import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

// Free RPC endpoints that work without authentication
const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  'https://rpc.ankr.com/solana',
  'https://solana.public-rpc.com'
]

// Known DEX program IDs on Solana
const DEX_PROGRAMS: { [key: string]: string } = {
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter',
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': 'Jupiter V4',
  'JUP3c2Uh3WA4Ng34tw6kPd2G4C5BB21Xo36Je1s32Ph': 'Jupiter V3',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Orca Whirlpool',
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': 'Orca V2',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium V4',
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': 'Raydium CLMM',
  'SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ': 'Saber',
  'MERLuDFBMmsHnsBPZw2sDQZHvXFMwp8EdjudcU2HKky': 'Mercurial'
}

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
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': 'PYTH',
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'JUP',
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': 'stSOL',
  'A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM': 'USDCet',
  'Dn4noZ5jgGfkntzcQSUZ8czkreiZ1ForXYoV2H8Dm7S1': 'USDTet',
  '5RpUwQ8wtdPCZHhu6MERp2RGrpobsbZ6MH5dDHkUjs2': 'BUSDet'
}

async function tryRpcEndpoint(endpoint: string, method: string, params: any[]) {
  try {
    const response = await axios.post(endpoint, {
      jsonrpc: '2.0',
      id: 1,
      method,
      params
    }, {
      timeout: 5000
    })
    return response.data
  } catch (error) {
    return null
  }
}

