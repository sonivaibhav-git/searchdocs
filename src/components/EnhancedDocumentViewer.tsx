import React, { useState, useEffect, useCallback } from 'react'
import { X, ZoomIn, ZoomOut, RotateCcw, Download, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react'
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf'
import { DocumentWithProfile } from '../lib/supabase'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

interface EnhancedDocumentViewerProps {
  document: DocumentWithProfile
  onClose: () => void
}

export function EnhancedDocumentViewer({ document, onClose }: EnhancedDocumentViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [pageInput, setPageInput] = useState<string>('1')
  const [zoomInput, setZoomInput] = useState<string>('100')
  const [fitMode, setFitMode] = useState<'width' | 'page'>('width')
  const [downloading, setDownloading] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 })

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '=':
          case '+':
            e.preventDefault()
            handleZoomIn()
            break
          case '-':
            e.preventDefault()
            handleZoomOut()
            break
          case '0':
            e.preventDefault()
            handleFitToWidth()
            break
        }
      }
      
      // Navigation shortcuts
      switch (e.key) {
        case 'ArrowLeft':
          if (pageNumber > 1) {
            goToPrevPage()
          }
          break
        case 'ArrowRight':
          if (pageNumber < numPages) {
            goToNextPage()
          }
          break
        case 'Home':
          setPageNumber(1)
          setPageInput('1')
          break
        case 'End':
          setPageNumber(numPages)
          setPageInput(numPages.toString())
          break
        case 'Escape':
          if (isFullscreen) {
            exitFullscreen()
          } else {
            onClose()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [pageNumber, numPages, isFullscreen])

  // Mouse wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      if (e.deltaY < 0) {
        handleZoomIn()
      } else {
        handleZoomOut()
      }
    }
  }, [])

  useEffect(() => {
    const container = document.querySelector('.pdf-container')
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false })
      return () => container.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  // Update container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      const container = document.querySelector('.pdf-container')
      if (container) {
        const rect = container.getBoundingClientRect()
        setContainerDimensions({ width: rect.width, height: rect.height })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Auto-fit on load
  useEffect(() => {
    if (numPages > 0 && containerDimensions.width > 0) {
      handleFitToWidth()
    }
  }, [numPages, containerDimensions])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setPageNumber(1)
    setPageInput('1')
  }

  const handleZoomIn = () => {
    const newScale = Math.min(scale * 1.1, 4.0) // 10% increment, max 400%
    setScale(newScale)
    setZoomInput(Math.round(newScale * 100).toString())
    setFitMode('width') // Reset fit mode when manually zooming
  }

  const handleZoomOut = () => {
    const newScale = Math.max(scale / 1.1, 0.25) // 10% decrement, min 25%
    setScale(newScale)
    setZoomInput(Math.round(newScale * 100).toString())
    setFitMode('width') // Reset fit mode when manually zooming
  }

  const handleFitToWidth = () => {
    if (containerDimensions.width > 0) {
      // Estimate page width (A4 ratio: 210/297 ≈ 0.707)
      const estimatedPageWidth = 595 // PDF points for A4 width
      const newScale = (containerDimensions.width - 40) / estimatedPageWidth // 40px padding
      setScale(Math.max(0.25, Math.min(4.0, newScale)))
      setZoomInput(Math.round(newScale * 100).toString())
      setFitMode('width')
    }
  }

  const handleFitToPage = () => {
    if (containerDimensions.width > 0 && containerDimensions.height > 0) {
      // Estimate page dimensions (A4 ratio)
      const estimatedPageWidth = 595
      const estimatedPageHeight = 842
      const scaleX = (containerDimensions.width - 40) / estimatedPageWidth
      const scaleY = (containerDimensions.height - 40) / estimatedPageHeight
      const newScale = Math.min(scaleX, scaleY)
      setScale(Math.max(0.25, Math.min(4.0, newScale)))
      setZoomInput(Math.round(newScale * 100).toString())
      setFitMode('page')
    }
  }

  const handleZoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoomInput(e.target.value)
  }

  const handleZoomInputSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const numValue = parseInt(zoomInput)
    if (!isNaN(numValue) && numValue >= 25 && numValue <= 400) {
      setScale(numValue / 100)
      setFitMode('width') // Reset fit mode
    } else {
      setZoomInput(Math.round(scale * 100).toString())
    }
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

  const handleDownload = async () => {
    if (!document.file_url) return
    
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

  const enterFullscreen = () => {
    const element = document.documentElement
    if (element.requestFullscreen) {
      element.requestFullscreen()
    }
    setIsFullscreen(true)
  }

  const exitFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen()
    }
    setIsFullscreen(false)
  }

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col z-50">
      {/* Header */}
      <div className="bg-gray-800 text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate">{document.title}</h3>
          <span className="text-sm text-gray-300">
            {document.file_type.toUpperCase()} • {Math.round(document.file_size / 1024)} KB
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Downloading...' : 'Download'}</span>
          </button>
          
          <button
            onClick={isFullscreen ? exitFullscreen : enterFullscreen}
            className="p-2 hover:bg-gray-700 rounded-md transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-gray-700 text-white p-3 flex items-center justify-center space-x-4">
        {/* Zoom Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-gray-600 rounded-md transition-colors"
            title="Zoom Out (Ctrl+-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          
          <form onSubmit={handleZoomInputSubmit} className="flex items-center">
            <input
              type="text"
              value={zoomInput}
              onChange={handleZoomInputChange}
              className="w-16 text-center bg-gray-600 text-white px-2 py-1 rounded border-0 focus:ring-2 focus:ring-blue-500"
              title="Zoom Level (25-400%)"
            />
            <span className="ml-1 text-sm">%</span>
          </form>
          
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-gray-600 rounded-md transition-colors"
            title="Zoom In (Ctrl++)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Fit Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleFitToWidth}
            className={`px-3 py-1 rounded-md transition-colors ${
              fitMode === 'width' ? 'bg-blue-600' : 'hover:bg-gray-600'
            }`}
            title="Fit to Width (Ctrl+0)"
          >
            Fit Width
          </button>
          
          <button
            onClick={handleFitToPage}
            className={`px-3 py-1 rounded-md transition-colors ${
              fitMode === 'page' ? 'bg-blue-600' : 'hover:bg-gray-600'
            }`}
            title="Fit to Page"
          >
            Fit Page
          </button>
          
          <button
            onClick={() => {
              setScale(1.0)
              setZoomInput('100')
              setFitMode('width')
            }}
            className="p-2 hover:bg-gray-600 rounded-md transition-colors"
            title="Reset Zoom"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Page Navigation */}
        {numPages > 1 && (
          <div className="flex items-center space-x-2">
            <button
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
              className="p-2 hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous Page (←)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <form onSubmit={handlePageInputSubmit} className="flex items-center">
              <input
                type="text"
                value={pageInput}
                onChange={handlePageInputChange}
                className="w-12 text-center bg-gray-600 text-white px-2 py-1 rounded border-0 focus:ring-2 focus:ring-blue-500"
                title="Page Number"
              />
              <span className="mx-1 text-sm">/</span>
              <span className="text-sm">{numPages}</span>
            </form>
            
            <button
              onClick={goToNextPage}
              disabled={pageNumber >= numPages}
              className="p-2 hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next Page (→)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto bg-gray-100 pdf-container">
        <div className="flex items-center justify-center min-h-full p-4">
          {document.file_type === 'pdf' && document.file_url ? (
            <PDFDocument
              file={document.file_url}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading PDF...</span>
                </div>
              }
              error={
                <div className="flex items-center justify-center p-8 text-red-600">
                  <span>Failed to load PDF. Please try downloading the file.</span>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="shadow-lg bg-white"
              />
            </PDFDocument>
          ) : (
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full shadow-lg">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Extracted Text Content</h4>
              <div className="prose max-w-none text-gray-700">
                {document.content ? (
                  <pre className="whitespace-pre-wrap font-sans bg-gray-50 p-4 rounded border overflow-auto">
                    {document.content}
                  </pre>
                ) : (
                  <p className="text-gray-500 italic text-center py-8">No text content available</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="bg-gray-800 text-white px-4 py-2 text-xs text-center text-gray-400">
        Shortcuts: Ctrl++ (Zoom In) • Ctrl+- (Zoom Out) • Ctrl+0 (Fit Width) • ← → (Navigate) • Esc (Close)
      </div>
    </div>
  )
}