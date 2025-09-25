import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

// Using a free RPC endpoint with better rate limits
const SOLANA_RPC = 'https://solana-mainnet.g.alchemy.com/v2/demo'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const address = searchParams.get('address')
  
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  }

  try {
    // Get transaction signatures for the address
    const signaturesResponse = await axios.post(SOLANA_RPC, {
      jsonrpc: '2.0',
      id: 1,
      method: 'getSignaturesForAddress',
      params: [
        address,
        { limit: 20 }
      ]
    })

    const signatures = signaturesResponse.data.result

    if (!signatures || signatures.length === 0) {
      return NextResponse.json({ data: [] })
    }
    
    // Transform the response to match our expected format (without fetching full tx details to avoid rate limits)
    const transactions = signatures.map((sig: any) => {
      return {
        signature: sig.signature,
        block_time: sig.blockTime || 0,
        status: sig.err ? 'Failed' : 'Success',
        fee: 5000, // Default fee
        lamport: 0, // Would need full tx details
        signer: [],
        type: 'Transaction',
        slot: sig.slot,
        memo: sig.memo
      }
    })

    return NextResponse.json({ data: transactions })
  } catch (error: any) {
    console.error('Error fetching transactions from RPC:', error.response?.data || error.message)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch transactions from Solana RPC', 
        details: error.response?.data?.message || error.message
      },
      { status: error.response?.status || 500 }
    )
  }
}