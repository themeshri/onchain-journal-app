import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const HELIUS_API = 'https://api.helius.xyz/v0'
const HELIUS_KEY = '7a8c3b45-39f7-4d2f-8e6a-0c9d1e3f5a7b' // Free tier key

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const address = searchParams.get('address')
  
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  }

  try {
    // Use Solscan API v2 for better swap detection
    const solscanResponse = await axios.get(`https://pro-api.solscan.io/v2.0/account/transactions`, {
      params: {
        address: address,
        limit: 50,
        activity_type: 'ACTIVITY_SPL_TRADE' // Focus only on trades/swaps
      },
      headers: {
        'token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NTg3NTA0NTgzNDYsImVtYWlsIjoibWVjaHJpLmhvc3NAZ21haWwuY29tIiwiYWN0aW9uIjoidG9rZW4tYXBpIiwiYXBpVmVyc2lvbiI6InYyIiwiaWF0IjoxNzU4NzUwNDU4fQ.ershC5SSzshdCPot94WUHo0PpHuf6sAlxdBXOQo256Y' // Your API key
      }
    }).catch(() => null)

    let transactions = []
    
    if (solscanResponse && solscanResponse.data) {
      transactions = solscanResponse.data.data || []
    }
    
    // If Solscan fails or returns no data, try alternative approach
    if (transactions.length === 0) {
      // Get all recent transactions and filter
      const rpcResponse = await axios.post('https://solana-mainnet.g.alchemy.com/v2/demo', {
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [address, { limit: 100 }] // Get more to find swaps
      })
      
      const signatures = rpcResponse.data.result || []
      
      // Filter by memo patterns that indicate swaps
      transactions = signatures.filter((sig: any) => {
        const memo = sig.memo || ''
        return memo.toLowerCase().includes('swap') || 
               memo.toLowerCase().includes('trade') ||
               memo.toLowerCase().includes('buy') ||
               memo.toLowerCase().includes('sell') ||
               memo.toLowerCase().includes('exchange')
      })
    }

    // Transform and filter for swap activities only
    const defiActivities = transactions
      .filter((tx: any) => {
        // Only include actual swaps/trades
        if (tx.type) {
          return tx.type === 'SWAP' || 
                 tx.type === 'TRADE' ||
                 tx.type === 'BUY' ||
                 tx.type === 'SELL' ||
                 tx.type === 'ACTIVITY_SPL_TRADE'
        }
        
        // Check description for swap indicators
        if (tx.description) {
          const desc = tx.description.toLowerCase()
          return desc.includes('swap') || 
                 desc.includes('bought') || 
                 desc.includes('sold') ||
                 desc.includes('trade')
        }
        
        // For basic signatures, check if it's likely a swap based on memo
        if (tx.memo) {
          const memo = tx.memo.toLowerCase()
          return memo.includes('swap') || 
                 memo.includes('raydium') ||
                 memo.includes('orca') ||
                 memo.includes('jupiter')
        }
        
        return false
      })
      .map((tx: any) => {
        // Parse token transfers for swap details
        const tokenTransfers = tx.tokenTransfers || []
        let fromToken = null
        let toToken = null
        let fromAmount = 0
        let toAmount = 0
        
        // Find incoming and outgoing tokens
        tokenTransfers.forEach((transfer: any) => {
          if (transfer.fromUserAccount === address) {
            fromToken = transfer.tokenMint
            fromAmount = transfer.tokenAmount
          }
          if (transfer.toUserAccount === address) {
            toToken = transfer.tokenMint
            toAmount = transfer.tokenAmount
          }
        })

        return {
          signature: tx.signature,
          timestamp: tx.timestamp,
          type: tx.type || 'SWAP',
          action: 'AGG TOKEN SWAP', // Default action like in screenshot
          description: tx.description || 'Token Swap',
          status: 'Success',
          fee: tx.fee || 5000,
          fromToken,
          toToken,
          fromAmount,
          toAmount,
          source: tx.source || 'Unknown',
          platform: 'Solana'
        }
      })
      .slice(0, 20) // Limit to 20 most recent

    return NextResponse.json({ data: defiActivities })
  } catch (error: any) {
    console.error('Error fetching DeFi activities:', error.response?.data || error.message)
    
    // Fallback to basic RPC if Helius fails
    try {
      const rpcResponse = await axios.post('https://solana-mainnet.g.alchemy.com/v2/demo', {
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [address, { limit: 20 }]
      })

      const signatures = rpcResponse.data.result || []
      
      const defiActivities = signatures.map((sig: any) => ({
        signature: sig.signature,
        timestamp: sig.blockTime || 0,
        type: 'Transaction',
        action: 'Transaction',
        description: sig.memo || 'Solana Transaction',
        status: sig.err ? 'Failed' : 'Success',
        fee: 5000,
        fromToken: null,
        toToken: null,
        fromAmount: 0,
        toAmount: 0,
        source: 'Solana',
        platform: 'Solana'
      }))

      return NextResponse.json({ data: defiActivities })
    } catch (fallbackError: any) {
      return NextResponse.json(
        { 
          error: 'Failed to fetch DeFi activities', 
          details: fallbackError.message 
        },
        { status: 500 }
      )
    }
  }
}