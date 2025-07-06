import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, Image, Calendar, Download, X, ZoomIn, ZoomOut, Expand, RotateCcw, Share2, ChevronLeft, ChevronRight, AlertCircle, Globe, Lock, MoreVertical, Info, Heart } from 'lucide-react'
import { supabase, DocumentWithProfile } from '../lib/supabase'
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf'
import { ImageViewer } from './ImageViewer'
import { ShareModal } from './ShareModal'
import { ThemeToggle } from './ThemeToggle'
import { useAuth } from '../contexts/AuthContext'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function DocumentViewerPage() {
  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [document, setDocument] = useState<DocumentWithProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [pageInput, setPageInput] = useState<string>('1')
  const [scale, setScale] = useState<number>(1.0)
  const [zoomInput, setZoomInput] = useState<string>('100')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showDocDetails, setShowDocDetails] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 })
  const [headerHeight, setHeaderHeight] = useState(120) // Default header height

  useEffect(() => {
    if (documentId) {
      fetchDocument()
      if (user?.id) {
        checkIfFavorited()
      }
    }
  }, [documentId, user?.id])

  // Calculate header height on mount and resize
  useEffect(() => {
    const calculateHeaderHeight = () => {
      const header = document.querySelector('[data-document-header]')
      const controls = document.querySelector('[data-document-controls]')
      
      let totalHeight = 0
      if (header) totalHeight += header.getBoundingClientRect().height
      if (controls) totalHeight += controls.getBoundingClientRect().height
      
      setHeaderHeight(totalHeight || 120) // Fallback to 120px
    }

    calculateHeaderHeight()
    window.addEventListener('resize', calculateHeaderHeight)
    
    return () => window.removeEventListener('resize', calculateHeaderHeight)
  }, [])

  const fetchDocument = async () => {
    try {
      setLoading(true)
      setError(null)

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
        .eq('id', documentId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          setError('Document not found')
        } else {
          setError('Failed to load document')
        }
        return
      }

      // Check if document is accessible (public or user owns it)
      if (!data.is_public) {
        setError('This document is private and cannot be accessed via shared link')
        return
      }

      setDocument(data)
    } catch (err) {
      console.error('Error fetching document:', err)
      setError('Failed to load document')
    } finally {
      setLoading(false)
    }
  }

  const checkIfFavorited = async () => {
    if (!user?.id || !documentId) return

    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('document_id', documentId)
        .maybeSingle()

      if (error) throw error
      setIsFavorited(!!data)
    } catch (error) {
      console.error('Error checking favorite status:', error)
    }
  }

  const toggleFavorite = async () => {
    if (!user?.id || !documentId) return

    try {
      if (isFavorited) {
        // Remove from favorites
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('document_id', documentId)

        if (error) throw error
        setIsFavorited(false)
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('favorites')
          .insert({
            user_id: user.id,
            document_id: documentId
          })

        if (error) throw error
        setIsFavorited(true)
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  const onPageLoadSuccess = (page: any) => {
    const { width, height } = page.getViewport({ scale: 1 })
    setPageDimensions({ width, height })
    
    // Calculate scale to fit screen dimensions
    const screenWidth = window.innerWidth - 32 // Account for minimal padding
    const screenHeight = window.innerHeight - headerHeight - 32 // Account for header and minimal padding
    
    const scaleX = screenWidth / width
    const scaleY = screenHeight / height
    const optimalScale = Math.min(scaleX, scaleY) // Fit to screen
    
    setScale(optimalScale)
    setZoomInput(Math.round(optimalScale * 100).toString())
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
    // Reset to screen-fit zoom
    if (pageDimensions.width && pageDimensions.height) {
      const screenWidth = window.innerWidth - 32
      const screenHeight = window.innerHeight - headerHeight - 32
      
      const scaleX = screenWidth / pageDimensions.width
      const scaleY = screenHeight / pageDimensions.height
      const optimalScale = Math.min(scaleX, scaleY)
      
      setScale(optimalScale)
      setZoomInput(Math.round(optimalScale * 100).toString())
    } else {
      setScale(1.0)
      setZoomInput('100')
    }
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

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value)
  }

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const numValue = parseInt(pageInput)
    if (!isNaN(numValue) && numValue >= 1 && numValue <= numPages) {
      setPageNumber(numValue)
    } else {
      setPageInput(pageNumber.toString())
    }
  }

  const handlePageInputBlur = () => {
    handlePageInputSubmit({ preventDefault: () => {} } as React.FormEvent)
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
    const newPage = Math.max(pageNumber - 1, 1)
    setPageNumber(newPage)
    setPageInput(newPage.toString())
  }

  const goToNextPage = () => {
    const newPage = Math.min(pageNumber + 1, numPages)
    setPageNumber(newPage)
    setPageInput(newPage.toString())
  }

  const handleDirectDownload = async () => {
    if (!document?.file_url) return
    
    setDownloading(true)
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
    } finally {
      setDownloading(false)
    }
  }

  // Handle scroll for page navigation
  const handleScroll = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) return // Allow zoom with Ctrl+scroll
    
    if (e.deltaY > 0 && pageNumber < numPages) {
      // Scroll down - next page
      const newPage = pageNumber + 1
      setPageNumber(newPage)
      setPageInput(newPage.toString())
    } else if (e.deltaY < 0 && pageNumber > 1) {
      // Scroll up - previous page
      const newPage = pageNumber - 1
      setPageNumber(newPage)
      setPageInput(newPage.toString())
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center transition-colors duration-200">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-accent-primary"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-300">Loading document...</span>
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center p-4 transition-colors duration-200">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 dark:text-accent-warning mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-2">Document Not Available</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || 'The document you are looking for could not be found.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 dark:bg-accent-primary text-white rounded-md hover:bg-blue-700 dark:hover:bg-accent-primary/90 transition-colors"
          >
            Go to SearchDoc
          </button>
        </div>
      </div>
    )
  }

  if (document.file_type === 'image') {
    return <ImageViewer document={document} onClose={() => navigate('/')} />
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg transition-colors duration-200">
        {/* Header */}
        <div 
          data-document-header
          className="bg-white dark:bg-dark-card shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors duration-200"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                {document.file_type === 'pdf' ? (
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 flex-shrink-0" />
                ) : (
                  <Image className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <h1 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-dark-text truncate">{document.title}</h1>
                  <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    <span>{new Date(document.created_at).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{formatFileSize(document.file_size)}</span>
                    <span>•</span>
                    <div className="flex items-center space-x-1">
                      {document.is_public ? (
                        <Globe className="w-3 h-3 text-green-600 dark:text-accent-success" />
                      ) : (
                        <Lock className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                      )}
                      <span>{document.is_public ? 'Public' : 'Private'}</span>
                    </div>
                    {document.user_profiles && (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span className="hidden sm:inline">by @{document.user_profiles.username}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 flex-shrink-0">
                <ThemeToggle size="sm" />
                
                {/* Dropdown Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
                    title="More options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {showDropdown && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowDropdown(false)}
                      ></div>
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-card rounded-md shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-50">
                        <button
                          onClick={() => {
                            setShowDocDetails(true)
                            setShowDropdown(false)
                          }}
                          className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-search transition-colors"
                        >
                          <Info className="w-4 h-4" />
                          <span>Document Details</span>
                        </button>
                        
                        {user?.id && (
                          <button
                            onClick={() => {
                              toggleFavorite()
                              setShowDropdown(false)
                            }}
                            className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-search transition-colors"
                          >
                            <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current text-red-500 dark:text-accent-warning' : ''}`} />
                            <span>{isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
                
                <button
                  onClick={() => setShowShareModal(true)}
                  className="p-2 text-blue-600 dark:text-accent-primary hover:text-blue-700 dark:hover:text-accent-primary/80 hover:bg-blue-50 dark:hover:bg-accent-primary/10 rounded-md transition-colors"
                  title="Share document"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                
                {document.file_url && (
                  <button
                    onClick={handleDirectDownload}
                    disabled={downloading}
                    className="flex items-center space-x-1 px-3 py-2 text-sm text-white bg-blue-600 dark:bg-accent-primary hover:bg-blue-700 dark:hover:bg-accent-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span className="hidden sm:inline">Downloading...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Download</span>
                      </>
                    )}
                  </button>
                )}
                
                <button
                  onClick={() => navigate('/')}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Viewer Controls */}
        <div 
          data-document-controls
          className="bg-gray-100 dark:bg-dark-search border-b border-gray-200 dark:border-gray-600 px-4 py-2 transition-colors duration-200"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-center space-x-4">
            <button
              onClick={resetZoom}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              title="Reset zoom to fit screen"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            
            <button
              onClick={handleZoomOut}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            
            <form onSubmit={handleZoomInputSubmit} className="flex items-center">
              <input
                type="text"
                value={zoomInput}
                onChange={handleZoomInputChange}
                onBlur={handleZoomInputBlur}
                className="w-16 text-sm text-center bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text px-2 py-1 rounded border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent"
                title="Enter zoom percentage (25-500%)"
              />
              <span className="text-sm text-gray-600 dark:text-gray-300 ml-1">%</span>
            </form>
            
            <button
              onClick={handleZoomIn}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              <Expand className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content - Full screen width and height minus header */}
        <div 
          className="bg-gray-100 dark:bg-dark-bg flex items-center justify-center transition-colors duration-200 relative overflow-auto"
          style={{ 
            height: `calc(100vh - ${headerHeight}px)`,
            width: '100vw'
          }}
        >
          {document.file_type === 'pdf' && document.file_url ? (
            <>
              <div 
                className="flex items-center justify-center w-full h-full"
                onWheel={handleScroll}
              >
                <PDFDocument
                  file={document.file_url}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div className="flex items-center justify-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-accent-primary"></div>
                      <span className="ml-2 text-gray-600 dark:text-gray-300">Loading PDF...</span>
                    </div>
                  }
                  error={
                    <div className="flex items-center justify-center p-8 text-red-600 dark:text-accent-warning">
                      <span>Failed to load PDF. Please try downloading the file.</span>
                    </div>
                  }
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    onLoadSuccess={onPageLoadSuccess}
                  />
                </PDFDocument>
              </div>

              {/* Page Navigation - Bottom Center */}
              {numPages > 1 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg">
                  <button
                    onClick={goToPrevPage}
                    disabled={pageNumber <= 1}
                    className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  <form onSubmit={handlePageInputSubmit} className="flex items-center">
                    <input
                      type="text"
                      value={pageInput}
                      onChange={handlePageInputChange}
                      onBlur={handlePageInputBlur}
                      className="w-12 text-sm text-center bg-white bg-opacity-20 text-white px-1 py-1 rounded border-0 focus:ring-2 focus:ring-white focus:ring-opacity-50"
                      title="Enter page number"
                    />
                    <span className="text-sm mx-1">/</span>
                    <span className="text-sm">{numPages}</span>
                  </form>
                  
                  <button
                    onClick={goToNextPage}
                    disabled={pageNumber >= numPages}
                    className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white dark:bg-dark-card rounded-lg p-6 max-w-4xl w-full max-h-full overflow-auto shadow-lg transition-colors duration-200">
              <h4 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-4 border-b border-gray-200 dark:border-gray-600 pb-2">Extracted Text Content</h4>
              <div 
                className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 leading-relaxed"
                style={{ fontSize: `${scale * 0.875}rem` }}
              >
                {document.content ? (
                  <pre className="whitespace-pre-wrap font-sans bg-gray-50 dark:bg-dark-search p-4 rounded border border-gray-200 dark:border-gray-600 overflow-auto transition-colors duration-200">
                    {document.content}
                  </pre>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 italic text-center py-8">No text content available</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Document Details Modal */}
      {showDocDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-card rounded-lg shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Document Details</h3>
              <button
                onClick={() => setShowDocDetails(false)}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File Name</label>
                <p className="text-sm text-gray-900 dark:text-dark-text">{document.title}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File Type</label>
                <p className="text-sm text-gray-900 dark:text-dark-text capitalize">{document.file_type}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File Size</label>
                <p className="text-sm text-gray-900 dark:text-dark-text">{formatFileSize(document.file_size)}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Access Level</label>
                <div className="flex items-center space-x-2">
                  {document.is_public ? (
                    <>
                      <Globe className="w-4 h-4 text-green-600 dark:text-accent-success" />
                      <span className="text-sm text-gray-900 dark:text-dark-text">Public</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-dark-text">Private</span>
                    </>
                  )}
                </div>
              </div>
              
              {document.user_profiles && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Owner</label>
                  <p className="text-sm text-gray-900 dark:text-dark-text">@{document.user_profiles.username}</p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Upload Date</label>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm text-gray-900 dark:text-dark-text">
                    {new Date(document.created_at).toLocaleDateString()} at {new Date(document.created_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              
              {document.tags && document.tags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {document.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-accent-primary/20 text-blue-800 dark:text-accent-primary rounded-full text-xs"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <ShareModal
          document={document}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </>
  )
}