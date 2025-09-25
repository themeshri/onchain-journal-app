import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const HELIUS_API_BASE = 'https://api.helius.xyz/v0'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const address = searchParams.get('address')
  
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  }

  try {
    // Using Helius free API (limited to 50 RPS)
    const response = await axios.get(`${HELIUS_API_BASE}/addresses/${address}/transactions`, {
      params: {
        'api-key': 'a50e9e77-0e82-466b-9e60-08bb63bb08e7' // This is a public demo key
      }
    })

    // Transform the response to match our expected format
    const transactions = response.data.map((tx: any) => ({
      signature: tx.signature,
      block_time: tx.timestamp,
      status: 'Success',
      fee: tx.fee || 5000,
      lamport: tx.nativeTransfers?.reduce((sum: number, transfer: any) => 
        sum + (transfer.amount || 0), 0) || 0,
      signer: [],
      type: tx.type || 'Unknown',
      description: tx.description || ''
    }))

    return NextResponse.json({ data: transactions })
  } catch (error: any) {
    console.error('Error fetching transactions from Helius:', error.response?.data || error.message)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch transactions', 
        details: error.response?.data?.message || error.message
      },
      { status: error.response?.status || 500 }
    )
  }
}