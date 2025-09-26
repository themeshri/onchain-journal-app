import Database from 'better-sqlite3'
import { TransactionSchema, validateBody } from './validation'
import { withDbPerformanceMonitoring, withAsyncDbPerformanceMonitoring } from './performance'
import path from 'path'

// Database configuration
interface DbConfig {
  filename: string
  options: Database.Options
  poolSize: number
  maxRetries: number
  retryDelay: number
}

// Default configuration
const DEFAULT_CONFIG: DbConfig = {
  filename: path.join(process.cwd(), 'transactions.db'),
  options: {
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
    fileMustExist: false,
    timeout: 5000,
    readonly: false
  },
  poolSize: 5, // Number of connections in pool
  maxRetries: 3,
  retryDelay: 100 // ms
}

// Connection pool class
class DatabasePool {
  private pool: Database.Database[] = []
  private available: boolean[] = []
  private config: DbConfig
  private initialized = false

  constructor(config: Partial<DbConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // Initialize the connection pool
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Create pool connections
      for (let i = 0; i < this.config.poolSize; i++) {
        const db = new Database(this.config.filename, this.config.options)
        
        // Configure database settings for better performance
        db.pragma('journal_mode = WAL') // Write-Ahead Logging for better concurrency
        db.pragma('synchronous = NORMAL') // Balance between safety and performance
        db.pragma('cache_size = 10000') // Increase cache size
        db.pragma('temp_store = MEMORY') // Store temp tables in memory
        db.pragma('mmap_size = 268435456') // 256MB memory map
        db.pragma('optimize') // Optimize database
        
        this.pool.push(db)
        this.available.push(true)
      }

      // Initialize schema on the first connection
      this.initializeSchema()
      
      this.initialized = true
      console.log(`Database pool initialized with ${this.config.poolSize} connections`)
    } catch (error) {
      console.error('Failed to initialize database pool:', error)
      throw error
    }
  }

  // Initialize database schema
  private initializeSchema(): void {
    if (this.pool.length === 0) {
      throw new Error('No database connections available for schema initialization')
    }
    
    // Use the first connection directly to avoid recursion
    const db = this.pool[0]
    
    try {
      // Create transactions table with optimized schema
      db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          signature TEXT NOT NULL,
          address TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          block_time INTEGER NOT NULL DEFAULT 0,
          slot INTEGER NOT NULL DEFAULT 0,
          type TEXT DEFAULT '',
          action TEXT DEFAULT '',
          description TEXT DEFAULT '',
          status TEXT DEFAULT 'Unknown',
          fee INTEGER DEFAULT 0,
          from_token TEXT,
          to_token TEXT,
          from_amount REAL DEFAULT 0,
          to_amount REAL DEFAULT 0,
          from_symbol TEXT DEFAULT '',
          to_symbol TEXT DEFAULT '',
          from_value_usd REAL DEFAULT 0,
          to_value_usd REAL DEFAULT 0,
          source TEXT DEFAULT 'Unknown',
          platform TEXT DEFAULT 'Solana',
          value REAL DEFAULT 0,
          traded_coin TEXT DEFAULT '',
          traded_coin_mint TEXT,
          is_buy INTEGER DEFAULT 0,
          is_sell INTEGER DEFAULT 0,
          transaction_type TEXT,
          notes TEXT DEFAULT '',
          tags TEXT DEFAULT '',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          
          -- Unique constraint for transaction splitting
          UNIQUE(signature, transaction_type)
        )
      `)

      // Create optimized indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_transactions_address ON transactions(address);
        CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_transactions_signature ON transactions(signature);
        CREATE INDEX IF NOT EXISTS idx_transactions_address_timestamp ON transactions(address, timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
        CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
        CREATE INDEX IF NOT EXISTS idx_transactions_slot ON transactions(slot DESC);
      `)

      // Create trigger for updated_at
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_transactions_timestamp 
        AFTER UPDATE ON transactions
        BEGIN
          UPDATE transactions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
      `)

      console.log('Database schema initialized successfully')
    } catch (error) {
      console.error('Failed to initialize schema:', error)
      throw error
    }
  }

  // Get an available connection from the pool
  async getConnection(): Promise<Database.Database> {
    if (!this.initialized) {
      await this.initialize()
    }

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      // Look for available connection
      for (let i = 0; i < this.pool.length; i++) {
        if (this.available[i]) {
          this.available[i] = false
          return this.pool[i]
        }
      }

      // If no connection available, wait and retry
      if (attempt < this.config.maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay))
      }
    }

    throw new Error('No database connections available after retries')
  }

  // Release a connection back to the pool
  releaseConnection(db: Database.Database): void {
    const index = this.pool.indexOf(db)
    if (index !== -1) {
      this.available[index] = true
    }
  }

  // Execute a function with automatic connection management
  async withConnection<T>(fn: (db: Database.Database) => T): Promise<T> {
    const db = await this.getConnection()
    try {
      return fn(db)
    } finally {
      this.releaseConnection(db)
    }
  }

  // Execute a transaction with automatic rollback on error
  async withTransaction<T>(fn: (db: Database.Database) => T): Promise<T> {
    const db = await this.getConnection()
    const transaction = db.transaction(() => fn(db))
    
    try {
      const result = transaction()
      this.releaseConnection(db)
      return result
    } catch (error) {
      this.releaseConnection(db)
      throw error
    }
  }

  // Close all connections in the pool
  async close(): Promise<void> {
    for (const db of this.pool) {
      try {
        db.close()
      } catch (error) {
        console.error('Error closing database connection:', error)
      }
    }
    this.pool = []
    this.available = []
    this.initialized = false
    console.log('Database pool closed')
  }

  // Get pool statistics
  getStats() {
    const availableCount = this.available.filter(Boolean).length
    return {
      totalConnections: this.pool.length,
      availableConnections: availableCount,
      busyConnections: this.pool.length - availableCount,
      initialized: this.initialized
    }
  }
}

// Global pool instance
let dbPool: DatabasePool | null = null

// Get or create the database pool
export function getDbPool(): DatabasePool {
  if (!dbPool) {
    dbPool = new DatabasePool()
  }
  return dbPool
}

// Initialize database (for backward compatibility)
export async function initDatabase(): Promise<void> {
  const pool = getDbPool()
  await pool.initialize()
}

// Insert multiple transactions with connection pooling
export async function insertTransactions(transactions: any[]): Promise<void> {
  return withAsyncDbPerformanceMonitoring('insertTransactions', async () => {
  // Validate input transactions
  try {
    const validation = validateBody(TransactionSchema.array(), transactions)
    
    if (!validation.success) {
      console.error('Transaction validation failed:', validation.details)
      throw new Error(`Invalid transaction data: ${validation.error}`)
    }
  } catch (error) {
    console.warn('Transaction validation skipped due to error:', error)
    // Continue with unvalidated data for now to maintain compatibility
  }

  const pool = getDbPool()
  
  await pool.withTransaction((db) => {
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO transactions (
        signature, address, timestamp, block_time, slot, type, action, description,
        status, fee, from_token, to_token, from_amount, to_amount,
        from_symbol, to_symbol, from_value_usd, to_value_usd, source, platform,
        value, traded_coin, traded_coin_mint, is_buy, is_sell, transaction_type,
        notes, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const tx of transactions) {
      try {
        insertStmt.run(
          tx.signature,
          tx.address,
          tx.timestamp,
          tx.timestamp, // block_time
          tx.slot || 0,
          tx.type || 'UNKNOWN',
          tx.action || '',
          tx.description || '',
          tx.status || 'Unknown',
          tx.fee || 0,
          tx.fromToken || null,
          tx.toToken || null,
          tx.fromAmount || 0,
          tx.toAmount || 0,
          tx.fromSymbol || '',
          tx.toSymbol || '',
          tx.fromValueUSD || 0,
          tx.toValueUSD || 0,
          tx.source || 'Unknown',
          tx.platform || 'Solana',
          tx.value || 0,
          tx.tradedCoin || '',
          tx.tradedCoinMint || null,
          tx.isBuy ? 1 : 0,
          tx.isSell ? 1 : 0,
          tx.transaction_type || tx.transactionType || null,
          tx.notes || '',
          tx.tags || ''
        )
      } catch (error: any) {
        if (error.code !== 'SQLITE_CONSTRAINT_UNIQUE') {
          console.error('Error inserting transaction:', error)
        }
        // Continue with other transactions even if one fails
      }
    }
  })

  console.log(`Inserted/updated ${transactions.length} transactions`)
  })
}

// Get stored transactions for an address
export async function getStoredTransactions(address: string, limit = 100): Promise<any[]> {
  return withAsyncDbPerformanceMonitoring('getStoredTransactions', async () => {
    const pool = getDbPool()
    
    return pool.withConnection((db) => {
      const stmt = db.prepare(`
        SELECT * FROM transactions 
        WHERE address = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `)
      
      return stmt.all(address, limit)
    })
  })
}

// Get last transaction for an address
export async function getLastTransaction(address: string): Promise<any | null> {
  const pool = getDbPool()
  
  return pool.withConnection((db) => {
    const stmt = db.prepare(`
      SELECT * FROM transactions 
      WHERE address = ? 
      ORDER BY slot DESC 
      LIMIT 1
    `)
    
    return stmt.get(address) || null
  })
}

// Get transactions by date range
export async function getTransactionsByDateRange(
  address: string, 
  startDate: number, 
  endDate: number
): Promise<any[]> {
  const pool = getDbPool()
  
  return pool.withConnection((db) => {
    const stmt = db.prepare(`
      SELECT * FROM transactions 
      WHERE address = ? AND timestamp BETWEEN ? AND ?
      ORDER BY timestamp DESC
    `)
    
    return stmt.all(address, startDate, endDate)
  })
}

// Get transaction count for an address
export async function getTransactionCount(address: string): Promise<number> {
  const pool = getDbPool()
  
  return pool.withConnection((db) => {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM transactions WHERE address = ?
    `)
    
    const result = stmt.get(address) as any
    return result?.count || 0
  })
}

