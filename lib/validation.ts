import { z } from 'zod'

// Base validation schemas
export const SolanaAddressSchema = z
  .string()
  .min(32, 'Solana address must be at least 32 characters')
  .max(44, 'Solana address must be at most 44 characters')
  .regex(/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/, 'Invalid Solana address format (base58)')
  .refine((address) => {
    // Additional validation: typical Solana address patterns
    return address.length >= 32 && address.length <= 44
  }, 'Invalid Solana address length')

export const TransactionSignatureSchema = z
  .string()
  .min(32, 'Transaction signature must be at least 32 characters')
  .max(128, 'Transaction signature must be at most 128 characters')

export const TimestampSchema = z
  .number()
  .int('Timestamp must be an integer')
  .positive('Timestamp must be positive')
  .max(Date.now() / 1000 + 86400, 'Timestamp cannot be more than 1 day in the future')
  .min(1609459200, 'Timestamp cannot be before 2021-01-01') // Solana mainnet launch

export const LimitSchema = z
  .number()
  .int('Limit must be an integer')
  .min(1, 'Limit must be at least 1')
  .max(1000, 'Limit cannot exceed 1000')
  .default(50)

export const BooleanStringSchema = z
  .string()
  .optional()
  .transform((val) => val === 'true')
  .pipe(z.boolean())

// API endpoint validation schemas

// Helius Swaps API validation
export const HeliusSwapsQuerySchema = z.object({
  address: SolanaAddressSchema,
  source: z.enum(['helius', 'solscan', 'all']).default('helius').optional(),
  cache: BooleanStringSchema.default(true).optional(),
  limit: z.string().optional().transform((val) => val ? parseInt(val, 10) : 50)
})

// Solscan Swaps API validation
export const SolscanSwapsQuerySchema = z.object({
  address: SolanaAddressSchema,
  limit: z.string().optional().transform((val) => val ? parseInt(val, 10) : 50)
})

// Transaction data validation
export const TransactionSchema = z.object({
  signature: TransactionSignatureSchema,
  address: SolanaAddressSchema,
  timestamp: TimestampSchema,
  type: z.string().min(1, 'Type is required'),
  action: z.string().min(1, 'Action is required'),
  description: z.string().default(''),
  status: z.enum(['Success', 'Failed', 'Pending']),
  fee: z.number().nonnegative('Fee must be non-negative').default(0),
  fromToken: z.string().nullable().optional(),
  toToken: z.string().nullable().optional(),
  fromAmount: z.number().nonnegative('From amount must be non-negative').optional(),
  toAmount: z.number().nonnegative('To amount must be non-negative').optional(),
  fromSymbol: z.string().nullable().optional(),
  toSymbol: z.string().nullable().optional(),
  fromValueUSD: z.number().nonnegative('USD value must be non-negative').optional(),
  toValueUSD: z.number().nonnegative('USD value must be non-negative').optional(),
  source: z.string().default('Unknown'),
  platform: z.string().default('Solana'),
  value: z.number().nonnegative('Value must be non-negative').optional(),
  slot: z.number().int('Slot must be an integer').nonnegative('Slot must be non-negative').optional(),
  tradedCoin: z.string().optional(),
  tradedCoinMint: z.string().optional(),
  isBuy: z.boolean().optional(),
  isSell: z.boolean().optional(),
  transaction_type: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional()
})

// Database operation validation
export const InsertTransactionSchema = z.array(TransactionSchema).min(1, 'At least one transaction is required')

// Error response schema
export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
  message: z.string().optional(),
  code: z.string().optional()
})

// Success response schema
export const SuccessResponseSchema = z.object({
  data: z.array(z.any()),
  total: z.number().nonnegative(),
  source: z.string(),
  cached: z.boolean().optional(),
  timestamp: z.number().optional()
})

