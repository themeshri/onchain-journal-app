import { RETRY_CONFIG, calculateRetryDelay, isRetryableError } from './error-config'
import { throwExternalApiError, throwDatabaseError } from './error-handler'

export interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  shouldRetry?: (error: Error, attempt: number) => boolean
  onRetry?: (error: Error, attempt: number, delay: number) => void
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
  operationType: 'externalApi' | 'database' | 'rpc' = 'externalApi'
): Promise<T> {
  const config = RETRY_CONFIG[operationType]
  const {
    maxRetries = config.maxRetries,
    baseDelay = config.baseDelay,
    maxDelay = config.maxDelay,
    backoffMultiplier = config.backoffMultiplier,
    shouldRetry = isRetryableError,
    onRetry
  } = options

  let lastError: Error = new Error('No attempts made')

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Don't retry if this is the last attempt
      if (attempt === maxRetries) {
        break
      }
      
      // Check if error is retryable
      if (!shouldRetry(lastError, attempt)) {
        break
      }
      
      // Calculate delay for next attempt
      const delay = calculateRetryDelay(attempt, {
        baseDelay,
        maxDelay,
        backoffMultiplier,
        maxRetries
      })
      
      // Call retry callback if provided
      if (onRetry) {
        onRetry(lastError, attempt + 1, delay)
      }
      
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms for error: ${lastError.message}`)
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  // All retries exhausted, throw the last error
  throw lastError
}

export async function retryExternalApiCall<T>(
  apiCall: () => Promise<T>,
  apiName: string,
  options: RetryOptions = {}
): Promise<T> {
  return withRetry(
    apiCall,
    {
      ...options,
      onRetry: (error, attempt, delay) => {
        console.log(`${apiName} API call failed (attempt ${attempt}), retrying in ${delay}ms: ${error.message}`)
        options.onRetry?.(error, attempt, delay)
      }
    },
    'externalApi'
  )
}

export async function retryDatabaseOperation<T>(
  dbOperation: () => Promise<T>,
  operationName: string,
  options: RetryOptions = {}
): Promise<T> {
  return withRetry(
    dbOperation,
    {
      ...options,
      onRetry: (error, attempt, delay) => {
        console.log(`Database operation '${operationName}' failed (attempt ${attempt}), retrying in ${delay}ms: ${error.message}`)
        options.onRetry?.(error, attempt, delay)
      }
    },
    'database'
  )
}

export async function retryRpcCall<T>(
  rpcCall: () => Promise<T>,
  endpoint: string,
  options: RetryOptions = {}
): Promise<T> {
  return withRetry(
    rpcCall,
    {
      ...options,
      onRetry: (error, attempt, delay) => {
        console.log(`RPC call to ${endpoint} failed (attempt ${attempt}), retrying in ${delay}ms: ${error.message}`)
        options.onRetry?.(error, attempt, delay)
      }
    },
    'rpc'
  )
}

export class CircuitBreaker {
  private failures: number = 0
  private lastFailureTime: number = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  
  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000, // 1 minute
    private successThreshold: number = 2
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.recoveryTimeout) {
        throw new Error('Circuit breaker is OPEN')
      } else {
        this.state = 'HALF_OPEN'
      }
    }
    
    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }
  
  private onSuccess(): void {
    this.failures = 0
    this.state = 'CLOSED'
  }
  
  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN'
    }
  }
  
  getState(): string {
    return this.state
  }
  
  getFailureCount(): number {
    return this.failures
  }
  
  reset(): void {
    this.failures = 0
    this.state = 'CLOSED'
    this.lastFailureTime = 0
  }
}

// Global circuit breakers for different services
export const heliusCircuitBreaker = new CircuitBreaker(3, 30000, 1) // 3 failures, 30s timeout
export const solscanCircuitBreaker = new CircuitBreaker(3, 30000, 1)
export const jupiterCircuitBreaker = new CircuitBreaker(5, 60000, 2) // More lenient for Jupiter
export const databaseCircuitBreaker = new CircuitBreaker(2, 10000, 1) // Strict for DB

export async function withCircuitBreaker<T>(
  operation: () => Promise<T>,
  circuitBreaker: CircuitBreaker,
  serviceName: string
): Promise<T> {
  try {
    return await circuitBreaker.execute(operation)
  } catch (error) {
    if (error instanceof Error && error.message === 'Circuit breaker is OPEN') {
      throw new Error(`${serviceName} service is temporarily unavailable (circuit breaker open)`)
    }
    throw error
  }
}

export interface TimeoutOptions {
  timeout: number
  timeoutMessage?: string
}

export async function withTimeout<T>(
  operation: () => Promise<T>,
  options: TimeoutOptions
): Promise<T> {
  const { timeout, timeoutMessage = `Operation timed out after ${timeout}ms` } = options
  
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, timeout)
    
    operation()
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeoutId))
  })
}