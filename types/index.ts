export interface Transaction {
  signature: string
  block_time: number
  status: string
  fee: number
  lamport: number
  signer: string[]
  type: string
  token_decimals?: number
  amount?: string
  source?: string
  destination?: string
}

export interface JournalEntry {
  id: string
  transactionSignature: string
  note: string
  tags: string[]
  createdAt: string
  updatedAt: string
}