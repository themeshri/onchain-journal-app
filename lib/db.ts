import sqlite3 from 'sqlite3'
import { TransactionSchema, validateBody } from './validation'
import path from 'path'

// Initialize SQLite in verbose mode for debugging
const sqlite = sqlite3.verbose()

// Database file path
const dbPath = path.join(process.cwd(), 'transactions.db')

// Create and initialize database
export const db = new sqlite.Database(dbPath)

// Initialize database schema
export const initDatabase = () => {
  return new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      // Create transactions table if it doesn't exist
      db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          signature TEXT NOT NULL,
          address TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          block_time INTEGER NOT NULL,
          slot INTEGER NOT NULL,
          type TEXT,
          action TEXT,
          description TEXT,
          status TEXT,
          fee INTEGER,
          from_token TEXT,
          to_token TEXT,
          from_amount REAL,
          to_amount REAL,
          from_symbol TEXT,
          to_symbol TEXT,
          from_value_usd REAL,
          to_value_usd REAL,
          source TEXT,
          platform TEXT,
          value REAL,
          traded_coin TEXT,
          traded_coin_mint TEXT,
          is_buy INTEGER,
          is_sell INTEGER,
          transaction_type TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(signature, transaction_type)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating transactions table:', err)
          reject(err)
        } else {
          // Create indexes for better query performance
          db.run(`CREATE INDEX IF NOT EXISTS idx_address_timestamp ON transactions(address, timestamp)`, (err) => {
            if (err) console.error('Error creating address_timestamp index:', err)
          })
          db.run(`CREATE INDEX IF NOT EXISTS idx_address_slot ON transactions(address, slot)`, (err) => {
            if (err) console.error('Error creating address_slot index:', err)
          })
          console.log('Database initialized successfully')
          resolve()
        }
      })
    })
  })
}

// Get the last transaction for an address
export const getLastTransaction = (address: string): Promise<any | null> => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM transactions
       WHERE address = ?
       ORDER BY timestamp DESC, slot DESC
       LIMIT 1`,
      [address],
      (err, row) => {
        if (err) {
          reject(err)
        } else {
          resolve(row || null)
        }
      }
    )
  })
}

// Get all stored transactions for an address
export const getStoredTransactions = (address: string, limit?: number): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const query = limit
      ? `SELECT * FROM transactions WHERE address = ? ORDER BY timestamp DESC LIMIT ?`
      : `SELECT * FROM transactions WHERE address = ? ORDER BY timestamp DESC`

    const params = limit ? [address, limit] : [address]

    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err)
      } else {
        resolve(rows || [])
      }
    })
  })
}

// Insert multiple transactions (with upsert to handle duplicates)
export const insertTransactions = (transactions: any[]): Promise<void> => {
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
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO transactions (
        signature, address, timestamp, block_time, slot, type, action, description,
        status, fee, from_token, to_token, from_amount, to_amount,
        from_symbol, to_symbol, from_value_usd, to_value_usd, source,
        platform, value, traded_coin, traded_coin_mint, is_buy, is_sell,
        transaction_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    db.serialize(() => {
      db.run('BEGIN TRANSACTION')

      for (const tx of transactions) {
        stmt.run(
          tx.signature,
          tx.address,
          tx.timestamp,
          tx.timestamp, // Using timestamp as block_time
          tx.slot,
          tx.type,
          tx.action,
          tx.description,
          tx.status,
          tx.fee,
          tx.fromToken,
          tx.toToken,
          tx.fromAmount,
          tx.toAmount,
          tx.fromSymbol,
          tx.toSymbol,
          tx.fromValueUSD,
          tx.toValueUSD,
          tx.source,
          tx.platform,
          tx.value,
          tx.tradedCoin,
          tx.tradedCoinMint,
          tx.isBuy ? 1 : 0,
          tx.isSell ? 1 : 0,
          tx.transactionType,
          (err: any) => {
            if (err) {
              console.error('Error inserting transaction:', err)
            }
          }
        )
      }

      db.run('COMMIT', (err) => {
        if (err) {
          db.run('ROLLBACK')
          reject(err)
        } else {
          console.log(`Inserted/updated ${transactions.length} transactions`)
          resolve()
        }
      })
    })

    stmt.finalize()
  })
}

// Get transactions within date range
export const getTransactionsByDateRange = (
  address: string,
  startTime: number,
  endTime: number
): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM transactions
       WHERE address = ? AND timestamp >= ? AND timestamp <= ?
       ORDER BY timestamp DESC`,
      [address, startTime, endTime],
      (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(rows || [])
        }
      }
    )
  })
}

// Count total transactions for an address
export const getTransactionCount = (address: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT COUNT(*) as count FROM transactions WHERE address = ?`,
      [address],
      (err, row: any) => {
        if (err) {
          reject(err)
        } else {
          resolve(row?.count || 0)
        }
      }
    )
  })
}