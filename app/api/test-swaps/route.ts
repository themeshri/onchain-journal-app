import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const address = searchParams.get('address')
  
  // Return mock swap data for testing
  const mockSwaps = [
    {
      signature: '3L25xHjUjFQaAobVWPjma6bF4Bd8LL2cMYe8MgsZWmrW9dEJJ8zF8q3H1vR2s4T9K6N7P8M5Q1A2B3C4D5',
      timestamp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      type: 'SWAP',
      action: 'SWAP on Jupiter',
      description: 'Swapped USDC for SOL',
      status: 'Success',
      fee: 5000,
      fromToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      toToken: 'So11111111111111111111111111111111111111112', // SOL
      fromAmount: 1000,
      toAmount: 54.14462,
      source: 'Jupiter',
      platform: 'Solana',
      slot: 123456789
    },
    {
      signature: '2K15xHjUjFQaAobVWPjma6bF4Bd8LL2cMYe8MgsZWmrW9dEJJ8zF8q3H1vR2s4T9K6N7P8M5Q1A2B3C4D5',
      timestamp: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
      type: 'SWAP',
      action: 'SWAP on Raydium',
      description: 'Swapped SOL for BONK',
      status: 'Success',
      fee: 5000,
      fromToken: 'So11111111111111111111111111111111111111112', // SOL
      toToken: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
      fromAmount: 2.5,
      toAmount: 54144626.09,
      source: 'Raydium V4',
      platform: 'Solana',
      slot: 123456788
    },
    {
      signature: '1F25xHjUjFQaAobVWPjma6bF4Bd8LL2cMYe8MgsZWmrW9dEJJ8zF8q3H1vR2s4T9K6N7P8M5Q1A2B3C4D5',
      timestamp: Math.floor(Date.now() / 1000) - 10800, // 3 hours ago
      type: 'SWAP',
      action: 'SWAP on Orca',
      description: 'Swapped USDT for USDC',
      status: 'Success',
      fee: 5000,
      fromToken: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
      toToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      fromAmount: 500,
      toAmount: 500.12,
      source: 'Orca V2',
      platform: 'Solana',
      slot: 123456787
    }
  ]

  return NextResponse.json({ 
    data: mockSwaps,
    total: mockSwaps.length,
    message: 'Mock swap data for testing - replace with real implementation'
  })
}