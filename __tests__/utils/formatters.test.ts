import { formatTime, formatAmount, formatValue, formatDuration } from '../../components/utils/formatters'

describe('formatters', () => {
  describe('formatTime', () => {
    beforeEach(() => {
      // Mock Date.now() to return a consistent timestamp
      jest.spyOn(Date, 'now').mockReturnValue(1640995200000) // 2022-01-01 00:00:00 UTC
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should return "Unknown" for falsy timestamp', () => {
      expect(formatTime(0)).toBe('Unknown')
      expect(formatTime(null as any)).toBe('Unknown')
      expect(formatTime(undefined as any)).toBe('Unknown')
    })

    it('should return "Just now" for very recent timestamp', () => {
      const now = Date.now() / 1000
      expect(formatTime(now)).toBe('Just now')
      expect(formatTime(now - 30)).toBe('Just now')
    })

    it('should return minutes ago for timestamps under an hour', () => {
      const now = Date.now() / 1000
      expect(formatTime(now - 120)).toBe('2 mins ago')
      expect(formatTime(now - 1800)).toBe('30 mins ago')
    })

    it('should return hours ago for timestamps under a day', () => {
      const now = Date.now() / 1000
      expect(formatTime(now - 7200)).toBe('2 hrs ago')
      expect(formatTime(now - 43200)).toBe('12 hrs ago')
    })

    it('should return days ago for older timestamps', () => {
      const now = Date.now() / 1000
      expect(formatTime(now - 86400)).toBe('1 days ago')
      expect(formatTime(now - 259200)).toBe('3 days ago')
    })
  })

  describe('formatAmount', () => {
    it('should return "0" for falsy amounts', () => {
      expect(formatAmount(0)).toBe('0')
      expect(formatAmount(null as any)).toBe('0')
      expect(formatAmount(undefined as any)).toBe('0')
    })

    it('should format amounts with default 9 decimals', () => {
      expect(formatAmount(1000000000)).toBe('1.00')
      expect(formatAmount(5000000000)).toBe('5.00')
      expect(formatAmount(1500000000)).toBe('1.50')
    })

    it('should format amounts with custom decimals', () => {
      expect(formatAmount(100000, 6)).toBe('0.10')
      expect(formatAmount(1000000, 6)).toBe('1.00')
      expect(formatAmount(2500000, 6)).toBe('2.50')
    })

    it('should handle very large numbers', () => {
      expect(formatAmount(1000000000000000000)).toBe('1,000,000,000.00')
    })

    it('should limit to 6 decimal places maximum', () => {
      expect(formatAmount(1234567890)).toBe('1.234568')
    })
  })

  describe('formatValue', () => {
    it('should return "$0.00" for falsy values', () => {
      expect(formatValue(0)).toBe('$0.00')
      expect(formatValue(null as any)).toBe('$0.00')
      expect(formatValue(undefined as any)).toBe('$0.00')
    })

    it('should format small dollar amounts', () => {
      expect(formatValue(1.50)).toBe('$1.50')
      expect(formatValue(0.99)).toBe('$0.99')
      expect(formatValue(12.34)).toBe('$12.34')
    })

    it('should format large dollar amounts with commas', () => {
      expect(formatValue(1000)).toBe('$1,000.00')
      expect(formatValue(1234567.89)).toBe('$1,234,567.89')
      expect(formatValue(1000000)).toBe('$1,000,000.00')
    })

    it('should handle negative values', () => {
      expect(formatValue(-100.50)).toBe('-$100.50')
      expect(formatValue(-1234.56)).toBe('-$1,234.56')
    })
  })

  describe('formatDuration', () => {
    it('should return "0s" for falsy duration', () => {
      expect(formatDuration(0)).toBe('0s')
      expect(formatDuration(null as any)).toBe('0s')
      expect(formatDuration(undefined as any)).toBe('0s')
    })

    it('should format seconds only', () => {
      expect(formatDuration(30)).toBe('30s')
      expect(formatDuration(45)).toBe('45s')
    })

    it('should format minutes and seconds', () => {
      expect(formatDuration(90)).toBe('1m 30s')
      expect(formatDuration(150)).toBe('2m 30s')
    })

    it('should format hours, minutes and seconds', () => {
      expect(formatDuration(3661)).toBe('1h 1m 1s')
      expect(formatDuration(7323)).toBe('2h 2m 3s')
    })

    it('should format days, hours, minutes (no seconds for days)', () => {
      expect(formatDuration(90061)).toBe('1d 1h 1m')
      expect(formatDuration(176523)).toBe('2d 1h 2m')
    })

    it('should skip zero values', () => {
      expect(formatDuration(3600)).toBe('1h')
      expect(formatDuration(86400)).toBe('1d')
      expect(formatDuration(90000)).toBe('1d 1h')
    })

    it('should handle very large durations', () => {
      expect(formatDuration(2629746)).toBe('30d 10h 29m') // ~30.4 days
    })
  })
})