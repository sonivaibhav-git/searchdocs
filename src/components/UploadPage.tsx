import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, File, Image, AlertCircle, CheckCircle, X, Globe, Lock, Tag, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { createWorker } from 'tesseract.js'
import { UploadConfirmationModal } from './UploadConfirmationModal'
import { useUploadToast } from './Toast'

interface UploadFile {
  id: string
  file: File
  status: 'pending' | 'processing' | 'completed' | 'error' | 'duplicate'
  progress: number
  error?: string
  extractedText?: string
  isPublic: boolean
  tags: string[]
}

export function UploadPage() {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [pendingFiles, setPendingFiles] = useState<UploadFile[]>([])
  const [showConfirmation, setShowConfirmation] = useState(false)
  const { user } = useAuth()
  const uploadToast = useUploadToast()

  const checkForDuplicates = async (files: File[]) => {
    try {
      // Get existing documents for the user
      const { data: existingDocs, error } = await supabase
        .from('documents')
        .select('title, file_size')
        .eq('user_id', user?.id)

      if (error) throw error

      const duplicates: string[] = []
      const existingDocsMap = new Map()
      
      // Create a map of existing documents by title and size
      existingDocs?.forEach(doc => {
        const key = `${doc.title}-${doc.file_size}`
        existingDocsMap.set(key, true)
      })

      // Check each new file against existing documents
      files.forEach(file => {
        const key = `${file.name}-${file.size}`
        if (existingDocsMap.has(key)) {
          duplicates.push(file.name)
        }
      })

      return duplicates
    } catch (error) {
      console.error('Error checking for duplicates:', error)
      return []
    }
  }

  const getBucketForFileType = (fileType: string) => {
    if (fileType === 'application/pdf') {
      return 'pdf-documents'
    } else if (fileType.startsWith('image/')) {
      return 'image-documents'
    }
    // Fallback to pdf-documents for unknown types
    return 'pdf-documents'
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Check for duplicates first
    const duplicateFiles = await checkForDuplicates(acceptedFiles)
    
    if (duplicateFiles.length > 0) {
      uploadToast.showDuplicateWarning(duplicateFiles)
    }

    const newFiles: UploadFile[] = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: duplicateFiles.includes(file.name) ? 'duplicate' : 'pending',
      progress: duplicateFiles.includes(file.name) ? 100 : 0,
      error: duplicateFiles.includes(file.name) ? 'Document already exists' : undefined,
      isPublic: false, // Default to private
      tags: [], // Default to no tags
    }))

    // Filter out duplicates for confirmation
    const filesToConfirm = newFiles.filter(uploadFile => uploadFile.status !== 'duplicate')
    
    // Add duplicates directly to upload files (they won't be processed)
    const duplicateUploadFiles = newFiles.filter(uploadFile => uploadFile.status === 'duplicate')
    setUploadFiles((prev) => [...prev, ...duplicateUploadFiles])

    if (filesToConfirm.length > 0) {
      setPendingFiles(filesToConfirm)
      setShowConfirmation(true)
    }
  }, [user?.id, uploadToast])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  })

  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      // For basic PDF text extraction, we'll use a simple approach
      // In a production environment, you'd want to use a proper PDF parsing library
      const arrayBuffer = await file.arrayBuffer()
      const text = new TextDecoder().decode(arrayBuffer)
      
      // Extract readable text from the PDF buffer (this is a simplified approach)
      const textMatch = text.match(/\/Length\s+(\d+).*?stream\s*(.*?)\s*endstream/gs)
      if (textMatch) {
        return textMatch.map(match => {
          const streamContent = match.replace(/.*stream\s*/, '').replace(/\s*endstream.*/, '')
          return streamContent.replace(/[^\x20-\x7E]/g, ' ').trim()
        }).join(' ').substring(0, 1000) // Limit to first 1000 chars
      }
      
      return `PDF content from ${file.name} - Advanced PDF text extraction would require additional libraries`
    } catch (error) {
      throw new Error('Failed to extract text from PDF')
    }
  }

  const extractTextFromImage = async (file: File): Promise<string> => {
    const worker = await createWorker('eng')
    try {
      const { data: { text } } = await worker.recognize(file)
      await worker.terminate()
      return text
    } catch (error) {
      await worker.terminate()
      throw new Error('Failed to extract text from image')
    }
  }

  const processFile = async (uploadFile: UploadFile) => {
    const { file } = uploadFile

    uploadToast.showUploadStart(file.name)

    // Update status to processing
    setUploadFiles((prev) =>
      prev.map((f) =>
        f.id === uploadFile.id ? { ...f, status: 'processing', progress: 10 } : f
      )
    )

    try {
      // Extract text based on file type
      let extractedText = ''
      
      if (file.type === 'application/pdf') {
        setUploadFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, progress: 30 } : f
          )
        )
        extractedText = await extractTextFromPDF(file)
      } else if (file.type.startsWith('image/')) {
        setUploadFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, progress: 30 } : f
          )
        )
        extractedText = await extractTextFromImage(file)
      }

      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, progress: 50, extractedText } : f
        )
      )

      // Determine the appropriate bucket based on file type
      const bucketName = getBucketForFileType(file.type)
      
      // Generate unique file path
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
      const filePath = `${user?.id}/${fileName}`

      console.log(`Uploading ${file.type} file to bucket: ${bucketName}, path: ${filePath}`)

      // Upload file to the appropriate Supabase Storage bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        throw new Error(`Storage upload failed: ${uploadError.message}`)
      }

      console.log('File uploaded successfully to bucket:', bucketName, uploadData)

      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, progress: 70 } : f
        )
      )

      // Get the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath)

      console.log('Generated public URL:', publicUrl)

      // Verify the file exists by checking if we can access it
      try {
        const response = await fetch(publicUrl, { method: 'HEAD' })
        if (!response.ok) {
          throw new Error(`File verification failed: ${response.status}`)
        }
        console.log('File verification successful')
      } catch (verifyError) {
        console.error('File verification failed:', verifyError)
        throw new Error('File upload verification failed')
      }

      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, progress: 85 } : f
        )
      )

      // Save document metadata to database
      const { data: dbData, error: dbError } = await supabase
        .from('documents')
        .insert({
          title: file.name,
          content: extractedText,
          file_type: file.type === 'application/pdf' ? 'pdf' : 'image',
          file_size: file.size,
          file_url: publicUrl,
          user_id: user?.id,
          is_public: uploadFile.isPublic,
          tags: uploadFile.tags,
          metadata: {
            original_name: file.name,
            mime_type: file.type,
            storage_path: filePath,
            storage_bucket: bucketName,
          },
        })
        .select()

      if (dbError) {
        console.error('Database insert error:', dbError)
        // If database insert fails, try to clean up the uploaded file
        try {
          await supabase.storage.from(bucketName).remove([filePath])
        } catch (cleanupError) {
          console.error('Failed to cleanup uploaded file:', cleanupError)
        }
        throw new Error(`Database save failed: ${dbError.message}`)
      }

      console.log('Document saved to database:', dbData)

      // Mark as completed
      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: 'completed', progress: 100 } : f
        )
      )

      uploadToast.showUploadSuccess(file.name, uploadFile.isPublic)
    } catch (error) {
      console.error('Upload error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      
      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: 'error',
                error: errorMessage,
              }
            : f
        )
      )

      uploadToast.showUploadError(file.name, errorMessage)
    }
  }

  const handleConfirmUpload = (confirmedFiles: UploadFile[]) => {
    setShowConfirmation(false)
    setPendingFiles([])
    
    // Add confirmed files to upload list and start processing
    setUploadFiles((prev) => [...prev, ...confirmedFiles])
    confirmedFiles.forEach(processFile)
  }

  const handleCancelUpload = () => {
    setShowConfirmation(false)
    setPendingFiles([])
  }

  const removeFile = (id: string) => {
    setUploadFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">Upload Documents</h2>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 md:p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-10 w-10 md:h-12 md:w-12 text-gray-400 mb-3 md:mb-4" />
            {isDragActive ? (
              <p className="text-base md:text-lg text-blue-600">Drop the files here...</p>
            ) : (
              <div>
                <p className="text-base md:text-lg text-gray-600 mb-2">
                  Drag & drop files here, or click to select files
                </p>
                <p className="text-sm text-gray-500">
                  Supports PDF and image files (PNG, JPG, GIF, TIFF, WebP, etc.) up to 50MB each
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  ℹ️ Files are automatically organized: PDFs → PDF bucket, Images → Image bucket
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  You'll be able to set privacy and tags for each file before uploading
                </p>
              </div>
            )}
          </div>
        </div>

        {uploadFiles.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Upload Progress</h3>
            <div className="space-y-3 md:space-y-4">
              {uploadFiles.map((uploadFile) => (
                <div
                  key={uploadFile.id}
                  className="border border-gray-200 rounded-lg p-3 md:p-4"
                >
                  <div className="flex items-start space-x-3 md:space-x-4">
                    <div className="flex-shrink-0">
                      {uploadFile.file.type === 'application/pdf' ? (
                        <File className="w-6 h-6 md:w-8 md:h-8 text-red-500" />
                      ) : (
                        <Image className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {uploadFile.file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(uploadFile.file.size)} • {uploadFile.file.type === 'application/pdf' ? 'PDF Bucket' : 'Image Bucket'}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          {uploadFile.status === 'completed' && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                          {uploadFile.status === 'error' && (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          )}
                          {uploadFile.status === 'duplicate' && (
                            <AlertCircle className="w-4 h-4 text-orange-500" />
                          )}
                          <button
                            onClick={() => removeFile(uploadFile.id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {uploadFile.status !== 'completed' && uploadFile.status !== 'duplicate' && (
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              uploadFile.status === 'error'
                                ? 'bg-red-500'
                                : 'bg-blue-600'
                            }`}
                            style={{ width: `${uploadFile.progress}%` }}
                          ></div>
                        </div>
                      )}

                      {/* Show settings for completed uploads */}
                      {uploadFile.status === 'completed' && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1">
                              {uploadFile.isPublic ? (
                                <Globe className="w-3 h-3 text-green-600" />
                              ) : (
                                <Lock className="w-3 h-3 text-gray-600" />
                              )}
                              <span className="text-gray-700">
                                {uploadFile.isPublic ? 'Public' : 'Private'}
                              </span>
                            </div>
                            {uploadFile.tags.length > 0 && (
                              <div className="flex items-center space-x-1">
                                <Tag className="w-3 h-3 text-gray-500" />
                                <span className="text-gray-700">
                                  {uploadFile.tags.join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {uploadFile.status === 'processing' && (
                        <p className="text-xs text-gray-500 mt-1">
                          {uploadFile.progress < 30 ? 'Extracting text content...' : 
                           uploadFile.progress < 50 ? 'Processing content...' :
                           uploadFile.progress < 70 ? `Uploading to ${getBucketForFileType(uploadFile.file.type)}...` :
                           uploadFile.progress < 85 ? 'Verifying upload...' :
                           'Saving to database...'}
                        </p>
                      )}

                      {uploadFile.status === 'duplicate' && (
                        <p className="text-xs text-orange-600 mt-1">
                          ⚠️ This document already exists in your database
                        </p>
                      )}

                      {uploadFile.error && uploadFile.status !== 'duplicate' && (
                        <p className="text-xs text-red-600 mt-1">{uploadFile.error}</p>
                      )}

                      {uploadFile.extractedText && uploadFile.status === 'completed' && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                          <p className="font-medium mb-1">Extracted text preview:</p>
                          <p className="line-clamp-2">
                            {uploadFile.extractedText.substring(0, 200)}
                            {uploadFile.extractedText.length > 200 && '...'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Upload Confirmation Modal */}
      {showConfirmation && (
        <UploadConfirmationModal
          files={pendingFiles}
          onConfirm={handleConfirmUpload}
          onCancel={handleCancelUpload}
        />
      )}
    </>
  )
}