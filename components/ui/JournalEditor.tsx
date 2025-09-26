import React from 'react'
import { JournalEntry, TransactionType } from '../types'

interface JournalEditorProps {
  editingTransaction: string | null
  journalNote: string
  journalTags: string
  transactionType: TransactionType
  journalEntries: { [key: string]: JournalEntry }
  onNoteChange: (note: string) => void
  onTagsChange: (tags: string) => void
  onTransactionTypeChange: (type: TransactionType) => void
  onSave: (signature: string) => void
  onDelete: (signature: string) => void
  onCancel: () => void
}

export const JournalEditor: React.FC<JournalEditorProps> = ({
  editingTransaction,
  journalNote,
  journalTags,
  transactionType,
  journalEntries,
  onNoteChange,
  onTagsChange,
  onTransactionTypeChange,
  onSave,
  onDelete,
  onCancel
}) => {
  if (!editingTransaction) return null

  const handleSave = () => {
    onSave(editingTransaction)
  }

  const handleDelete = () => {
    onDelete(editingTransaction)
    onCancel()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-medium mb-4">Add Swap Journal Entry</h3>

        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type</label>
          <select
            value={transactionType}
            onChange={(e) => onTransactionTypeChange(e.target.value as TransactionType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="sell">Sell</option>
            <option value="sell all">Sell All</option>
            <option value="first buy">First Buy</option>
            <option value="buy more">Buy More</option>
          </select>
        </div>

        <textarea
          value={journalNote}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Write your notes about this swap (e.g., 'Profitable trade', 'Stop loss', 'DCA buy')..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          rows={4}
        />
        
        <input
          type="text"
          value={journalTags}
          onChange={(e) => onTagsChange(e.target.value)}
          placeholder="Tags (comma-separated, e.g., Profit, Loss, Jupiter, DCA)"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        />
        
        <div className="flex space-x-3">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save
          </button>
          {journalEntries[editingTransaction] && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Delete
            </button>
          )}
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}