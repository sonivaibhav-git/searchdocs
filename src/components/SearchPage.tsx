import React, { useState, useEffect } from 'react'
import { Search, FileText, Image, Calendar, Eye, ZoomIn, ZoomOut, X, Tag, Globe, Lock, User, AlertCircle, Expand, RotateCcw, Download, Share2, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase, DocumentWithProfile } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf'
import { ProfilePage } from './ProfilePage'
import { ImageViewer } from './ImageViewer'
import { ShareModal } from './ShareModal'
import { useSearchToast } from './Toast'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

interface DocumentViewerProps {
  document: DocumentWithProfile
  onClose: () => void
}

function DocumentViewer({ document: doc, onClose }: DocumentViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [pageInput, setPageInput] = useState<string>('1')
  const [scale, setScale] = useState<number>(1.0)
  const [zoomInput, setZoomInput] = useState<string>('100')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 })
  const [isMobile, setIsMobile] = useState(false)

  // Prevent background scrolling when viewer is open
  useEffect(() => {
    // Disable scrolling on body
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'
    document.body.style.height = '100%'
    
    // Hide bottom navbar on mobile
    const bottomNav = document.querySelector('[data-bottom-nav]')
    if (bottomNav) {
      (bottomNav as HTMLElement).style.display = 'none'
    }

    return () => {
      // Re-enable scrolling when component unmounts
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.height = ''
      
      // Show bottom navbar again
      if (bottomNav) {
        (bottomNav as HTMLElement).style.display = ''
      }
    }
  }, [])

  // Check if mobile and update container dimensions
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    
    const updateDimensions = () => {
      checkMobile()
      
      // Calculate container dimensions for full screen
      const headerHeight = isMobile ? 80 : 100 // Top navbar height
      const pageNavHeight = 60 // Bottom page navigation height
      
      const availableWidth = window.innerWidth
      const availableHeight = window.innerHeight - headerHeight - pageNavHeight
      
      setContainerDimensions({
        width: availableWidth,
        height: availableHeight
      })
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    window.addEventListener('orientationchange', updateDimensions)

    return () => {
      window.removeEventListener('resize', updateDimensions)
      window.removeEventListener('orientationchange', updateDimensions)
    }
  }, [isMobile])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    // Auto-fit document to container height by default
    const optimalScale = calculateContainerFitScale()
    setScale(optimalScale)
    setZoomInput(Math.round(optimalScale * 100).toString())
  }

  const calculateContainerFitScale = () => {
    if (containerDimensions.width === 0 || containerDimensions.height === 0) {
      return isMobile ? 0.8 : 1.0
    }

    // Standard PDF page ratio is approximately 8.5:11 (0.77)
    const pageRatio = 0.77
    const containerRatio = containerDimensions.width / containerDimensions.height
    
    let optimalScale: number
    
    // Always prioritize fitting to height for better reading experience
    const heightBasedScale = containerDimensions.height / 1100 // Assuming standard PDF height
    const widthBasedScale = containerDimensions.width / 850   // Assuming standard PDF width
    
    // Use the smaller scale to ensure document fits completely
    optimalScale = Math.min(heightBasedScale, widthBasedScale)
    
    // Ensure scale is within reasonable bounds
    return Math.max(0.3, Math.min(optimalScale, isMobile ? 2.0 : 3.0))
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
    const optimalScale = calculateContainerFitScale()
    setScale(optimalScale)
    setZoomInput(Math.round(optimalScale * 100).toString())
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

  // Handle scroll for page navigation (both desktop and mobile)
  const handleScroll = (e: React.WheelEvent | React.TouchEvent) => {
    e.preventDefault() // Prevent background scrolling
    
    if ('deltaY' in e) {
      // Mouse wheel event
      if (e.deltaY > 0 && pageNumber < numPages) {
        const newPage = pageNumber + 1
        setPageNumber(newPage)
        setPageInput(newPage.toString())
      } else if (e.deltaY < 0 && pageNumber > 1) {
        const newPage = pageNumber - 1
        setPageNumber(newPage)
        setPageInput(newPage.toString())
      }
    }
  }

  // Touch handling for mobile
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientY)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isUpSwipe = distance > 50
    const isDownSwipe = distance < -50

    if (isUpSwipe && pageNumber < numPages) {
      const newPage = pageNumber + 1
      setPageNumber(newPage)
      setPageInput(newPage.toString())
    }
    
    if (isDownSwipe && pageNumber > 1) {
      const newPage = pageNumber - 1
      setPageNumber(newPage)
      setPageInput(newPage.toString())
    }
  }

  const getDocumentWidth = () => {
    // Calculate width based on container and scale, prioritizing height fit
    return containerDimensions.width * 0.95 // Use most of container width
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col z-50 overflow-hidden">
        {/* Top Navbar */}
        <div className="flex items-center justify-between p-2 sm:p-3 md:p-4 border-b border-gray-600 bg-gray-900 flex-shrink-0">
          <div className="flex items-center space-x-2 md:space-x-3 min-w-0 flex-1">
            {doc.file_type === 'pdf' ? (
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-red-500 flex-shrink-0" />
            ) : (
              <Image className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-blue-500 flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm md:text-lg font-semibold text-white truncate">{doc.title}</h3>
              <div className="flex items-center space-x-1 md:space-x-2 text-xs md:text-sm text-gray-300">
                <span className="hidden sm:inline">{new Date(doc.created_at).toLocaleDateString()}</span>
                <span className="hidden sm:inline">•</span>
                <span>{formatFileSize(doc.file_size)}</span>
                <span className="hidden md:inline">•</span>
                <div className="hidden md:flex items-center space-x-1">
                  {doc.is_public ? (
                    <Globe className="w-3 h-3 text-green-400" />
                  ) : (
                    <Lock className="w-3 h-3 text-gray-400" />
                  )}
                  <span>{doc.is_public ? 'Public' : 'Private'}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-1 md:space-x-2 flex-shrink-0">
            <button
              onClick={resetZoom}
              className="p-1 md:p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
              title="Fit to container"
            >
              <RotateCcw className="w-3 h-3 md:w-4 md:h-4" />
            </button>
            
            <button
              onClick={handleZoomOut}
              className="p-1 md:p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-3 h-3 md:w-4 md:h-4" />
            </button>
            
            <form onSubmit={handleZoomInputSubmit} className="flex items-center">
              <input
                type="text"
                value={zoomInput}
                onChange={handleZoomInputChange}
                onBlur={handleZoomInputBlur}
                className="w-8 sm:w-12 md:w-16 text-xs md:text-sm text-center bg-gray-800 text-white px-1 md:px-2 py-1 rounded border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                title="Enter zoom percentage (25-500%)"
              />
              <span className="text-xs md:text-sm text-gray-300 ml-1">%</span>
            </form>
            
            <button
              onClick={handleZoomIn}
              className="p-1 md:p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-3 h-3 md:w-4 md:h-4" />
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-1 md:p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              <Expand className="w-3 h-3 md:w-4 md:h-4" />
            </button>

            <button
              onClick={() => setShowShareModal(true)}
              className="p-1 md:p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded-md transition-colors"
              title="Share document"
            >
              <Share2 className="w-3 h-3 md:w-4 md:h-4" />
            </button>
            
            {doc.file_url && (
              <button
                onClick={handleDirectDownload}
                disabled={downloading}
                className="flex items-center space-x-1 px-2 md:px-3 py-1 md:py-2 text-xs md:text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download PDF directly to your device"
              >
                {downloading ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 md:h-4 md:w-4 border-b-2 border-white"></div>
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
              className="p-1 md:p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors ml-1 md:ml-2"
            >
              <X className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </div>

        {/* Full Screen Document Container */}
        <div 
          className="flex-1 bg-gray-900 flex items-center justify-center relative overflow-hidden"
          style={{
            width: '100vw',
            height: `${containerDimensions.height}px`
          }}
        >
          {doc.file_type === 'pdf' && doc.file_url ? (
            <>
              <div 
                className="w-full h-full flex items-center justify-center overflow-auto bg-gray-800"
                onWheel={handleScroll}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ 
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch',
                  width: `${containerDimensions.width}px`,
                  height: `${containerDimensions.height}px`
                }}
              >
                <div className="flex items-center justify-center p-4">
                  <PDFDocument
                    file={doc.file_url}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={
                      <div className="flex items-center justify-center p-4 md:p-8">
                        <div className="animate-spin rounded-full h-6 w-6 md:h-8 md:w-8 border-b-2 border-blue-400"></div>
                        <span className="ml-2 text-white text-sm md:text-base">Loading PDF...</span>
                      </div>
                    }
                    error={
                      <div className="flex items-center justify-center p-4 md:p-8 text-red-400">
                        <span className="text-sm md:text-base">Failed to load PDF. Please try downloading the file.</span>
                      </div>
                    }
                  >
                    <Page
                      pageNumber={pageNumber}
                      scale={scale}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      height={containerDimensions.height * 0.9} // Use 90% of container height
                      className="shadow-2xl bg-white rounded"
                    />
                  </PDFDocument>
                </div>
              </div>

              {/* Page Navigation - Bottom Center */}
              {numPages > 0 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg">
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
                      type="number"
                      min="1"
                      max={numPages}
                      value={pageInput}
                      onChange={handlePageInputChange}
                      onBlur={handlePageInputBlur}
                      className="w-12 sm:w-16 text-xs sm:text-sm text-center bg-white bg-opacity-20 text-white px-1 py-1 rounded border-0 focus:ring-2 focus:ring-white focus:ring-opacity-50"
                      title="Enter page number"
                    />
                    <span className="text-xs sm:text-sm mx-1">/</span>
                    <span className="text-xs sm:text-sm">{numPages}</span>
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
            <div 
              className="bg-gray-800 rounded-lg p-4 md:p-6 w-full h-full overflow-auto shadow-lg"
              style={{
                width: `${containerDimensions.width}px`,
                height: `${containerDimensions.height}px`
              }}
            >
              <h4 className="text-base md:text-lg font-medium text-white mb-4 border-b border-gray-600 pb-2">Extracted Text Content</h4>
              <div 
                className="prose prose-sm max-w-none text-gray-300 leading-relaxed"
                style={{ fontSize: `${scale * 0.875}rem` }}
              >
                {doc.content ? (
                  <pre className="whitespace-pre-wrap font-sans bg-gray-900 p-3 md:p-4 rounded border border-gray-600 overflow-auto text-sm md:text-base">
                    {doc.content}
                  </pre>
                ) : (
                  <p className="text-gray-400 italic text-center py-8">No text content available</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showShareModal && (
        <ShareModal
          document={doc}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </>
  )
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getTagColor = (tag: string, index: number) => {
  const colors = [
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  ]
  
  // Use tag name to generate consistent color
  const colorIndex = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
  return colors[colorIndex]
}

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DocumentWithProfile[]>([])
  const [allDocuments, setAllDocuments] = useState<DocumentWithProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedPrivacy, setSelectedPrivacy] = useState<'all' | 'public' | 'private'>('all')
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithProfile | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState<DocumentWithProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const searchToast = useSearchToast()

  useEffect(() => {
    fetchAllDocuments()
  }, [])

  const fetchAllDocuments = async () => {
    try {
      setError(null)
      console.log('Fetching documents...')
      
      if (!user?.id) {
        console.log('No authenticated user found')
        setAllDocuments([])
        setResults([])
        setInitialLoading(false)
        return
      }

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
        .or(`user_id.eq.${user.id},is_public.eq.true`)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase query error:', error)
        throw error
      }
      
      console.log('Documents fetched successfully:', data?.length || 0)
      const documents = data || []
      setAllDocuments(documents)
      setResults(documents)
      
      const allTags = new Set<string>()
      documents.forEach(doc => {
        if (doc.tags && Array.isArray(doc.tags)) {
          doc.tags.forEach(tag => allTags.add(tag))
        }
      })
      setAvailableTags(Array.from(allTags).sort())
    } catch (error: any) {
      console.error('Error fetching documents:', error)
      
      let errorMessage = 'Failed to load documents. '
      
      if (error.message?.includes('Failed to fetch')) {
        errorMessage += 'Please check your internet connection and ensure Supabase is properly configured.'
      } else if (error.code === 'PGRST301') {
        errorMessage += 'Database connection issue. Please try refreshing the page.'
      } else if (error.message) {
        errorMessage += error.message
      } else {
        errorMessage += 'An unexpected error occurred.'
      }
      
      setError(errorMessage)
      searchToast.showSearchError(errorMessage)
    } finally {
      setInitialLoading(false)
    }
  }

  const handleSearch = async () => {
    let filteredDocs = allDocuments

    // Apply privacy filter
    if (selectedPrivacy === 'public') {
      filteredDocs = filteredDocs.filter(doc => doc.is_public)
    } else if (selectedPrivacy === 'private') {
      filteredDocs = filteredDocs.filter(doc => !doc.is_public && doc.user_id === user?.id)
    }

    // Apply tag filter
    if (selectedTags.length > 0) {
      filteredDocs = filteredDocs.filter(doc => 
        doc.tags && doc.tags.some(tag => selectedTags.includes(tag))
      )
    }

    if (!query.trim()) {
      setResults(filteredDocs)
      return
    }

    setLoading(true)
    try {
      setError(null)
      
      if (!user?.id) {
        throw new Error('User not authenticated')
      }

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
        .or(`user_id.eq.${user.id},is_public.eq.true`)
        .or(`content.fts.${query},title.ilike.%${query}%,tags.cs.{${query}}`)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Search query error:', error)
        throw error
      }

      let searchResults = data || []

      // Apply privacy filter to search results
      if (selectedPrivacy === 'public') {
        searchResults = searchResults.filter(doc => doc.is_public)
      } else if (selectedPrivacy === 'private') {
        searchResults = searchResults.filter(doc => !doc.is_public && doc.user_id === user?.id)
      }

      // Apply tag filter to search results
      if (selectedTags.length > 0) {
        searchResults = searchResults.filter(doc => 
          doc.tags && doc.tags.some(tag => selectedTags.includes(tag))
        )
      }

      setResults(searchResults)
      
      if (searchResults.length === 0) {
        searchToast.showNoResults(query)
      }
    } catch (error: any) {
      console.error('Search error:', error)
      
      let errorMessage = 'Search failed. '
      if (error.message?.includes('Failed to fetch')) {
        errorMessage += 'Please check your internet connection.'
      } else if (error.message) {
        errorMessage += error.message
      } else {
        errorMessage += 'An unexpected error occurred.'
      }
      
      setError(errorMessage)
      searchToast.showSearchError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (query) {
      const debounceTimer = setTimeout(handleSearch, 300)
      return () => clearTimeout(debounceTimer)
    } else {
      let filteredDocs = allDocuments
      
      // Apply privacy filter
      if (selectedPrivacy === 'public') {
        filteredDocs = filteredDocs.filter(doc => doc.is_public)
      } else if (selectedPrivacy === 'private') {
        filteredDocs = filteredDocs.filter(doc => !doc.is_public && doc.user_id === user?.id)
      }
      
      // Apply tag filter
      if (selectedTags.length > 0) {
        filteredDocs = filteredDocs.filter(doc => 
          doc.tags && doc.tags.some(tag => selectedTags.includes(tag))
        )
      }
      
      setResults(filteredDocs)
    }
  }, [query, selectedTags, selectedPrivacy, allDocuments])

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const clearAllTags = () => {
    setSelectedTags([])
  }

  const clearSearch = () => {
    setQuery('')
  }

  const clearAllFilters = () => {
    setSelectedTags([])
    setSelectedPrivacy('all')
    setQuery('')
  }

  const handleDocumentClick = (doc: DocumentWithProfile) => {
    setSelectedDocument(doc)
  }

  const handleShare = (doc: DocumentWithProfile, event: React.MouseEvent) => {
    event.stopPropagation()
    setShowShareModal(doc)
  }

  if (initialLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-accent-primary mx-auto"></div>
        <p className="mt-2 text-gray-600 dark:text-gray-300">Loading documents...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 px-4">
        <AlertCircle className="w-12 h-12 text-red-500 dark:text-accent-warning mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">Connection Error</h3>
        <p className="text-red-600 dark:text-accent-warning mb-4 max-w-md mx-auto text-sm">{error}</p>
        <button
          onClick={() => {
            setError(null)
            setInitialLoading(true)
            fetchAllDocuments()
          }}
          className="px-4 py-2 bg-blue-600 dark:bg-accent-primary text-white rounded-md hover:bg-blue-700 dark:hover:bg-accent-primary/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 md:p-6 transition-colors duration-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4 md:w-5 md:h-5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search through documents..."
              className="w-full pl-10 md:pl-10 pr-12 py-2 md:py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-search text-gray-900 dark:text-dark-text placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent text-base md:text-lg transition-colors duration-200"
            />
            {query && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Clear search"
              >
                <X className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 md:p-6 transition-colors duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 md:mb-4 gap-2">
            <div className="flex items-center space-x-2">
              <Tag className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
            </div>
            {(selectedTags.length > 0 || selectedPrivacy !== 'all') && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-blue-600 dark:text-accent-primary hover:text-blue-700 dark:hover:text-accent-primary/80 transition-colors self-start sm:self-auto"
              >
                Clear all filters
              </button>
            )}
          </div>
          
          {/* Privacy Filter */}
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedPrivacy('all')}
                className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedPrivacy === 'all'
                    ? 'bg-blue-600 dark:bg-accent-primary text-white shadow-md transform scale-105'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:shadow-md hover:scale-105'
                }`}
              >
                <Globe className="w-3 h-3" />
                <span>All Documents</span>
              </button>
              
              <button
                onClick={() => setSelectedPrivacy('public')}
                className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedPrivacy === 'public'
                    ? 'bg-green-600 dark:bg-accent-success text-white shadow-md transform scale-105'
                    : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:shadow-md hover:scale-105'
                }`}
              >
                <Globe className="w-3 h-3" />
                <span>Public</span>
              </button>
              
              <button
                onClick={() => setSelectedPrivacy('private')}
                className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedPrivacy === 'private'
                    ? 'bg-gray-600 dark:bg-gray-500 text-white shadow-md transform scale-105'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:shadow-md hover:scale-105'
                }`}
              >
                <Lock className="w-3 h-3" />
                <span>Private</span>
              </button>
            </div>
          </div>

          {/* Tags Filter */}
          {availableTags.length > 0 && (
            <div>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag, index) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                      selectedTags.includes(tag)
                        ? 'bg-blue-600 dark:bg-accent-primary text-white shadow-md transform scale-105'
                        : `${getTagColor(tag, index)} hover:shadow-md hover:scale-105`
                    }`}
                  >
                    <Tag className="w-3 h-3" />
                    <span>{tag}</span>
                  </button>
                ))}
              </div>
              
              {(selectedTags.length > 0 || selectedPrivacy !== 'all') && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Active filters: 
                    {selectedPrivacy !== 'all' && <span className="ml-1 font-medium">{selectedPrivacy}</span>}
                    {selectedTags.length > 0 && selectedPrivacy !== 'all' && ', '}
                    {selectedTags.length > 0 && <span className="ml-1 font-medium">{selectedTags.join(', ')}</span>}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-accent-primary mx-auto"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-300">Searching...</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {query ? `Found ${results.length} result${results.length !== 1 ? 's' : ''}` : `Showing ${results.length} document${results.length !== 1 ? 's' : ''}`}
                {(selectedTags.length > 0 || selectedPrivacy !== 'all') && (
                  <span> with active filters</span>
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {results.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => handleDocumentClick(doc)}
                  className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-3 md:p-4 hover:shadow-md hover:border-blue-300 dark:hover:border-accent-primary transition-all duration-200 cursor-pointer group flex flex-col h-full"
                >
                  <div className="flex items-start justify-between mb-2 md:mb-3">
                    <div className="flex items-center space-x-2">
                      {doc.file_type === 'pdf' ? (
                        <FileText className="w-5 h-5 md:w-6 md:h-6 text-red-500 flex-shrink-0" />
                      ) : (
                        <Image className="w-5 h-5 md:w-6 md:h-6 text-blue-500 flex-shrink-0" />
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      {doc.is_public ? (
                        <Globe className="w-3 h-3 md:w-4 md:h-4 text-green-600 dark:text-accent-success" />
                      ) : (
                        <Lock className="w-3 h-3 md:w-4 md:h-4 text-gray-600 dark:text-gray-400" />
                      )}
                      {doc.user_id !== user?.id && (
                        <User className="w-3 h-3 md:w-4 md:h-4 text-blue-600 dark:text-accent-primary" />
                      )}
                    </div>
                  </div>

                  <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-2 md:mb-3 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-accent-primary transition-colors text-sm md:text-base">
                    {doc.title}
                  </h3>

                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2 md:mb-3 flex-1">
                      {doc.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={tag}
                          className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
                            selectedTags.includes(tag)
                              ? 'bg-blue-600 text-white dark:bg-accent-primary'
                              : getTagColor(tag, index)
                          }`}
                        >
                          #{tag}
                        </span>
                      ))}
                      {doc.tags.length > 3 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                          +{doc.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

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

                  <div className="mt-auto space-y-1 md:space-y-2">
                    <div className="flex items-center text-xs md:text-sm text-gray-500 dark:text-gray-400">
                      <Calendar className="w-3 h-3 mr-1" />
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs md:text-sm text-gray-500 dark:text-gray-400">
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span className="capitalize">{doc.file_type}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-600">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedDocument(doc)
                        }}
                        className="flex items-center space-x-1 px-2 py-1 text-xs text-blue-600 dark:text-accent-primary hover:text-blue-700 dark:hover:text-accent-primary/80 hover:bg-blue-50 dark:hover:bg-accent-primary/10 rounded transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        <span className="hidden sm:inline">View</span>
                      </button>

                      <button
                        onClick={(e) => handleShare(doc, e)}
                        className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded transition-colors"
                        title="Share document"
                      >
                        <Share2 className="w-3 h-3" />
                        <span className="hidden sm:inline">Share</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && results.length === 0 && allDocuments.length === 0 && (
          <div className="text-center py-12 px-4">
            <Search className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">No documents found</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">
              Upload some documents first to start searching.
            </p>
          </div>
        )}

        {!loading && results.length === 0 && allDocuments.length > 0 && (query || selectedTags.length > 0 || selectedPrivacy !== 'all') && (
          <div className="text-center py-12 px-4">
            <Search className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">No results found</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">
              Try adjusting your search query or filters to find what you're looking for.
            </p>
          </div>
        )}
      </div>

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

      {showShareModal && (
        <ShareModal
          document={showShareModal}
          onClose={() => setShowShareModal(null)}
        />
      )}

      {selectedProfile && (
        <ProfilePage
          userId={selectedProfile}
          onClose={() => setSelectedProfile(null)}
        />
      )}
    </>
  )
}