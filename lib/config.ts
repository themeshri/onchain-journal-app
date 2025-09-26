// Centralized configuration for API keys and environment variables
// This file ensures API keys are only accessed server-side

// Server-side only configuration (never exposed to client)
export const serverConfig = {
  helius: {
    apiKey: process.env.HELIUS_API_KEY,
    rpcUrl: process.env.HELIUS_API_KEY 
      ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
      : undefined
  },
  solscan: {
    apiKey: process.env.SOLSCAN_API_KEY,
    baseUrl: 'https://pro-api.solscan.io/v2.0'
  },
  quicknode: {
    apiKey: process.env.QUICKNODE_API_KEY
  },
  alchemy: {
    apiKey: process.env.ALCHEMY_API_KEY
  },
  shyft: {
    apiKey: process.env.SHYFT_API_KEY
  }
}

// Validate required configuration
export function validateServerConfig() {
  const errors: string[] = []
  
  if (!serverConfig.helius.apiKey) {
    errors.push('HELIUS_API_KEY is not configured')
  }
  
  // Add other required validations here
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Check if running on server-side
export function isServerSide() {
  return typeof window === 'undefined'
}

// Safe config accessor that throws if used client-side
export function getServerConfig() {
  if (!isServerSide()) {
    throw new Error('Server configuration cannot be accessed from client-side code')
  }
  return serverConfig
}