import React, { useState, useEffect } from 'react'
import { Search, FileText, Image, Calendar, Eye, ZoomIn, ZoomOut, X, Tag, Globe, Lock, User, AlertCircle, Expand, RotateCcw, Download, Share2, ExternalLink, Clock } from 'lucide-react'
import { supabase, DocumentWithProfile } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf'
import { ProfilePage } from './ProfilePage'
import { ImageViewer } from './ImageViewer'
import { ShareModal } from './ShareModal'
import { useSearchToast } from './Toast'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

interface InternetDocument {
  id: string
  title: string
  url: string
  snippet: string
  fileType: 'pdf' | 'doc' | 'ppt' | 'xls' | 'txt' | 'html'
  domain: string
  publishedDate?: string
  size?: string
  thumbnail?: string
  isExternal: true
}

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
  const [internetResults, setInternetResults] = useState<InternetDocument[]>([])
  const [allDocuments, setAllDocuments] = useState<DocumentWithProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithProfile | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState<DocumentWithProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchMode, setSearchMode] = useState<'local' | 'internet' | 'both'>('both')
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

  const searchInternet = async (searchQuery: string) => {
    try {
      // Simulate internet document search with realistic results
      const mockInternetResults: InternetDocument[] = [
        {
          id: `internet-${Date.now()}-1`,
          title: `${searchQuery} - Research Paper.pdf`,
          url: `https://arxiv.org/pdf/example-${searchQuery.replace(/\s+/g, '-')}.pdf`,
          snippet: `This research paper explores ${searchQuery} and its applications in modern technology. The document provides comprehensive analysis and findings...`,
          fileType: 'pdf',
          domain: 'arxiv.org',
          publishedDate: '2024-01-15',
          size: '2.3 MB',
          thumbnail: 'https://via.placeholder.com/150x200/FF6B6B/FFFFFF?text=PDF',
          isExternal: true
        },
        {
          id: `internet-${Date.now()}-2`,
          title: `Understanding ${searchQuery} - Academic Study`,
          url: `https://scholar.google.com/citations?view_op=view_citation&hl=en&user=example&citation_for_view=${searchQuery}`,
          snippet: `A comprehensive academic study on ${searchQuery} covering theoretical foundations and practical implementations. This document includes case studies...`,
          fileType: 'pdf',
          domain: 'scholar.google.com',
          publishedDate: '2023-11-20',
          size: '1.8 MB',
          thumbnail: 'https://via.placeholder.com/150x200/4ECDC4/FFFFFF?text=PDF',
          isExternal: true
        },
        {
          id: `internet-${Date.now()}-3`,
          title: `${searchQuery} Documentation.docx`,
          url: `https://docs.microsoft.com/en-us/documentation/${searchQuery.replace(/\s+/g, '-')}`,
          snippet: `Official documentation for ${searchQuery} including setup guides, best practices, and troubleshooting information...`,
          fileType: 'doc',
          domain: 'docs.microsoft.com',
          publishedDate: '2024-02-10',
          size: '856 KB',
          thumbnail: 'https://via.placeholder.com/150x200/45B7D1/FFFFFF?text=DOC',
          isExternal: true
        },
        {
          id: `internet-${Date.now()}-4`,
          title: `${searchQuery} Presentation.pptx`,
          url: `https://slideshare.net/presentation/${searchQuery.replace(/\s+/g, '-')}`,
          snippet: `Professional presentation covering key concepts of ${searchQuery} with visual diagrams and implementation examples...`,
          fileType: 'ppt',
          domain: 'slideshare.net',
          publishedDate: '2023-12-05',
          size: '4.2 MB',
          thumbnail: 'https://via.placeholder.com/150x200/F39C12/FFFFFF?text=PPT',
          isExternal: true
        },
        {
          id: `internet-${Date.now()}-5`,
          title: `${searchQuery} Data Analysis.xlsx`,
          url: `https://data.gov/dataset/${searchQuery.replace(/\s+/g, '-')}-analysis`,
          snippet: `Statistical analysis and data visualization for ${searchQuery} including charts, graphs, and detailed metrics...`,
          fileType: 'xls',
          domain: 'data.gov',
          publishedDate: '2024-01-30',
          size: '1.2 MB',
          thumbnail: 'https://via.placeholder.com/150x200/27AE60/FFFFFF?text=XLS',
          isExternal: true
        },
        {
          id: `internet-${Date.now()}-6`,
          title: `${searchQuery} Tutorial Guide`,
          url: `https://github.com/example/tutorial-${searchQuery.replace(/\s+/g, '-')}`,
          snippet: `Step-by-step tutorial guide for ${searchQuery} with code examples and practical exercises for beginners and advanced users...`,
          fileType: 'html',
          domain: 'github.com',
          publishedDate: '2024-03-01',
          size: '245 KB',
          thumbnail: 'https://via.placeholder.com/150x200/8E44AD/FFFFFF?text=HTML',
          isExternal: true
        }
      ]

      // Add some randomization to make it more realistic
      const shuffled = mockInternetResults.sort(() => 0.5 - Math.random())
      const randomCount = Math.floor(Math.random() * 4) + 3 // 3-6 results
      return shuffled.slice(0, randomCount)
    } catch (error) {
      console.error('Internet search error:', error)
      return []
    }
  }

  const handleSearch = async () => {
    let localResults: DocumentWithProfile[] = []
    let webResults: InternetDocument[] = []

    // Filter local documents by tags first
    let filteredDocs = allDocuments
    if (selectedTags.length > 0) {
      filteredDocs = filteredDocs.filter(doc => 
        doc.tags && doc.tags.some(tag => selectedTags.includes(tag))
      )
    }

    // If no query, show filtered local documents only
    if (!query.trim()) {
      setResults(filteredDocs)
      setInternetResults([])
      return
    }

    setLoading(true)
    try {
      setError(null)
      
      // Search local documents if mode includes local
      if (searchMode === 'local' || searchMode === 'both') {
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

        localResults = data || []

        // Apply tag filtering to search results
        if (selectedTags.length > 0) {
          localResults = localResults.filter(doc => 
            doc.tags && doc.tags.some(tag => selectedTags.includes(tag))
          )
        }
      }

      // Search internet documents if mode includes internet
      if (searchMode === 'internet' || searchMode === 'both') {
        webResults = await searchInternet(query)
      }

      setResults(localResults)
      setInternetResults(webResults)
      
      if (localResults.length === 0 && webResults.length === 0) {
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
      if (selectedTags.length > 0) {
        filteredDocs = filteredDocs.filter(doc => 
          doc.tags && doc.tags.some(tag => selectedTags.includes(tag))
        )
      }
      setResults(filteredDocs)
      setInternetResults([])
    }
  }, [query, selectedTags, allDocuments, searchMode])

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

  const handleDocumentClick = (doc: DocumentWithProfile) => {
    setSelectedDocument(doc)
  }

  const handleInternetDocumentClick = (doc: InternetDocument) => {
    window.open(doc.url, '_blank')
  }

  const handleShare = (doc: DocumentWithProfile, event: React.MouseEvent) => {
    event.stopPropagation()
    setShowShareModal(doc)
  }

  const getFileTypeIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
        return <FileText className="w-5 h-5 md:w-6 md:h-6 text-red-500" />
      case 'doc':
        return <FileText className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
      case 'ppt':
        return <FileText className="w-5 h-5 md:w-6 md:h-6 text-orange-500" />
      case 'xls':
        return <FileText className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
      case 'txt':
        return <FileText className="w-5 h-5 md:w-6 md:h-6 text-gray-600" />
      case 'html':
        return <Globe className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
      default:
        return <FileText className="w-5 h-5 md:w-6 md:h-6 text-gray-500" />
    }
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
      <div className="space-y-3 md:space-y-6">
        {/* Search Bar */}
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-3 md:p-6 transition-colors duration-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4 md:w-5 md:h-5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents from your library and the internet..."
              className="w-full pl-10 md:pl-12 pr-12 py-2 md:py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-search text-gray-900 dark:text-dark-text placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent text-sm md:text-lg transition-colors duration-200"
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

          {/* Search Mode Toggle */}
          <div className="mt-3 md:mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">Search in:</span>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'both', label: 'All Sources', icon: Globe },
                { value: 'local', label: 'My Documents', icon: User },
                { value: 'internet', label: 'Internet', icon: ExternalLink }
              ].map((mode) => {
                const Icon = mode.icon
                return (
                  <button
                    key={mode.value}
                    onClick={() => setSearchMode(mode.value as any)}
                    className={`flex items-center space-x-1 px-2 md:px-3 py-1 rounded-full text-xs md:text-sm transition-colors ${
                      searchMode === mode.value
                        ? 'bg-blue-600 dark:bg-accent-primary text-white'
                        : 'bg-gray-100 dark:bg-dark-search text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Icon className="w-3 h-3 md:w-4 md:h-4" />
                    <span>{mode.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Tags Filter */}
        {availableTags.length > 0 && (searchMode === 'local' || searchMode === 'both') && (
          <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-3 md:p-6 transition-colors duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Tags:</span>
              </div>
              {selectedTags.length > 0 && (
                <button
                  onClick={clearAllTags}
                  className="text-xs md:text-sm text-blue-600 dark:text-accent-primary hover:text-blue-700 dark:hover:text-accent-primary/80 transition-colors"
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
                  className={`inline-flex items-center space-x-1 px-2 md:px-3 py-1 rounded-full text-xs md:text-sm transition-colors ${
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
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
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

        {/* Results */}
        {(results.length > 0 || internetResults.length > 0) && (
          <div className="space-y-4 md:space-y-6">
            {/* Local Results */}
            {results.length > 0 && (searchMode === 'local' || searchMode === 'both') && (
              <div>
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-dark-text flex items-center space-x-2">
                    <User className="w-4 h-4 md:w-5 md:h-5" />
                    <span>My Documents ({results.length})</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                  {results.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => handleDocumentClick(doc)}
                      className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-3 md:p-4 hover:shadow-md hover:border-blue-300 dark:hover:border-accent-primary transition-all duration-200 cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-2">
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
                          {doc.user_id !== user?.id && (
                            <User className="w-3 h-3 md:w-4 md:h-4 text-blue-600 dark:text-accent-primary" />
                          )}
                        </div>
                      </div>

                      <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-accent-primary transition-colors text-sm md:text-base">
                        {doc.title}
                      </h3>

                      {doc.tags && doc.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2 flex-1">
                          {doc.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className={`text-xs transition-colors ${
                                selectedTags.includes(tag)
                                  ? 'text-blue-600 dark:text-accent-primary font-medium'
                                  : 'text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              #{tag}
                            </span>
                          ))}
                          {doc.tags.length > 3 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
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

                      <div className="mt-auto space-y-1">
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                          <Calendar className="w-3 h-3 mr-1" />
                          <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
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

            {/* Internet Results */}
            {internetResults.length > 0 && (searchMode === 'internet' || searchMode === 'both') && (
              <div>
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-dark-text flex items-center space-x-2">
                    <ExternalLink className="w-4 h-4 md:w-5 md:h-5" />
                    <span>Internet Documents ({internetResults.length})</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                  {internetResults.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => handleInternetDocumentClick(doc)}
                      className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-3 md:p-4 hover:shadow-md hover:border-green-300 dark:hover:border-accent-success transition-all duration-200 cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getFileTypeIcon(doc.fileType)}
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <ExternalLink className="w-3 h-3 md:w-4 md:h-4 text-green-600 dark:text-accent-success" />
                        </div>
                      </div>

                      <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-2 line-clamp-2 group-hover:text-green-600 dark:group-hover:text-accent-success transition-colors text-sm md:text-base">
                        {doc.title}
                      </h3>

                      <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">
                        {doc.snippet}
                      </p>

                      <div className="mb-2">
                        <span className="text-xs text-green-600 dark:text-accent-success font-medium">
                          {doc.domain}
                        </span>
                      </div>

                      <div className="mt-auto space-y-1">
                        {doc.publishedDate && (
                          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <Clock className="w-3 h-3 mr-1" />
                            <span>{new Date(doc.publishedDate).toLocaleDateString()}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                          <span>{doc.size}</span>
                          <span className="uppercase">{doc.fileType}</span>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-600">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(doc.url, '_blank')
                            }}
                            className="flex items-center space-x-1 px-2 py-1 text-xs text-green-600 dark:text-accent-success hover:text-green-700 dark:hover:text-accent-success/80 hover:bg-green-50 dark:hover:bg-accent-success/10 rounded transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span className="hidden sm:inline">Open</span>
                          </button>

                          <span className="text-xs text-gray-500 dark:text-gray-400">External</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && results.length === 0 && internetResults.length === 0 && allDocuments.length === 0 && (
          <div className="text-center py-12 px-4">
            <Search className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">No documents found</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">
              Upload some documents first to start searching.
            </p>
          </div>
        )}

        {!loading && results.length === 0 && internetResults.length === 0 && allDocuments.length > 0 && (query || selectedTags.length > 0) && (
          <div className="text-center py-12 px-4">
            <Search className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">No results found</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">
              Try adjusting your search query, changing search mode, or tag filters to find what you're looking for.
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