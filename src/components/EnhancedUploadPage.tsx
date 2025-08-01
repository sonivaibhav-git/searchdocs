import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Plus, FileText, Image, AlertCircle, CheckCircle, X, Folder } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { createWorker } from 'tesseract.js'
import { FolderAPI } from '../lib/folderApi'
import { FolderTree } from './FolderTree'
import { useUploadToast } from './Toast'

interface UploadFile {
  id: string
  file: File
  status: 'pending' | 'processing' | 'completed' | 'error' | 'duplicate'
  progress: number
  error?: string
  extractedText?: string
  folderId?: string
  tags: string[]
}

export function EnhancedUploadPage() {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>()
  const { user } = useAuth()
  const uploadToast = useUploadToast()

  const checkForDuplicates = async (files: File[]) => {
    try {
      const { data: existingDocs, error } = await supabase
        .from('documents')
        .select('title, file_size')
        .eq('user_id', user?.id)

      if (error) throw error

      const duplicates: string[] = []
      const existingDocsMap = new Map()
      
      existingDocs?.forEach(doc => {
        const key = `${doc.title}-${doc.file_size}`
        existingDocsMap.set(key, true)
      })

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
    return 'pdf-documents'
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
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
      folderId: selectedFolderId,
      tags: [],
    }))

    setUploadFiles((prev) => [...prev, ...newFiles])

    // Auto-process non-duplicate files
    const filesToProcess = newFiles.filter(uploadFile => uploadFile.status !== 'duplicate')
    filesToProcess.forEach(processFile)
  }, [user?.id, selectedFolderId, uploadToast])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'],
    },
    maxSize: 50 * 1024 * 1024,
  })

  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const text = new TextDecoder().decode(arrayBuffer)
      
      const textMatch = text.match(/\/Length\s+(\d+).*?stream\s*(.*?)\s*endstream/gs)
      if (textMatch) {
        return textMatch.map(match => {
          const streamContent = match.replace(/.*stream\s*/, '').replace(/\s*endstream.*/, '')
          return streamContent.replace(/[^\x20-\x7E]/g, ' ').trim()
        }).join(' ').substring(0, 1000)
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

    setUploadFiles((prev) =>
      prev.map((f) =>
        f.id === uploadFile.id ? { ...f, status: 'processing', progress: 10 } : f
      )
    )

    try {
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

      const bucketName = getBucketForFileType(file.type)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
      const filePath = `${user?.id}/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`)
      }

      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, progress: 70 } : f
        )
      )

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath)

      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, progress: 85 } : f
        )
      )

      const { data: dbData, error: dbError } = await supabase
        .from('documents')
        .insert({
          title: file.name,
          content: extractedText,
          file_type: file.type === 'application/pdf' ? 'pdf' : 'image',
          file_size: file.size,
          file_url: publicUrl,
          user_id: user?.id,
          is_public: false, // Default to private in folder system
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
        try {
          await supabase.storage.from(bucketName).remove([filePath])
        } catch (cleanupError) {
          console.error('Failed to cleanup uploaded file:', cleanupError)
        }
        throw new Error(`Database save failed: ${dbError.message}`)
      }

      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: 'completed', progress: 100 } : f
        )
      )

      uploadToast.showUploadSuccess(file.name, false)
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

  const removeFile = (id: string) => {
    setUploadFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const updateFileTags = (fileId: string, tags: string[]) => {
    setUploadFiles(prev => 
      prev.map(file => 
        file.id === fileId ? { ...file, tags } : file
      )
    )
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-dark-bg">
      {/* Sidebar - Folder Tree */}
      <div className="w-80 bg-white dark:bg-dark-card border-r border-gray-200 dark:border-gray-600 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-4">Upload Destination</h3>
          <FolderTree
            selectedFolderId={selectedFolderId}
            onFolderSelect={setSelectedFolderId}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Upload Area */}
          <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6 transition-colors duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Upload Documents</h2>
              {selectedFolderId && (
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  <Folder className="w-4 h-4" />
                  <span>Uploading to selected folder</span>
                </div>
              )}
            </div>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-blue-400 dark:border-accent-primary bg-blue-50 dark:bg-accent-primary/10'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              <input {...getInputProps()} />
              <Plus className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
              {isDragActive ? (
                <p className="text-lg text-blue-600 dark:text-accent-primary">Drop the files here...</p>
              ) : (
                <div>
                  <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
                    Drag & drop files here, or click to select files
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Supports PDF and image files (PNG, JPG, GIF, TIFF, WebP, etc.) up to 50MB each
                  </p>
                  {selectedFolderId && (
                    <p className="text-sm text-blue-600 dark:text-accent-primary mt-2">
                      Files will be uploaded to the selected folder
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Upload Progress */}
          {uploadFiles.length > 0 && (
            <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6 transition-colors duration-200">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-4">Upload Progress</h3>
              <div className="space-y-4">
                {uploadFiles.map((uploadFile) => (
                  <div
                    key={uploadFile.id}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-dark-search transition-colors duration-200"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        {uploadFile.file.type === 'application/pdf' ? (
                          <FileText className="w-8 h-8 text-red-500" />
                        ) : (
                          <Image className="w-8 h-8 text-blue-500" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">
                              {uploadFile.file.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatFileSize(uploadFile.file.size)} • {uploadFile.file.type === 'application/pdf' ? 'PDF' : 'Image'}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {uploadFile.status === 'completed' && (
                              <CheckCircle className="w-4 h-4 text-green-500 dark:text-accent-success" />
                            )}
                            {uploadFile.status === 'error' && (
                              <AlertCircle className="w-4 h-4 text-red-500 dark:text-accent-warning" />
                            )}
                            {uploadFile.status === 'duplicate' && (
                              <AlertCircle className="w-4 h-4 text-orange-500" />
                            )}
                            <button
                              onClick={() => removeFile(uploadFile.id)}
                              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {uploadFile.status !== 'completed' && uploadFile.status !== 'duplicate' && (
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                uploadFile.status === 'error'
                                  ? 'bg-red-500 dark:bg-accent-warning'
                                  : 'bg-blue-600 dark:bg-accent-primary'
                              }`}
                              style={{ width: `${uploadFile.progress}%` }}
                            ></div>
                          </div>
                        )}

                        {uploadFile.status === 'processing' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {uploadFile.progress < 30 ? 'Extracting text content...' : 
                             uploadFile.progress < 50 ? 'Processing content...' :
                             uploadFile.progress < 70 ? `Uploading to ${getBucketForFileType(uploadFile.file.type)}...` :
                             uploadFile.progress < 85 ? 'Verifying upload...' :
                             'Saving to database...'}
                          </p>
                        )}

                        {uploadFile.status === 'duplicate' && (
                          <p className="text-xs text-orange-600 dark:text-orange-400">
                            This document already exists in your database
                          </p>
                        )}

                        {uploadFile.error && uploadFile.status !== 'duplicate' && (
                          <p className="text-xs text-red-600 dark:text-red-400">{uploadFile.error}</p>
                        )}

                        {uploadFile.status === 'completed' && (
                          <div className="mt-2 p-2 bg-gray-100 dark:bg-dark-bg rounded text-xs transition-colors duration-200">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-1">
                                <Folder className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                                <span className="text-gray-700 dark:text-gray-300">
                                  {uploadFile.folderId ? 'In folder' : 'Root folder'}
                                </span>
                              </div>
                              {uploadFile.tags.length > 0 && (
                                <div className="flex items-center space-x-1">
                                  <span className="text-gray-700 dark:text-gray-300">
                                    Tags: {uploadFile.tags.join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
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
      </div>
    </div>
  )
}