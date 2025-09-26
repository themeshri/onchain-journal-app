import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import {
  initDatabase,
  getLastTransaction,
  getStoredTransactions,
  insertTransactions,
  getTransactionsByDateRange,
  getTransactionCount
} from '../../../lib/db-pool'
import { getServerConfig, validateServerConfig } from '../../../lib/config'
import { 
  HeliusSwapsQuerySchema, 
  validateQuery, 
  formatZodError, 
  TransactionSchema 
} from '../../../lib/validation'
import { 
  withErrorHandler, 
  throwValidationError, 
  throwExternalApiError, 
  throwDatabaseError,
  throwAuthorizationError,
  createErrorContext
} from '../../../lib/error-handler'
import { withRateLimit } from '../../../lib/rate-limiter'
import { 
  retryExternalApiCall, 
  retryDatabaseOperation, 
  retryRpcCall,
  withTimeout,
  heliusCircuitBreaker,
  jupiterCircuitBreaker,
  withCircuitBreaker
} from '../../../lib/retry-utils'
import { TIMEOUT_CONFIG } from '../../../lib/error-config'

// Initialize database on first load
initDatabase().catch(console.error)

// Get configuration securely from server-side config
const config = getServerConfig()
const HELIUS_API_KEY = config.helius.apiKey
const HELIUS_RPC_URL = config.helius.rpcUrl || ''

// Define stablecoins and base currencies - global scope
const stablecoins = ['USDC', 'USDT', 'DAI', 'BUSD']  // USDUC is NOT a stablecoin - it's a meme coin!
const baseCurrencies = ['SOL', ...stablecoins]

// Transaction classification function
function classifyTransaction(fromSymbol: string, toSymbol: string, allSwaps: any[], currentIndex: number): 'sell' | 'sell all' | 'first buy' | 'buy more' {

  // Determine if this is a buy or sell
  const isBuying = baseCurrencies.includes(fromSymbol) && !baseCurrencies.includes(toSymbol)
  const isSelling = !baseCurrencies.includes(fromSymbol) && baseCurrencies.includes(toSymbol)

  if (isBuying) {
    // Check if this is the first time buying this token
    const previousBuys = allSwaps.slice(currentIndex + 1).filter((swap: any) => {
      const prevFromSymbol = swap.fromSymbol || ''
      const prevToSymbol = swap.toSymbol || ''
      return baseCurrencies.includes(prevFromSymbol) && prevToSymbol === toSymbol
    })

    return previousBuys.length === 0 ? 'first buy' : 'buy more'
  }

  if (isSelling) {
    // For sells, we'll default to "sell" for now
    // In a more sophisticated system, we'd track balances to determine "sell all"
    // For now, we can look at relative amounts or patterns
    return 'sell'
  }

  // For token-to-token swaps, treat as selling the from token
  return 'sell'
}

// Dynamic token cache to avoid repeated API calls
const TOKEN_CACHE: { [key: string]: { symbol: string, decimals: number } } = {}

// Token metadata - NO HARDCODED PRICES, everything comes from Jupiter API
const ESSENTIAL_TOKENS: { [key: string]: { symbol: string, decimals: number } } = {
  // Stablecoins (pegged to $1)
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', decimals: 6 },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', decimals: 6 },
  // Meme coins and other tokens (volatile prices)
  'CB9dDufT3ZuQXqqSfa1c5kY935TEreyBw9XJXxHKpump': { symbol: 'USDUC', decimals: 6 }, // MEME COIN - NOT a stablecoin!
  'So11111111111111111111111111111111111111112': { symbol: 'SOL', decimals: 9 },
  '5zCETicUCJqJ5Z3wbfFPZqtSpHPYqnggs1wX7ZRpump': { symbol: 'SPARK', decimals: 9 },
  '5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2': { symbol: 'TROLL', decimals: 9 },
  'CARDSccUMFKoPRZxt5vt3ksUbxEFEcnZ3H2pd3dKxYjp': { symbol: 'CARDS', decimals: 9 },
}

