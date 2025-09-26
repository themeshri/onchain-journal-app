import { DeFiActivity, TokenTradeCycles, TradeGroup } from '../types'

export const calculateTradeCycles = (activities: DeFiActivity[]): TokenTradeCycles[] => {
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