export const ERROR_CODES = {
  // Validation Errors (4xx)
  VALIDATION_FAILED: {
    message: 'Request validation failed',
    statusCode: 400,
    type: 'VALIDATION_ERROR' as const
  },
  INVALID_WALLET_ADDRESS: {
    message: 'Invalid Solana wallet address format',
    statusCode: 400,
    type: 'VALIDATION_ERROR' as const
  },
  INVALID_SIGNATURE: {
    message: 'Invalid transaction signature format',
    statusCode: 400,
    type: 'VALIDATION_ERROR' as const
  },
  MISSING_REQUIRED_FIELD: {
    message: 'Required field is missing',
    statusCode: 400,
    type: 'VALIDATION_ERROR' as const
  },

  // Authorization Errors (4xx)
  MISSING_API_KEY: {
    message: 'API key is required but not provided',
    statusCode: 401,
    type: 'AUTHORIZATION_ERROR' as const
  },
  INVALID_API_KEY: {
    message: 'Provided API key is invalid',
    statusCode: 401,
    type: 'AUTHORIZATION_ERROR' as const
  },

  // Rate Limiting (4xx)
  RATE_LIMIT_EXCEEDED: {
    message: 'Rate limit exceeded',
    statusCode: 429,
    type: 'RATE_LIMIT_ERROR' as const
  },

  // External API Errors (5xx)
  HELIUS_API_ERROR: {
    message: 'Helius API request failed',
    statusCode: 502,
    type: 'EXTERNAL_API_ERROR' as const
  },
  SOLSCAN_API_ERROR: {
    message: 'Solscan API request failed',
    statusCode: 502,
    type: 'EXTERNAL_API_ERROR' as const
  },
  JUPITER_API_ERROR: {
    message: 'Jupiter API request failed',
    statusCode: 502,
    type: 'EXTERNAL_API_ERROR' as const
  },
  RPC_ENDPOINT_FAILURE: {
    message: 'All RPC endpoints failed',
    statusCode: 502,
    type: 'EXTERNAL_API_ERROR' as const
  },

  // Database Errors (5xx)
  DATABASE_CONNECTION_ERROR: {
    message: 'Database connection failed',
    statusCode: 500,
    type: 'DATABASE_ERROR' as const
  },
  DATABASE_QUERY_ERROR: {
    message: 'Database query failed',
    statusCode: 500,
    type: 'DATABASE_ERROR' as const
  },
  DATABASE_POOL_EXHAUSTED: {
    message: 'Database connection pool exhausted',
    statusCode: 500,
    type: 'DATABASE_ERROR' as const
  },

  // Internal Errors (5xx)
  INTERNAL_SERVER_ERROR: {
    message: 'An unexpected error occurred',
    statusCode: 500,
    type: 'INTERNAL_ERROR' as const
  },
  CONFIGURATION_ERROR: {
    message: 'Server configuration error',
    statusCode: 500,
    type: 'INTERNAL_ERROR' as const
  }
} as const

export type ErrorCode = keyof typeof ERROR_CODES

export const RETRY_CONFIG = {
  // External API retry configuration
  externalApi: {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2
  },
  
  // Database retry configuration
  database: {
    maxRetries: 2,
    baseDelay: 500, // 500ms
    maxDelay: 2000, // 2 seconds
    backoffMultiplier: 2
  },
  
  // RPC endpoint retry configuration
  rpc: {
    maxRetries: 2,
    baseDelay: 1000, // 1 second
    maxDelay: 5000, // 5 seconds
    backoffMultiplier: 2
  }
}

export const TIMEOUT_CONFIG = {
  externalApi: 10000, // 10 seconds
  database: 5000, // 5 seconds
  rpc: 15000 // 15 seconds
}

export const RATE_LIMIT_CONFIG = {
  // Per-endpoint rate limits (requests per minute)
  '/api/helius-swaps': 60,
  '/api/solscan-swaps': 30,
  '/api/db-status': 120,
  '/api/db-maintenance': 10,
  '/api/performance': 60,
  
  // Global rate limit
  global: 200
}

export function getErrorConfig(code: ErrorCode) {
  return ERROR_CODES[code]
}

export function isRetryableError(error: Error): boolean {
  const retryablePatterns = [
    'timeout',
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'network',
    'temporary failure',
    'try again',
    'rate limit',
    'too many requests'
  ]
  
  return retryablePatterns.some(pattern => 
    error.message.toLowerCase().includes(pattern.toLowerCase())
  )
}

export function calculateRetryDelay(attempt: number, config: typeof RETRY_CONFIG.externalApi): number {
  const delay = Math.min(
    config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelay
  )
  
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay
  return Math.floor(delay + jitter)
}