// Function to derive Metaplex metadata PDA
function deriveMetadataPda(mintAddress: string): string {
  // This is a simplified version - in production you'd use @solana/web3.js PublicKey.findProgramAddress
  // For now, we'll use a known pattern for pump.fun and other common metadata
  const METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
  // This is where the metadata PDA would be calculated
  // For now, return a placeholder since we can't easily derive it without proper crypto libraries
  return 'metadata_pda_placeholder'
}

// Function to fetch token metadata directly from blockchain
async function getTokenSymbol(mintAddress: string): Promise<string> {
  console.log('Getting token symbol for:', mintAddress.slice(0, 8))

  // Check essential tokens first
  if (ESSENTIAL_TOKENS[mintAddress]) {
    console.log('Found in essential tokens:', ESSENTIAL_TOKENS[mintAddress].symbol)
    return ESSENTIAL_TOKENS[mintAddress].symbol
  }

  // Check dynamic cache
  if (TOKEN_CACHE[mintAddress]) {
    console.log('Found in cache:', TOKEN_CACHE[mintAddress].symbol)
    return TOKEN_CACHE[mintAddress].symbol
  }

  console.log('Fetching metadata from blockchain for:', mintAddress.slice(0, 8))

  try {
    // Method 1: Try Helius DAS (Digital Asset Standard) API if available
    if (HELIUS_API_KEY) {
      try {
        console.log('Trying Helius DAS API for:', mintAddress.slice(0, 8))
        const dasResponse = await fetch(HELIUS_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'token-metadata',
            method: 'getAsset',
            params: { id: mintAddress }
          })
        })

        const dasData = await dasResponse.json()
        if (dasData.result && dasData.result.content) {
          const metadata = dasData.result.content.metadata
          if (metadata && metadata.symbol) {
            console.log('Found symbol via Helius DAS:', metadata.symbol)
            TOKEN_CACHE[mintAddress] = {
              symbol: metadata.symbol,
              decimals: dasData.result.token_info?.decimals || 9
            }
            return metadata.symbol
          }
        }
      } catch (error) {
        console.log('Helius DAS API failed for:', mintAddress.slice(0, 8))
      }
    }

    // Method 2: Try to get basic mint info and check if it's a valid token
    const tokenSupplyResponse = await fetchWithFallback('getTokenSupply', [mintAddress])

    if (tokenSupplyResponse?.result?.value) {
      console.log('Token exists on chain:', mintAddress.slice(0, 8))
      const decimals = tokenSupplyResponse.result.value.decimals || 9

      // Method 3: For pump.fun tokens, use a more sophisticated naming
      if (mintAddress.includes('pump') || mintAddress.endsWith('pump')) {
        // Generate a meaningful name for pump tokens
        const pumpName = generatePumpTokenName(mintAddress)
        console.log('Generated pump token name:', pumpName)
        TOKEN_CACHE[mintAddress] = { symbol: pumpName, decimals: 6 }
        return pumpName
      }

      // Method 4: Create a short, readable token identifier
      const shortSymbol = mintAddress.slice(0, 8).toUpperCase()
      console.log('Generated short symbol:', shortSymbol)
      TOKEN_CACHE[mintAddress] = { symbol: shortSymbol, decimals }
      return shortSymbol
    }

  } catch (error) {
    console.log('Failed to fetch blockchain metadata for:', mintAddress.slice(0, 8), error)
  }

  // Final fallback
  const fallback = mintAddress.slice(0, 8).toUpperCase()
  console.log('Using final fallback:', fallback)
  TOKEN_CACHE[mintAddress] = { symbol: fallback, decimals: 9 }
  return fallback
}

