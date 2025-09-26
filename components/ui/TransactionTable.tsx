import React from 'react'
import { DeFiActivity, JournalEntry, TransactionType } from '../types'
import { formatTime, formatAmount, formatValue } from '../utils/formatters'

interface TransactionTableProps {
  activities: DeFiActivity[]
  walletAddress: string
  journalEntries: { [key: string]: JournalEntry }
  onAddJournal: (signature: string, transactionType?: TransactionType) => void
  onEditJournal: (
    signature: string, 
    note: string, 
    tags: string, 
    transactionType: TransactionType
  ) => void
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  activities,
  walletAddress,
  journalEntries,
  onAddJournal,
  onEditJournal
}) => {
  const handleEditClick = (activity: DeFiActivity) => {
    const entry = journalEntries[activity.signature]
    if (entry) {
      onEditJournal(
        activity.signature,
        entry.note,
        entry.tags.join(', '),
        entry.transactionType
      )
    } else {
      onAddJournal(
        activity.signature,
        activity.transactionType as TransactionType
      )
    }
  }

  return (
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
                      onClick={() => handleEditClick(activity)}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleEditClick(activity)}
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
  )
}