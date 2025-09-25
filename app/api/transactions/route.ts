import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const SOLSCAN_API_BASE = 'https://pro-api.solscan.io/v2.0'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const address = searchParams.get('address')
  const apiKey = searchParams.get('apiKey')
  
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  }
  
  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 400 })
  }

  try {
    // Try with just the token header as per Solscan v2 docs
    const response = await axios.get(`${SOLSCAN_API_BASE}/account/transactions`, {
      params: {
        address: address,
        limit: 20
      },
      headers: {
        'token': apiKey
      }
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    console.error('Error fetching transactions:', error.response?.data || error.message)
    
    if (error.response?.status === 401) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your Solscan API key.' },
        { status: 401 }
      )
    }
    
    if (error.response?.status === 400) {
      return NextResponse.json(
        { error: 'Invalid wallet address or request parameters.' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch transactions', 
        details: error.response?.data?.message || error.message,
        status: error.response?.status 
      },
      { status: error.response?.status || 500 }
    )
  }
}