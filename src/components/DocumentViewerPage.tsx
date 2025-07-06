import React, { useState, useEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

interface PdfViewerProps {
  file: string
}

const PdfViewer: React.FC<PdfViewerProps> = ({ file }) => {
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [zoomInput, setZoomInput] = useState('100')
  const [viewerDimensions, setViewerDimensions] = useState({ width: 800, height: 600 })
  const viewerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateSize = () => {
      if (viewerRef.current) {
        setViewerDimensions({
          width: viewerRef.current.offsetWidth,
          height: viewerRef.current.offsetHeight,
        })
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)

    // Default to fit-to-width
    const pageOriginalWidth = 612 // Points (8.5in * 72)
    const fitScale = viewerDimensions.width / pageOriginalWidth
    setScale(fitScale)
    setZoomInput(Math.round(fitScale * 100).toString())
  }

  const changePage = (offset: number) =>
    setPageNumber((prev) => Math.min(Math.max(prev + offset, 1), numPages))

  const handleZoomIn = () => {
    const newScale = Math.min(scale + 0.1, 5.0)
    setScale(newScale)
    setZoomInput(Math.round(newScale * 100).toString())
  }

  const handleZoomOut = () => {
    const newScale = Math.max(scale - 0.1, 0.25)
    setScale(newScale)
    setZoomInput(Math.round(newScale * 100).toString())
  }

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value)
    if (!isNaN(value)) {
      const newScale = Math.min(Math.max(value / 100, 0.25), 5.0)
      setScale(newScale)
      setZoomInput(value.toString())
    } else {
      setZoomInput('')
    }
  }

  const fitToWidth = () => {
    const pageOriginalWidth = 612
    const fitScale = viewerDimensions.width / pageOriginalWidth
    setScale(fitScale)
    setZoomInput(Math.round(fitScale * 100).toString())
  }

  const fitToPage = () => {
    const pageOriginalHeight = 792
    const fitScale = viewerDimensions.height / pageOriginalHeight
    setScale(fitScale)
    setZoomInput(Math.round(fitScale * 100).toString())
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-sm">
        <button onClick={() => changePage(-1)} disabled={pageNumber <= 1}>
          Previous
        </button>
        <span>
          Page {pageNumber} of {numPages}
        </span>
        <button onClick={() => changePage(1)} disabled={pageNumber >= numPages}>
          Next
        </button>

        <button onClick={handleZoomOut}>-</button>
        <input
          type="number"
          value={zoomInput}
          onChange={handleZoomChange}
          className="w-16 border p-1 text-center"
        />
        <span>%</span>
        <button onClick={handleZoomIn}>+</button>

        <button onClick={fitToWidth}>Fit to Width</button>
        <button onClick={fitToPage}>Fit to Page</button>
      </div>

      <div ref={viewerRef} className="mx-auto w-full max-w-5xl overflow-auto border p-4">
        <Document file={file} onLoadSuccess={onDocumentLoadSuccess} loading="Loading PDF...">
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderAnnotationLayer={false}
            renderTextLayer={true}
            width={viewerDimensions.width}
          />
        </Document>
      </div>
    </div>
  )
}

export default PdfViewer