// Validation helper functions
export function validateQuery<T>(schema: z.ZodSchema<T>, query: Record<string, any>): { success: true; data: T } | { success: false; error: string; details: z.ZodError } {
  try {
    const result = schema.safeParse(query)
    
    if (result.success) {
      return { success: true, data: result.data }
    } else {
      return { 
        success: false, 
        error: 'Validation failed', 
        details: result.error 
      }
    }
  } catch (error) {
    console.error('Validation error:', error)
    return { 
      success: false, 
      error: 'Unknown validation error', 
      details: new z.ZodError([{
        code: 'custom',
        path: ['unknown'],
        message: error instanceof Error ? error.message : 'Unknown error'
      }])
    }
  }
}

export function validateBody<T>(schema: z.ZodSchema<T>, body: any): { success: true; data: T } | { success: false; error: string; details: z.ZodError } {
  return validateQuery(schema, body)
}

// Format Zod errors for API responses
export function formatZodError(error: z.ZodError): { field: string; message: string }[] {
  if (!error || !error.issues || !Array.isArray(error.issues)) {
    return [{ field: 'unknown', message: 'Invalid validation error format' }]
  }
  
  return error.issues.map((err) => ({
    field: err.path ? err.path.join('.') : 'unknown',
    message: err.message || 'Unknown validation error'
  }))
}

// Validation middleware wrapper
export function withValidation<T>(
  schema: z.ZodSchema<T>,
  handler: (validatedData: T, request: Request) => Promise<Response>
) {
  return async (request: Request) => {
    try {
      // Extract query parameters from URL
      const url = new URL(request.url)
      const queryParams = Object.fromEntries(url.searchParams.entries())
      
      const validation = validateQuery(schema, queryParams)
      
      if (!validation.success) {
        return new Response(
          JSON.stringify({
            error: 'Invalid request parameters',
            details: formatZodError(validation.details)
          }),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }
      
      return await handler(validation.data, request)
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Request processing failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  }
}

// Common validation patterns
export const ValidationPatterns = {
  // Solana program IDs
  PROGRAM_ID: /^[A-HJ-NP-Z1-9]{44}$/,
  
  // Token mint addresses
  TOKEN_MINT: /^[A-HJ-NP-Z1-9]{44}$/,
  
  // Transaction signatures
  SIGNATURE: /^[A-HJ-NP-Z1-9]{88}$/,
  
  // Wallet addresses
  WALLET_ADDRESS: /^[A-HJ-NP-Z1-9]{32,44}$/,
  
  // DEX names
  DEX_NAME: /^[a-zA-Z0-9\s\-_]+$/,
  
  // Token symbols
  TOKEN_SYMBOL: /^[A-Z0-9]{1,12}$/,
  
  // Numeric amounts (can include decimals)
  AMOUNT: /^\d+(\.\d+)?$/,
  
  // USD values
  USD_VALUE: /^\d+(\.\d{1,2})?$/
}

// Environment variable validation
export const EnvConfigSchema = z.object({
  HELIUS_API_KEY: z.string().min(1, 'HELIUS_API_KEY is required').optional(),
  SOLSCAN_API_KEY: z.string().min(1, 'SOLSCAN_API_KEY is required').optional(),
  QUICKNODE_API_KEY: z.string().optional(),
  ALCHEMY_API_KEY: z.string().optional(),
  SHYFT_API_KEY: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().optional().transform((val) => val ? parseInt(val, 10) : 3000).pipe(z.number().min(1).max(65535))
})

// Rate limiting validation
export const RateLimitSchema = z.object({
  windowMs: z.number().positive().default(15 * 60 * 1000), // 15 minutes
  max: z.number().positive().default(100), // limit each IP to 100 requests per windowMs
  skipSuccessfulRequests: z.boolean().default(false),
  skipFailedRequests: z.boolean().default(false)
})

export type HeliusSwapsQuery = z.infer<typeof HeliusSwapsQuerySchema>
export type SolscanSwapsQuery = z.infer<typeof SolscanSwapsQuerySchema>
export type Transaction = z.infer<typeof TransactionSchema>
export type EnvConfig = z.infer<typeof EnvConfigSchema>
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>