import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseStats, getDbPool } from '../../../lib/db-pool'
import { withErrorHandler, throwDatabaseError } from '../../../lib/error-handler'
import { withRateLimit } from '../../../lib/rate-limiter'
import { retryDatabaseOperation } from '../../../lib/retry-utils'

async function handleDatabaseStatus(request: NextRequest): Promise<NextResponse> {
  // Get database and pool statistics with retry
  const stats = await retryDatabaseOperation(
    () => getDatabaseStats(),
    'getDatabaseStats'
  )
  
  const pool = getDbPool()
  const poolStats = pool.getStats()
  
  // Calculate some additional metrics
  const totalTransactions = stats.database.total_transactions
  const uniqueAddresses = stats.database.unique_addresses
  const avgTransactionsPerAddress = totalTransactions > 0 ? 
    Math.round(totalTransactions / uniqueAddresses * 100) / 100 : 0
  
  // Convert timestamps to readable dates
  const earliestDate = stats.database.earliest_transaction ? 
    new Date(stats.database.earliest_transaction * 1000).toISOString() : null
  const latestDate = stats.database.latest_transaction ? 
    new Date(stats.database.latest_transaction * 1000).toISOString() : null
  
  return NextResponse.json({
    status: 'healthy',
    database: {
      totalTransactions,
      uniqueAddresses,
      uniqueSignatures: stats.database.unique_signatures,
      avgTransactionsPerAddress,
      dateRange: {
        earliest: earliestDate,
        latest: latestDate
      }
    },
    connectionPool: {
      totalConnections: poolStats.totalConnections,
      availableConnections: poolStats.availableConnections,
      busyConnections: poolStats.busyConnections,
      utilizationPercent: Math.round((poolStats.busyConnections / poolStats.totalConnections) * 100),
      initialized: poolStats.initialized
    },
    performance: {
      poolEfficiency: poolStats.totalConnections > 0 ? 
        Math.round((poolStats.availableConnections / poolStats.totalConnections) * 100) : 0,
      status: poolStats.busyConnections === poolStats.totalConnections ? 'high_load' : 'normal'
    },
    timestamp: new Date().toISOString()
  })
}

export const GET = withRateLimit(withErrorHandler(handleDatabaseStatus))