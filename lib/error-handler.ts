import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'

export interface ErrorContext {
  method: string
  url: string
  timestamp: string
  userAgent?: string
  ip?: string
}

export interface ApiError {
  type: 'VALIDATION_ERROR' | 'DATABASE_ERROR' | 'EXTERNAL_API_ERROR' | 'AUTHORIZATION_ERROR' | 'RATE_LIMIT_ERROR' | 'INTERNAL_ERROR'
  message: string
  code: string
  statusCode: number
  details?: any
  context?: ErrorContext
}

export class AppError extends Error {
  public readonly type: string
  public readonly statusCode: number
  public readonly code: string
  public readonly details?: any
  public readonly context?: ErrorContext

  constructor(
    type: ApiError['type'], 
    message: string, 
    statusCode: number = 500, 
    code: string = 'UNKNOWN_ERROR',
    details?: any,
    context?: ErrorContext
  ) {
    super(message)
    this.name = 'AppError'
    this.type = type
    this.statusCode = statusCode
    this.code = code
    this.details = details
    this.context = context
  }
}

export function createErrorContext(request: NextRequest): ErrorContext {
  return {
    method: request.method,
    url: request.url,
    timestamp: new Date().toISOString(),
    userAgent: request.headers.get('user-agent') || undefined,
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
  }
}

export function handleValidationError(error: ZodError, context?: ErrorContext): ApiError {
  return {
    type: 'VALIDATION_ERROR',
    message: 'Invalid request parameters',
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    details: error.issues.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      received: err.code === 'invalid_type' ? `${typeof (err as any).received}` : undefined
    })),
    context
  }
}

export function handleDatabaseError(error: Error, context?: ErrorContext): ApiError {
  const isDatabaseError = error.message.includes('SQLITE_') || 
                         error.message.includes('database') ||
                         error.message.includes('no such table') ||
                         error.message.includes('syntax error')

  return {
    type: 'DATABASE_ERROR',
    message: isDatabaseError ? 'Database operation failed' : 'Internal server error',
    code: isDatabaseError ? 'DATABASE_ERROR' : 'INTERNAL_ERROR',
    statusCode: 500,
    details: isDatabaseError ? {
      operation: 'database_query',
      error: error.message
    } : undefined,
    context
  }
}

export function handleExternalApiError(error: Error, apiName: string, context?: ErrorContext): ApiError {
  const isTimeoutError = error.message.includes('timeout') || error.message.includes('ETIMEDOUT')
  const isNetworkError = error.message.includes('network') || error.message.includes('ENOTFOUND')
  const isRateLimitError = error.message.includes('rate limit') || error.message.includes('429')

  if (isRateLimitError) {
    return {
      type: 'RATE_LIMIT_ERROR',
      message: `Rate limit exceeded for ${apiName}`,
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      details: { apiName, retryAfter: 60 },
      context
    }
  }

  return {
    type: 'EXTERNAL_API_ERROR',
    message: `External API error: ${apiName}`,
    code: isTimeoutError ? 'API_TIMEOUT' : isNetworkError ? 'API_NETWORK_ERROR' : 'API_ERROR',
    statusCode: 502,
    details: {
      apiName,
      errorType: isTimeoutError ? 'timeout' : isNetworkError ? 'network' : 'unknown',
      message: error.message
    },
    context
  }
}

export function handleAuthorizationError(message: string, context?: ErrorContext): ApiError {
  return {
    type: 'AUTHORIZATION_ERROR',
    message,
    code: 'UNAUTHORIZED',
    statusCode: 401,
    context
  }
}

export function handleInternalError(error: Error, context?: ErrorContext): ApiError {
  console.error('Internal error:', error)
  
  return {
    type: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    code: 'INTERNAL_SERVER_ERROR',
    statusCode: 500,
    details: process.env.NODE_ENV === 'development' ? {
      stack: error.stack,
      message: error.message
    } : undefined,
    context
  }
}

export function formatErrorResponse(apiError: ApiError): NextResponse {
  const response = {
    error: apiError.message,
    code: apiError.code,
    type: apiError.type,
    timestamp: apiError.context?.timestamp || new Date().toISOString(),
    ...(apiError.details && { details: apiError.details })
  }

  return NextResponse.json(response, { status: apiError.statusCode })
}

export function withErrorHandler<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const context = createErrorContext(request)
    
    try {
      return await handler(request, ...args)
    } catch (error) {
      console.error('API Error:', error)
      
      let apiError: ApiError

      if (error instanceof AppError) {
        apiError = {
          type: error.type as ApiError['type'],
          message: error.message,
          code: error.code,
          statusCode: error.statusCode,
          details: error.details,
          context: error.context || context
        }
      } else if (error instanceof ZodError) {
        apiError = handleValidationError(error, context)
      } else if (error instanceof Error) {
        // Determine error type based on message content
        if (error.message.includes('Helius') || error.message.includes('Solscan') || error.message.includes('Jupiter')) {
          const apiName = error.message.includes('Helius') ? 'Helius' : 
                         error.message.includes('Solscan') ? 'Solscan' : 'Jupiter'
          apiError = handleExternalApiError(error, apiName, context)
        } else if (error.message.includes('SQLITE_') || error.message.includes('database')) {
          apiError = handleDatabaseError(error, context)
        } else if (error.message.includes('API key') || error.message.includes('unauthorized')) {
          apiError = handleAuthorizationError(error.message, context)
        } else {
          apiError = handleInternalError(error, context)
        }
      } else {
        apiError = handleInternalError(new Error('Unknown error'), context)
      }

      return formatErrorResponse(apiError)
    }
  }
}

export class ErrorLogger {
  static log(error: ApiError): void {
    const logEntry = {
      timestamp: error.context?.timestamp || new Date().toISOString(),
      type: error.type,
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      method: error.context?.method,
      url: error.context?.url,
      userAgent: error.context?.userAgent,
      ip: error.context?.ip,
      details: error.details
    }

    if (error.statusCode >= 500) {
      console.error('Server Error:', JSON.stringify(logEntry, null, 2))
    } else if (error.statusCode >= 400) {
      console.warn('Client Error:', JSON.stringify(logEntry, null, 2))
    } else {
      console.info('Error Log:', JSON.stringify(logEntry, null, 2))
    }
  }
}

export interface ValidationErrorDetails {
  field: string
  message: string
  received?: string
}

export function throwValidationError(message: string, details?: ValidationErrorDetails[], context?: ErrorContext): never {
  throw new AppError('VALIDATION_ERROR', message, 400, 'VALIDATION_FAILED', details, context)
}

export function throwDatabaseError(message: string, operation?: string, context?: ErrorContext): never {
  throw new AppError('DATABASE_ERROR', message, 500, 'DATABASE_ERROR', { operation }, context)
}

export function throwExternalApiError(apiName: string, message: string, context?: ErrorContext): never {
  throw new AppError('EXTERNAL_API_ERROR', `${apiName} API error: ${message}`, 502, 'EXTERNAL_API_ERROR', { apiName }, context)
}

export function throwAuthorizationError(message: string, context?: ErrorContext): never {
  throw new AppError('AUTHORIZATION_ERROR', message, 401, 'UNAUTHORIZED', undefined, context)
}

export function throwRateLimitError(apiName: string, retryAfter: number = 60, context?: ErrorContext): never {
  throw new AppError('RATE_LIMIT_ERROR', `Rate limit exceeded for ${apiName}`, 429, 'RATE_LIMIT_EXCEEDED', { apiName, retryAfter }, context)
}