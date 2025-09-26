export interface DeFiActivity {
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
  tradedCoin?: string
  tradedCoinMint?: string
  isBuy?: boolean
  isSell?: boolean
}

export interface JournalEntry {
  id: string
  transactionSignature: string
  note: string
  tags: string[]
  transactionType: 'sell' | 'sell all' | 'first buy' | 'buy more'
  createdAt: string
  updatedAt: string
}

export interface TradeGroup {
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

export interface TokenTradeCycles {
  token: string
  tokenMint: string
  tradeGroups: TradeGroup[]
  currentBalance: number
  totalTrades: number
}

export type ViewMode = 'table' | 'cards' | 'summary'
export type TransactionType = 'sell' | 'sell all' | 'first buy' | 'buy more'