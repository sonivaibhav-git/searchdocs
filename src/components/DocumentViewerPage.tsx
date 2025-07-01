import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, Image, Calendar, Download, X, ZoomIn, ZoomOut, Expand, RotateCcw, Share2, ChevronLeft, ChevronRight, AlertCircle, Globe, Lock } from 'lucide-react'
import { supabase, DocumentWithProfile } from '../lib/supabase'
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf'
import { ImageViewer } from './ImageViewer'
import { ShareModal } from './ShareModal'
import { ThemeToggle } from './ThemeToggle'
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

  useEffect(() => {
    if (documentId) {
      fetchDocument()
    }
  }, [documentId])

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
        <div className="bg-white dark:bg-dark-card shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors duration-200">
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
        <div className="bg-gray-100 dark:bg-dark-search border-b border-gray-200 dark:border-gray-600 px-4 py-2 transition-colors duration-200">
          <div className="max-w-7xl mx-auto flex items-center justify-center space-x-4">
            <button
              onClick={resetZoom}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              title="Reset zoom to 100%"
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

        {/* Content */}
        <div className="flex-1 bg-gray-100 dark:bg-dark-bg flex flex-col items-center justify-center p-4 transition-colors duration-200 relative min-h-[calc(100vh-120px)]">
          {document.file_type === 'pdf' && document.file_url ? (
            <>
              <div 
                className="bg-white shadow-lg rounded-lg overflow-hidden flex-1 flex items-center justify-center w-full max-w-full"
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
                    width={Math.min(viewerDimensions.width, window.innerWidth - 32)}
                  />
                </PDFDocument>
              </div>

              {/* Page Navigation - Bottom Center */}
              {numPages > 0 && (
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

      {showShareModal && (
        <ShareModal
          document={document}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </>
  )
}