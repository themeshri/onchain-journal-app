import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { getServerConfig } from '../../../lib/config'
import { 
  SolscanSwapsQuerySchema, 
  validateQuery, 
  formatZodError 
} from '../../../lib/validation'

// Get configuration securely from server-side config
const config = getServerConfig()
const SOLSCAN_API_KEY = config.solscan.apiKey
const SOLSCAN_API_BASE = config.solscan.baseUrl

// Token symbols mapping
const TOKEN_SYMBOLS: { [key: string]: string } = {
  'So11111111111111111111111111111111111111112': 'SOL',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'jitoSOL',
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 'ETH',
  '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': 'BTC',
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 'RAY',
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': 'PYTH'
}

// DEX sources
const DEX_SOURCES: { [key: string]: string } = {
  'jupiter': 'Jupiter',
  'raydium': 'Raydium',
  'orca': 'Orca',
  'saber': 'Saber',
  'serum': 'Serum',
  'aldrin': 'Aldrin',
  'crema': 'Crema'
}

export async function GET(request: NextRequest) {
  // Validate query parameters
  const searchParams = request.nextUrl.searchParams
  const queryParams = Object.fromEntries(searchParams.entries())
  
  const validation = validateQuery(SolscanSwapsQuerySchema, queryParams)
  
  if (!validation.success) {
    return NextResponse.json(
      {
        error: 'Invalid request parameters',
        details: formatZodError(validation.details),
        message: 'Please check your query parameters and try again'
      },
      { status: 400 }
    )
  }
  
  const { address, limit = 50 } = validation.data
  
  // Check if API key is configured
  if (!SOLSCAN_API_KEY) {
    return NextResponse.json(
      { 
        error: 'Solscan API is not configured', 
        message: 'Please set SOLSCAN_API_KEY in environment variables.',
        code: 'MISSING_API_KEY'
      },
      { status: 500 }
    )
  }

  try {
    console.log('Fetching swap activities from Solscan for:', address)
    
    // First try basic transactions endpoint (should work with your API tier)
    const response = await axios.get(`${SOLSCAN_API_BASE}/account/transactions`, {
      params: {
        address: address,
        limit: 50
      },
      headers: {
        'token': SOLSCAN_API_KEY,
        'Accept': 'application/json'
      }
    })

    console.log('Solscan response status:', response.status)
    console.log('Solscan response data keys:', Object.keys(response.data || {}))

    const transactions = response.data?.data || []
    console.log(`Found ${transactions.length} total transactions`)

    // Filter for swap-like transactions
    const swapTransactions = transactions.filter((tx: any) => {
      // Look for transactions that have multiple token transfers (indication of swaps)
      const tokenTransfers = tx.token_transfers || []
      const hasMultipleTransfers = tokenTransfers.length >= 2
      
      // Look for specific programs or activities that indicate swaps
      const programIds = tx.program_ids || []
      const hasSwapProgram = programIds.some((id: string) => 
        id.includes('JUP') || // Jupiter
        id.includes('whir') || // Orca Whirlpool
        id.includes('9W959') || // Orca
        id.includes('675k') || // Raydium
        id.includes('CAMM') // Raydium CLMM
      )
      
      // Check activity type if available
      const activityType = tx.activity_type || ''
      const isSwapActivity = activityType.toLowerCase().includes('swap') || 
                            activityType.toLowerCase().includes('trade')
      
      return hasMultipleTransfers || hasSwapProgram || isSwapActivity
    })

    console.log(`Found ${swapTransactions.length} potential swap transactions`)

    // Process the filtered swap transactions
    const activities = swapTransactions.slice(0, 20).map((tx: any) => {
      let fromToken = null
      let toToken = null
      let fromAmount = 0
      let toAmount = 0
      let fromSymbol = ''
      let toSymbol = ''

      // Extract swap details from transaction
      const tokenTransfers = tx.token_transfers || []
      
      if (tokenTransfers.length >= 2) {
        // Find outgoing and incoming transfers for this address
        const outgoing = tokenTransfers.find((t: any) => 
          t.from_address === address || (t.amount < 0 && t.from_user_account === address)
        )
        const incoming = tokenTransfers.find((t: any) => 
          t.to_address === address || (t.amount > 0 && t.to_user_account === address)
        )

        if (outgoing) {
          fromToken = outgoing.token_address
          fromAmount = Math.abs(outgoing.amount)
          fromSymbol = TOKEN_SYMBOLS[fromToken] || outgoing.token_symbol || fromToken?.slice(0, 8) || 'Token'
        }

        if (incoming) {
          toToken = incoming.token_address
          toAmount = Math.abs(incoming.amount)
          toSymbol = TOKEN_SYMBOLS[toToken] || incoming.token_symbol || toToken?.slice(0, 8) || 'Token'
        }
      }

      // Determine DEX source from program IDs or source field
      let dexSource = 'Unknown DEX'
      const programIds = tx.program_ids || []
      
      if (programIds.some((id: string) => id.includes('JUP'))) dexSource = 'Jupiter'
      else if (programIds.some((id: string) => id.includes('whir'))) dexSource = 'Orca'
      else if (programIds.some((id: string) => id.includes('9W959'))) dexSource = 'Orca'
      else if (programIds.some((id: string) => id.includes('675k'))) dexSource = 'Raydium'
      else if (programIds.some((id: string) => id.includes('CAMM'))) dexSource = 'Raydium'
      else if (tx.source) dexSource = DEX_SOURCES[tx.source.toLowerCase()] || tx.source

      return {
        signature: tx.signature,
        timestamp: tx.block_time,
        type: 'SWAP',
        action: `SWAP on ${dexSource}`,
        description: `Swapped ${fromSymbol} for ${toSymbol}`,
        status: tx.status === 'Success' ? 'Success' : 'Failed',
        fee: tx.fee || 5000,
        fromToken,
        toToken,
        fromAmount,
        toAmount,
        fromSymbol,
        toSymbol,
        source: dexSource,
        platform: 'Solana'
      }
    })

    return NextResponse.json({ 
      data: activities,
      total: activities.length 
    })
    
  } catch (error: any) {
    console.error('Error fetching from Solscan:', error.response?.data || error.message)
    
    if (error.response?.status === 401) {
      return NextResponse.json(
        { error: 'Invalid Solscan API key or insufficient permissions' },
        { status: 401 }
      )
    }
    
    if (error.response?.status === 403) {
      return NextResponse.json(
        { error: 'API key tier insufficient for this endpoint' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch swap activities from Solscan', 
        details: error.response?.data?.message || error.message
      },
      { status: error.response?.status || 500 }
    )
  }
}