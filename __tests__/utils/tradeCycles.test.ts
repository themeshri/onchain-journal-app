import { calculateTradeCycles } from '../../components/utils/tradeCycles'
import { DeFiActivity } from '../../components/types'

describe('calculateTradeCycles', () => {
  const createActivity = (overrides: Partial<DeFiActivity> = {}): DeFiActivity => ({
    signature: 'test-signature',
    timestamp: Date.now() / 1000,
    type: 'SWAP',
    action: 'BUY',
    description: 'Test swap',
    status: 'Success',
    fee: 5000,
    tradedCoin: 'TEST',
    tradedCoinMint: 'test-mint',
    isBuy: false,
    isSell: false,
    ...overrides
  })

  it('should return empty array for no activities', () => {
    const result = calculateTradeCycles([])
    expect(result).toEqual([])
  })

  it('should filter out activities without tradedCoin or tradedCoinMint', () => {
    const activities = [
      createActivity({ tradedCoin: undefined }),
      createActivity({ tradedCoinMint: undefined }),
      createActivity({ tradedCoin: 'TEST', tradedCoinMint: 'test-mint' })
    ]

    const result = calculateTradeCycles(activities)
    expect(result).toHaveLength(1)
    expect(result[0].token).toBe('TEST')
  })

  it('should create a complete trade cycle for buy and sell', () => {
    const activities: DeFiActivity[] = [
      createActivity({
        signature: 'buy-1',
        timestamp: 1000,
        tradedCoin: 'TEST',
        tradedCoinMint: 'test-mint',
        isBuy: true,
        toAmount: 100,
        value: 50
      }),
      createActivity({
        signature: 'sell-1',
        timestamp: 2000,
        tradedCoin: 'TEST',
        tradedCoinMint: 'test-mint',
        isSell: true,
        fromAmount: 100,
        value: 60
      })
    ]

    const result = calculateTradeCycles(activities)
    
    expect(result).toHaveLength(1)
    
    const tokenCycle = result[0]
    expect(tokenCycle.token).toBe('TEST')
    expect(tokenCycle.tokenMint).toBe('test-mint')
    expect(tokenCycle.tradeGroups).toHaveLength(1)
    expect(tokenCycle.currentBalance).toBe(0)

    const tradeGroup = tokenCycle.tradeGroups[0]
    expect(tradeGroup.buys).toHaveLength(1)
    expect(tradeGroup.sells).toHaveLength(1)
    expect(tradeGroup.totalBuyAmount).toBe(100)
    expect(tradeGroup.totalSellAmount).toBe(100)
    expect(tradeGroup.totalBuyValue).toBe(50)
    expect(tradeGroup.totalSellValue).toBe(60)
    expect(tradeGroup.isComplete).toBe(true)
    expect(tradeGroup.profitLoss).toBe(10) // 60 - 50
  })

  it('should handle multiple buys before sell', () => {
    const activities: DeFiActivity[] = [
      createActivity({
        signature: 'buy-1',
        timestamp: 1000,
        tradedCoin: 'TEST',
        tradedCoinMint: 'test-mint',
        isBuy: true,
        toAmount: 50,
        value: 25
      }),
      createActivity({
        signature: 'buy-2',
        timestamp: 1500,
        tradedCoin: 'TEST',
        tradedCoinMint: 'test-mint',
        isBuy: true,
        toAmount: 50,
        value: 30
      }),
      createActivity({
        signature: 'sell-1',
        timestamp: 2000,
        tradedCoin: 'TEST',
        tradedCoinMint: 'test-mint',
        isSell: true,
        fromAmount: 100,
        value: 70
      })
    ]

    const result = calculateTradeCycles(activities)
    const tradeGroup = result[0].tradeGroups[0]
    
    expect(tradeGroup.buys).toHaveLength(2)
    expect(tradeGroup.sells).toHaveLength(1)
    expect(tradeGroup.totalBuyAmount).toBe(100)
    expect(tradeGroup.totalBuyValue).toBe(55) // 25 + 30
    expect(tradeGroup.profitLoss).toBeCloseTo(15, 10) // 70 - 55
    expect(tradeGroup.isComplete).toBe(true)
  })

  it('should handle partial sells', () => {
    const activities: DeFiActivity[] = [
      createActivity({
        signature: 'buy-1',
        timestamp: 1000,
        tradedCoin: 'TEST',
        tradedCoinMint: 'test-mint',
        isBuy: true,
        toAmount: 100,
        value: 50
      }),
      createActivity({
        signature: 'sell-1',
        timestamp: 2000,
        tradedCoin: 'TEST',
        tradedCoinMint: 'test-mint',
        isSell: true,
        fromAmount: 60,
        value: 40
      })
    ]

    const result = calculateTradeCycles(activities)
    const tradeGroup = result[0].tradeGroups[0]
    
    expect(tradeGroup.isComplete).toBe(false)
    expect(tradeGroup.endBalance).toBe(40) // 100 - 60
    expect(result[0].currentBalance).toBe(40)
  })

  it('should create new trade group when balance returns to 0 and new buy occurs', () => {
    const activities: DeFiActivity[] = [
      // First complete trade
      createActivity({
        signature: 'buy-1',
        timestamp: 1000,
        tradedCoin: 'TEST',
        tradedCoinMint: 'test-mint',
        isBuy: true,
        toAmount: 100,
        value: 50
      }),
      createActivity({
        signature: 'sell-1',
        timestamp: 2000,
        tradedCoin: 'TEST',
        tradedCoinMint: 'test-mint',
        isSell: true,
        fromAmount: 100,
        value: 60
      }),
      // Second trade starts
      createActivity({
        signature: 'buy-2',
        timestamp: 3000,
        tradedCoin: 'TEST',
        tradedCoinMint: 'test-mint',
        isBuy: true,
        toAmount: 200,
        value: 120
      })
    ]

    const result = calculateTradeCycles(activities)
    expect(result[0].tradeGroups).toHaveLength(2)
    
    const firstTrade = result[0].tradeGroups[0]
    expect(firstTrade.isComplete).toBe(true)
    expect(firstTrade.profitLoss).toBe(10)
    
    const secondTrade = result[0].tradeGroups[1]
    expect(secondTrade.isComplete).toBe(false)
    expect(secondTrade.totalBuyAmount).toBe(200)
  })

  it('should sort results by most recent activity', () => {
    const activities: DeFiActivity[] = [
      createActivity({
        signature: 'old-token',
        timestamp: 1000,
        tradedCoin: 'OLD',
        tradedCoinMint: 'old-mint',
        isBuy: true,
        toAmount: 100,
        value: 50
      }),
      createActivity({
        signature: 'new-token',
        timestamp: 3000,
        tradedCoin: 'NEW',
        tradedCoinMint: 'new-mint',
        isBuy: true,
        toAmount: 100,
        value: 50
      })
    ]

    const result = calculateTradeCycles(activities)
    expect(result).toHaveLength(2)
    expect(result[0].token).toBe('NEW') // Most recent first
    expect(result[1].token).toBe('OLD')
  })

  it('should handle floating point precision in balance calculations', () => {
    const activities: DeFiActivity[] = [
      createActivity({
        signature: 'buy-1',
        timestamp: 1000,
        tradedCoin: 'TEST',
        tradedCoinMint: 'test-mint',
        isBuy: true,
        toAmount: 100.000001, // Slight floating point difference
        value: 50
      }),
      createActivity({
        signature: 'sell-1',
        timestamp: 2000,
        tradedCoin: 'TEST',
        tradedCoinMint: 'test-mint',
        isSell: true,
        fromAmount: 100.000001,
        value: 60
      })
    ]

    const result = calculateTradeCycles(activities)
    const tradeGroup = result[0].tradeGroups[0]
    
    expect(tradeGroup.isComplete).toBe(true)
    expect(result[0].currentBalance).toBe(0) // Should be reset to exactly 0
  })

  it('should calculate trade duration correctly', () => {
    const activities: DeFiActivity[] = [
      createActivity({
        signature: 'buy-1',
        timestamp: 1000,
        tradedCoin: 'TEST',
        tradedCoinMint: 'test-mint',
        isBuy: true,
        toAmount: 100,
        value: 50
      }),
      createActivity({
        signature: 'sell-1',
        timestamp: 2500, // 1500 seconds later
        tradedCoin: 'TEST',
        tradedCoinMint: 'test-mint',
        isSell: true,
        fromAmount: 100,
        value: 60
      })
    ]

    const result = calculateTradeCycles(activities)
    const tradeGroup = result[0].tradeGroups[0]
    
    expect(tradeGroup.duration).toBe(1500)
    expect(tradeGroup.startDate).toBe(1000)
    expect(tradeGroup.endDate).toBe(2500)
  })
})