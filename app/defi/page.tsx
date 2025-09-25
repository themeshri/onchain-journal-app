'use client'

import { useState, useEffect } from 'react'

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
  source?: string
  platform?: string
  value?: number
}

interface JournalEntry {
  id: string
  transactionSignature: string
  note: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export default function DeFiTracker() {
  const [walletAddress, setWalletAddress] = useState('4NuB8ZFSjEVWE1nJTJ5RBCRmw9VHUE2g8Q5vFza4L8wm')
  const [activities, setActivities] = useState<DeFiActivity[]>([])
  const [journalEntries, setJournalEntries] = useState<{ [key: string]: JournalEntry }>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null)
  const [journalNote, setJournalNote] = useState('')
  const [journalTags, setJournalTags] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

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
      // Use real swap detection
      const response = await fetch(`/api/real-swaps?address=${walletAddress}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch swap activities')
      }

      setActivities(data.data || [])
      console.log(`Loaded ${data.total || 0} swap transactions`)
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const updatedEntries = { ...journalEntries, [signature]: entry }
    setJournalEntries(updatedEntries)
    localStorage.setItem('journalEntries', JSON.stringify(updatedEntries))
    
    setEditingTransaction(null)
    setJournalNote('')
    setJournalTags('')
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

  const formatValue = (value: number) => {
    if (!value) return '$0'
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getTokenSymbol = (mint: string, fallbackSymbol?: string) => {
    if (fallbackSymbol) return fallbackSymbol
    
    // Token mapping - you can expand this
    const tokens: { [key: string]: string } = {
      'So11111111111111111111111111111111111111112': 'SOL',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
      'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'jitoSOL',
      '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 'ETH',
      '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': 'BTC'
    }
    return tokens[mint] || mint?.slice(0, 8) || 'Token'
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Token Swap Tracker</h1>
            <div className="flex space-x-2">
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
              {loading ? 'Loading...' : 'Fetch Activities'}
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              All Transactions
            </button>
          </div>
          
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded mb-4">
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
                    Action
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
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {activity.action || activity.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {activity.fromAmount ? (
                        <div>
                          <span className="text-red-500">-{formatAmount(activity.fromAmount)}</span>
                          <span className="ml-1 text-gray-500">{getTokenSymbol(activity.fromToken || '', (activity as any).fromSymbol)}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                      {activity.toAmount ? (
                        <div>
                          <span className="text-green-500">+{formatAmount(activity.toAmount)}</span>
                          <span className="ml-1 text-gray-500">{getTokenSymbol(activity.toToken || '', (activity as any).toSymbol)}</span>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {journalEntries[activity.signature] ? (
                        <div className="flex items-center space-x-2">
                          <span className="text-green-600">✓</span>
                          <button
                            onClick={() => {
                              setEditingTransaction(activity.signature)
                              setJournalNote(journalEntries[activity.signature].note)
                              setJournalTags(journalEntries[activity.signature].tags.join(', '))
                            }}
                            className="text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingTransaction(activity.signature)}
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
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                    {activity.action || activity.type}
                  </span>
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
                      <span className="text-red-500">-{formatAmount(activity.fromAmount)}</span>
                      <span className="ml-1 text-gray-500">{getTokenSymbol(activity.fromToken || '', (activity as any).fromSymbol)}</span>
                    </div>
                  ) : null}
                  {activity.toAmount ? (
                    <div className="text-sm">
                      <span className="text-green-500">+{formatAmount(activity.toAmount)}</span>
                      <span className="ml-1 text-gray-500">{getTokenSymbol(activity.toToken || '', (activity as any).toSymbol)}</span>
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
                      }}
                      className="text-sm text-green-600"
                    >
                      ✓ Journal
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditingTransaction(activity.signature)}
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

        {/* Journal Entry Modal */}
        {editingTransaction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium mb-4">Add Journal Entry</h3>
              <textarea
                value={journalNote}
                onChange={(e) => setJournalNote(e.target.value)}
                placeholder="Write your notes about this DeFi activity..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                rows={4}
              />
              <input
                type="text"
                value={journalTags}
                onChange={(e) => setJournalTags(e.target.value)}
                placeholder="Tags (comma-separated, e.g., Swap, Raydium, Profit)"
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