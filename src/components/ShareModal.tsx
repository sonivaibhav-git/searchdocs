import React, { useState, useEffect } from 'react'
import { X, Share2, Copy, Mail, MessageCircle, Send, Check, AlertTriangle, Globe, Lock, Eye, Edit3, MessageSquare } from 'lucide-react'
import { DocumentWithProfile } from '../lib/supabase'

interface ShareModalProps {
  document: DocumentWithProfile
  onClose: () => void
}

export function ShareModal({ document, onClose }: ShareModalProps) {
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [accessLevel, setAccessLevel] = useState<'view' | 'edit' | 'comment'>('view')
  const [showWarning, setShowWarning] = useState(false)

  useEffect(() => {
    // Generate secure document URL
    const baseUrl = window.location.origin
    const documentId = document.id
    const shareToken = generateShareToken()
    const url = `${baseUrl}/share/${documentId}?token=${shareToken}&access=${accessLevel}`
    setShareUrl(url)
    
    // Show warning for sensitive documents
    setShowWarning(document.content.length > 1000 || document.tags.some(tag => 
      ['confidential', 'private', 'internal', 'sensitive'].includes(tag.toLowerCase())
    ))
  }, [document, accessLevel])

  const generateShareToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      
      // Track sharing analytics
      trackShareEvent('copy', accessLevel)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const trackShareEvent = (method: string, permission: string) => {
    // Analytics tracking
    console.log('Share event:', {
      documentId: document.id,
      method,
      permission,
      timestamp: new Date().toISOString()
    })
  }

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Shared Document: ${document.title}`)
    const body = encodeURIComponent(`I've shared a document with you: ${document.title}\n\nAccess it here: ${shareUrl}`)
    window.open(`mailto:?subject=${subject}&body=${body}`)
    trackShareEvent('email', accessLevel)
  }

  const shareViaWhatsApp = () => {
    const text = encodeURIComponent(`Check out this document: ${document.title}\n${shareUrl}`)
    window.open(`https://wa.me/?text=${text}`)
    trackShareEvent('whatsapp', accessLevel)
  }

  const shareViaTelegram = () => {
    const text = encodeURIComponent(`Check out this document: ${document.title}\n${shareUrl}`)
    window.open(`https://t.me/share/url?url=${shareUrl}&text=${text}`)
    trackShareEvent('telegram', accessLevel)
  }

  const getAccessIcon = (level: string) => {
    switch (level) {
      case 'view': return <Eye className="w-4 h-4" />
      case 'edit': return <Edit3 className="w-4 h-4" />
      case 'comment': return <MessageSquare className="w-4 h-4" />
      default: return <Eye className="w-4 h-4" />
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-card rounded-lg shadow-2xl w-full max-w-md md:max-w-lg transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-3">
            <Share2 className="w-6 h-6 text-blue-600 dark:text-accent-primary" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text">Share Document</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-64">{document.title}</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Warning Message */}
          {showWarning && (
            <div className="flex items-start space-x-3 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-800 dark:text-orange-300">Sharing Sensitive Content</p>
                <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">
                  This document contains information from your docs. Please ensure you have permission to share.
                </p>
              </div>
            </div>
          )}

          {/* Access Rights */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Access Rights
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'view', label: 'View only', icon: <Eye className="w-4 h-4" /> },
                { value: 'edit', label: 'Edit', icon: <Edit3 className="w-4 h-4" /> },
                { value: 'comment', label: 'Comment', icon: <MessageSquare className="w-4 h-4" /> }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setAccessLevel(option.value as any)}
                  className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${
                    accessLevel === option.value
                      ? 'border-blue-500 dark:border-accent-primary bg-blue-50 dark:bg-accent-primary/10 text-blue-700 dark:text-accent-primary'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {option.icon}
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Share Link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Share Link
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-dark-search text-gray-900 dark:text-dark-text text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent"
              />
              <button
                onClick={copyToClipboard}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors min-w-[100px] justify-center ${
                  copied
                    ? 'bg-green-600 dark:bg-accent-success text-white'
                    : 'bg-blue-600 dark:bg-accent-primary text-white hover:bg-blue-700 dark:hover:bg-accent-primary/90'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span className="text-sm">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span className="text-sm">Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Direct Share Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Share via
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={shareViaEmail}
                className="flex flex-col items-center space-y-2 p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-dark-search transition-colors group"
              >
                <Mail className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-accent-primary transition-colors" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</span>
              </button>
              
              <button
                onClick={shareViaWhatsApp}
                className="flex flex-col items-center space-y-2 p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-dark-search transition-colors group"
              >
                <MessageCircle className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-accent-success transition-colors" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">WhatsApp</span>
              </button>
              
              <button
                onClick={shareViaTelegram}
                className="flex flex-col items-center space-y-2 p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-dark-search transition-colors group"
              >
                <Send className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-blue-500 transition-colors" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Telegram</span>
              </button>
            </div>
          </div>

          {/* Document Privacy Status */}
          <div className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-dark-search rounded-lg">
            {document.is_public ? (
              <>
                <Globe className="w-4 h-4 text-green-600 dark:text-accent-success" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  This document is public and can be accessed by anyone with the link
                </span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  This document is private and requires authentication to access
                </span>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-dark-text transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}