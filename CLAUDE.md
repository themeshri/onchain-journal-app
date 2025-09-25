# Onchain Journal App - Claude/LLM Project Guide

## Project Overview
A Next.js application for tracking and analyzing Solana transactions with journal functionality. Users can fetch their swap transactions, analyze trade cycles, calculate P/L, and add personal notes.

## Key Features
- **Transaction Fetching**: Helius API integration for Solana blockchain data
- **Trade Analysis**: Automatic trade cycle detection with P/L calculations
- **Multiple Views**: Table, Cards, and Summary views with historical ordering
- **Journal Functionality**: Add notes and tags to transactions
- **SQLite Database**: Local storage with transaction splitting (SELL/BUY pairs)
- **Duration Formatting**: Display in seconds-minutes-hours-days format

## Tech Stack
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: SQLite with sqlite3 package
- **APIs**: Helius API for Solana transaction data
- **Styling**: Tailwind CSS with responsive design

## Environment Setup
Create `.env.local` file with:
```
HELIUS_API_KEY=your_helius_api_key_here
```

## Development Commands
```bash
npm run dev    # Start development server
npm run build  # Build for production
npm run start  # Start production server
npm run lint   # Run ESLint
```

## Project Structure
```
/app
  /api                    # API routes
    /helius-swaps/route.ts     # Main transaction fetching endpoint
    /[other-apis]/             # Alternative/experimental endpoints
  /globals.css            # Global styles
  /layout.tsx            # Root layout
  /page.tsx              # Main application page
/lib
  /db.ts                 # SQLite database operations
/types
  /index.ts              # TypeScript type definitions
```

## Key Files & Their Purpose

### `/app/api/helius-swaps/route.ts`
- **Main API endpoint** for fetching Solana transactions
- Integrates with Helius API
- Processes raw transactions into structured swap data
- Handles transaction categorization (BUY/SELL, token-to-token, etc.)
- **Critical**: Contains stablecoin definitions and transaction splitting logic

### `/lib/db.ts`
- **Database operations** for SQLite
- **Important**: Uses composite unique key `(signature, transaction_type)` to allow both SELL and BUY transactions per signature
- Functions: `initDatabase`, `insertTransactions`, `getStoredTransactions`, etc.
- Schema supports all transaction fields including P/L data

### `/app/page.tsx`
- **Main UI component** with all view modes
- Trade cycle calculation logic
- Duration formatting function: `formatDuration()`
- Three view modes: table, cards, summary
- **Summary view**: Shows trades in historical order (not grouped by coins)

## Database Schema
```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signature TEXT NOT NULL,
  address TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  -- ... other fields
  transaction_type TEXT,
  UNIQUE(signature, transaction_type)  -- Allows SELL/BUY pairs
)
```

## API Endpoints
- `GET /api/helius-swaps?address={wallet_address}` - Fetch swap transactions
- Other endpoints in `/api/` are experimental/alternative implementations

## Common Issues & Solutions

### Transaction Splitting
- **Issue**: Only one transaction appears for token-to-token swaps
- **Solution**: Database uses composite unique key to store both SELL and BUY transactions with same signature

### Variable Scope Errors
- **Issue**: "stablecoins is not defined" compilation errors
- **Solution**: Keep stablecoin definitions at global scope in API files

### Duration Display
- **Function**: `formatDuration()` in `page.tsx`
- **Format**: Shows as "2d 4h 30m 15s" (only non-zero units)

### Trade Ordering
- **Summary View**: All trades sorted by `startDate` (most recent first)
- **No Grouping**: Trades shown individually, not grouped by token

## Testing Wallet Addresses
```
4NuB8ZFSjEVWE1nJTJ5RBCRmw9VHUE2g8Q5vFza4L8wm  # Default test address
```

## Important Notes for LLMs

### Code Style
- No comments in code unless explicitly requested
- Use existing patterns and conventions
- Follow TypeScript strict mode
- Use Tailwind for all styling

### Database Operations
- Always use the composite key pattern for transactions
- Transaction splitting creates separate SELL/BUY entries
- Use timestamp for chronological ordering

### API Integration
- Helius API is primary data source
- Handle rate limits and errors gracefully
- Cache responses when appropriate (5-minute cache implemented)

### UI/UX Patterns
- Three view modes with toggle buttons
- Responsive design (mobile-friendly)
- Color coding: green for profits/buys, red for losses/sells
- Loading states and error handling

### Recent Changes Made
1. **Fixed transaction splitting** - Database schema allows both SELL/BUY per signature
2. **Duration formatting** - Changed from days-only to full time breakdown
3. **Historical ordering** - Summary view shows trades chronologically, not grouped by coins
4. **Type safety** - Fixed TypeScript errors for `allTrades` array

### Git Repository
- **GitHub**: https://github.com/themeshri/onchain-journal-app
- **Branch**: main
- Initial commit includes all current features

## Future Enhancement Ideas
- Real-time transaction monitoring
- Portfolio tracking across multiple wallets
- Advanced filtering and search
- Export functionality (CSV, PDF)
- Mobile app version
- Integration with other Solana APIs

---

*Last updated: 2024 - Generated with Claude Code*