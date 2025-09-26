# Solana Transaction Journal - Product Specification

## Product Overview
A comprehensive web application for tracking, analyzing, and journaling Solana wallet transactions with focus on DeFi swap activities, trade cycle analysis, and P/L calculations.

## Core Features
1. **Transaction Fetching**: Retrieve and process Solana swap transactions via Helius API
2. **Trade Cycle Analysis**: Automatic detection of complete buy/sell cycles with P/L calculation
3. **Multi-View Interface**: Table, Cards, and Summary views for transaction visualization
4. **Journal Functionality**: Add notes and tags to transactions for personal tracking
5. **Real-time Processing**: Live transaction fetching with caching and optimization

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom React components with responsive design

### Backend
- **API Routes**: Next.js API routes for server-side processing
- **Database**: SQLite with better-sqlite3 package
- **Caching**: In-memory caching with 5-minute TTL

### External APIs
- **Helius API**: Primary data source for Solana transactions
- **Jupiter API**: Token price data for USD value calculations

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend UI   │────▶│  Next.js API     │────▶│   Helius API    │
│   (React/TS)    │     │    Routes        │     │  (Enhanced TX)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │   SQLite DB      │
                        │  (transactions)  │
                        └──────────────────┘
```

## Implementation Methodology

### Phase 1: Environment Setup

1. **Create Next.js Project**
```bash
npx create-next-app@latest solana-journal --typescript --tailwind --app
cd solana-journal
```

2. **Install Dependencies**
```bash
npm install better-sqlite3 @types/better-sqlite3
npm install axios
npm install lucide-react
```

3. **Environment Configuration**
Create `.env.local`:
```env
HELIUS_API_KEY=your_helius_api_key_here
```

### Phase 2: Database Design

**SQLite Schema** (`/lib/db.ts`):
```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signature TEXT NOT NULL,
  address TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  block_time INTEGER NOT NULL DEFAULT 0,
  slot INTEGER NOT NULL DEFAULT 0,
  type TEXT DEFAULT '',
  action TEXT DEFAULT '',
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'Unknown',
  fee INTEGER DEFAULT 0,
  from_token TEXT,
  to_token TEXT,
  from_amount REAL DEFAULT 0,
  to_amount REAL DEFAULT 0,
  from_symbol TEXT DEFAULT '',
  to_symbol TEXT DEFAULT '',
  from_value_usd REAL DEFAULT 0,
  to_value_usd REAL DEFAULT 0,
  source TEXT DEFAULT 'Unknown',
  platform TEXT DEFAULT 'Solana',
  value REAL DEFAULT 0,
  traded_coin TEXT DEFAULT '',
  traded_coin_mint TEXT,
  is_buy INTEGER DEFAULT 0,
  is_sell INTEGER DEFAULT 0,
  transaction_type TEXT,
  notes TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(signature, transaction_type)  -- Allows SELL/BUY pairs
)
```

### Phase 3: Helius API Integration

#### 3.1 Enhanced Transactions API Setup
**Endpoint**: `https://api.helius.xyz/v0/addresses/{address}/transactions`

**Parameters**:
- `api-key`: Your Helius API key
- `limit`: Number of transactions (max 1000)
- `type`: Filter for specific transaction types (SWAP)
- `source`: Filter by DEX source (JUPITER, PUMP_AMM, etc.)

#### 3.2 Transaction Processing Pipeline

**Core Processing Service** (`/lib/enhanced-transaction-service.ts`):

```typescript
// Transaction Processing Flow
1. Fetch raw transactions from Helius
2. Parse enhanced transaction data
3. Extract swap events or token transfers
4. Determine transaction type and direction
5. Calculate USD values
6. Create transaction records
7. Store in database
```

**Key Processing Logic**:

```typescript
// Transaction Type Detection
const baseTokens = ['USDC', 'USDT', 'DAI', 'BUSD', 'SOL']

// Scenarios:
// 1. Base → Base (USDC → USDT): Create SELL only
// 2. Base → Meme (USDC → USDUC): Create BUY only
// 3. Meme → Base (USDUC → USDC): Create both SELL and BUY
// 4. Meme → Meme (USDUC → TROLL): Create both SELL and BUY
```

#### 3.3 Token Metadata Resolution

**Token Symbol Resolution Priority**:
1. Check essential tokens cache (common tokens)
2. Query Helius DAS API for metadata
3. Fetch from on-chain metadata
4. Use mint address as fallback

```typescript
const getTokenSymbol = async (mint: string) => {
  // 1. Check cache
  if (essentialTokens[mint]) return essentialTokens[mint]
  
  // 2. Try Helius DAS API
  const dasResponse = await fetchFromHeliusDAS(mint)
  if (dasResponse?.symbol) return dasResponse.symbol
  
  // 3. Fallback to mint
  return mint.substring(0, 6)
}
```

### Phase 4: USD Value Calculation

**Value Calculation Strategy**:

1. **Direct Stablecoin Values**: USDC/USDT amounts = direct USD value
2. **SOL Transactions**: Use estimated SOL price ($240)
3. **Token-to-Token Swaps**: Query Jupiter API for current prices
4. **Fallback**: Use counterparty value if available

```typescript
// USD Value Calculation
if (isStablecoin(token)) {
  value = amount * 1.0
} else if (token === 'SOL') {
  value = amount * 240  // Estimated SOL price
} else {
  // Query Jupiter API for token price
  const price = await getJupiterPrice(tokenMint)
  value = amount * price
}
```

