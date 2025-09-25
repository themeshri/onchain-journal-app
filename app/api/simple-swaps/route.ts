import { NextRequest, NextResponse } from 'next/server'

// Generate realistic swap data based on wallet address
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const address = searchParams.get('address')
  
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  }

  // Generate demo swaps with realistic data
  const now = Math.floor(Date.now() / 1000)
  const swaps = [
    {
      signature: `5K${address.slice(0, 8)}xHjUq6bF4Bd8LL2c`,
      timestamp: now - 3600,
      type: 'SWAP',
      action: 'SWAP on Jupiter',
      description: 'Swapped USDC for SOL',
      status: 'Success',
      fee: 5000,
      fromToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      toToken: 'So11111111111111111111111111111111111111112',
      fromAmount: 2500.50,
      toAmount: 12.85,
      fromSymbol: 'USDC',
      toSymbol: 'SOL',
      source: 'Jupiter',
      platform: 'Solana',
      value: 2500.50
    },
    {
      signature: `4N${address.slice(0, 8)}yTcJvPyuVWA6yvB`,
      timestamp: now - 7200,
      type: 'SWAP',
      action: 'SWAP on Raydium',
      description: 'Swapped SOL for BONK',
      status: 'Success',
      fee: 5000,
      fromToken: 'So11111111111111111111111111111111111111112',
      toToken: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      fromAmount: 5.2,
      toAmount: 125442315.26,
      fromSymbol: 'SOL',
      toSymbol: 'BONK',
      source: 'Raydium',
      platform: 'Solana',
      value: 1014.50
    },
    {
      signature: `3M${address.slice(0, 8)}xHjUqAobWPpxj`,
      timestamp: now - 10800,
      type: 'SWAP',
      action: 'SWAP on Orca',
      description: 'Swapped USDT for USDC',
      status: 'Success',
      fee: 5000,
      fromToken: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      toToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      fromAmount: 1000,
      toAmount: 1001.24,
      fromSymbol: 'USDT',
      toSymbol: 'USDC',
      source: 'Orca',
      platform: 'Solana',
      value: 1000
    },
    {
      signature: `2X${address.slice(0, 8)}MEEBjVwRBLZAjg`,
      timestamp: now - 14400,
      type: 'SWAP',
      action: 'SWAP on Jupiter',
      description: 'Swapped SOL for JUP',
      status: 'Success',
      fee: 5000,
      fromToken: 'So11111111111111111111111111111111111111112',
      toToken: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      fromAmount: 3.5,
      toAmount: 2847.33,
      fromSymbol: 'SOL',
      toSymbol: 'JUP',
      source: 'Jupiter',
      platform: 'Solana',
      value: 683.25
    },
    {
      signature: `1A${address.slice(0, 8)}pqWJ9UGj9rwzXr`,
      timestamp: now - 18000,
      type: 'SWAP',
      action: 'SWAP on Raydium',
      description: 'Swapped RAY for SOL',
      status: 'Success',
      fee: 5000,
      fromToken: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
      toToken: 'So11111111111111111111111111111111111111112',
      fromAmount: 500,
      toAmount: 8.25,
      fromSymbol: 'RAY',
      toSymbol: 'SOL',
      source: 'Raydium',
      platform: 'Solana',
      value: 1610.12
    },
    {
      signature: `6P${address.slice(0, 8)}CLdBByRjTpgf5P`,
      timestamp: now - 86400,
      type: 'SWAP',
      action: 'SWAP on Orca',
      description: 'Swapped USDC for mSOL',
      status: 'Success',
      fee: 5000,
      fromToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      toToken: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
      fromAmount: 3000,
      toAmount: 14.75,
      fromSymbol: 'USDC',
      toSymbol: 'mSOL',
      source: 'Orca',
      platform: 'Solana',
      value: 3000
    },
    {
      signature: `7H${address.slice(0, 8)}fYFKgB5yXLBrW`,
      timestamp: now - 172800,
      type: 'SWAP',
      action: 'SWAP on Jupiter',
      description: 'Swapped jitoSOL for SOL',
      status: 'Success',
      fee: 5000,
      fromToken: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
      toToken: 'So11111111111111111111111111111111111111112',
      fromAmount: 10.5,
      toAmount: 10.85,
      fromSymbol: 'jitoSOL',
      toSymbol: 'SOL',
      source: 'Jupiter',
      platform: 'Solana',
      value: 2119.75
    },
    {
      signature: `8Q${address.slice(0, 8)}vg8vyTcJvPyuVW`,
      timestamp: now - 259200,
      type: 'SWAP',
      action: 'SWAP on Raydium',
      description: 'Swapped USDC for PYTH',
      status: 'Success',
      fee: 5000,
      fromToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      toToken: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
      fromAmount: 500,
      toAmount: 1428.57,
      fromSymbol: 'USDC',
      toSymbol: 'PYTH',
      source: 'Raydium',
      platform: 'Solana',
      value: 500
    },
    {
      signature: `9Z${address.slice(0, 8)}RWDCXSRXEj1xF3`,
      timestamp: now - 345600,
      type: 'SWAP',
      action: 'SWAP on Orca',
      description: 'Swapped SOL for USDC',
      status: 'Success',
      fee: 5000,
      fromToken: 'So11111111111111111111111111111111111111112',
      toToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      fromAmount: 20,
      toAmount: 3900.80,
      fromSymbol: 'SOL',
      toSymbol: 'USDC',
      source: 'Orca',
      platform: 'Solana',
      value: 3900.80
    },
    {
      signature: `0B${address.slice(0, 8)}PN5FUqLGLxrGq8`,
      timestamp: now - 432000,
      type: 'SWAP',
      action: 'SWAP on Jupiter',
      description: 'Swapped BONK for SOL',
      status: 'Success',
      fee: 5000,
      fromToken: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      toToken: 'So11111111111111111111111111111111111111112',
      fromAmount: 500000000,
      toAmount: 10.25,
      fromSymbol: 'BONK',
      toSymbol: 'SOL',
      source: 'Jupiter',
      platform: 'Solana',
      value: 2000.75
    }
  ]

  return NextResponse.json({
    data: swaps,
    total: swaps.length,
    source: 'Demo Data (RPC endpoints are rate-limited, showing sample swaps)'
  })
}