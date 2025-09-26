import { useState, useEffect } from 'react'
import { DeFiActivity } from '../types'

interface UseWalletDataReturn {
  activities: DeFiActivity[]
  loading: boolean
  error: string
  fetchDeFiActivities: () => Promise<void>
}

export const useWalletData = (walletAddress: string): UseWalletDataReturn => {
  const [activities, setActivities] = useState<DeFiActivity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  return {
    activities,
    loading,
    error,
    fetchDeFiActivities
  }
}