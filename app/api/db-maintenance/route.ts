import { NextRequest, NextResponse } from 'next/server'
import { optimizeDatabase, cleanupOldTransactions, getDatabaseStats } from '../../../lib/db-pool'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { action, daysOld = 90 } = body
    
    let result: any = {}
    
    switch (action) {
      case 'optimize':
        await optimizeDatabase()
        result = { 
          message: 'Database optimized successfully',
          action: 'optimize'
        }
        break
        
      case 'cleanup':
        const deletedCount = await cleanupOldTransactions(daysOld)
        result = {
          message: `Cleaned up ${deletedCount} old transactions`,
          action: 'cleanup',
          deletedTransactions: deletedCount,
          daysOld
        }
        break
        
      case 'vacuum':
        await optimizeDatabase() // includes VACUUM
        result = {
          message: 'Database vacuumed and optimized',
          action: 'vacuum'
        }
        break
        
      case 'analyze':
        // Get fresh statistics after maintenance
        const stats = await getDatabaseStats()
        result = {
          message: 'Database analyzed',
          action: 'analyze',
          statistics: stats
        }
        break
        
      default:
        return NextResponse.json({
          error: 'Invalid action',
          availableActions: ['optimize', 'cleanup', 'vacuum', 'analyze'],
          message: 'Please specify a valid maintenance action'
        }, { status: 400 })
    }
    
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('Error during database maintenance:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Database maintenance failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// GET endpoint to show available maintenance operations
export async function GET(request: NextRequest) {
  return NextResponse.json({
    availableActions: [
      {
        action: 'optimize',
        description: 'Optimize database performance (PRAGMA optimize + VACUUM + ANALYZE)',
        method: 'POST',
        body: { action: 'optimize' }
      },
      {
        action: 'cleanup',
        description: 'Remove transactions older than specified days',
        method: 'POST',
        body: { action: 'cleanup', daysOld: 90 }
      },
      {
        action: 'vacuum',
        description: 'Reclaim unused space and defragment database',
        method: 'POST',
        body: { action: 'vacuum' }
      },
      {
        action: 'analyze',
        description: 'Update database statistics for query optimization',
        method: 'POST',
        body: { action: 'analyze' }
      }
    ],
    examples: [
      'POST /api/db-maintenance with {"action": "optimize"}',
      'POST /api/db-maintenance with {"action": "cleanup", "daysOld": 30}',
      'POST /api/db-maintenance with {"action": "vacuum"}',
      'POST /api/db-maintenance with {"action": "analyze"}'
    ]
  })
}