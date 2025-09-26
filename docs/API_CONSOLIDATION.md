# API Route Consolidation

This document outlines the consolidation of 14 API routes into 2 clean, well-organized endpoints.

## New API Structure

### 1. `/api/helius-swaps` - Enhanced Main Swap Endpoint

**Purpose**: Fetch and process Solana swap transactions with enhanced features

**Parameters**:
- `address` (required): Solana wallet address
- `source` (optional): Data source - `helius` | `solscan` (default: `helius`)
- `cache` (optional): Use cached data - `true` | `false` (default: `true`)

**Features**:
- Multi-source data fetching (Helius, Solscan)
- Intelligent caching (5-minute cache)
- Database integration for storage
- Standardized response format
- Error handling and fallbacks
- DEX source identification
- Enhanced security with proper API key management

**Example**:
```bash
GET /api/helius-swaps?address=WALLET_ADDRESS&source=helius&cache=true
```

### 2. `/api/solscan-swaps` - Alternative Data Source

**Purpose**: Specialized endpoint for Solscan data with robust token mapping

**Parameters**:
- `address` (required): Solana wallet address

**Features**:
- Specialized Solscan API integration
- Comprehensive token symbol mapping
- DEX source identification
- Swap transaction filtering
- Error handling with fallbacks

**Example**:
```bash
GET /api/solscan-swaps?address=WALLET_ADDRESS
```

## Replaced Endpoints

The following 14 endpoints have been consolidated:

### Swap-Related Endpoints (now → `/api/swaps`)
- ❌ `/api/defi-activities` 
- ❌ `/api/free-rpc-swaps`
- ❌ `/api/gmgn-swaps`
- ❌ `/api/real-swaps`
- ❌ `/api/simple-swaps`
- ❌ `/api/solscan-swaps`
- ❌ `/api/swaps-only`
- ❌ `/api/test-swaps`

### Transaction-Related Endpoints (now → `/api/transactions-all`)
- ❌ `/api/transactions`
- ❌ `/api/transactions-helius`
- ❌ `/api/transactions-public`
- ❌ `/api/transactions-rpc`
- ❌ `/api/transactions-v1`

### Kept for Compatibility
- ✅ `/api/helius-swaps` (temporary, for smooth migration)

## Benefits of Consolidation

### 1. **Reduced Complexity**
- From 14 endpoints to 3 clean endpoints
- Single source of truth for each data type
- Consistent error handling and response formats

### 2. **Better Maintainability**
- Centralized business logic
- Shared configuration and utilities
- Easier testing and debugging

### 3. **Improved Performance**
- Intelligent caching strategies
- Connection pooling opportunities
- Reduced code duplication

### 4. **Enhanced Security**
- Centralized API key management
- Consistent input validation
- Standardized error responses

### 5. **Better Developer Experience**
- Clear endpoint purposes
- Comprehensive documentation
- Predictable behavior

## Migration Guide

### Frontend Changes
```javascript
// Old (multiple redundant endpoints)
fetch('/api/test-swaps?address=WALLET')
fetch('/api/simple-swaps?address=WALLET')
fetch('/api/free-rpc-swaps?address=WALLET')
fetch('/api/gmgn-swaps?address=WALLET')
fetch('/api/real-swaps?address=WALLET')
fetch('/api/transactions-rpc?address=WALLET')
fetch('/api/transactions-v1?address=WALLET')
fetch('/api/transactions-public?address=WALLET')
fetch('/api/swaps-only?address=WALLET')
fetch('/api/defi-activities?address=WALLET')
fetch('/api/transactions-helius?address=WALLET')
fetch('/api/transactions?address=WALLET')

// New (clean, consolidated endpoints)
fetch('/api/helius-swaps?address=WALLET&source=helius&cache=true')
fetch('/api/solscan-swaps?address=WALLET')
```

### Response Format
All endpoints now return standardized responses:
```json
{
  "data": [...],
  "total": 42,
  "source": "helius",
  "error": null
}
```

### Error Handling
```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

## Cleanup Process

1. **Test new endpoints** thoroughly
2. **Update frontend** to use new endpoints
3. **Run cleanup script**: `./scripts/cleanup-old-apis.sh`
4. **Verify** everything works
5. **Remove backup** after successful migration

## Configuration

All endpoints use the centralized configuration from `/lib/config.ts`:

```typescript
// Server-side only configuration
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
  }
}
```

## Next Steps

1. Update any remaining frontend references
2. Add comprehensive input validation (Zod/Joi)
3. Implement database connection pooling
4. Add monitoring and metrics
5. Consider GraphQL for more flexible querying

---

*Generated during API consolidation - Task 2 of security and performance improvements*## Consolidation Summary

**Before**: 14 API routes
**After**: 2 clean endpoints

### Removed Routes (backed up to ./backup/api-routes-old/):
- defi-activities
- free-rpc-swaps
- gmgn-swaps
- real-swaps
- simple-swaps
- swaps-only
- test-swaps
- transactions
- transactions-helius
- transactions-public
- transactions-rpc
- transactions-v1
