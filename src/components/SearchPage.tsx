import React, { useState, useEffect } from 'react'
import { Search, FileText, Image, Calendar, Eye, ZoomIn, ZoomOut, X, Tag, Globe, Lock, User, AlertCircle, Expand, RotateCcw, Download } from 'lucide-react'
import { supabase, DocumentWithProfile } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf'
import { ProfilePage } from './ProfilePage'
import { ImageViewer } from './ImageViewer'
import { useSearchToast } from './Toast'
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
      // Reset to current scale if invalid
      setZoomInput(Math.round(scale * 100).toString())
    }
  }

  const handleZoomInputBlur = () => {
    handleZoomInputSubmit({ preventDefault: () => {} } as React.FormEvent)
  }

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      // Enter fullscreen
      const element = document.documentElement
      if (element.requestFullscreen) {
        element.requestFullscreen()
      } else if ((element as any).webkitRequestFullscreen) {
        (element as any).webkitRequestFullscreen()
      } else if ((element as any).msRequestFullscreen) {
        (element as any).msRequestFullscreen()
      }
    } else {
      // Exit fullscreen
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

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement
      )
      setIsFullscreen(isCurrentlyFullscreen)
    }

    // Check if document and addEventListener exist before using them
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
      // Fetch the PDF as a blob
      const response = await fetch(doc.file_url)
      if (!response.ok) throw new Error('Failed to fetch PDF')
      
      const blob = await response.blob()
      
      // Create a download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = doc.title || 'document.pdf'
      
      // Trigger download
      document.body.appendChild(link)
      link.click()
      
      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download failed:', error)
      // Fallback to opening in new tab
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
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${isFullscreen ? 'p-0' : 'p-2 md:p-4'}`}>
      <div className={`bg-white dark:bg-dark-card rounded-lg shadow-2xl flex flex-col ${
        isFullscreen 
          ? 'w-full h-full rounded-none' 
          : 'w-full max-w-7xl h-[95vh]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-dark-search rounded-t-lg flex-shrink-0">
          <div className="flex items-center space-x-2 md:space-x-3 min-w-0 flex-1">
            {doc.file_type === 'pdf' ? (
              <FileText className="w-5 h-5 md:w-6 md:h-6 text-red-500 flex-shrink-0" />
            ) : (
              <Image className="w-5 h-5 md:w-6 md:h-6 text-blue-500 flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm md:text-lg font-semibold text-gray-900 dark:text-dark-text truncate">{doc.title}</h3>
              <div className="flex items-center space-x-1 md:space-x-2 text-xs md:text-sm text-gray-500 dark:text-gray-400">
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
          
          <div className="flex items-center space-x-1 md:space-x-2 flex-shrink-0">
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
                
                <span className="text-xs md:text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-dark-card px-2 md:px-3 py-1 rounded border border-gray-300 dark:border-gray-600">
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
                
                <div className="w-px h-4 md:h-6 bg-gray-300 dark:bg-gray-600 mx-1 md:mx-2"></div>
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
                className="w-12 md:w-16 text-xs md:text-sm text-center bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text px-1 md:px-2 py-1 rounded border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent"
                title="Enter zoom percentage (25-500%)"
              />
              <span className="text-xs md:text-sm text-gray-600 dark:text-gray-300 ml-1">%</span>
            </form>
            
            <button
              onClick={handleZoomIn}
              className="p-1 md:p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-3 h-3 md:w-4 md:h-4" />
            </button>

            {/* Fullscreen Toggle with Arrow Icon */}
            <button
              onClick={toggleFullscreen}
              className="p-1 md:p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              <Expand className="w-3 h-3 md:w-4 md:h-4" />
            </button>
            
            {/* Direct Download Button */}
            {doc.file_url && (
              <button
                onClick={handleDirectDownload}
                disabled={downloading}
                className="flex items-center space-x-1 px-2 md:px-3 py-1 md:py-2 text-xs md:text-sm text-white bg-blue-600 dark:bg-accent-primary hover:bg-blue-700 dark:hover:bg-accent-primary/90 rounded-md transition-colors ml-1 md:ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="p-1 md:p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors ml-1 md:ml-2"
            >
              <X className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-dark-bg flex items-center justify-center p-2 md:p-4">
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
            <div className="bg-white dark:bg-dark-card rounded-lg p-4 md:p-6 max-w-4xl w-full max-h-full overflow-auto shadow-lg">
              <h4 className="text-base md:text-lg font-medium text-gray-900 dark:text-dark-text mb-4 border-b border-gray-200 dark:border-gray-600 pb-2">Extracted Text Content</h4>
              <div 
                className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 leading-relaxed"
                style={{ fontSize: `${scale * 0.875}rem` }}
              >
                {doc.content ? (
                  <pre className="whitespace-pre-wrap font-sans bg-gray-50 dark:bg-dark-search p-3 md:p-4 rounded border border-gray-200 dark:border-gray-600 overflow-auto text-sm md:text-base">
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
  )
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DocumentWithProfile[]>([])
  const [allDocuments, setAllDocuments] = useState<DocumentWithProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithProfile | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const searchToast = useSearchToast()

  // Load all documents on component mount
  useEffect(() => {
    fetchAllDocuments()
  }, [])

  const fetchAllDocuments = async () => {
    try {
      setError(null)
      console.log('Fetching documents...')
      
      // Check if user is authenticated
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
      setResults(documents) // Show all documents initially
      
      // Extract all unique tags
      const allTags = new Set<string>()
      documents.forEach(doc => {
        if (doc.tags && Array.isArray(doc.tags)) {
          doc.tags.forEach(tag => allTags.add(tag))
        }
      })
      setAvailableTags(Array.from(allTags).sort())
    } catch (error: any) {
      console.error('Error fetching documents:', error)
      
      // Provide more specific error messages
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

    // Filter by tags first
    if (selectedTags.length > 0) {
      filteredDocs = filteredDocs.filter(doc => 
        doc.tags && doc.tags.some(tag => selectedTags.includes(tag))
      )
    }

    // If no query, show filtered documents
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

      // Use full-text search on content and also search in tags and title
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

      // Apply tag filtering to search results
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
      // Show filtered documents when query is empty
      let filteredDocs = allDocuments
      if (selectedTags.length > 0) {
        filteredDocs = filteredDocs.filter(doc => 
          doc.tags && doc.tags.some(tag => selectedTags.includes(tag))
        )
      }
      setResults(filteredDocs)
    }
  }, [query, selectedTags, allDocuments])

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

  const handleDocumentClick = (doc: DocumentWithProfile) => {
    setSelectedDocument(doc)
  }

  if (initialLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-accent-primary mx-auto"></div>
        <p className="mt-2 text-gray-600 dark:text-gray-300">Loading documents...</p>
      </div>
    )
  }

  // Show error state
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
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 md:p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4 md:w-5 md:h-5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search through documents..."
              className="w-full pl-10 md:pl-10 pr-4 py-2 md:py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-search text-gray-900 dark:text-dark-text placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent text-base md:text-lg"
            />
          </div>
        </div>

        {/* Tags Filter */}
        {availableTags.length > 0 && (
          <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 md:p-6">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Tags:</span>
              </div>
              {selectedTags.length > 0 && (
                <button
                  onClick={clearAllTags}
                  className="text-sm text-blue-600 dark:text-accent-primary hover:text-blue-700 dark:hover:text-accent-primary/80 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-600 dark:bg-accent-primary text-white'
                      : 'bg-gray-100 dark:bg-dark-tag-bg text-gray-700 dark:text-dark-tag-text hover:bg-gray-200 dark:hover:bg-dark-tag-alt'
                  }`}
                >
                  <Tag className="w-3 h-3" />
                  <span>{tag}</span>
                </button>
              ))}
            </div>
            
            {selectedTags.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Active filters: {selectedTags.join(', ')}
                </p>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-accent-primary mx-auto"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-300">Searching...</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {query ? `Found ${results.length} result${results.length !== 1 ? 's' : ''}` : `Showing ${results.length} document${results.length !== 1 ? 's' : ''}`}
                {selectedTags.length > 0 && ` with tags: ${selectedTags.join(', ')}`}
              </p>
            </div>

            {/* Responsive Grid Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {results.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => handleDocumentClick(doc)}
                  className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-3 md:p-4 hover:shadow-md hover:border-blue-300 dark:hover:border-accent-primary transition-all duration-200 cursor-pointer group aspect-square flex flex-col"
                >
                  {/* Header with icons */}
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

                  {/* Title */}
                  <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-2 md:mb-3 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-accent-primary transition-colors text-sm md:text-base">
                    {doc.title}
                  </h3>

                  {/* Tags - Updated to match filter tag size */}
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2 md:mb-3 flex-1">
                      {doc.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors ${
                            selectedTags.includes(tag)
                              ? 'bg-blue-100 dark:bg-accent-primary/20 text-blue-800 dark:text-accent-primary'
                              : 'bg-gray-100 dark:bg-dark-tag-bg text-gray-600 dark:text-dark-tag-text'
                          }`}
                        >
                          <Tag className="w-3 h-3 flex-shrink-0" />
                          <span>{tag}</span>
                        </span>
                      ))}
                      {doc.tags.length > 3 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 whitespace-nowrap">
                          +{doc.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Author */}
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

                  {/* Footer with metadata */}
                  <div className="mt-auto space-y-1 md:space-y-2">
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="w-3 h-3 mr-1" />
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span className="capitalize">{doc.file_type}</span>
                    </div>

                    {/* Action button - Only View */}
                    <div className="flex items-center justify-center pt-2 border-t border-gray-100 dark:border-gray-600">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedDocument(doc)
                        }}
                        className="flex items-center space-x-1 px-3 py-1 text-xs text-blue-600 dark:text-accent-primary hover:text-blue-700 dark:hover:text-accent-primary/80 hover:bg-blue-50 dark:hover:bg-accent-primary/10 rounded transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View Document</span>
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

        {!loading && results.length === 0 && allDocuments.length > 0 && (query || selectedTags.length > 0) && (
          <div className="text-center py-12 px-4">
            <Search className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">No results found</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">
              Try adjusting your search query or tag filters to find what you're looking for.
            </p>
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