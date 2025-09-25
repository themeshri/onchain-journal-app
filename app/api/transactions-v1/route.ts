import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const SOLSCAN_API_V1 = 'https://pro-api.solscan.io/v1.0'

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
    // Using v1 API endpoint
    const response = await axios.get(`${SOLSCAN_API_V1}/account/transactions`, {
      params: {
        account: address,
        limit: 20
      },
      headers: {
        'token': apiKey
      }
    })

    // Transform to match our expected format
    const transactions = response.data?.succcess ? response.data.data : response.data
    
    return NextResponse.json({ 
      data: Array.isArray(transactions) ? transactions : [] 
    })
  } catch (error: any) {
    console.error('Error fetching transactions from v1:', error.response?.data || error.message)
    
    if (error.response?.status === 401) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your Solscan API key.' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch transactions', 
        details: error.response?.data?.message || error.response?.data?.error_message || error.message,
        status: error.response?.status 
      },
      { status: error.response?.status || 500 }
    )
  }
}