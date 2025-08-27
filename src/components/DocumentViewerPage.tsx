import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, Image, Calendar, Download, X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, AlertCircle, Globe, Lock, Search } from 'lucide-react'
import { supabase, DocumentWithProfile } from '../lib/supabase'
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf'
import { ThemeToggle } from './ThemeToggle'
import { useAuth } from '../contexts/AuthContext'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Set up PDF.js worker for faster loading
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
  
  // Zoom functionality
  const [scale, setScale] = useState<number>(1.0)
  const [zoomInput, setZoomInput] = useState<string>('100')
  
  const [downloading, setDownloading] = useState(false)
  
  // Search functionality
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<DocumentWithProfile[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  
  const [headerHeight, setHeaderHeight] = useState(120)

  useEffect(() => {
    if (documentId) {
      fetchDocument()
    }
  }, [documentId])

  // Calculate header height on mount and resize
  useEffect(() => {
    const calculateHeaderHeight = () => {
      const header = document.querySelector('[data-document-header]')
      const controls = document.querySelector('[data-document-controls]')
      
      let totalHeight = 0
      if (header) totalHeight += header.getBoundingClientRect().height
      if (controls) totalHeight += controls.getBoundingClientRect().height
      
      setHeaderHeight(totalHeight || 120)
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
      if (!data.is_public && data.user_id !== user?.id) {
        setError('This document is private and cannot be accessed')
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

  // Zoom functionality
  const handleZoomIn = () => {
    const newScale = Math.min(scale * 1.25, 5.0)
    setScale(newScale)
    setZoomInput(Math.round(newScale * 100).toString())
  }
  
  const handleZoomOut = () => {
    const newScale = Math.max(scale * 0.8, 0.25)
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

  // Page navigation
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

  // Search functionality
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    if (!searchQuery.trim()) {
      setShowSearchResults(false)
      return
    }

    try {
      setSearchLoading(true)
      
      // Search by title, content, and tags
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
        .eq('is_public', true)
        .or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      
      // Also search by tags
      const { data: tagData, error: tagError } = await supabase
        .from('documents')
        .select(`
          *,
          user_profiles (
            user_id,
            username,
            display_name
          )
        `)
        .eq('is_public', true)
        .contains('tags', [searchQuery])
        .order('created_at', { ascending: false })
        .limit(10)

      if (tagError) throw tagError

      // Combine and deduplicate results
      const allResults = [...(data || []), ...(tagData || [])]
      const uniqueResults = allResults.filter((doc, index, self) => 
        index === self.findIndex(d => d.id === doc.id)
      )
      
      setSearchResults(uniqueResults)
      setShowSearchResults(true)
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
      setShowSearchResults(true)
    } finally {
      setSearchLoading(false)
    }
  }

  const handleDocumentSelect = (doc: DocumentWithProfile) => {
    navigate(`/document/${doc.id}`)
    setShowSearchResults(false)
    setSearchQuery('')
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

  return (
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
              {/* Search Bar */}
              <div className="relative">
                <form onSubmit={handleSearch} className="flex items-center">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search documents..."
                      className="w-48 pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-dark-search text-gray-900 dark:text-dark-text placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent transition-colors text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={searchLoading}
                    className="ml-2 px-3 py-2 bg-blue-600 dark:bg-accent-primary text-white rounded-md hover:bg-blue-700 dark:hover:bg-accent-primary/90 focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:ring-offset-2 dark:focus:ring-offset-dark-card disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    {searchLoading ? 'Searching...' : 'Search'}
                  </button>
                </form>

                {/* Search Results Dropdown */}
                {showSearchResults && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowSearchResults(false)}
                    ></div>
                    <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-dark-card rounded-md shadow-lg border border-gray-200 dark:border-gray-600 py-2 z-50 max-h-96 overflow-y-auto transition-colors duration-200">
                      {searchResults.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          No documents found for "{searchQuery}"
                        </div>
                      ) : (
                        searchResults.map((doc) => (
                          <button
                            key={doc.id}
                            onClick={() => handleDocumentSelect(doc)}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-dark-search transition-colors border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                          >
                            <div className="flex items-start space-x-3">
                              {doc.file_type === 'pdf' ? (
                                <FileText className="w-4 h-4 text-red-500 mt-1 flex-shrink-0" />
                              ) : (
                                <Image className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">{doc.title}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {new Date(doc.created_at).toLocaleDateString()} • {formatFileSize(doc.file_size)}
                                </p>
                                {doc.tags && doc.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {doc.tags.slice(0, 3).map((tag) => (
                                      <span
                                        key={tag}
                                        className="inline-block px-1 py-0.5 bg-blue-100 dark:bg-accent-primary/20 text-blue-800 dark:text-accent-primary rounded text-xs"
                                      >
                                        #{tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              <ThemeToggle size="sm" />
              
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

      {/* Zoom Controls */}
      <div 
        data-document-controls
        className="bg-gray-100 dark:bg-dark-search border-b border-gray-200 dark:border-gray-600 px-4 py-2 transition-colors duration-200"
      >
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
              className="w-16 text-sm text-center bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text px-2 py-1 rounded border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent transition-colors"
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
        </div>
      </div>

      {/* Content */}
      <div 
        className="bg-gray-100 dark:bg-dark-bg flex items-center justify-center transition-colors duration-200 overflow-auto"
        style={{ 
          minHeight: `calc(100vh - ${headerHeight}px)`,
          width: '100vw'
        }}
      >
        {document.file_type === 'pdf' && document.file_url ? (
          <>
            <div 
              className="flex items-center justify-center p-4"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'center center',
                transition: 'transform 0.3s ease-in-out'
              }}
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
                options={{
                  cMapUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
                  cMapPacked: true,
                  standardFontDataUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
                }}
              >
                <Page
                  pageNumber={pageNumber}
                  scale={1.0}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="shadow-lg bg-white dark:bg-gray-800 transition-colors duration-200"
                />
              </PDFDocument>
            </div>

            {/* Page Navigation */}
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
        ) : document.file_type === 'image' && document.file_url ? (
          <div 
            className="flex items-center justify-center p-4"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              transition: 'transform 0.3s ease-in-out'
            }}
          >
            <img
              src={document.file_url}
              alt={document.title}
              className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
              style={{ backgroundColor: 'white' }}
            />
          </div>
        ) : (
          <div 
            className="bg-white dark:bg-dark-card rounded-lg p-6 w-full max-w-4xl mx-4 shadow-lg transition-colors duration-200"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              transition: 'transform 0.3s ease-in-out'
            }}
          >
            <h4 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-4 border-b border-gray-200 dark:border-gray-600 pb-2">Extracted Text Content</h4>
            <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 leading-relaxed">
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
  )
}