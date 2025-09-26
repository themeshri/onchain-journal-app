'use client'

import { useState, useEffect } from 'react'
import React from 'react'

import { 
  ViewMode, 
  TransactionType,
  useWalletData,
  useJournal,
  useLocalStorage,
  Header,
  TransactionTable,
  TransactionCards,
  TradeSummary,
  JournalEditor
} from '../components'

export default function Home() {
  const [walletAddress, setWalletAddress] = useLocalStorage('walletAddress', '4NuB8ZFSjEVWE1nJTJ5RBCRmw9VHUE2g8Q5vFza4L8wm')
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  const { 
    activities, 
    loading, 
    error, 
    fetchDeFiActivities 
  } = useWalletData(walletAddress)

  const {
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
  } = useJournal()

  // Auto-fetch on load
  useEffect(() => {
    if (walletAddress) {
      fetchDeFiActivities()
    }
  }, [walletAddress])

  const handleAddJournal = (signature: string, suggestedType?: TransactionType) => {
    setEditingTransaction(signature)
    setJournalNote('')
    setJournalTags('')
    if (suggestedType) {
      setTransactionType(suggestedType)
    }
  }

  const handleEditJournal = (
    signature: string, 
    note: string, 
    tags: string, 
    type: TransactionType
  ) => {
    setEditingTransaction(signature)
    setJournalNote(note)
    setJournalTags(tags)
    setTransactionType(type)
  }

  const handleCancelJournal = () => {
    setEditingTransaction(null)
    setJournalNote('')
    setJournalTags('')
    setTransactionType('sell')
  }

  const renderContent = () => {
    if (activities.length === 0) {
      return null
    }

    switch (viewMode) {
      case 'table':
        return (
          <TransactionTable
            activities={activities}
            walletAddress={walletAddress}
            journalEntries={journalEntries}
            onAddJournal={handleAddJournal}
            onEditJournal={handleEditJournal}
          />
        )
      case 'cards':
        return (
          <TransactionCards
            activities={activities}
            journalEntries={journalEntries}
            onAddJournal={handleAddJournal}
            onEditJournal={handleEditJournal}
          />
        )
      case 'summary':
        return <TradeSummary activities={activities} />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Header
          viewMode={viewMode}
          setViewMode={setViewMode}
          walletAddress={walletAddress}
          setWalletAddress={setWalletAddress}
          onFetch={fetchDeFiActivities}
          loading={loading}
          error={error}
          activitiesCount={activities.length}
        />

        {renderContent()}

        <JournalEditor
          editingTransaction={editingTransaction}
          journalNote={journalNote}
          journalTags={journalTags}
          transactionType={transactionType}
          journalEntries={journalEntries}
          onNoteChange={setJournalNote}
          onTagsChange={setJournalTags}
          onTransactionTypeChange={setTransactionType}
          onSave={saveJournalEntry}
          onDelete={deleteJournalEntry}
          onCancel={handleCancelJournal}
        />
      </div>
    </div>
  )
}