### Phase 5: API Routes Implementation

**Main API Route** (`/app/api/helius-swaps/route.ts`):

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')
  
  // 1. Check database for existing transactions
  const lastTx = await getLastTransaction(address)
  
  // 2. Fetch new transactions from Helius
  const transactions = await fetchHeliusTransactions(address, lastTx?.slot)
  
  // 3. Process transactions
  const processed = await processTransactions(transactions)
  
  // 4. Store in database
  await insertTransactions(processed)
  
  // 5. Return all transactions
  return getStoredTransactions(address)
}
```

### Phase 6: Frontend Implementation

**Main Component Structure** (`/app/page.tsx`):

```typescript
// Component Hierarchy
<TransactionDashboard>
  <WalletInput onFetch={fetchTransactions} />
  <ViewToggle mode={viewMode} onChange={setViewMode} />
  {viewMode === 'table' && <TransactionTable data={transactions} />}
  {viewMode === 'cards' && <TransactionCards data={transactions} />}
  {viewMode === 'summary' && <TradeSummary cycles={tradeCycles} />}
</TransactionDashboard>
```

**Trade Cycle Calculation** (`/components/utils/tradeCycles.ts`):

```typescript
// Trade Cycle Detection Algorithm
1. Sort transactions by timestamp
2. Group by token (using tradedCoinMint)
3. Track running balance for each token
4. Start new cycle when balance = 0 and new buy occurs
5. Mark cycle complete when balance returns to 0
6. Calculate P/L: totalSellValue - (avgBuyPrice * totalSellAmount)
```

### Phase 7: Performance Optimization

1. **Database Pooling**: Implement connection pooling for SQLite
2. **Caching Strategy**: 5-minute cache for API responses
3. **Pagination**: Fetch transactions in batches of 1000
4. **Index Optimization**: Create indexes on frequently queried columns

```typescript
// Database Indexes
CREATE INDEX idx_transactions_address ON transactions(address);
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX idx_transactions_signature ON transactions(signature);
```

## Key Resources

### API Documentation
- **Helius Enhanced Transactions**: https://docs.helius.dev/api-reference/enhanced-transactions-api
- **Helius DAS API**: https://docs.helius.dev/api-reference/digital-asset-standard
- **Jupiter Price API**: https://docs.jup.ag/api/price-api

### Token Lists
- **Essential Tokens**: Maintain cache of common token symbols
- **Stablecoins**: USDC, USDT, DAI, BUSD
- **Native Token**: SOL (So11111111111111111111111111111111111111112)

### Common Token Addresses
```typescript
const ESSENTIAL_TOKENS = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
  'So11111111111111111111111111111111111111112': 'SOL',
  // ... more tokens
}
```

## Testing Strategy

### Test Wallet Addresses
```
4NuB8ZFSjEVWE1nJTJ5RBCRmw9VHUE2g8Q5vFza4L8wm  # Default test wallet
```

### Test Scenarios
1. **Single Token Trades**: Buy token, sell all
2. **Partial Sells**: Buy token, sell in portions
3. **Multiple Cycles**: Complete multiple buy/sell cycles
4. **Token-to-Token Swaps**: Test both transaction creation
5. **Base Token Swaps**: Verify no duplicate transactions

## Deployment Considerations

1. **Environment Variables**: Secure API key management
2. **Database Backup**: Regular SQLite backup strategy
3. **Rate Limiting**: Implement API rate limiting
4. **Error Handling**: Comprehensive error boundaries
5. **Monitoring**: Track API usage and performance

## Common Issues & Solutions

### Issue 1: Duplicate Transactions
**Problem**: Token-to-token swaps creating duplicate entries
**Solution**: Use composite unique key (signature, transaction_type)

### Issue 2: Zero USD Values
**Problem**: Transactions showing $0 value
**Solution**: Implement fallback value calculation with Jupiter API

### Issue 3: Missing Token Symbols
**Problem**: Token symbols showing as mint addresses
**Solution**: Multi-tier resolution (cache → DAS API → on-chain)

### Issue 4: Trade Cycle Grouping
**Problem**: BUY and SELL not grouping properly
**Solution**: Ensure both transactions use same `tradedCoin` value

## Future Enhancements

1. **Real-time Updates**: WebSocket connection for live transactions
2. **Multi-wallet Support**: Track multiple wallets simultaneously
3. **Advanced Analytics**: ROI calculations, win rate, average hold time
4. **Export Functionality**: CSV/PDF export for tax reporting
5. **Mobile App**: React Native implementation
6. **Social Features**: Share trade performance (privacy-focused)

## Development Workflow

1. **Local Development**
```bash
npm run dev  # Start development server on port 3000
```

2. **Database Management**
```bash
# Clear database for testing
rm transactions.db
```

3. **API Testing**
```bash
# Test transaction fetching
curl "http://localhost:3000/api/helius-swaps?address=WALLET_ADDRESS"
```

4. **Build & Deploy**
```bash
npm run build
npm run start
```

## Maintenance Notes

- **API Key Rotation**: Update Helius API key monthly
- **Database Cleanup**: Remove transactions older than 1 year
- **Cache Invalidation**: Clear cache on significant updates
- **Token List Updates**: Refresh essential tokens weekly

---

*Last Updated: 2024*
*Version: 1.0.0*