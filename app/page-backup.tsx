'use client'

import { useState, useEffect } from 'react'
import React from 'react'

interface DeFiActivity {
  signature: string
  timestamp: number
  type: string
  action: string
  description: string
  status: string
  fee: number
  fromToken?: string
  toToken?: string
  fromAmount?: number
  toAmount?: number
  fromValueUSD?: number
  toValueUSD?: number
  fromSymbol?: string
  toSymbol?: string
  source?: string
  platform?: string
  value?: number
  transactionType?: 'sell' | 'sell all' | 'first buy' | 'buy more'
  // New fields
  tradedCoin?: string
  tradedCoinMint?: string
  isBuy?: boolean
  isSell?: boolean
}

interface JournalEntry {
  id: string
  transactionSignature: string
  note: string
  tags: string[]
  transactionType: 'sell' | 'sell all' | 'first buy' | 'buy more'
  createdAt: string
  updatedAt: string
}

interface TradeGroup {
  tradeNumber: number
  token: string
  tokenMint: string
  buys: DeFiActivity[]
  sells: DeFiActivity[]
  totalBuyAmount: number
  totalSellAmount: number
  totalBuyValue: number
  totalSellValue: number
  startBalance: number
  endBalance: number
  profitLoss: number
  isComplete: boolean
  startDate: number
  endDate?: number
  duration?: number
}

interface TokenTradeCycles {
  token: string
  tokenMint: string
  tradeGroups: TradeGroup[]
  currentBalance: number
  totalTrades: number
}

