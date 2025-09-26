import { NextRequest, NextResponse } from 'next/server'
import { performanceMonitor, getPerformanceHealth } from '../../../lib/performance'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const operation = searchParams.get('operation')
    const type = searchParams.get('type') || 'stats'
    
    switch (type) {
      case 'stats':
        const stats = performanceMonitor.getStats(operation || undefined)
        return NextResponse.json({
          success: true,
          data: stats,
          timestamp: new Date().toISOString()
        })
        
      case 'operations':
        const operations = performanceMonitor.getOperationTypes()
        return NextResponse.json({
          success: true,
          data: {
            operations,
            count: operations.length
          },
          timestamp: new Date().toISOString()
        })
        
      case 'slow':
        const threshold = parseInt(searchParams.get('threshold') || '1000', 10)
        const slowOps = performanceMonitor.getSlowOperations(threshold)
        return NextResponse.json({
          success: true,
          data: {
            threshold,
            slowOperations: slowOps,
            count: slowOps.length
          },
          timestamp: new Date().toISOString()
        })
        
      case 'health':
        const health = getPerformanceHealth()
        return NextResponse.json({
          success: true,
          data: health,
          timestamp: new Date().toISOString()
        })
        
      default:
        return NextResponse.json({
          error: 'Invalid type parameter',
          availableTypes: ['stats', 'operations', 'slow', 'health'],
          examples: [
            'GET /api/performance?type=stats',
            'GET /api/performance?type=stats&operation=db_insertTransactions',
            'GET /api/performance?type=operations',
            'GET /api/performance?type=slow&threshold=2000',
            'GET /api/performance?type=health'
          ]
        }, { status: 400 })
    }
    
  } catch (error: any) {
    console.error('Error getting performance data:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get performance data',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// POST endpoint to clear metrics (for testing/maintenance)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { action } = body
    
    if (action === 'clear') {
      performanceMonitor.clear()
      return NextResponse.json({
        success: true,
        message: 'Performance metrics cleared',
        timestamp: new Date().toISOString()
      })
    }
    
    return NextResponse.json({
      error: 'Invalid action',
      availableActions: ['clear'],
      example: 'POST /api/performance with {"action": "clear"}'
    }, { status: 400 })
    
  } catch (error: any) {
    console.error('Error processing performance action:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to process performance action',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}