import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

// Token mint addresses to symbols mapping
const TOKEN_SYMBOLS: { [key: string]: string } = {
  'So11111111111111111111111111111111111111112': 'SOL',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'jitoSOL',
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 'ETH',
  '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': 'BTC'
}

// DEX program IDs for source identification
const DEX_SOURCES: { [key: string]: string } = {
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter',
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': 'Jupiter',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Orca',
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': 'Orca',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium',
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': 'Raydium',
  'SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ': 'Saber'
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const address = searchParams.get('address')
  
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  }

  try {
    console.log('Fetching swap transactions for:', address)
    
    // Get transaction signatures with RPC
    const rpcResponse = await axios.post('https://api.mainnet-beta.solana.com', {
      jsonrpc: '2.0',
      id: 1,
      method: 'getSignaturesForAddress',
      params: [
        address,
        { limit: 50 }
      ]
    })

    const signatures = rpcResponse.data.result || []
    console.log(`Found ${signatures.length} total transactions`)

    const swapTransactions = []
    
    // Process transactions in batches
    for (let i = 0; i < Math.min(signatures.length, 20); i++) {
      try {
        const sig = signatures[i]
        
        // Get transaction details
        const txResponse = await axios.post('https://api.mainnet-beta.solana.com', {
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransaction',
          params: [
            sig.signature,
            { 
              encoding: 'jsonParsed',
              maxSupportedTransactionVersion: 0
            }
          ]
        })

        const tx = txResponse.data.result
        if (!tx || !tx.meta) continue

        // Check if transaction involves token transfers
        const preTokenBalances = tx.meta.preTokenBalances || []
        const postTokenBalances = tx.meta.postTokenBalances || []
        
        // Find our address's token balance changes
        const balanceChanges = []
        
        for (const preBalance of preTokenBalances) {
          if (preBalance.owner === address) {
            const postBalance = postTokenBalances.find((p: any) => 
              p.accountIndex === preBalance.accountIndex
            )
            
            if (postBalance) {
              const preAmount = preBalance.uiTokenAmount?.uiAmount || 0
              const postAmount = postBalance.uiTokenAmount?.uiAmount || 0
              const change = postAmount - preAmount
              
              if (Math.abs(change) > 0.001) {
                balanceChanges.push({
                  mint: preBalance.mint,
                  change,
                  symbol: TOKEN_SYMBOLS[preBalance.mint] || preBalance.mint.slice(0, 8)
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
              balanceChanges.push({
                mint: postBalance.mint,
                change: postBalance.uiTokenAmount.uiAmount,
                symbol: TOKEN_SYMBOLS[postBalance.mint] || postBalance.mint.slice(0, 8)
              })
            }
          }
        }

        // If we have both positive and negative changes, it's likely a swap
        const increases = balanceChanges.filter(b => b.change > 0)
        const decreases = balanceChanges.filter(b => b.change < 0)
        
        if (increases.length > 0 && decreases.length > 0) {
          // Find the DEX source
          const accountKeys = tx.transaction?.message?.accountKeys || []
          let dexSource = 'Unknown DEX'
          
          for (const key of accountKeys) {
            const keyStr = typeof key === 'string' ? key : key.pubkey
            if (keyStr && DEX_SOURCES[keyStr]) {
              dexSource = DEX_SOURCES[keyStr]
              break
            }
          }
          
          // Also check instructions
          if (dexSource === 'Unknown DEX') {
            const instructions = tx.transaction?.message?.instructions || []
            for (const inst of instructions) {
              const programId = inst.programId || inst.program
              if (programId && DEX_SOURCES[programId]) {
                dexSource = DEX_SOURCES[programId]
                break
              }
            }
          }

          const soldToken = decreases[0]
          const boughtToken = increases[0]
          
          swapTransactions.push({
            signature: sig.signature,
            timestamp: sig.blockTime,
            type: 'SWAP',
            action: `SWAP on ${dexSource}`,
            description: `Swapped ${soldToken.symbol} for ${boughtToken.symbol}`,
            status: sig.err ? 'Failed' : 'Success',
            fee: tx.meta.fee || 5000,
            fromToken: soldToken.mint,
            toToken: boughtToken.mint,
            fromAmount: Math.abs(soldToken.change),
            toAmount: boughtToken.change,
            fromSymbol: soldToken.symbol,
            toSymbol: boughtToken.symbol,
            source: dexSource,
            platform: 'Solana',
            slot: sig.slot
          })
        }
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 50))
        
      } catch (error) {
        console.error('Error processing transaction:', error)
        continue
      }
    }

    console.log(`Found ${swapTransactions.length} swap transactions`)
    
    return NextResponse.json({ 
      data: swapTransactions,
      total: swapTransactions.length 
    })
    
  } catch (error: any) {
    console.error('Error fetching real swap transactions:', error.message)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch swap transactions', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}