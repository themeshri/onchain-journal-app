import React from 'react'
import { DeFiActivity } from '../types'
import { calculateTradeCycles } from '../utils/tradeCycles'
import { formatValue, formatDuration, formatTime } from '../utils/formatters'

interface TradeSummaryProps {
  activities: DeFiActivity[]
}

export const TradeSummary: React.FC<TradeSummaryProps> = ({ activities }) => {
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

  return (
    <div className="space-y-4">
      {allTrades.map((trade) => (
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
      ))}
    </div>
  )
}