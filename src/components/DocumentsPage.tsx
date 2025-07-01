import React, { useState, useEffect } from 'react'
import { FileText, Image, Calendar, Trash2, Download, X, ZoomIn, ZoomOut, Edit3, Save, Globe, Lock, Tag, Plus, User, Expand, RotateCcw, AlertTriangle, Share2 } from 'lucide-react'
import { supabase, DocumentWithProfile } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf'
import { ProfilePage } from './ProfilePage'
import { ImageViewer } from './ImageViewer'
import { ShareModal } from './ShareModal'
import { useDocumentToast } from './Toast'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

interface DocumentViewerProps {
  document: DocumentWithProfile
  onClose: () => void
}

function DocumentViewer({ document: doc, onClose }: DocumentViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [zoomInput, setZoomInput] = useState<string>('100')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  const handleZoomIn = () => {
    const newScale = Math.min(scale + 0.25, 5.0)
    setScale(newScale)
    setZoomInput(Math.round(newScale * 100).toString())
  }
  
  const handleZoomOut = () => {
    const newScale = Math.max(scale - 0.25, 0.25)
    setScale(newScale)
    setZoomInput(Math.round(newScale * 100).toString())
  }

  const resetZoom = () => {
    setScale(1.0)
    setZoomInput('100')
  }

  const handleZoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setZoomInput(value)
  }

  const handleZoomInputSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const numValue = parseInt(zoomInput)
    if (!isNaN(numValue) && numValue >= 25 && numValue <= 500) {
      setScale(numValue / 100)
    } else {
      setZoomInput(Math.round(scale * 100).toString())
    }
  }

  const handleZoomInputBlur = () => {
    handleZoomInputSubmit({ preventDefault: () => {} } as React.FormEvent)
  }

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      const element = document.documentElement
      if (element.requestFullscreen) {
        element.requestFullscreen()
      } else if ((element as any).webkitRequestFullscreen) {
        (element as any).webkitRequestFullscreen()
      } else if ((element as any).msRequestFullscreen) {
        (element as any).msRequestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen()
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen()
      }
    }
    setIsFullscreen(!isFullscreen)
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement
      )
      setIsFullscreen(isCurrentlyFullscreen)
    }

    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('fullscreenchange', handleFullscreenChange)
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.addEventListener('msfullscreenchange', handleFullscreenChange)

      return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange)
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
        document.removeEventListener('msfullscreenchange', handleFullscreenChange)
      }
    }
  }, [])

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1))
  }

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages))
  }

  const handleDirectDownload = async () => {
    if (!doc.file_url) return
    
    setDownloading(true)
    try {
      const response = await fetch(doc.file_url)
      if (!response.ok) throw new Error('Failed to fetch PDF')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = doc.title || 'document.pdf'
      
      document.body.appendChild(link)
      link.click()
      
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download failed:', error)
      window.open(doc.file_url, '_blank')
    } finally {
      setDownloading(false)
    }
  }

  const getViewerDimensions = () => {
    if (isFullscreen) {
      return {
        width: window.innerWidth * 0.95,
        height: window.innerHeight * 0.85
      }
    }
    return {
      width: Math.min(window.innerWidth * 0.9, 1200),
      height: Math.min(window.innerHeight * 0.7, 800)
    }
  }

  const viewerDimensions = getViewerDimensions()

  return (
    <>
      <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${isFullscreen ? 'p-0' : 'p-2 md:p-4'}`}>
        <div className={`bg-white dark:bg-dark-card rounded-lg shadow-2xl flex flex-col ${
          isFullscreen 
            ? 'w-full h-full rounded-none' 
            : 'w-full max-w-7xl h-[95vh]'
        } transition-colors duration-200`}>
          {/* Header */}
          <div className="flex items-center justify-between p-2 md:p-4 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-dark-search rounded-t-lg flex-shrink-0 transition-colors duration-200">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              {doc.file_type === 'pdf' ? (
                <FileText className="w-4 h-4 md:w-6 md:h-6 text-red-500 flex-shrink-0" />
              ) : (
                <Image className="w-4 h-4 md:w-6 md:h-6 text-blue-500 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-xs md:text-lg font-semibold text-gray-900 dark:text-dark-text truncate">{doc.title}</h3>
                <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                  <span className="hidden sm:inline">{new Date(doc.created_at).toLocaleDateString()}</span>
                  <span className="hidden sm:inline">•</span>
                  <span>{formatFileSize(doc.file_size)}</span>
                  <span className="hidden md:inline">•</span>
                  <div className="hidden md:flex items-center space-x-1">
                    {doc.is_public ? (
                      <Globe className="w-3 h-3 text-green-600 dark:text-accent-success" />
                    ) : (
                      <Lock className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                    )}
                    <span>{doc.is_public ? 'Public' : 'Private'}</span>
                  </div>
                  {doc.user_profiles && (
                    <>
                      <span className="hidden lg:inline">•</span>
                      <span className="hidden lg:inline">by @{doc.user_profiles.username}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-1 flex-shrink-0">
              {/* PDF Navigation Controls */}
              {doc.file_type === 'pdf' && numPages > 0 && (
                <>
                  <button
                    onClick={goToPrevPage}
                    disabled={pageNumber <= 1}
                    className="p-1 md:p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Previous page"
                  >
                    ←
                  </button>
                  
                  <span className="text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-dark-card px-1 md:px-3 py-1 rounded border border-gray-300 dark:border-gray-600">
                    {pageNumber} / {numPages}
                  </span>
                  
                  <button
                    onClick={goToNextPage}
                    disabled={pageNumber >= numPages}
                    className="p-1 md:p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Next page"
                  >
                    →
                  </button>
                  
                  <div className="w-px h-4 md:h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                </>
              )}
              
              {/* Zoom Controls */}
              <button
                onClick={resetZoom}
                className="p-1 md:p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                title="Reset zoom to 100%"
              >
                <RotateCcw className="w-3 h-3 md:w-4 md:h-4" />
              </button>
              
              <button
                onClick={handleZoomOut}
                className="p-1 md:p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-3 h-3 md:w-4 md:h-4" />
              </button>
              
              {/* Editable Zoom Input */}
              <form onSubmit={handleZoomInputSubmit} className="flex items-center">
                <input
                  type="text"
                  value={zoomInput}
                  onChange={handleZoomInputChange}
                  onBlur={handleZoomInputBlur}
                  className="w-8 md:w-16 text-xs text-center bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text px-1 py-1 rounded border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent"
                  title="Enter zoom percentage (25-500%)"
                />
                <span className="text-xs text-gray-600 dark:text-gray-300 ml-1">%</span>
              </form>
              
              <button
                onClick={handleZoomIn}
                className="p-1 md:p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-3 h-3 md:w-4 md:h-4" />
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="p-1 md:p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                <Expand className="w-3 h-3 md:w-4 md:h-4" />
              </button>

              {/* Share Button */}
              <button
                onClick={() => setShowShareModal(true)}
                className="p-1 md:p-2 text-blue-600 dark:text-accent-primary hover:text-blue-700 dark:hover:text-accent-primary/80 hover:bg-blue-50 dark:hover:bg-accent-primary/10 rounded-md transition-colors"
                title="Share document"
              >
                <Share2 className="w-3 h-3 md:w-4 md:h-4" />
              </button>
              
              {/* Direct Download Button */}
              {doc.file_url && (
                <button
                  onClick={handleDirectDownload}
                  disabled={downloading}
                  className="flex items-center space-x-1 px-1 md:px-3 py-1 md:py-2 text-xs text-white bg-blue-600 dark:bg-accent-primary hover:bg-blue-700 dark:hover:bg-accent-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Download PDF directly to your device"
                >
                  {downloading ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      <span className="hidden sm:inline">Downloading...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3 md:w-4 md:h-4" />
                      <span className="hidden sm:inline">Download</span>
                    </>
                  )}
                </button>
              )}
              
              <button
                onClick={onClose}
                className="p-1 md:p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                <X className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto bg-gray-100 dark:bg-dark-bg flex items-center justify-center p-2 md:p-4 transition-colors duration-200">
            {doc.file_type === 'pdf' && doc.file_url ? (
              <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                <PDFDocument
                  file={doc.file_url}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div className="flex items-center justify-center p-4 md:p-8">
                      <div className="animate-spin rounded-full h-6 w-6 md:h-8 md:w-8 border-b-2 border-blue-600 dark:border-accent-primary"></div>
                      <span className="ml-2 text-gray-600 dark:text-gray-300 text-sm md:text-base">Loading PDF...</span>
                    </div>
                  }
                  error={
                    <div className="flex items-center justify-center p-4 md:p-8 text-red-600 dark:text-accent-warning">
                      <span className="text-sm md:text-base">Failed to load PDF. Please try downloading the file.</span>
                    </div>
                  }
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </PDFDocument>
              </div>
            ) : (
              <div className="bg-white dark:bg-dark-card rounded-lg p-4 md:p-6 max-w-4xl w-full max-h-full overflow-auto shadow-lg transition-colors duration-200">
                <h4 className="text-base md:text-lg font-medium text-gray-900 dark:text-dark-text mb-4 border-b border-gray-200 dark:border-gray-600 pb-2">Extracted Text Content</h4>
                <div 
                  className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 leading-relaxed"
                  style={{ fontSize: `${scale * 0.875}rem` }}
                >
                  {doc.content ? (
                    <pre className="whitespace-pre-wrap font-sans bg-gray-50 dark:bg-dark-search p-3 md:p-4 rounded border border-gray-200 dark:border-gray-600 overflow-auto text-sm md:text-base transition-colors duration-200">
                      {doc.content}
                    </pre>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 italic text-center py-8">No text content available</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          document={doc}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </>
  )
}

interface EditDocumentModalProps {
  document: DocumentWithProfile
  onClose: () => void
  onSave: (updatedDoc: Partial<DocumentWithProfile>) => void
}

function EditDocumentModal({ document: doc, onClose, onSave }: EditDocumentModalProps) {
  const [isPublic, setIsPublic] = useState(doc.is_public)
  const [tags, setTags] = useState<string[]>(doc.tags || [])
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        id: doc.id,
        is_public: isPublic,
        tags: tags
      })
      onClose()
    } catch (error) {
      console.error('Error saving document:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-card rounded-lg shadow-2xl w-full max-w-md transition-colors duration-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Edit Document Settings</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-2 truncate">{doc.title}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(doc.created_at).toLocaleDateString()} • {formatFileSize(doc.file_size)}
            </p>
          </div>

          {/* Privacy Setting */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Privacy</label>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  checked={!isPublic}
                  onChange={() => setIsPublic(false)}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <div className="flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Private - Only visible to you</span>
                </div>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  checked={isPublic}
                  onChange={() => setIsPublic(true)}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-green-600 dark:text-accent-success" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Public - Visible to all users</span>
                </div>
              </label>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  placeholder="Add a tag..."
                  className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-dark-search text-gray-900 dark:text-dark-text focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent"
                />
                <button
                  onClick={addTag}
                  className="flex items-center space-x-1 px-3 py-1 bg-blue-600 dark:bg-accent-primary text-white rounded-md hover:bg-blue-700 dark:hover:bg-accent-primary/90 transition-colors text-sm"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-100 dark:bg-accent-primary/20 text-blue-800 dark:text-accent-primary rounded-full text-xs"
                  >
                    <Tag className="w-3 h-3" />
                    <span>{tag}</span>
                    <button
                      onClick={() => removeTag(tag)}
                      className="text-blue-600 dark:text-accent-primary hover:text-blue-800 dark:hover:text-accent-primary/80"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-dark-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 dark:bg-accent-primary text-white rounded-md hover:bg-blue-700 dark:hover:bg-accent-primary/90 transition-colors text-sm disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-3 h-3" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

interface DeleteConfirmationModalProps {
  document: DocumentWithProfile
  onConfirm: () => void
  onCancel: () => void
}

function DeleteConfirmationModal({ document: doc, onConfirm, onCancel }: DeleteConfirmationModalProps) {
  const [deleting, setDeleting] = useState(false)

  const handleConfirm = async () => {
    setDeleting(true)
    try {
      await onConfirm()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-card rounded-lg shadow-2xl w-full max-w-md transition-colors duration-200">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-8 h-8 text-red-500 dark:text-accent-warning" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Delete Document</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-dark-search rounded-lg p-4 mb-6 transition-colors duration-200">
            <div className="flex items-center space-x-3">
              {doc.file_type === 'pdf' ? (
                <FileText className="w-6 h-6 text-red-500 flex-shrink-0" />
              ) : (
                <Image className="w-6 h-6 text-blue-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-dark-text truncate">{doc.title}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(doc.created_at).toLocaleDateString()} • {formatFileSize(doc.file_size)}
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Are you sure you want to delete this document? This will permanently remove the file from storage and all associated data from the database.
          </p>

          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={onCancel}
              disabled={deleting}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-dark-text transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={deleting}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 dark:bg-accent-warning text-white rounded-md hover:bg-red-700 dark:hover:bg-accent-warning/90 transition-colors text-sm disabled:opacity-50"
            >
              {deleting ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3 h-3" />
                  <span>Delete Document</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithProfile | null>(null)
  const [editingDocument, setEditingDocument] = useState<DocumentWithProfile | null>(null)
  const [deletingDocument, setDeletingDocument] = useState<DocumentWithProfile | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState<DocumentWithProfile | null>(null)
  const { user } = useAuth()
  const documentToast = useDocumentToast()

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          user_profiles (
            user_id,
            username,
            display_name
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocuments(data || [])
    } catch (error) {
      console.error('Error fetching documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateDocument = async (updatedDoc: Partial<DocumentWithProfile>) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          is_public: updatedDoc.is_public,
          tags: updatedDoc.tags
        })
        .eq('id', updatedDoc.id)

      if (error) throw error

      setDocuments(prev => 
        prev.map(doc => 
          doc.id === updatedDoc.id 
            ? { ...doc, is_public: updatedDoc.is_public!, tags: updatedDoc.tags! }
            : doc
        )
      )

      const document = documents.find(doc => doc.id === updatedDoc.id)
      if (document) {
        documentToast.showUpdateSuccess(document.title)
      }
    } catch (error) {
      console.error('Error updating document:', error)
      throw error
    }
  }

  const deleteDocument = async (id: string) => {
    try {
      const document = documents.find(doc => doc.id === id)
      if (!document) throw new Error('Document not found')

      if (document.metadata?.storage_path && document.metadata?.storage_bucket) {
        console.log(`Deleting file from storage: ${document.metadata.storage_bucket}/${document.metadata.storage_path}`)
        
        const { error: storageError } = await supabase.storage
          .from(document.metadata.storage_bucket)
          .remove([document.metadata.storage_path])

        if (storageError) {
          console.error('Storage deletion error:', storageError)
        } else {
          console.log('File successfully deleted from storage')
        }
      } else {
        if (document.file_url) {
          try {
            const url = new URL(document.file_url)
            const pathParts = url.pathname.split('/')
            
            if (pathParts.length >= 6 && pathParts[1] === 'storage' && pathParts[4] === 'public') {
              const bucket = pathParts[5]
              const filePath = pathParts.slice(6).join('/')
              
              console.log(`Attempting fallback deletion from bucket: ${bucket}, path: ${filePath}`)
              
              const { error: fallbackStorageError } = await supabase.storage
                .from(bucket)
                .remove([filePath])

              if (fallbackStorageError) {
                console.error('Fallback storage deletion error:', fallbackStorageError)
              } else {
                console.log('File successfully deleted from storage (fallback method)')
              }
            }
          } catch (urlError) {
            console.error('Failed to parse file URL for storage deletion:', urlError)
          }
        }
      }

      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)

      if (dbError) throw dbError

      setDocuments((prev) => prev.filter((doc) => doc.id !== id))
      
      documentToast.showDeleteSuccess(document.title)
      console.log('Document and associated file successfully deleted')
    } catch (error) {
      console.error('Error deleting document:', error)
      throw error
    }
  }

  const handleDeleteClick = (document: DocumentWithProfile, event: React.MouseEvent) => {
    event.stopPropagation()
    setDeletingDocument(document)
  }

  const handleDeleteConfirm = async () => {
    if (deletingDocument) {
      await deleteDocument(deletingDocument.id)
      setDeletingDocument(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeletingDocument(null)
  }

  const handleDirectDownload = async (document: DocumentWithProfile, event: React.MouseEvent) => {
    event.stopPropagation()
    if (!document.file_url) return
    
    try {
      const response = await fetch(document.file_url)
      if (!response.ok) throw new Error('Failed to fetch file')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = document.title || 'document'
      
      document.body.appendChild(link)
      link.click()
      
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download failed:', error)
      window.open(document.file_url, '_blank')
    }
  }

  const handleEdit = (document: DocumentWithProfile, event: React.MouseEvent) => {
    event.stopPropagation()
    setEditingDocument(document)
  }

  const handleShare = (document: DocumentWithProfile, event: React.MouseEvent) => {
    event.stopPropagation()
    setShowShareModal(document)
  }

  const handleDocumentClick = (doc: DocumentWithProfile) => {
    setSelectedDocument(doc)
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-accent-primary mx-auto"></div>
        <p className="mt-2 text-gray-600 dark:text-gray-300">Loading documents...</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3 md:space-y-6">
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-3 md:p-6 transition-colors duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-dark-text">Document Dashboard</h2>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {documents.length} document{documents.length !== 1 ? 's' : ''} total
            </div>
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-12 px-4">
            <FileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">No documents yet</h3>
            <p className="text-gray-600 dark:text-gray-400">Upload your first document to get started</p>
          </div>
        ) : (
          <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => handleDocumentClick(doc)}
                className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-3 md:p-4 hover:shadow-md hover:border-blue-300 dark:hover:border-accent-primary transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-2 md:mb-3">
                  <div className="flex items-center space-x-2">
                    {doc.file_type === 'pdf' ? (
                      <FileText className="w-4 h-4 md:w-5 md:h-5 text-red-500 flex-shrink-0" />
                    ) : (
                      <Image className="w-4 h-4 md:w-5 md:h-5 text-blue-500 flex-shrink-0" />
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    {doc.is_public ? (
                      <Globe className="w-3 h-3 md:w-4 md:h-4 text-green-600 dark:text-accent-success" />
                    ) : (
                      <Lock className="w-3 h-3 md:w-4 md:h-4 text-gray-600 dark:text-gray-400" />
                    )}
                  </div>
                </div>

                <h3 className="font-medium text-gray-900 dark:text-dark-text mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-accent-primary transition-colors text-sm md:text-base">
                  {doc.title}
                </h3>

                {doc.user_profiles && (
                  <div className="mb-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedProfile(doc.user_profiles!.user_id)
                      }}
                      className="text-xs text-blue-600 dark:text-accent-primary hover:text-blue-700 dark:hover:text-accent-primary/80 hover:underline transition-colors"
                    >
                      by @{doc.user_profiles.username}
                    </button>
                  </div>
                )}

                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2 md:mb-3">
                    {doc.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs text-gray-600 dark:text-gray-400"
                      >
                        #{tag}
                      </span>
                    ))}
                    {doc.tags.length > 2 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">+{doc.tags.length - 2} more</span>
                    )}
                  </div>
                )}

                <div className="space-y-1 md:space-y-2 mb-3 md:mb-4">
                  <div className="flex items-center text-xs md:text-sm text-gray-500 dark:text-gray-400">
                    <Calendar className="w-3 h-3 mr-1" />
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                    Size: {formatFileSize(doc.file_size)}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-600">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => handleEdit(doc, e)}
                      className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span className="hidden sm:inline">Edit</span>
                    </button>
                    
                    <button
                      onClick={(e) => handleShare(doc, e)}
                      className="flex items-center space-x-1 px-2 py-1 text-xs text-blue-600 dark:text-accent-primary hover:text-blue-700 dark:hover:text-accent-primary/80 hover:bg-blue-50 dark:hover:bg-accent-primary/10 rounded transition-colors"
                      title="Share document"
                    >
                      <Share2 className="w-3 h-3" />
                      <span className="hidden sm:inline">Share</span>
                    </button>
                    
                    <button
                      onClick={(e) => handleDirectDownload(doc, e)}
                      className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded transition-colors"
                      title="Download directly to device"
                    >
                      <Download className="w-3 h-3" />
                      <span className="hidden sm:inline">Download</span>
                    </button>
                  </div>
                  
                  <button
                    onClick={(e) => handleDeleteClick(doc, e)}
                    className="flex items-center space-x-1 px-2 py-1 text-xs text-red-600 dark:text-accent-warning hover:text-red-700 dark:hover:text-accent-warning/80 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Document/Image Viewer Modal */}
      {selectedDocument && (
        <>
          {selectedDocument.file_type === 'image' ? (
            <ImageViewer
              document={selectedDocument}
              onClose={() => setSelectedDocument(null)}
            />
          ) : (
            <DocumentViewer
              document={selectedDocument}
              onClose={() => setSelectedDocument(null)}
            />
          )}
        </>
      )}

      {/* Edit Document Modal */}
      {editingDocument && (
        <EditDocumentModal
          document={editingDocument}
          onClose={() => setEditingDocument(null)}
          onSave={updateDocument}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingDocument && (
        <DeleteConfirmationModal
          document={deletingDocument}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          document={showShareModal}
          onClose={() => setShowShareModal(null)}
        />
      )}

      {/* Profile Modal */}
      {selectedProfile && (
        <ProfilePage
          userId={selectedProfile}
          onClose={() => setSelectedProfile(null)}
        />
      )}
    </>
  )
}