import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Header } from '../../../components/ui/Header'

describe('Header', () => {
  const defaultProps = {
    viewMode: 'table' as const,
    setViewMode: jest.fn(),
    walletAddress: '4NuB8ZFSjEVWE1nJTJ5RBCRmw9VHUE2g8Q5vFza4L8wm',
    setWalletAddress: jest.fn(),
    onFetch: jest.fn(),
    loading: false,
    error: '',
    activitiesCount: 0
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render header with title', () => {
    render(<Header {...defaultProps} />)
    
    expect(screen.getByText('Trench Journal')).toBeInTheDocument()
  })

  it('should render view mode buttons', () => {
    render(<Header {...defaultProps} />)
    
    expect(screen.getByText('Table')).toBeInTheDocument()
    expect(screen.getByText('Cards')).toBeInTheDocument()
    expect(screen.getByText('Summary')).toBeInTheDocument()
  })

  it('should highlight active view mode', () => {
    render(<Header {...defaultProps} viewMode="cards" />)
    
    const tableButton = screen.getByText('Table')
    const cardsButton = screen.getByText('Cards')
    
    expect(tableButton).toHaveClass('bg-gray-200')
    expect(cardsButton).toHaveClass('bg-blue-500', 'text-white')
  })

  it('should call setViewMode when view buttons are clicked', async () => {
    const user = userEvent.setup()
    render(<Header {...defaultProps} />)
    
    await user.click(screen.getByText('Cards'))
    expect(defaultProps.setViewMode).toHaveBeenCalledWith('cards')
    
    await user.click(screen.getByText('Summary'))
    expect(defaultProps.setViewMode).toHaveBeenCalledWith('summary')
  })

  it('should render wallet address input with value', () => {
    render(<Header {...defaultProps} />)
    
    const input = screen.getByPlaceholderText('Enter Solana wallet address')
    expect(input).toHaveValue('4NuB8ZFSjEVWE1nJTJ5RBCRmw9VHUE2g8Q5vFza4L8wm')
  })

  it('should call setWalletAddress when input changes', () => {
    render(<Header {...defaultProps} />)
    
    const input = screen.getByPlaceholderText('Enter Solana wallet address')
    
    // Simulate typing in the input
    fireEvent.change(input, { target: { value: 'new-address' } })
    
    expect(defaultProps.setWalletAddress).toHaveBeenCalledWith('new-address')
  })

  it('should render fetch button', () => {
    render(<Header {...defaultProps} />)
    
    const button = screen.getByText('Fetch Activities')
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })

  it('should call onFetch when fetch button is clicked', async () => {
    const user = userEvent.setup()
    render(<Header {...defaultProps} />)
    
    await user.click(screen.getByText('Fetch Activities'))
    expect(defaultProps.onFetch).toHaveBeenCalled()
  })

  it('should disable fetch button when loading', () => {
    render(<Header {...defaultProps} loading={true} />)
    
    const button = screen.getByText('Loading...')
    expect(button).toBeDisabled()
  })

  it('should display error message when error exists', () => {
    render(<Header {...defaultProps} error="Something went wrong" />)
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('should display info message with blue styling', () => {
    render(<Header {...defaultProps} error="ℹ️ Data source: Helius" />)
    
    const errorDiv = screen.getByText('ℹ️ Data source: Helius').closest('div')
    expect(errorDiv).toHaveClass('bg-blue-50', 'border-blue-200', 'text-blue-700')
  })

  it('should display stats message with blue styling', () => {
    render(<Header {...defaultProps} error="📊 Wallet Stats: 1.5 SOL" />)
    
    const errorDiv = screen.getByText('📊 Wallet Stats: 1.5 SOL').closest('div')
    expect(errorDiv).toHaveClass('bg-blue-50', 'border-blue-200', 'text-blue-700')
  })

  it('should display regular error with red styling', () => {
    render(<Header {...defaultProps} error="Network error occurred" />)
    
    const errorDiv = screen.getByText('Network error occurred').closest('div')
    expect(errorDiv).toHaveClass('bg-red-50', 'border-red-200', 'text-red-700')
  })

  it('should display transaction count', () => {
    render(<Header {...defaultProps} activitiesCount={15} />)
    
    expect(screen.getByText('Showing 15 swap transactions')).toBeInTheDocument()
  })

  it('should display no transactions message when count is 0', () => {
    render(<Header {...defaultProps} activitiesCount={0} />)
    
    expect(screen.getByText('No transactions loaded')).toBeInTheDocument()
  })

  it('should not display error div when no error', () => {
    render(<Header {...defaultProps} error="" />)
    
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
  })
})