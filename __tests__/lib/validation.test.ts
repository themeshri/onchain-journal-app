import { 
  SolanaAddressSchema, 
  TransactionSignatureSchema, 
  TransactionSchema,
  validateQuery,
  validateBody,
  formatZodError 
} from '../../lib/validation'
import { z } from 'zod'

describe('validation', () => {
  describe('SolanaAddressSchema', () => {
    it('should validate correct Solana addresses', () => {
      const validAddresses = [
        '4NuB8ZFSjEVWE1nJTJ5RBCRmw9VHUE2g8Q5vFza4L8wm',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'DiiTPZdpd9t3XorHiuZUu4E1FoSaQ7uGN4q9YkQupump'
      ]

      validAddresses.forEach(address => {
        expect(() => SolanaAddressSchema.parse(address)).not.toThrow()
      })
    })

    it('should reject invalid Solana addresses', () => {
      const invalidAddresses = [
        '', // empty
        'short', // too short
        '4NuB8ZFSjEVWE1nJTJ5RBCRmw9VHUE2g8Q5vFza4L8wmTooLong123456789', // too long
        '4NuB8ZFSjEVWE1nJTJ5RBCRmw9VHUE2g8Q5vFza4L8w@', // invalid character
        'OlIl0123456789ABCDEFGHJKMNPQRSTUVWXYZabcdefgh' // contains O, I, l, 0
      ]

      invalidAddresses.forEach(address => {
        expect(() => SolanaAddressSchema.parse(address)).toThrow()
      })
    })
  })

  describe('TransactionSignatureSchema', () => {
    it('should validate transaction signatures of various lengths', () => {
      const validSignatures = [
        '5DaybsLP1n1Fk7xFKMnVN3N6R5nYPRiZtzGa2NbdaHofV6HMi8f5AB4VSFf4QojnQrvCtkDubgqEiTJXss6znna2',
        'shortSig123456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
      ]

      validSignatures.forEach(signature => {
        expect(() => TransactionSignatureSchema.parse(signature)).not.toThrow()
      })
    })

    it('should reject signatures that are too short or too long', () => {
      const invalidSignatures = [
        '', // empty
        'short', // too short
        'a'.repeat(150) // too long
      ]

      invalidSignatures.forEach(signature => {
        expect(() => TransactionSignatureSchema.parse(signature)).toThrow()
      })
    })
  })

  describe('TransactionSchema', () => {
    const validTransaction = {
      signature: '5DaybsLP1n1Fk7xFKMnVN3N6R5nYPRiZtzGa2NbdaHofV6HMi8f5AB4VSFf4QojnQrvCtkDubgqEiTJXss6znna2',
      address: '4NuB8ZFSjEVWE1nJTJ5RBCRmw9VHUE2g8Q5vFza4L8wm',
      timestamp: 1640995200,
      type: 'SWAP',
      action: 'BUY',
      status: 'Success' as const,
      fee: 5000
    }

    it('should validate a complete valid transaction', () => {
      expect(() => TransactionSchema.parse(validTransaction)).not.toThrow()
    })

    it('should handle optional fields', () => {
      const transactionWithOptionals = {
        ...validTransaction,
        fromToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        toToken: null,
        fromAmount: 1000,
        toAmount: 2000,
        fromSymbol: 'USDC',
        toSymbol: null,
        isBuy: true,
        isSell: false
      }

      expect(() => TransactionSchema.parse(transactionWithOptionals)).not.toThrow()
    })

    it('should reject transactions with invalid status', () => {
      const invalidTransaction = {
        ...validTransaction,
        status: 'InvalidStatus'
      }

      expect(() => TransactionSchema.parse(invalidTransaction)).toThrow()
    })

    it('should reject transactions with negative amounts', () => {
      const invalidTransaction = {
        ...validTransaction,
        fromAmount: -100
      }

      expect(() => TransactionSchema.parse(invalidTransaction)).toThrow()
    })
  })

  describe('validateQuery', () => {
    const testSchema = z.object({
      name: z.string(),
      age: z.number()
    })

    it('should return success for valid data', () => {
      const result = validateQuery(testSchema, { name: 'John', age: 30 })
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ name: 'John', age: 30 })
      }
    })

    it('should return error for invalid data', () => {
      const result = validateQuery(testSchema, { name: 'John', age: 'thirty' })
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Validation failed')
        expect(result.details).toBeDefined()
      }
    })

    it('should handle validation exceptions', () => {
      const badSchema = {
        safeParse: () => { throw new Error('Schema error') }
      } as any

      const result = validateQuery(badSchema, {})
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Unknown validation error')
      }
    })
  })

  describe('validateBody', () => {
    it('should work the same as validateQuery', () => {
      const schema = z.object({ id: z.number() })
      const result = validateBody(schema, { id: 123 })
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe(123)
      }
    })
  })

  describe('formatZodError', () => {
    it('should format Zod errors correctly', () => {
      try {
        z.object({
          name: z.string(),
          age: z.number()
        }).parse({ name: 123, age: 'thirty' })
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formatted = formatZodError(error)
          
          expect(Array.isArray(formatted)).toBe(true)
          expect(formatted.length).toBeGreaterThan(0)
          expect(formatted[0]).toHaveProperty('field')
          expect(formatted[0]).toHaveProperty('message')
        }
      }
    })

    it('should handle invalid error format', () => {
      const invalidError = null as any
      const result = formatZodError(invalidError)
      
      expect(result).toEqual([
        { field: 'unknown', message: 'Invalid validation error format' }
      ])
    })

    it('should handle error without errors array', () => {
      const invalidError = {} as any
      const result = formatZodError(invalidError)
      
      expect(result).toEqual([
        { field: 'unknown', message: 'Invalid validation error format' }
      ])
    })
  })
})