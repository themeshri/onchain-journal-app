import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

// Known DEX program IDs on Solana
const DEX_PROGRAMS = {
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter',
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': 'Jupiter V4',
  'JUP3c2Uh3WA4Ng34tw6kPd2G4C5BB21Xo36Je1s32Ph': 'Jupiter V3',
  'JUP2jxvXaqu7NQY1GmNF4m1vodw12LVXYxbFL2uJvfo': 'Jupiter V2',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Orca Whirlpool',
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': 'Orca V2',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium V4',
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': 'Raydium CLMM',
  'SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ': 'Saber',
  'MERLuDFBMmsHnsBPZw2sDQZHvXFMwp8EdjudcU2HKky': 'Mercurial',
  'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1': 'Orca V1',
  '27haf8L6oxUeXrHrgEgsexjSY5hbVUWEmvv9Nyxg8vQv': 'Raydium V3',
  'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr': 'Raydium V1',
  '5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h': 'Raydium V2'
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const address = searchParams.get('address')
  
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  }

  try {
    // Get recent signatures
    const sigResponse = await axios.post('https://solana-mainnet.g.alchemy.com/v2/demo', {
      jsonrpc: '2.0',
      id: 1,
      method: 'getSignaturesForAddress',
      params: [address, { limit: 100 }]
    })

    const signatures = sigResponse.data.result || []
    
    // Get transaction details for each signature to check if it's a swap
    const swapTransactions = []
    const batchSize = 10 // Process in batches to avoid rate limits
    
    for (let i = 0; i < Math.min(signatures.length, 30); i += batchSize) {
      const batch = signatures.slice(i, i + batchSize)
      
      const txPromises = batch.map((sig: any) => 
        axios.post('https://solana-mainnet.g.alchemy.com/v2/demo', {
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
        }).catch(() => null)
      )
      
      const txResponses = await Promise.all(txPromises)
      
      for (let j = 0; j < txResponses.length; j++) {
        if (!txResponses[j] || !txResponses[j].data.result) continue
        
        const tx = txResponses[j].data.result
        const sig = batch[j]
        
        // Check if transaction involves a DEX program
        const instructions = tx.transaction?.message?.instructions || []
        const accountKeys = tx.transaction?.message?.accountKeys || []
        
        let isDexTransaction = false
        let dexName = ''
        
        // Check all account keys and instructions for DEX programs
        for (const key of accountKeys) {
          const keyStr = typeof key === 'string' ? key : key.pubkey
          if (keyStr && DEX_PROGRAMS[keyStr]) {
            isDexTransaction = true
            dexName = DEX_PROGRAMS[keyStr]
            break
          }
        }
        
        // If not found in account keys, check instructions
        if (!isDexTransaction) {
          for (const instruction of instructions) {
            const programId = instruction.programId || instruction.program
            if (programId && DEX_PROGRAMS[programId]) {
              isDexTransaction = true
              dexName = DEX_PROGRAMS[programId]
              break
            }
          }
        }
        
        // ONLY include if it's a DEX transaction
        if (isDexTransaction) {
          // Parse token balances to determine swap details
          const preTokenBalances = tx.meta?.preTokenBalances || []
          const postTokenBalances = tx.meta?.postTokenBalances || []
          
          let fromToken = null
          let toToken = null
          let fromAmount = 0
          let toAmount = 0
          
          // Find tokens that changed balance for our address
          const tokenChanges = []
          
          // Check all pre and post balances
          for (const preBalance of preTokenBalances) {
            if (preBalance.owner === address) {
              const postBalance = postTokenBalances.find((p: any) => 
                p.accountIndex === preBalance.accountIndex && p.owner === address
              )
              
              if (postBalance) {
                const preBal = preBalance.uiTokenAmount?.uiAmount || 0
                const postBal = postBalance.uiTokenAmount?.uiAmount || 0
                const diff = postBal - preBal
                
                if (Math.abs(diff) > 0.000001) { // Ignore dust
                  tokenChanges.push({
                    mint: preBalance.mint,
                    change: diff,
                    decimals: preBalance.uiTokenAmount?.decimals || 9
                  })
                }
              }
            }
          }
          
          // Also check post balances that weren't in pre (new tokens)
          for (const postBalance of postTokenBalances) {
            if (postBalance.owner === address) {
              const hadPreBalance = preTokenBalances.some((p: any) => 
                p.accountIndex === postBalance.accountIndex
              )
              
              if (!hadPreBalance && postBalance.uiTokenAmount?.uiAmount > 0) {
                tokenChanges.push({
                  mint: postBalance.mint,
                  change: postBalance.uiTokenAmount.uiAmount,
                  decimals: postBalance.uiTokenAmount?.decimals || 9
                })
              }
            }
          }
          
          // Identify sold and bought tokens
          const soldTokens = tokenChanges.filter(t => t.change < 0)
          const boughtTokens = tokenChanges.filter(t => t.change > 0)
          
          if (soldTokens.length > 0) {
            fromToken = soldTokens[0].mint
            fromAmount = Math.abs(soldTokens[0].change)
          }
          
          if (boughtTokens.length > 0) {
            toToken = boughtTokens[0].mint
            toAmount = boughtTokens[0].change
          }
          
          swapTransactions.push({
            signature: sig.signature,
            timestamp: sig.blockTime,
            type: 'SWAP',
            action: dexName ? `SWAP on ${dexName}` : 'TOKEN SWAP',
            description: `Swapped tokens on ${dexName || 'DEX'}`,
            status: sig.err ? 'Failed' : 'Success',
            fee: tx.meta?.fee || 5000,
            fromToken,
            toToken,
            fromAmount,
            toAmount,
            source: dexName || 'Unknown DEX',
            platform: 'Solana',
            slot: sig.slot
          })
        }
      }
      
      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < signatures.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return NextResponse.json({ 
      data: swapTransactions,
      total: swapTransactions.length 
    })
    
  } catch (error: any) {
    console.error('Error fetching swap transactions:', error.message)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch swap transactions', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}