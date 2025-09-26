import { NextRequest } from 'next/server'
import { RATE_LIMIT_CONFIG } from './error-config'
import { throwRateLimitError } from './error-handler'

interface RateLimitEntry {
  count: number
  resetTime: number
}

class InMemoryRateLimiter {
  private store: Map<string, RateLimitEntry> = new Map()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.resetTime) {
        this.store.delete(key)
      }
    }
  }

  private getKey(identifier: string, endpoint: string): string {
    return `${identifier}:${endpoint}`
  }

  public checkLimit(
    identifier: string, 
    endpoint: string, 
    limit: number, 
    windowMs: number = 60000
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const key = this.getKey(identifier, endpoint)
    const now = Date.now()
    const resetTime = now + windowMs

    let entry = this.store.get(key)

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired entry
      entry = { count: 1, resetTime }
      this.store.set(key, entry)
      return { allowed: true, remaining: limit - 1, resetTime }
    }

    entry.count++
    
    if (entry.count > limit) {
      return { allowed: false, remaining: 0, resetTime: entry.resetTime }
    }

    return { allowed: true, remaining: limit - entry.count, resetTime: entry.resetTime }
  }

  public reset(identifier: string, endpoint: string): void {
    const key = this.getKey(identifier, endpoint)
    this.store.delete(key)
  }

  public getStatus(identifier: string, endpoint: string): RateLimitEntry | null {
    const key = this.getKey(identifier, endpoint)
    return this.store.get(key) || null
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.store.clear()
  }
}

// Global rate limiter instance
const rateLimiter = new InMemoryRateLimiter()

export function getClientIdentifier(request: NextRequest): string {
  // Try to get client IP
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             request.headers.get('cf-connecting-ip') ||
             'unknown'
  
  // Extract first IP if there are multiple
  const clientIp = ip.split(',')[0].trim()
  
  // For development, use a fallback identifier
  return clientIp === '::1' || clientIp === '127.0.0.1' || clientIp === 'unknown' 
    ? 'dev-client' 
    : clientIp
}

export function getEndpointFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    
    // Normalize API endpoints
    if (pathname.startsWith('/api/')) {
      return pathname
    }
    
    return pathname
  } catch {
    return '/unknown'
  }
}

export function applyRateLimit(request: NextRequest): void {
  const identifier = getClientIdentifier(request)
  const endpoint = getEndpointFromUrl(request.url)
  
  // Get rate limit for this endpoint
  const endpointLimit = RATE_LIMIT_CONFIG[endpoint as keyof typeof RATE_LIMIT_CONFIG]
  const limit = endpointLimit || RATE_LIMIT_CONFIG.global
  
  // Check rate limit
  const result = rateLimiter.checkLimit(identifier, endpoint, limit)
  
  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000)
    throwRateLimitError(`Rate limit exceeded for ${endpoint}`, retryAfter)
  }
  
  // Add rate limit headers to response (this would be added in the response)
  console.log(`Rate limit for ${identifier} on ${endpoint}: ${result.remaining}/${limit} remaining`)
}

export function withRateLimit<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    applyRateLimit(request)
    const response = await handler(request, ...args)
    
    // Add rate limit headers
    const identifier = getClientIdentifier(request)
    const endpoint = getEndpointFromUrl(request.url)
    const endpointLimit = RATE_LIMIT_CONFIG[endpoint as keyof typeof RATE_LIMIT_CONFIG]
    const limit = endpointLimit || RATE_LIMIT_CONFIG.global
    const status = rateLimiter.getStatus(identifier, endpoint)
    
    if (status) {
      const remaining = Math.max(0, limit - status.count)
      const resetTime = Math.ceil((status.resetTime - Date.now()) / 1000)
      
      response.headers.set('X-RateLimit-Limit', limit.toString())
      response.headers.set('X-RateLimit-Remaining', remaining.toString())
      response.headers.set('X-RateLimit-Reset', resetTime.toString())
    }
    
    return response
  }
}

export function getRateLimitStatus(request: NextRequest): {
  limit: number
  remaining: number
  resetTime: number
} {
  const identifier = getClientIdentifier(request)
  const endpoint = getEndpointFromUrl(request.url)
  const endpointLimit = RATE_LIMIT_CONFIG[endpoint as keyof typeof RATE_LIMIT_CONFIG]
  const limit = endpointLimit || RATE_LIMIT_CONFIG.global
  const status = rateLimiter.getStatus(identifier, endpoint)
  
  if (!status) {
    return { limit, remaining: limit, resetTime: Date.now() + 60000 }
  }
  
  const remaining = Math.max(0, limit - status.count)
  return { limit, remaining, resetTime: status.resetTime }
}

// Export the rate limiter instance for testing
export { rateLimiter }