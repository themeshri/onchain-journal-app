import React from 'react'
import { ViewMode } from '../types'

interface HeaderProps {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  walletAddress: string
  setWalletAddress: (address: string) => void
  onFetch: () => void
  loading: boolean
  error: string
  activitiesCount: number
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  setViewMode,
  walletAddress,
  setWalletAddress,
  onFetch,
  loading,
  error,
  activitiesCount
}) => {
  return (
    <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Trench Journal</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 rounded ${viewMode === 'table' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Table
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`px-4 py-2 rounded ${viewMode === 'cards' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Cards
          </button>
          <button
            onClick={() => setViewMode('summary')}
            className={`px-4 py-2 rounded ${viewMode === 'summary' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Summary
          </button>
        </div>
      </div>

      <div className="flex space-x-4 mb-4">
        <input
          type="text"
          placeholder="Enter Solana wallet address"
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={onFetch}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Fetch Activities'}
        </button>
      </div>

      {error && (
        <div className={`p-3 rounded mb-4 ${
          error.startsWith('ℹ️') || error.startsWith('📊') 
            ? 'bg-blue-50 border border-blue-200 text-blue-700' 
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {error}
        </div>
      )}

      <div className="text-sm text-gray-600">
        {activitiesCount > 0 ? (
          <span>Showing {activitiesCount} swap transactions</span>
        ) : (
          <span>No transactions loaded</span>
        )}
      </div>
    </div>
  )
}