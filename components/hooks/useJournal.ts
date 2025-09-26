import { useState, useEffect } from 'react'
import { JournalEntry, TransactionType } from '../types'

interface UseJournalReturn {
  journalEntries: { [key: string]: JournalEntry }
  editingTransaction: string | null
  journalNote: string
  journalTags: string
  transactionType: TransactionType
  setEditingTransaction: (signature: string | null) => void
  setJournalNote: (note: string) => void
  setJournalTags: (tags: string) => void
  setTransactionType: (type: TransactionType) => void
  saveJournalEntry: (signature: string) => void
  deleteJournalEntry: (signature: string) => void
}

export const useJournal = (): UseJournalReturn => {
  const [journalEntries, setJournalEntries] = useState<{ [key: string]: JournalEntry }>({})
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null)
  const [journalNote, setJournalNote] = useState('')
  const [journalTags, setJournalTags] = useState('')
  const [transactionType, setTransactionType] = useState<TransactionType>('sell')

  useEffect(() => {
    const savedEntries = localStorage.getItem('journalEntries')
    if (savedEntries) {
      setJournalEntries(JSON.parse(savedEntries))
    }
  }, [])

  const saveJournalEntry = (signature: string) => {
    if (!journalNote.trim()) return

    const entry: JournalEntry = {
      id: Date.now().toString(),
      transactionSignature: signature,
      note: journalNote,
      tags: journalTags.split(',').map(tag => tag.trim()).filter(tag => tag),
      transactionType: transactionType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const updatedEntries = { ...journalEntries, [signature]: entry }
    setJournalEntries(updatedEntries)
    localStorage.setItem('journalEntries', JSON.stringify(updatedEntries))
    
    setEditingTransaction(null)
    setJournalNote('')
    setJournalTags('')
    setTransactionType('sell')
  }

  const deleteJournalEntry = (signature: string) => {
    const updatedEntries = { ...journalEntries }
    delete updatedEntries[signature]
    setJournalEntries(updatedEntries)
    localStorage.setItem('journalEntries', JSON.stringify(updatedEntries))
  }

  return {
    journalEntries,
    editingTransaction,
    journalNote,
    journalTags,
    transactionType,
    setEditingTransaction,
    setJournalNote,
    setJournalTags,
    setTransactionType,
    saveJournalEntry,
    deleteJournalEntry
  }
}