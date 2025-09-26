export const formatTime = (timestamp: number): string => {
  if (!timestamp) return 'Unknown'
  const now = Date.now() / 1000
  const diff = now - timestamp
  
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hrs ago`
  return `${Math.floor(diff / 86400)} days ago`
}

export const formatAmount = (amount: number, decimals: number = 9): string => {
  if (!amount) return '0'
  return (amount / Math.pow(10, decimals)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  })
}

export const formatValue = (value: number): string => {
  if (!value) return '$0.00'
  const isNegative = value < 0
  const absValue = Math.abs(value)
  const formatted = absValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return isNegative ? `-$${formatted}` : `$${formatted}`
}

export const formatDuration = (durationInSeconds: number): string => {
  if (!durationInSeconds) return '0s'
  
  const days = Math.floor(durationInSeconds / (24 * 60 * 60))
  const hours = Math.floor((durationInSeconds % (24 * 60 * 60)) / (60 * 60))
  const minutes = Math.floor((durationInSeconds % (60 * 60)) / 60)
  const seconds = Math.floor(durationInSeconds % 60)
  
  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0 && days === 0) parts.push(`${seconds}s`)
  
  return parts.join(' ')
}