// Helper function to generate meaningful names for pump.fun tokens
function generatePumpTokenName(mintAddress: string): string {
  // Extract some characteristics from the mint address to create a more meaningful name
  const hash = mintAddress.slice(0, 8)

  // Simple mapping based on hash patterns (this is just for demo)
  const patterns = {
    '5UUH': 'MEME5U',
    'CB9d': 'CBMEME',
    'pump': 'PUMP'
  }

  for (const [pattern, name] of Object.entries(patterns)) {
    if (mintAddress.includes(pattern)) {
      return name
    }
  }

  // Default pattern
  return 'TKN' + hash.slice(0, 4)
}

// Free RPC endpoints that work without authentication
const RPC_ENDPOINTS = [
  HELIUS_RPC_URL,
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
  'https://solana.public-rpc.com',
  'https://solana-api.projectserum.com',
  'https://rpc.hellomoon.io/e4c1bc57-4b3d-4a42-b5f7-bd0b6b26e8e7',
  'https://solana-mainnet.g.alchemy.com/v2/demo',
  'https://api.devnet.solana.com'  // fallback to devnet if mainnet fails
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

async function tryRpcEndpoint(endpoint: string, method: string, params: any[]) {
  return retryRpcCall(async () => {
    return withTimeout(async () => {
      const response = await axios.post(endpoint, {
        jsonrpc: '2.0',
        id: 1,
        method,
        params
      }, {
        timeout: TIMEOUT_CONFIG.rpc,
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (response.data && !response.data.error) {
        return response.data
      }

      // If we got a response with an error, throw to trigger retry
      if (response.data && response.data.error) {
        throw new Error(`RPC error: ${response.data.error.message}`)
      }

      throw new Error('Invalid RPC response')
    }, { timeout: TIMEOUT_CONFIG.rpc, timeoutMessage: `RPC call to ${endpoint} timed out` })
  }, endpoint)
}

async function fetchWithFallback(method: string, params: any[]) {
  const errors: string[] = []

  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const result = await tryRpcEndpoint(endpoint, method, params)
      if (result && !result.error) {
        return result
      }
      errors.push(`${endpoint.slice(0, 30)}: failed`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`${endpoint.slice(0, 30)}: ${errorMessage}`)
    }
  }

  throwExternalApiError('Solana RPC', `All endpoints failed for ${method}: ${errors.join(', ')}`)
}

function formatTokenAmount(amount: number, decimals: number): number {
  return amount / Math.pow(10, decimals)
}

// Deprecated - use calculateUSDValueDirectly instead
// This function is only kept for backward compatibility with demo data
function calculateUSDValue(tokenMint: string, amount: number, decimals?: number): number {
  // No hardcoded prices - always return 0 for sync functions
  // Real prices must come from async Jupiter API calls
  return 0
}

// Deprecated - prices must come from async Jupiter API
function calculateUSDValueWithContext(tokenMint: string, amount: number, decimals: number, counterpartToken?: string, counterpartAmount?: number, counterpartDecimals?: number): number {
  // No hardcoded prices - always return 0 for sync functions
  return 0
}

// Cache for Jupiter API prices (5 minute cache)
const JUPITER_PRICE_CACHE: { [key: string]: { price: number, timestamp: number } } = {}
const JUPITER_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Fetch real-time prices from Jupiter API
async function getJupiterPrices(tokenMints: string[]): Promise<{ [key: string]: number }> {
  return withCircuitBreaker(async () => {
    return retryExternalApiCall(async () => {
      return withTimeout(async () => {
        const uniqueMints = [...new Set(tokenMints)]
        const idsParam = uniqueMints.join(',')
        const response = await axios.get(`https://lite-api.jup.ag/price/v3?ids=${idsParam}`, {
          timeout: TIMEOUT_CONFIG.externalApi
        })

        const prices: { [key: string]: number } = {}
        if (response.data) {
          for (const [mint, data] of Object.entries(response.data)) {
            if (data && typeof data === 'object' && 'usdPrice' in data) {
              const priceData = data as any
              prices[mint] = priceData.usdPrice
              // Cache the price
              JUPITER_PRICE_CACHE[mint] = {
                price: priceData.usdPrice,
                timestamp: Date.now()
              }
              console.log(`🚀 Jupiter API: ${mint.slice(0, 8)}... = $${priceData.usdPrice}`)
            }
          }
        }
        return prices
      }, { 
        timeout: TIMEOUT_CONFIG.externalApi, 
        timeoutMessage: 'Jupiter API request timed out' 
      })
    }, 'Jupiter')
  }, jupiterCircuitBreaker, 'Jupiter')
}

// Get cached or fetch fresh price from Jupiter
async function getTokenPrice(tokenMint: string): Promise<number> {
  // Check cache first
  const cached = JUPITER_PRICE_CACHE[tokenMint]
  if (cached && (Date.now() - cached.timestamp) < JUPITER_CACHE_DURATION) {
    return cached.price
  }

  // Always fetch from Jupiter API - no hardcoded prices
  const prices = await getJupiterPrices([tokenMint])
  return prices[tokenMint] || 0
}

// Direct USD calculation using real-time prices from Jupiter API
async function calculateUSDValueDirectly(tokenMint: string, formattedAmount: number): Promise<number> {
  const price = await getTokenPrice(tokenMint)
  if (price > 0) {
    const usdValue = formattedAmount * price
    const tokenSymbol = ESSENTIAL_TOKENS[tokenMint]?.symbol || TOKEN_CACHE[tokenMint]?.symbol || tokenMint.slice(0, 8)
    console.log(`💰 ${tokenSymbol}: ${formattedAmount} × $${price} = $${usdValue.toFixed(2)}`)
    return usdValue
  }

  console.log(`💰 No real-time price data available for token ${tokenMint.slice(0, 8)}...`)
  return 0
}

async function handleHeliusSwaps(request: NextRequest): Promise<NextResponse> {
  // Validate query parameters
  const searchParams = request.nextUrl.searchParams
  const queryParams = Object.fromEntries(searchParams.entries())
  
  const validation = validateQuery(HeliusSwapsQuerySchema, queryParams)
  
  if (!validation.success) {
    throwValidationError(
      'Invalid request parameters',
      formatZodError(validation.details).map(detail => ({
        field: detail.field,
        message: detail.message
      })),
      createErrorContext(request)
    )
  }
  
  const { address, source = 'helius', cache = true, limit = 50 } = validation.data
  
  // Check if required API keys are configured based on source
  if (source === 'helius' && !HELIUS_API_KEY) {
    throwAuthorizationError(
      'Helius API key is not configured. Please set HELIUS_API_KEY in environment variables.',
      createErrorContext(request)
    )
  }
  
  if (source === 'solscan' && !config.solscan.apiKey) {
    throwAuthorizationError(
      'Solscan API key is not configured. Please set SOLSCAN_API_KEY in environment variables.',
      createErrorContext(request)
    )
  }

  console.log('Fetching transactions for:', address)

    // Calculate timestamp for 7 days ago
    const sevenDaysAgo = Math.floor((Date.now() - (7 * 24 * 60 * 60 * 1000)) / 1000)

    // Get the last stored transaction to determine where to start fetching
    const lastStoredTransaction = await getLastTransaction(address)
    console.log('Last stored transaction:', lastStoredTransaction ?
      `${lastStoredTransaction.signature.slice(0, 8)}... at slot ${lastStoredTransaction.slot}` :
      'None found')

    // Always fetch the most recent 1000 transactions (ignore lastStoredTransaction for now)
    // This will ensure we always capture the latest transactions while we debug the DB issue
    const fetchParams: any = { limit: 1000 }

    console.log('🔄 Fetching most recent 1000 transactions (ignoring DB pagination due to sync issues)')

    const signaturesResult = await fetchWithFallback('getSignaturesForAddress', [
      address,
      fetchParams
    ])

    const newSignatures = signaturesResult.result || []
    console.log(`Found ${newSignatures.length} new transactions since last fetch`)

    // Filter to only include transactions from the last 7 days
    const recentNewSignatures = newSignatures.filter((sig: any) => sig.blockTime && sig.blockTime >= sevenDaysAgo)
    console.log(`${recentNewSignatures.length} new transactions are from last 7 days`)

    // Process new transactions if any
    const newSwapTransactions: any[] = []
    let processedCount = 0

    if (recentNewSignatures.length > 0) {
      console.log(`Processing ${recentNewSignatures.length} new transactions...`)

      // Process all new transactions to find swaps
      for (let i = 0; i < recentNewSignatures.length; i++) {
        processedCount++
        const sig = recentNewSignatures[i]
      
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
                    symbol: '', // Will be populated async
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
                  symbol: '', // Will be populated async
                  decimals: postBalance.uiTokenAmount?.decimals || 9
                })
              }
            }
          }

          console.log('Token changes detected:', tokenChanges.length)
          tokenChanges.forEach((tc, i) => {
            console.log(`Token ${i}:`, tc.mint.slice(0, 8), 'change:', tc.change)
          })

          // Resolve all token symbols asynchronously
          await Promise.all(tokenChanges.map(async (tokenChange) => {
            tokenChange.symbol = await getTokenSymbol(tokenChange.mint)
          }))

          console.log('Token symbols resolved:')
          tokenChanges.forEach((tc, i) => {
            console.log(`Token ${i}:`, tc.symbol)
          })

          // If we have both positive and negative changes, it's likely a swap
          const increases = tokenChanges.filter(t => t.change > 0)
          const decreases = tokenChanges.filter(t => t.change < 0)

          if (increases.length > 0 && decreases.length > 0) {
            const soldToken = decreases[0]
            const boughtToken = increases[0]

            // Determine if this is a buy or sell based on base currencies
            const baseCurrencies = ['SOL', 'USDC', 'USDT']
            const isBuy = baseCurrencies.includes(soldToken.symbol) && !baseCurrencies.includes(boughtToken.symbol)
            const isSell = !baseCurrencies.includes(soldToken.symbol) && baseCurrencies.includes(boughtToken.symbol)

            // The "traded coin" is the non-base currency
            let tradedCoin = ''
            let tradedCoinMint = ''
            if (isBuy) {
              tradedCoin = boughtToken.symbol
              tradedCoinMint = boughtToken.mint
            } else if (isSell) {
              tradedCoin = soldToken.symbol
              tradedCoinMint = soldToken.mint
            } else {
              // Token-to-token swap, use the sold token as traded
              tradedCoin = soldToken.symbol
              tradedCoinMint = soldToken.mint
            }

            // Calculate USD values for token-to-token swaps
            // Priority: Use the token with known price to determine the swap value
            // Note: soldToken.change is already in formatted units (e.g., 80465.566888), not raw units
            const soldAmount = Math.abs(soldToken.change)
            const boughtAmount = boughtToken.change

            console.log(`🔍 Debug amounts: sold ${soldToken.symbol}=${soldAmount}, bought ${boughtToken.symbol}=${boughtAmount}`)

            let swapValueUSD = 0

            // Determine swap value based on transaction data, not current prices
            // Priority: Use stablecoins as the base value since they're pegged to $1
            // Using stablecoins from global scope

            if (stablecoins.includes(soldToken.symbol)) {
              // Selling a stablecoin - use its amount as the USD value
              swapValueUSD = soldAmount // Stablecoins are always $1
              console.log(`💱 Swap value: $${swapValueUSD.toFixed(2)} (selling ${soldAmount} ${soldToken.symbol} @ $1.00)`)
            } else if (stablecoins.includes(boughtToken.symbol)) {
              // Buying a stablecoin - use its amount as the USD value
              swapValueUSD = boughtAmount // Stablecoins are always $1
              console.log(`💱 Swap value: $${swapValueUSD.toFixed(2)} (buying ${boughtAmount} ${boughtToken.symbol} @ $1.00)`)
            } else {
              // Token-to-token swap (no stablecoin involved)
              // We can only estimate value using current prices, not historical
              console.log(`🔄 Token-to-token swap: ${soldToken.symbol} → ${boughtToken.symbol}`)

              // Try to get current prices from Jupiter
              const prices = await getJupiterPrices([soldToken.mint, boughtToken.mint])
              const soldTokenPrice = prices[soldToken.mint] || 0
              const boughtTokenPrice = prices[boughtToken.mint] || 0

              // Use whichever token has a known price
              if (soldTokenPrice > 0) {
                swapValueUSD = soldAmount * soldTokenPrice
                console.log(`💱 Estimated value: $${swapValueUSD.toFixed(2)} (based on current ${soldToken.symbol} price: $${soldTokenPrice})`)
              } else if (boughtTokenPrice > 0) {
                swapValueUSD = boughtAmount * boughtTokenPrice
                console.log(`💱 Estimated value: $${swapValueUSD.toFixed(2)} (based on current ${boughtToken.symbol} price: $${boughtTokenPrice})`)
              } else {
                // No prices available - cannot determine USD value
                swapValueUSD = 0
                console.log(`⚠️ Cannot determine USD value - no price data for ${soldToken.symbol} or ${boughtToken.symbol}`)
              }
            }


            // Using stablecoins from global scope
            const isSellingForStablecoin = stablecoins.includes(boughtToken.symbol)
            const isBuyingWithStablecoin = stablecoins.includes(soldToken.symbol)

            if (isSellingForStablecoin) {
              // When selling a token for a stablecoin, only create SELL transaction
              newSwapTransactions.push({
                address,
                signature: sig.signature,
                timestamp: sig.blockTime,
                type: 'SELL',
                action: `SELL on ${dexName}`,
                description: `Sold ${soldToken.symbol} for ${boughtToken.symbol}`,
                status: sig.err ? 'Failed' : 'Success',
                fee: tx.meta.fee || 5000,
                fromToken: soldToken.mint,
                toToken: boughtToken.mint,
                fromAmount: Math.abs(soldToken.change),
                toAmount: boughtToken.change,
                fromSymbol: soldToken.symbol,
                toSymbol: boughtToken.symbol,
                fromValueUSD: swapValueUSD,
                toValueUSD: swapValueUSD,
                source: dexName,
                platform: 'Solana',
                value: swapValueUSD,
                slot: sig.slot,
                tradedCoin: soldToken.symbol,
                tradedCoinMint: soldToken.mint,
                isBuy: false,
                isSell: true,
                transactionType: 'sell'
              })
            } else if (isBuyingWithStablecoin) {
              // When buying a token with a stablecoin, only create BUY transaction
              newSwapTransactions.push({
                address,
                signature: sig.signature,
                timestamp: sig.blockTime,
                type: 'BUY',
                action: `BUY on ${dexName}`,
                description: `Bought ${boughtToken.symbol} with ${soldToken.symbol}`,
                status: sig.err ? 'Failed' : 'Success',
                fee: tx.meta.fee || 5000,
                fromToken: soldToken.mint,
                toToken: boughtToken.mint,
                fromAmount: Math.abs(soldToken.change),
                toAmount: boughtToken.change,
                fromSymbol: soldToken.symbol,
                toSymbol: boughtToken.symbol,
                fromValueUSD: swapValueUSD,
                toValueUSD: swapValueUSD,
                source: dexName,
                platform: 'Solana',
                value: swapValueUSD,
                slot: sig.slot,
                tradedCoin: boughtToken.symbol,
                tradedCoinMint: boughtToken.mint,
                isBuy: true,
                isSell: false,
                transactionType: 'buy'
              })
            } else {
              // Token-to-token swap (non-stablecoin): create both SELL and BUY transactions
              // 1. Create SELL transaction for the token being sold
              newSwapTransactions.push({
                address,
                signature: sig.signature,
                timestamp: sig.blockTime,
                type: 'SELL',
                action: `SELL on ${dexName}`,
                description: `Sold ${soldToken.symbol}`,
                status: sig.err ? 'Failed' : 'Success',
                fee: tx.meta.fee || 5000,
                fromToken: soldToken.mint,
                toToken: null,
                fromAmount: Math.abs(soldToken.change),
                toAmount: 0,
                fromSymbol: soldToken.symbol,
                toSymbol: null,
                fromValueUSD: swapValueUSD,
                toValueUSD: 0,
                source: dexName,
                platform: 'Solana',
                value: swapValueUSD,
                slot: sig.slot,
                tradedCoin: soldToken.symbol,
                tradedCoinMint: soldToken.mint,
                isBuy: false,
                isSell: true,
                transactionType: 'sell'
              })
              // 2. Create BUY transaction for the token being bought
              newSwapTransactions.push({
                address,
                signature: sig.signature,
                timestamp: sig.blockTime,
                type: 'BUY',
                action: `BUY on ${dexName}`,
                description: `Bought ${boughtToken.symbol}`,
                status: sig.err ? 'Failed' : 'Success',
                fee: 0, // Fee already counted in SELL transaction
                fromToken: null,
                toToken: boughtToken.mint,
                fromAmount: 0,
                toAmount: boughtToken.change,
                fromSymbol: null,
                toSymbol: boughtToken.symbol,
                fromValueUSD: 0,
                toValueUSD: swapValueUSD,
                source: dexName,
                platform: 'Solana',
                value: swapValueUSD,
                slot: sig.slot,
                tradedCoin: boughtToken.symbol,
                tradedCoinMint: boughtToken.mint,
                isBuy: true,
                isSell: false,
                transactionType: 'buy'
              })
            }
          }
        }
        
        // Add small delay to avoid rate limiting when processing many transactions
        if (processedCount % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
      } catch (error: any) {
        console.error('Error processing transaction:', sig.signature, error?.message || error)

        // Track failed transactions for debugging
        if (error?.message?.includes('All RPC endpoints failed')) {
          console.log(`⚠️  RPC failure for transaction ${sig.signature.slice(0, 8)}... (slot: ${sig.slot})`)
        }

        continue
      }
    }

      console.log(`Found ${newSwapTransactions.length} new swap transactions from ${processedCount} processed`)

      // Store new swap transactions in database if any found
      if (newSwapTransactions.length > 0) {
        console.log(`💾 Attempting to insert ${newSwapTransactions.length} transactions into database`)
        console.log(`🔍 Sample transaction data:`, {
          signature: newSwapTransactions[0]?.signature?.slice(0, 8),
          timestamp: newSwapTransactions[0]?.timestamp,
          slot: newSwapTransactions[0]?.slot,
          tradedCoin: newSwapTransactions[0]?.tradedCoin
        })

        try {
          await retryDatabaseOperation(
            () => insertTransactions(newSwapTransactions),
            'insertTransactions'
          )
          console.log(`✅ Successfully stored ${newSwapTransactions.length} new swap transactions in database`)

          // Verify insertion worked
          const newCount = await retryDatabaseOperation(
            () => getTransactionCount(address),
            'getTransactionCount'
          )
          console.log(`📊 Total transactions in DB after insert: ${newCount}`)

        } catch (dbError) {
          throwDatabaseError(
            `Failed to insert ${newSwapTransactions.length} transactions into database`,
            'insertTransactions'
          )
        }
      }

      // If we processed transactions but had RPC failures, still advance the pointer
      // by inserting a dummy "checkpoint" transaction with the latest successfully processed signature
      if (processedCount > 0 && recentNewSignatures.length > 0) {
        const latestProcessedSig = recentNewSignatures[0] // Most recent signature we attempted

        // Only create checkpoint if we don't already have this as last transaction
        const currentLast = await getLastTransaction(address)
        if (!currentLast || currentLast.signature !== latestProcessedSig.signature) {
          console.log(`📍 Advancing processing checkpoint to ${latestProcessedSig.signature.slice(0, 8)}... (slot: ${latestProcessedSig.slot})`)

          // Insert a minimal checkpoint record to advance the pointer
          const checkpointTx = {
            signature: latestProcessedSig.signature,
            address: address,
            timestamp: latestProcessedSig.blockTime || Math.floor(Date.now() / 1000),
            slot: latestProcessedSig.slot || 0,
            type: 'checkpoint',
            action: 'processed',
            description: 'Processing checkpoint',
            status: 'checkpoint',
            fee: 0,
            fromToken: null,
            toToken: null,
            fromAmount: 0,
            toAmount: 0,
            fromSymbol: null,
            toSymbol: null,
            fromValueUSD: 0,
            toValueUSD: 0,
            source: 'system',
            platform: 'checkpoint',
            value: 0,
            tradedCoin: null,
            tradedCoinMint: null,
            isBuy: false,
            isSell: false,
            transactionType: 'checkpoint'
          }

          await insertTransactions([checkpointTx])
          console.log(`✅ Checkpoint saved - next fetch will start from slot ${latestProcessedSig.slot}`)
        }
      }
    }

    // Get all stored transactions from the last 7 days
    const storedTransactions = await getTransactionsByDateRange(address, sevenDaysAgo, Math.floor(Date.now() / 1000))
    console.log(`Retrieved ${storedTransactions.length} stored transactions from last 7 days`)

    // Filter out checkpoint records from results (but keep them in DB for pagination)
    const actualSwapTransactions = storedTransactions.filter(tx => tx.type !== 'checkpoint')
    console.log(`Filtered to ${actualSwapTransactions.length} actual swap transactions (removed ${storedTransactions.length - actualSwapTransactions.length} checkpoints)`)

    // Combine new and stored transactions
    const allSwapTransactions = [...actualSwapTransactions]

    // Sort by timestamp descending (most recent first)
    const sortedSwaps = allSwapTransactions.sort((a, b) => b.timestamp - a.timestamp)

    // Apply classification to each swap and convert snake_case to camelCase
    const classifiedSwaps = sortedSwaps.map((swap, index) => ({
      ...swap,
      // Convert snake_case fields from database to camelCase for frontend
      tradedCoin: swap.tradedCoin || swap.traded_coin,
      tradedCoinMint: swap.tradedCoinMint || swap.traded_coin_mint,
      isBuy: swap.isBuy !== undefined ? Boolean(swap.isBuy) : Boolean(swap.is_buy),
      isSell: swap.isSell !== undefined ? Boolean(swap.isSell) : Boolean(swap.is_sell),
      fromSymbol: swap.fromSymbol || swap.from_symbol,
      toSymbol: swap.toSymbol || swap.to_symbol,
      fromToken: swap.fromToken || swap.from_token,
      toToken: swap.toToken || swap.to_token,
      fromAmount: swap.fromAmount || swap.from_amount,
      toAmount: swap.toAmount || swap.to_amount,
      fromValueUSD: swap.fromValueUSD || swap.from_value_usd,
      toValueUSD: swap.toValueUSD || swap.to_value_usd,
      transactionType: swap.transactionType || swap.transaction_type || classifyTransaction(swap.fromSymbol || swap.from_symbol, swap.toSymbol || swap.to_symbol, sortedSwaps, index)
    }))

  return NextResponse.json({
    data: classifiedSwaps,
    total: classifiedSwaps.length,
    source: 'Database + Helius RPC',
    message: `Total ${classifiedSwaps.length} swaps (${newSwapTransactions.length} new, ${storedTransactions.length - newSwapTransactions.length} from cache)`,
    newTransactions: newSwapTransactions.length,
    cachedTransactions: storedTransactions.length - newSwapTransactions.length
  })
}

// Export the wrapped handler with error handling and rate limiting
export const GET = withRateLimit(withErrorHandler(handleHeliusSwaps))