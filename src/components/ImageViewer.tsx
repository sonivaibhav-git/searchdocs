import React, { useState, useEffect } from 'react'
import { X, ZoomIn, ZoomOut, Download, RotateCcw, Expand, AlertCircle, Share2 } from 'lucide-react'
import { DocumentWithProfile } from '../lib/supabase'
import { ShareModal } from './ShareModal'

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
      setContainerDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    window.addEventListener('orientationchange', updateDimensions)

    return () => {
      window.removeEventListener('resize', updateDimensions)
      window.removeEventListener('orientationchange', updateDimensions)
    }
  }, [])

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
    const newScale = isMobile ? 0.8 : 1.0
    setScale(newScale)
    setZoomInput(Math.round(newScale * 100).toString())
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

  const handleImageLoad = () => {
    setImageLoaded(true)
    setImageError(false)
    // Auto-fit image to screen on load
    if (isMobile) {
      setScale(0.8) // Slightly smaller for mobile to ensure full visibility
      setZoomInput('80')
    } else {
      setScale(1.0)
      setZoomInput('100')
    }
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
      const response = await fetch(doc.file_url)
      if (!response.ok) throw new Error('Failed to fetch image')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = doc.title || 'image'
      
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

  const getOptimalImageSize = () => {
    const availableWidth = containerDimensions.width - (isMobile ? 32 : 64) // Account for padding
    const availableHeight = containerDimensions.height - (isMobile ? 120 : 160) // Account for header and controls
    
    if (isMobile) {
      return {
        maxWidth: availableWidth * 0.95,
        maxHeight: availableHeight * 0.9
      }
    }
    
    return {
      maxWidth: availableWidth * 0.9,
      maxHeight: availableHeight * 0.9
    }
  }

  const optimalSize = getOptimalImageSize()

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col z-50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-2 sm:p-3 md:p-4 border-b border-gray-600 bg-gray-900 flex-shrink-0">
          <div className="flex items-center space-x-2 md:space-x-3 min-w-0 flex-1">
            <div className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">IMG</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm md:text-lg font-semibold text-white truncate">{doc.title}</h3>
              <div className="flex items-center space-x-1 md:space-x-2 text-xs md:text-sm text-gray-300">
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
            <button
              onClick={resetZoom}
              className="p-1 md:p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
              title="Reset zoom to fit"
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
            
            <button
              onClick={handleDownload}
              disabled={downloading || !doc.file_url}
              className="flex items-center space-x-1 px-2 md:px-3 py-1 md:py-2 text-xs md:text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="p-1 md:p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors ml-1 md:ml-2"
            >
              <X className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-gray-900 flex items-center justify-center p-2 md:p-4 relative">
          {!imageLoaded && !imageError && (
            <div className="flex items-center justify-center p-4 md:p-8">
              <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-b-2 border-blue-400"></div>
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
            <div className="max-w-full max-h-full flex items-center justify-center overflow-auto">
              <img
                src={doc.file_url}
                alt={doc.title}
                className={`rounded-lg shadow-2xl object-contain transition-all duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                } ${imageError ? 'hidden' : ''}`}
                style={{ 
                  transform: `scale(${scale})`,
                  maxWidth: `${optimalSize.maxWidth}px`,
                  maxHeight: `${optimalSize.maxHeight}px`,
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

        {imageLoaded && (
          <div className="px-4 py-2 bg-gray-900 border-t border-gray-600 text-xs text-gray-400 text-center flex-shrink-0">
            <span>Use zoom controls or pinch to zoom • Click download to save to device</span>
          </div>
        )}
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