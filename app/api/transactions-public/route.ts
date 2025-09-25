import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const SOLSCAN_PUBLIC_API = 'https://api.solscan.io'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const address = searchParams.get('address')
  
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  }

  try {
    // Using public API endpoint (limited to recent transactions)
    const response = await axios.get(`${SOLSCAN_PUBLIC_API}/account/transactions`, {
      params: {
        account: address,
        limit: 20
      },
      headers: {
        'Accept': 'application/json'
      }
    })

    // Transform the response to match our expected format
    const transactions = response.data.map((tx: any) => ({
      signature: tx.txHash || tx.signature,
      block_time: tx.blockTime,
      status: tx.status === 'success' ? 'Success' : 'Failed',
      fee: tx.fee || 0,
      lamport: tx.lamport || 0,
      signer: tx.signer || [],
      type: tx.type || 'Unknown',
      amount: tx.amount,
      source: tx.source,
      destination: tx.destination
    }))

    return NextResponse.json({ data: transactions })
  } catch (error: any) {
    console.error('Error fetching transactions:', error.response?.data || error.message)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch transactions from public API', 
        details: error.response?.data?.message || error.message
      },
      { status: error.response?.status || 500 }
    )
  }
}