// Get database statistics
export async function getDatabaseStats(): Promise<any> {
  const pool = getDbPool()
  
  return pool.withConnection((db) => {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(DISTINCT address) as unique_addresses,
        COUNT(DISTINCT signature) as unique_signatures,
        MIN(timestamp) as earliest_transaction,
        MAX(timestamp) as latest_transaction
      FROM transactions
    `).get()

    const poolStats = pool.getStats()
    
    return {
      database: stats,
      pool: poolStats
    }
  })
}

// Clean up old transactions (optional maintenance function)
export async function cleanupOldTransactions(daysOld = 90): Promise<number> {
  const pool = getDbPool()
  const cutoffDate = Math.floor(Date.now() / 1000) - (daysOld * 24 * 60 * 60)
  
  return pool.withConnection((db) => {
    const stmt = db.prepare(`
      DELETE FROM transactions WHERE timestamp < ?
    `)
    
    const result = stmt.run(cutoffDate)
    console.log(`Cleaned up ${result.changes} old transactions`)
    return result.changes || 0
  })
}

// Optimize database (maintenance function)
export async function optimizeDatabase(): Promise<void> {
  const pool = getDbPool()
  
  await pool.withConnection((db) => {
    db.pragma('optimize')
    db.exec('VACUUM')
    db.exec('ANALYZE')
    console.log('Database optimized')
  })
}

// Export types for external use
export type { Database } from 'better-sqlite3'
export { DatabasePool }

// Graceful shutdown handler
process.on('SIGINT', async () => {
  if (dbPool) {
    console.log('Closing database pool...')
    await dbPool.close()
  }
  process.exit(0)
})

process.on('SIGTERM', async () => {
  if (dbPool) {
    console.log('Closing database pool...')
    await dbPool.close()
  }
  process.exit(0)
})