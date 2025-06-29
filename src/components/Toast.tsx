import React, { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { CheckCircle, AlertCircle, Info, X, Upload, Tag, Globe, Lock } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  showToast: (toast: Omit<Toast, 'id'>) => void
  hideToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: React.ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: Toast = {
      id,
      duration: 5000,
      ...toast,
    }

    setToasts(prev => [...prev, newToast])

    // Auto-hide toast after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        hideToast(id)
      }, newToast.duration)
    }
  }, [])

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const getToastIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-orange-500" />
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'warning':
        return 'bg-orange-50 border-orange-200 text-orange-800'
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800'
    }
  }

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              ${getToastStyles(toast.type)}
              border rounded-lg shadow-lg p-4 transform transition-all duration-300 ease-in-out
              animate-in slide-in-from-right-full
            `}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                {getToastIcon(toast.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold">{toast.title}</h4>
                {toast.message && (
                  <p className="text-sm mt-1 opacity-90">{toast.message}</p>
                )}
                
                {toast.action && (
                  <button
                    onClick={toast.action.onClick}
                    className="text-sm font-medium underline hover:no-underline mt-2 block"
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>
              
              <button
                onClick={() => hideToast(toast.id)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// Specialized toast components for different sections
export function useUploadToast() {
  const { showToast } = useToast()

  return {
    showUploadStart: (fileName: string) => {
      showToast({
        type: 'info',
        title: 'Upload Started',
        message: `Processing ${fileName}...`,
        duration: 3000
      })
    },
    
    showUploadSuccess: (fileName: string, isPublic: boolean) => {
      showToast({
        type: 'success',
        title: 'Upload Complete',
        message: `${fileName} uploaded successfully as ${isPublic ? 'public' : 'private'} document`,
        duration: 4000
      })
    },
    
    showUploadError: (fileName: string, error: string) => {
      showToast({
        type: 'error',
        title: 'Upload Failed',
        message: `${fileName}: ${error}`,
        duration: 6000
      })
    },
    
    showDuplicateWarning: (fileNames: string[]) => {
      showToast({
        type: 'warning',
        title: 'Duplicate Documents',
        message: `${fileNames.length} file(s) already exist and will be skipped`,
        duration: 5000
      })
    }
  }
}

export function useDocumentToast() {
  const { showToast } = useToast()

  return {
    showDeleteSuccess: (fileName: string) => {
      showToast({
        type: 'success',
        title: 'Document Deleted',
        message: `${fileName} has been removed`,
        duration: 3000
      })
    },
    
    showUpdateSuccess: (fileName: string) => {
      showToast({
        type: 'success',
        title: 'Document Updated',
        message: `${fileName} settings saved successfully`,
        duration: 3000
      })
    },
    
    showShareSuccess: (fileName: string) => {
      showToast({
        type: 'success',
        title: 'Link Copied',
        message: `Share link for ${fileName} copied to clipboard`,
        duration: 3000
      })
    }
  }
}

export function useSearchToast() {
  const { showToast } = useToast()

  return {
    showSearchError: (error: string) => {
      showToast({
        type: 'error',
        title: 'Search Failed',
        message: error,
        duration: 5000
      })
    },
    
    showNoResults: (query: string) => {
      showToast({
        type: 'info',
        title: 'No Results',
        message: `No documents found for "${query}"`,
        duration: 3000
      })
    }
  }
}