async function fetchWithFallback(method: string, params: any[]) {
  for (const endpoint of RPC_ENDPOINTS) {
    const result = await tryRpcEndpoint(endpoint, method, params)
    if (result && !result.error) {
      return result
    }
  }
  throw new Error('All RPC endpoints failed')
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const address = searchParams.get('address')
  
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  }

  try {
    console.log('Fetching transactions for:', address)
    
    // Get recent signatures - fetch more to ensure we find enough swaps
    const signaturesResult = await fetchWithFallback('getSignaturesForAddress', [
      address,
      { limit: 1000 }  // Fetch up to 1000 transactions
    ])

    const signatures = signaturesResult.result || []
    console.log(`Found ${signatures.length} total transactions`)

    if (signatures.length === 0) {
      return NextResponse.json({ 
        data: [],
        total: 0,
        source: 'Solana RPC (no transactions found)'
      })
    }

    const swapTransactions = []
    const targetSwapCount = 10 // We want to find at least 10 swaps
    let processedCount = 0
    const maxToProcess = Math.min(signatures.length, 100) // Process up to 100 transactions
    
    // Process transactions until we find enough swaps or hit the limit
    for (let i = 0; i < maxToProcess && swapTransactions.length < targetSwapCount; i++) {
      processedCount++
      const sig = signatures[i]
      
      try {
        // Get parsed transaction
        const txResult = await fetchWithFallback('getTransaction', [
          sig.signature,
          { 
            encoding: 'jsonParsed',
            maxSupportedTransactionVersion: 0
          }
        ])

        const tx = txResult.result
        if (!tx || !tx.meta) continue

        // Check if transaction involves DEX programs
        const accountKeys = tx.transaction?.message?.accountKeys || []
        let isDexTransaction = false
        let dexName = ''
        
        // Check account keys for DEX programs
        for (const key of accountKeys) {
          const keyStr = typeof key === 'string' ? key : key.pubkey
          if (keyStr && DEX_PROGRAMS[keyStr]) {
            isDexTransaction = true
            dexName = DEX_PROGRAMS[keyStr]
            break
          }
        }

        // Also check instructions for DEX programs
        if (!isDexTransaction) {
          const instructions = tx.transaction?.message?.instructions || []
          for (const inst of instructions) {
            const programId = inst.programId || inst.program
            if (programId && DEX_PROGRAMS[programId]) {
              isDexTransaction = true
              dexName = DEX_PROGRAMS[programId]
              break
            }
          }
        }

        // If it's a DEX transaction, analyze token transfers
        if (isDexTransaction) {
          const preTokenBalances = tx.meta.preTokenBalances || []
          const postTokenBalances = tx.meta.postTokenBalances || []
          
          // Find token changes for our address
          const tokenChanges = []
          
          for (const preBalance of preTokenBalances) {
            if (preBalance.owner === address) {
              const postBalance = postTokenBalances.find((p: any) => 
                p.accountIndex === preBalance.accountIndex
              )
              
              if (postBalance) {
                const preBal = preBalance.uiTokenAmount?.uiAmount || 0
                const postBal = postBalance.uiTokenAmount?.uiAmount || 0
                const change = postBal - preBal
                
                if (Math.abs(change) > 0.000001) {
                  tokenChanges.push({
                    mint: preBalance.mint,
                    change,
                    symbol: TOKEN_SYMBOLS[preBalance.mint] || preBalance.mint.slice(0, 6),
                    decimals: preBalance.uiTokenAmount?.decimals || 9
                  })
                }
              }
            }
          }

          // Check for new tokens (not in preBalances)
          for (const postBalance of postTokenBalances) {
            if (postBalance.owner === address) {
              const hadPreBalance = preTokenBalances.some((p: any) => 
                p.accountIndex === postBalance.accountIndex
              )
              
              if (!hadPreBalance && postBalance.uiTokenAmount?.uiAmount > 0) {
                tokenChanges.push({
                  mint: postBalance.mint,
                  change: postBalance.uiTokenAmount.uiAmount,
                  symbol: TOKEN_SYMBOLS[postBalance.mint] || postBalance.mint.slice(0, 6),
                  decimals: postBalance.uiTokenAmount?.decimals || 9
                })
              }
            }
          }

          // If we have both positive and negative changes, it's likely a swap
          const increases = tokenChanges.filter(t => t.change > 0)
          const decreases = tokenChanges.filter(t => t.change < 0)
          
          if (increases.length > 0 && decreases.length > 0) {
            const soldToken = decreases[0]
            const boughtToken = increases[0]
            
            swapTransactions.push({
              signature: sig.signature,
              timestamp: sig.blockTime,
              type: 'SWAP',
              action: `SWAP on ${dexName}`,
              description: `Swapped ${soldToken.symbol} for ${boughtToken.symbol}`,
              status: sig.err ? 'Failed' : 'Success',
              fee: tx.meta.fee || 5000,
              fromToken: soldToken.mint,
              toToken: boughtToken.mint,
              fromAmount: Math.abs(soldToken.change),
              toAmount: boughtToken.change,
              fromSymbol: soldToken.symbol,
              toSymbol: boughtToken.symbol,
              source: dexName,
              platform: 'Solana',
              slot: sig.slot
            })
          }
        }
        
        // Add delay to avoid rate limiting (increase delay after finding swaps)
        await new Promise(resolve => setTimeout(resolve, swapTransactions.length > 3 ? 500 : 200))
        
      } catch (error) {
        console.error('Error processing transaction:', sig.signature, error)
        continue
      }
    }

    console.log(`Found ${swapTransactions.length} swap transactions from ${processedCount} processed`)
    
    // If we found some swaps, return them
    if (swapTransactions.length > 0) {
      return NextResponse.json({ 
        data: swapTransactions,
        total: swapTransactions.length,
        source: `Solana Free RPC (${processedCount} transactions analyzed)`
      })
    }
    
    // If no swaps found, return demo data with a message
    console.log('No swaps found in recent transactions, returning demo data')
    const demoSwaps = [
      {
        signature: '3L25xHjUq6bF4Bd8LL2c',
        timestamp: Math.floor(Date.now() / 1000) - 3600,
        type: 'SWAP',
        action: 'SWAP on Jupiter',
        description: 'Swapped USDC for SOL',
        status: 'Success',
        fee: 5000,
        fromToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        toToken: 'So11111111111111111111111111111111111111112',
        fromAmount: 1000,
        toAmount: 5.14,
        fromSymbol: 'USDC',
        toSymbol: 'SOL',
        source: 'Jupiter',
        platform: 'Solana'
      },
      {
        signature: '2K15xHjUq6bF4Bd8LL2c',
        timestamp: Math.floor(Date.now() / 1000) - 7200,
        type: 'SWAP',
        action: 'SWAP on Raydium',
        description: 'Swapped SOL for BONK',
        status: 'Success',
        fee: 5000,
        fromToken: 'So11111111111111111111111111111111111111112',
        toToken: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        fromAmount: 2.5,
        toAmount: 54144626,
        fromSymbol: 'SOL',
        toSymbol: 'BONK',
        source: 'Raydium',
        platform: 'Solana'
      }
    ]
    
    return NextResponse.json({ 
      data: demoSwaps,
      total: demoSwaps.length,
      source: `Demo Data (${processedCount} transactions analyzed, no swaps found)`
    })
    
  } catch (error: any) {
    console.error('Error fetching transactions:', error.message)
    
    // Return demo swaps on error
    const demoSwaps = [
      {
        signature: '3L25xHjUq6bF4Bd8LL2c',
        timestamp: Math.floor(Date.now() / 1000) - 3600,
        type: 'SWAP',
        action: 'SWAP on Jupiter',
        description: 'Swapped USDC for SOL',
        status: 'Success',
        fee: 5000,
        fromToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        toToken: 'So11111111111111111111111111111111111111112',
        fromAmount: 1000,
        toAmount: 5.14,
        fromSymbol: 'USDC',
        toSymbol: 'SOL',
        source: 'Jupiter',
        platform: 'Solana'
      },
      {
        signature: '2K15xHjUq6bF4Bd8LL2c',
        timestamp: Math.floor(Date.now() / 1000) - 7200,
        type: 'SWAP',
        action: 'SWAP on Raydium',
        description: 'Swapped SOL for BONK',
        status: 'Success',
        fee: 5000,
        fromToken: 'So11111111111111111111111111111111111111112',
        toToken: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        fromAmount: 2.5,
        toAmount: 54144626,
        fromSymbol: 'SOL',
        toSymbol: 'BONK',
        source: 'Raydium',
        platform: 'Solana'
      },
      {
        signature: '1F25xHjUq6bF4Bd8LL2c',
        timestamp: Math.floor(Date.now() / 1000) - 10800,
        type: 'SWAP',
        action: 'SWAP on Orca',
        description: 'Swapped USDT for USDC',
        status: 'Success',
        fee: 5000,
        fromToken: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        toToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        fromAmount: 500,
        toAmount: 500.12,
        fromSymbol: 'USDT',
        toSymbol: 'USDC',
        source: 'Orca',
        platform: 'Solana'
      }
    ]
    
    return NextResponse.json({ 
      data: demoSwaps,
      total: demoSwaps.length,
      source: 'Demo Data (RPC unavailable)',
      error: error.message
    })
  }
}