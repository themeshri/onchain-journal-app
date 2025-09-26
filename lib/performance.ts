// Performance monitoring utilities for database operations

interface PerformanceMetric {
  operation: string
  duration: number
  timestamp: number
  success: boolean
  error?: string
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private maxMetrics = 1000 // Keep last 1000 metrics

  // Start timing an operation
  startTiming(operation: string): (success?: boolean, error?: string) => void {
    const startTime = Date.now()
    const startTimestamp = Date.now()

    return (success = true, error?: string) => {
      const duration = Date.now() - startTime
      this.addMetric({
        operation,
        duration,
        timestamp: startTimestamp,
        success,
        error
      })
    }
  }

  // Add a metric manually
  addMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric)
    
    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  // Get performance statistics
  getStats(operation?: string): any {
    const filteredMetrics = operation 
      ? this.metrics.filter(m => m.operation === operation)
      : this.metrics

    if (filteredMetrics.length === 0) {
      return { operation, count: 0, message: 'No metrics available' }
    }

    const durations = filteredMetrics.map(m => m.duration)
    const successCount = filteredMetrics.filter(m => m.success).length
    const errorCount = filteredMetrics.length - successCount

    return {
      operation: operation || 'all_operations',
      count: filteredMetrics.length,
      successRate: Math.round((successCount / filteredMetrics.length) * 100),
      errorCount,
      performance: {
        avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        medianDuration: this.calculateMedian(durations)
      },
      recentErrors: filteredMetrics
        .filter(m => !m.success && m.error)
        .slice(-5)
        .map(m => ({ operation: m.operation, error: m.error, timestamp: m.timestamp }))
    }
  }

  // Get all operation types
  getOperationTypes(): string[] {
    const operations = new Set(this.metrics.map(m => m.operation))
    return Array.from(operations).sort()
  }

  // Clear metrics (useful for testing or reset)
  clear(): void {
    this.metrics = []
  }

  // Get recent slow operations
  getSlowOperations(thresholdMs = 1000): PerformanceMetric[] {
    return this.metrics
      .filter(m => m.duration > thresholdMs)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
  }

  private calculateMedian(numbers: number[]): number {
    const sorted = [...numbers].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    
    return sorted.length % 2 !== 0 
      ? sorted[mid] 
      : (sorted[mid - 1] + sorted[mid]) / 2
  }
}

// Global performance monitor instance
const performanceMonitor = new PerformanceMonitor()

// Decorator function for automatic performance monitoring
export function withPerformanceMonitoring<T extends (...args: any[]) => Promise<any>>(
  operation: string,
  fn: T
): T {
  return (async (...args: any[]) => {
    const endTiming = performanceMonitor.startTiming(operation)
    
    try {
      const result = await fn(...args)
      endTiming()
      return result
    } catch (error) {
      endTiming(false, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }) as T
}

// Database operation wrapper with automatic monitoring
export function withDbPerformanceMonitoring<T>(
  operation: string,
  fn: () => T
): T {
  const endTiming = performanceMonitor.startTiming(`db_${operation}`)
  
  try {
    const result = fn()
    endTiming(true)
    return result
  } catch (error) {
    endTiming(false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  }
}

// Async database operation wrapper
export async function withAsyncDbPerformanceMonitoring<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const endTiming = performanceMonitor.startTiming(`db_${operation}`)
  
  try {
    const result = await fn()
    endTiming(true)
    return result
  } catch (error) {
    endTiming(false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  }
}

// Export the performance monitor instance
export { performanceMonitor, PerformanceMonitor }
export type { PerformanceMetric }

// Performance monitoring middleware for API routes
export function createPerformanceMiddleware(operation: string) {
  return function performanceMiddleware<T extends (...args: any[]) => Promise<any>>(
    handler: T
  ): T {
    return withPerformanceMonitoring(operation, handler)
  }
}

// Health check function
export function getPerformanceHealth(): {
  status: 'healthy' | 'warning' | 'critical'
  metrics: any
  issues: string[]
} {
  const stats = performanceMonitor.getStats()
  const slowOps = performanceMonitor.getSlowOperations(2000) // 2 second threshold
  
  const issues: string[] = []
  let status: 'healthy' | 'warning' | 'critical' = 'healthy'
  
  // Check for performance issues
  if (stats.performance?.avgDuration > 1000) {
    issues.push(`Average response time is high: ${stats.performance.avgDuration}ms`)
    status = 'warning'
  }
  
  if (stats.performance?.maxDuration > 5000) {
    issues.push(`Maximum response time is very high: ${stats.performance.maxDuration}ms`)
    status = 'critical'
  }
  
  if (stats.successRate < 95) {
    issues.push(`Success rate is low: ${stats.successRate}%`)
    status = status === 'critical' ? 'critical' : 'warning'
  }
  
  if (slowOps.length > 5) {
    issues.push(`High number of slow operations: ${slowOps.length}`)
    status = status === 'critical' ? 'critical' : 'warning'
  }
  
  return {
    status,
    metrics: stats,
    issues
  }
}

// Automatic cleanup of old metrics (run periodically)
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000)
  performanceMonitor['metrics'] = performanceMonitor['metrics'].filter(
    m => m.timestamp > oneHourAgo
  )
}, 10 * 60 * 1000) // Run every 10 minutes