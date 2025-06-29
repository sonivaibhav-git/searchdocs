import React, { useState, useEffect } from 'react'
import { X, ZoomIn, ZoomOut, Download, RotateCcw, Expand, AlertCircle } from 'lucide-react'
import { DocumentWithProfile } from '../lib/supabase'

interface ImageViewerProps {
  document: DocumentWithProfile
  onClose: () => void
}

export function ImageViewer({ document: doc, onClose }: ImageViewerProps) {
  const [scale, setScale] = useState<number>(1.0)
  const [zoomInput, setZoomInput] = useState<string>('100')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [downloading, setDownloading] = useState(false)

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

  const handleImageLoad = () => {
    setImageLoaded(true)
    setImageError(false)
  }

  const handleImageError = () => {
    setImageError(true)
    setImageLoaded(false)
    console.error('Image failed to load:', doc.file_url)
  }

  const handleDownload = async () => {
    if (!doc.file_url) return
    
    setDownloading(true)
    try {
      // Fetch the image as a blob
      const response = await fetch(doc.file_url)
      if (!response.ok) throw new Error('Failed to fetch image')
      
      const blob = await response.blob()
      
      // Create a download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = doc.title || 'image'
      
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
    <div className={`fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 ${isFullscreen ? 'p-0' : 'p-2 md:p-4'}`}>
      <div className={`bg-white rounded-lg shadow-2xl flex flex-col ${
        isFullscreen 
          ? 'w-full h-full rounded-none' 
          : 'w-full max-w-7xl h-[95vh]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg flex-shrink-0">
          <div className="flex items-center space-x-2 md:space-x-3 min-w-0 flex-1">
            <div className="w-5 h-5 md:w-6 md:h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">IMG</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm md:text-lg font-semibold text-gray-900 truncate">{doc.title}</h3>
              <div className="flex items-center space-x-1 md:space-x-2 text-xs md:text-sm text-gray-500">
                <span className="hidden sm:inline">{new Date(doc.created_at).toLocaleDateString()}</span>
                <span className="hidden sm:inline">•</span>
                <span>{formatFileSize(doc.file_size)}</span>
                <span className="hidden md:inline">•</span>
                <span className="hidden md:inline">Image</span>
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
            {/* Zoom Controls */}
            <button
              onClick={resetZoom}
              className="p-1 md:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
              title="Reset zoom to 100%"
            >
              <RotateCcw className="w-3 h-3 md:w-4 md:h-4" />
            </button>
            
            <button
              onClick={handleZoomOut}
              className="p-1 md:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
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
                className="w-12 md:w-16 text-xs md:text-sm text-center bg-white px-1 md:px-2 py-1 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                title="Enter zoom percentage (25-500%)"
              />
              <span className="text-xs md:text-sm text-gray-600 ml-1">%</span>
            </form>
            
            <button
              onClick={handleZoomIn}
              className="p-1 md:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-3 h-3 md:w-4 md:h-4" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-1 md:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              <Expand className="w-3 h-3 md:w-4 md:h-4" />
            </button>
            
            {/* Download Button */}
            <button
              onClick={handleDownload}
              disabled={downloading || !doc.file_url}
              className="flex items-center space-x-1 px-2 md:px-3 py-1 md:py-2 text-xs md:text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors ml-1 md:ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
            
            <button
              onClick={onClose}
              className="p-1 md:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors ml-1 md:ml-2"
            >
              <X className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-900 flex items-center justify-center p-2 md:p-4">
          {!imageLoaded && !imageError && (
            <div className="flex items-center justify-center p-4 md:p-8">
              <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-white text-sm md:text-base">Loading image...</span>
            </div>
          )}
          
          {imageError && (
            <div className="flex flex-col items-center justify-center p-4 md:p-8 text-red-400">
              <AlertCircle className="w-16 h-16 mb-4" />
              <span className="text-sm md:text-base text-center mb-4">Failed to load image</span>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Try Download
              </button>
            </div>
          )}
          
          {doc.file_url && (
            <div className="max-w-full max-h-full flex items-center justify-center">
              <img
                src={doc.file_url}
                alt={doc.title}
                className={`rounded-lg shadow-2xl object-contain transition-all duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                } ${imageError ? 'hidden' : ''}`}
                style={{ 
                  transform: `scale(${scale})`,
                  maxWidth: isFullscreen ? '90vw' : `${viewerDimensions.width}px`,
                  maxHeight: isFullscreen ? '80vh' : `${viewerDimensions.height}px`,
                  width: 'auto',
                  height: 'auto',
                  cursor: scale > 1 ? 'grab' : 'default'
                }}
                onLoad={handleImageLoad}
                onError={handleImageError}
                draggable={false}
              />
            </div>
          )}
        </div>

        {/* Footer with image info */}
        {imageLoaded && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600 text-center">
            <span>Use mouse wheel or zoom controls to adjust size • Click download to save to device</span>
          </div>
        )}
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