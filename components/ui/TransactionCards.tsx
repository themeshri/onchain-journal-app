import React from 'react'
import { DeFiActivity, JournalEntry, TransactionType } from '../types'
import { formatTime, formatAmount, formatValue } from '../utils/formatters'

interface TransactionCardsProps {
  activities: DeFiActivity[]
  journalEntries: { [key: string]: JournalEntry }
  onAddJournal: (signature: string, transactionType?: TransactionType) => void
  onEditJournal: (
    signature: string, 
    note: string, 
    tags: string, 
    transactionType: TransactionType
  ) => void
}

export const TransactionCards: React.FC<TransactionCardsProps> = ({
  activities,
  journalEntries,
  onAddJournal,
  onEditJournal
}) => {
  const handleJournalClick = (activity: DeFiActivity) => {
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
                onClick={() => handleJournalClick(activity)}
                className="text-sm text-green-600"
              >
                ✓ Journal
              </button>
            ) : (
              <button
                onClick={() => handleJournalClick(activity)}
                className="text-sm text-blue-600 hover:underline"
              >
                + Journal
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}