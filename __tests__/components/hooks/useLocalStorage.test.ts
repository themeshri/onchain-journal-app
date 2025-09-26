import { renderHook, act } from '@testing-library/react'
import { useLocalStorage } from '../../../components/hooks/useLocalStorage'

describe('useLocalStorage', () => {
  let setItemSpy: jest.SpyInstance
  let getItemSpy: jest.SpyInstance

  beforeEach(() => {
    // Clear localStorage mock
    localStorage.clear()
    jest.clearAllMocks()
    
    // Create fresh spies for each test
    setItemSpy = jest.spyOn(Storage.prototype, 'setItem')
    getItemSpy = jest.spyOn(Storage.prototype, 'getItem')
  })

  afterEach(() => {
    // Restore all spies after each test
    setItemSpy.mockRestore()
    getItemSpy.mockRestore()
  })

  it('should initialize with default value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default-value'))
    
    expect(result.current[0]).toBe('default-value')
  })

  it('should load value from localStorage if it exists', () => {
    localStorage.setItem('test-key', JSON.stringify('stored-value'))
    
    const { result } = renderHook(() => useLocalStorage('test-key', 'default-value'))
    
    expect(result.current[0]).toBe('stored-value')
  })

  it('should update localStorage when value changes', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'))
    
    act(() => {
      result.current[1]('new-value')
    })
    
    expect(result.current[0]).toBe('new-value')
    expect(setItemSpy).toHaveBeenCalledWith('test-key', JSON.stringify('new-value'))
  })

  it('should handle complex objects', () => {
    const complexObject = { name: 'John', age: 30, hobbies: ['reading', 'coding'] }
    
    const { result } = renderHook(() => useLocalStorage('test-key', complexObject))
    
    const newObject = { ...complexObject, age: 31 }
    
    act(() => {
      result.current[1](newObject)
    })
    
    expect(result.current[0]).toEqual(newObject)
    expect(setItemSpy).toHaveBeenCalledWith('test-key', JSON.stringify(newObject))
  })

  it('should handle localStorage read errors gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    getItemSpy.mockImplementation(() => {
      throw new Error('localStorage error')
    })
    
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'))
    
    expect(result.current[0]).toBe('default')
    expect(consoleSpy).toHaveBeenCalled()
    
    consoleSpy.mockRestore()
  })

  it('should handle localStorage write errors gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    setItemSpy.mockImplementation(() => {
      throw new Error('localStorage error')
    })
    
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'))
    
    act(() => {
      result.current[1]('new-value')
    })
    
    expect(consoleSpy).toHaveBeenCalled()
    
    consoleSpy.mockRestore()
  })

  it('should handle invalid JSON in localStorage', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    getItemSpy.mockReturnValue('invalid-json{')
    
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'))
    
    expect(result.current[0]).toBe('default')
    expect(consoleSpy).toHaveBeenCalled()
    
    consoleSpy.mockRestore()
  })

  it('should work with different data types', () => {
    // Test with number
    const { result: numberResult } = renderHook(() => useLocalStorage('number-key', 42))
    expect(numberResult.current[0]).toBe(42)
    
    // Test with boolean
    const { result: boolResult } = renderHook(() => useLocalStorage('bool-key', true))
    expect(boolResult.current[0]).toBe(true)
    
    // Test with array
    const { result: arrayResult } = renderHook(() => useLocalStorage('array-key', [1, 2, 3]))
    expect(arrayResult.current[0]).toEqual([1, 2, 3])
  })
})