export default function Home() {
  const [walletAddress, setWalletAddress] = useState('4NuB8ZFSjEVWE1nJTJ5RBCRmw9VHUE2g8Q5vFza4L8wm')
  const [activities, setActivities] = useState<DeFiActivity[]>([])
  const [journalEntries, setJournalEntries] = useState<{ [key: string]: JournalEntry }>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null)
  const [journalNote, setJournalNote] = useState('')
  const [journalTags, setJournalTags] = useState('')
  const [transactionType, setTransactionType] = useState<'sell' | 'sell all' | 'first buy' | 'buy more'>('sell')
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'summary'>('table')

  useEffect(() => {
    const savedEntries = localStorage.getItem('journalEntries')
    if (savedEntries) {
      setJournalEntries(JSON.parse(savedEntries))
    }
    
    const savedAddress = localStorage.getItem('walletAddress')
    if (savedAddress) {
      setWalletAddress(savedAddress)
    }
    
    // Auto-fetch on load
    if (walletAddress) {
      fetchDeFiActivities()
    }
  }, [])

  const fetchDeFiActivities = async () => {
    if (!walletAddress) {
      setError('Please provide a wallet address')
      return
    }

    setLoading(true)
    setError('')
    
    localStorage.setItem('walletAddress', walletAddress)

    try {
      // Use main swaps endpoint
      const response = await fetch(`/api/helius-swaps?address=${walletAddress}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch swap activities')
      }

      setActivities(data.data || [])
      
      // Show data source and any messages
      if (data.message) {
        setError(`ℹ️ ${data.message}`)
      } else if (data.wallet_stats) {
        const stats = data.wallet_stats
        setError(`📊 Wallet Stats: ${stats.sol_balance} SOL | PnL (7d): ${stats.pnl_7d} | Winrate: ${stats.winrate} | Source: ${data.source}`)
      } else if (data.source) {
        setError(`ℹ️ Data source: ${data.source}`)
      }
      
      console.log(`Loaded ${data.total || 0} swap transactions from ${data.source || 'Solana RPC'}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const saveJournalEntry = (signature: string) => {
    if (!journalNote.trim()) return

    const entry: JournalEntry = {
      id: Date.now().toString(),
      transactionSignature: signature,
      note: journalNote,
      tags: journalTags.split(',').map(tag => tag.trim()).filter(tag => tag),
      transactionType: transactionType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const updatedEntries = { ...journalEntries, [signature]: entry }
    setJournalEntries(updatedEntries)
    localStorage.setItem('journalEntries', JSON.stringify(updatedEntries))
    
    setEditingTransaction(null)
    setJournalNote('')
    setJournalTags('')
    setTransactionType('sell')
  }

  const deleteJournalEntry = (signature: string) => {
    const updatedEntries = { ...journalEntries }
    delete updatedEntries[signature]
    setJournalEntries(updatedEntries)
    localStorage.setItem('journalEntries', JSON.stringify(updatedEntries))
  }

  const formatTime = (timestamp: number) => {
    if (!timestamp) return 'Unknown'
    const now = Date.now() / 1000
    const diff = now - timestamp
    
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)} hrs ago`
    return `${Math.floor(diff / 86400)} days ago`
  }

  const formatAmount = (amount: number, decimals: number = 9) => {
    if (!amount) return '0'
    return (amount / Math.pow(10, decimals)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    })
  }

  const calculateTradeCycles = (activities: DeFiActivity[]): TokenTradeCycles[] => {
    const tokenMap = new Map<string, TokenTradeCycles>()

    // Sort activities by timestamp (oldest first) to track balance changes chronologically
    const sortedActivities = [...activities].sort((a, b) => a.timestamp - b.timestamp)

    sortedActivities.forEach(activity => {
      if (!activity.tradedCoin || !activity.tradedCoinMint) return

      const key = activity.tradedCoinMint

      if (!tokenMap.has(key)) {
        tokenMap.set(key, {
          token: activity.tradedCoin,
          tokenMint: activity.tradedCoinMint,
          tradeGroups: [],
          currentBalance: 0,
          totalTrades: 0
        })
      }

      const tokenCycles = tokenMap.get(key)!
      let currentTradeGroup = tokenCycles.tradeGroups[tokenCycles.tradeGroups.length - 1]

      // Determine transaction amounts
      const buyAmount = activity.isBuy ? (activity.toAmount || 0) : 0
      const sellAmount = activity.isSell ? (activity.fromAmount || 0) : 0
      const buyValue = activity.isBuy ? (activity.value || activity.fromValueUSD || 0) : 0
      const sellValue = activity.isSell ? (activity.value || activity.toValueUSD || 0) : 0

      // Start new trade group if:
      // 1. No current group exists
      // 2. Current balance is 0 and this is a buy (starting fresh)
      // 3. Current group is complete
      if (!currentTradeGroup ||
          (tokenCycles.currentBalance === 0 && activity.isBuy) ||
          currentTradeGroup.isComplete) {

        currentTradeGroup = {
          tradeNumber: tokenCycles.tradeGroups.length + 1,
          token: activity.tradedCoin,
          tokenMint: activity.tradedCoinMint,
          buys: [],
          sells: [],
          totalBuyAmount: 0,
          totalSellAmount: 0,
          totalBuyValue: 0,
          totalSellValue: 0,
          startBalance: tokenCycles.currentBalance,
          endBalance: 0,
          profitLoss: 0,
          isComplete: false,
          startDate: activity.timestamp
        }
        tokenCycles.tradeGroups.push(currentTradeGroup)
        tokenCycles.totalTrades++
      }

      // Add transaction to current trade group
      if (activity.isBuy) {
        currentTradeGroup.buys.push(activity)
        currentTradeGroup.totalBuyAmount += buyAmount
        currentTradeGroup.totalBuyValue += buyValue
        tokenCycles.currentBalance += buyAmount
      } else if (activity.isSell) {
        currentTradeGroup.sells.push(activity)
        currentTradeGroup.totalSellAmount += sellAmount
        currentTradeGroup.totalSellValue += sellValue
        tokenCycles.currentBalance -= sellAmount
      }

      // Update trade group end balance
      currentTradeGroup.endBalance = tokenCycles.currentBalance

      // Check if trade group is complete (balance back to 0)
      if (tokenCycles.currentBalance <= 0.000001) { // Account for floating point precision
        currentTradeGroup.isComplete = true
        currentTradeGroup.endDate = activity.timestamp
        currentTradeGroup.duration = currentTradeGroup.endDate - currentTradeGroup.startDate
        tokenCycles.currentBalance = 0 // Reset to exactly 0
      }

      // Calculate P/L for the trade group
      if (currentTradeGroup.totalBuyAmount > 0) {
        const avgBuyPrice = currentTradeGroup.totalBuyValue / currentTradeGroup.totalBuyAmount
        currentTradeGroup.profitLoss = currentTradeGroup.totalSellValue -
          (currentTradeGroup.totalSellAmount * avgBuyPrice)
      }
    })

    return Array.from(tokenMap.values()).sort((a, b) => {
      const aLastActivity = Math.max(...a.tradeGroups.map(g =>
        Math.max(g.startDate, g.endDate || 0)))
      const bLastActivity = Math.max(...b.tradeGroups.map(g =>
        Math.max(g.startDate, g.endDate || 0)))
      return bLastActivity - aLastActivity
    })
  }

  const formatValue = (value: number) => {
    if (!value) return '$0'
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDuration = (durationInSeconds: number) => {
    if (!durationInSeconds) return ''

    const days = Math.floor(durationInSeconds / (24 * 60 * 60))
    const hours = Math.floor((durationInSeconds % (24 * 60 * 60)) / (60 * 60))
    const minutes = Math.floor((durationInSeconds % (60 * 60)) / 60)
    const seconds = Math.floor(durationInSeconds % 60)

    const parts = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)

    return parts.join(' ')
  }


  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Trench Journal</h1>
            <div className="flex space-x-2">
              <button
                onClick={() => setViewMode('summary')}
                className={`px-3 py-1 rounded ${viewMode === 'summary' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Summary
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 rounded ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Table View
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1 rounded ${viewMode === 'cards' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Card View
              </button>
            </div>
          </div>
          
          <div className="flex space-x-4 mb-4">
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="Enter Solana wallet address"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={fetchDeFiActivities}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Fetch Swaps'}
            </button>
          </div>
          
          {error && (
            <div className={`p-3 rounded mb-4 ${
              error.includes('📊') || error.includes('ℹ️') || error.includes('demo data')
                ? 'bg-blue-100 border border-blue-400 text-blue-700' 
                : 'bg-red-100 border border-red-400 text-red-700'
            }`}>
              {error}
            </div>
          )}
          
          <div className="text-sm text-gray-600">
            Total: {activities.length} swap transactions (buys/sells only)
          </div>
        </div>

        {activities.length > 0 && viewMode === 'table' && (
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Signature
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Coin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    From
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Journal
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activities.map((activity) => (
                  <tr key={activity.signature} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <a
                        href={`https://solscan.io/tx/${activity.signature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-mono"
                      >
                        {activity.signature.slice(0, 8)}...
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTime(activity.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {activity.tradedCoin ? (
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          activity.isBuy
                            ? 'bg-green-100 text-green-800'
                            : activity.isSell
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}>
                          {activity.tradedCoin}
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                          SWAP
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {activity.fromAmount ? (
                        <div className="mb-1">
                          <span className="text-red-500">-{formatAmount(activity.fromAmount, 0)}</span>
                          <span className="ml-1 text-gray-500">{activity.fromSymbol}</span>
                          {activity.fromValueUSD && activity.fromValueUSD > 0 && (
                            <div className="text-xs text-gray-400">${activity.fromValueUSD.toFixed(2)}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                      {activity.toAmount ? (
                        <div>
                          <span className="text-green-500">+{formatAmount(activity.toAmount, 0)}</span>
                          <span className="ml-1 text-gray-500">{activity.toSymbol}</span>
                          {activity.toValueUSD && activity.toValueUSD > 0 && (
                            <div className="text-xs text-gray-400">${activity.toValueUSD.toFixed(2)}</div>
                          )}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatValue(activity.value || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center">
                        {activity.source || activity.platform}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {journalEntries[activity.signature] ? (
                        <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded capitalize">
                          {journalEntries[activity.signature].transactionType}
                        </span>
                      ) : activity.transactionType ? (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded capitalize">
                          {activity.transactionType}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {journalEntries[activity.signature] ? (
                        <div className="flex items-center space-x-2">
                          <span className="text-green-600">✓</span>
                          <button
                            onClick={() => {
                              setEditingTransaction(activity.signature)
                              setJournalNote(journalEntries[activity.signature].note)
                              setJournalTags(journalEntries[activity.signature].tags.join(', '))
                              setTransactionType(journalEntries[activity.signature].transactionType)
                            }}
                            className="text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingTransaction(activity.signature)
                            // Auto-populate transaction type from API classification if available
                            if (activity.transactionType) {
                              setTransactionType(activity.transactionType)
                            }
                          }}
                          className="text-blue-600 hover:underline"
                        >
                          + Add
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activities.length > 0 && viewMode === 'cards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activities.map((activity) => (
              <div key={activity.signature} className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex space-x-2">
                    {activity.tradedCoin ? (
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        activity.isBuy
                          ? 'bg-green-100 text-green-800'
                          : activity.isSell
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                        {activity.tradedCoin}
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                        SWAP
                      </span>
                    )}
                    {journalEntries[activity.signature] ? (
                      <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded capitalize">
                        {journalEntries[activity.signature].transactionType}
                      </span>
                    ) : activity.transactionType ? (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded capitalize">
                        {activity.transactionType}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-gray-500">{formatTime(activity.timestamp)}</span>
                </div>
                
                <div className="mb-3">
                  <a
                    href={`https://solscan.io/tx/${activity.signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline font-mono"
                  >
                    {activity.signature.slice(0, 16)}...
                  </a>
                </div>

                <div className="space-y-1 mb-3">
                  {activity.fromAmount ? (
                    <div className="text-sm">
                      <span className="text-red-500">-{formatAmount(activity.fromAmount, 0)}</span>
                      <span className="ml-1 text-gray-500">{activity.fromSymbol}</span>
                      {activity.fromValueUSD && activity.fromValueUSD > 0 && (
                        <span className="ml-1 text-xs text-gray-400">(${activity.fromValueUSD.toFixed(2)})</span>
                      )}
                    </div>
                  ) : null}
                  {activity.toAmount ? (
                    <div className="text-sm">
                      <span className="text-green-500">+{formatAmount(activity.toAmount, 0)}</span>
                      <span className="ml-1 text-gray-500">{activity.toSymbol}</span>
                      {activity.toValueUSD && activity.toValueUSD > 0 && (
                        <span className="ml-1 text-xs text-gray-400">(${activity.toValueUSD.toFixed(2)})</span>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                  <span className="text-sm font-medium">{formatValue(activity.value || 0)}</span>
                  {journalEntries[activity.signature] ? (
                    <button
                      onClick={() => {
                        setEditingTransaction(activity.signature)
                        setJournalNote(journalEntries[activity.signature].note)
                        setJournalTags(journalEntries[activity.signature].tags.join(', '))
                        setTransactionType(journalEntries[activity.signature].transactionType)
                      }}
                      className="text-sm text-green-600"
                    >
                      ✓ Journal
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingTransaction(activity.signature)
                        // Auto-populate transaction type from API classification if available
                        if (activity.transactionType) {
                          setTransactionType(activity.transactionType)
                        }
                      }}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      + Journal
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary View */}
        {activities.length > 0 && viewMode === 'summary' && (
          <div className="space-y-4">
            {(() => {
              const tradeCycles = calculateTradeCycles(activities)
              // Flatten all trades and sort by start date (most recent first)
              const allTrades: any[] = []
              let tradeCounter = 1

              tradeCycles.forEach((tokenCycle) => {
                tokenCycle.tradeGroups.forEach((trade) => {
                  allTrades.push({
                    ...trade,
                    globalTradeNumber: tradeCounter++,
                    token: tokenCycle.token,
                    tokenMint: tokenCycle.tokenMint
                  })
                })
              })

              // Sort by start date (most recent first)
              allTrades.sort((a, b) => b.startDate - a.startDate)

              return allTrades.map((trade) => (
                <div key={`${trade.tokenMint}-${trade.tradeNumber}`} className="bg-white shadow-sm rounded-lg overflow-hidden">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center space-x-3">
                        <h4 className="text-lg font-medium text-gray-900">
                          {trade.token} - Trade #{trade.globalTradeNumber}
                        </h4>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          trade.isComplete
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {trade.isComplete ? 'Completed' : 'Active'}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${
                          trade.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {trade.profitLoss >= 0 ? '+' : ''}{formatValue(trade.profitLoss)}
                        </div>
                        {trade.duration && (
                          <div className="text-xs text-gray-500">
                            {formatDuration(trade.duration)} duration
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-xs font-medium text-green-800 uppercase tracking-wide mb-1">
                          Buys ({trade.buys.length})
                        </div>
                        <div className="text-lg font-semibold text-green-900">
                          {trade.totalBuyAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-sm text-green-700">
                          {formatValue(trade.totalBuyValue)}
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          Avg: ${trade.totalBuyAmount > 0 ? (trade.totalBuyValue / trade.totalBuyAmount).toFixed(6) : '0.000000'}
                        </div>
                      </div>

                      <div className="bg-red-50 rounded-lg p-4">
                        <div className="text-xs font-medium text-red-800 uppercase tracking-wide mb-1">
                          Sells ({trade.sells.length})
                        </div>
                        <div className="text-lg font-semibold text-red-900">
                          {trade.totalSellAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-sm text-red-700">
                          {formatValue(trade.totalSellValue)}
                        </div>
                        <div className="text-xs text-red-600 mt-1">
                          Avg: ${trade.totalSellAmount > 0 ? (trade.totalSellValue / trade.totalSellAmount).toFixed(6) : '0.000000'}
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-xs font-medium text-gray-800 uppercase tracking-wide mb-1">
                          Balance
                        </div>
                        <div className="text-lg font-semibold text-gray-900">
                          {(trade.endBalance || trade.startBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Started: {formatTime(trade.startDate)}
                        </div>
                        {trade.endDate && (
                          <div className="text-xs text-gray-600">
                            Ended: {formatTime(trade.endDate)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            })()}
          </div>
        )}

        {/* Journal Entry Modal */}
        {editingTransaction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium mb-4">Add Swap Journal Entry</h3>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type</label>
                <select
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value as 'sell' | 'sell all' | 'first buy' | 'buy more')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="sell">Sell</option>
                  <option value="sell all">Sell All</option>
                  <option value="first buy">First Buy</option>
                  <option value="buy more">Buy More</option>
                </select>
              </div>

              <textarea
                value={journalNote}
                onChange={(e) => setJournalNote(e.target.value)}
                placeholder="Write your notes about this swap (e.g., 'Profitable trade', 'Stop loss', 'DCA buy')..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                rows={4}
              />
              <input
                type="text"
                value={journalTags}
                onChange={(e) => setJournalTags(e.target.value)}
                placeholder="Tags (comma-separated, e.g., Profit, Loss, Jupiter, DCA)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />
              <div className="flex space-x-3">
                <button
                  onClick={() => saveJournalEntry(editingTransaction)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save
                </button>
                {journalEntries[editingTransaction] && (
                  <button
                    onClick={() => {
                      deleteJournalEntry(editingTransaction)
                      setEditingTransaction(null)
                      setJournalNote('')
                      setJournalTags('')
                      setTransactionType('sell')
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingTransaction(null)
                    setJournalNote('')
                    setJournalTags('')
                    setTransactionType('sell')
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}