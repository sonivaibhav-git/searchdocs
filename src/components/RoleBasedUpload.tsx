import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Plus, FileText, Image, AlertCircle, CheckCircle, X, Upload, Tag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useRole } from '../contexts/RoleContext'
import { createWorker } from 'tesseract.js'
import { huggingFaceService } from '../lib/huggingface'
import { useUploadToast } from './Toast'

interface UploadFile {
  id: string
  file: File
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  error?: string
  categoryId?: string
  deadline?: string
  severity?: number
}

const CATEGORY_OPTIONS = {
  STATION_CTRL: [
    { id: 'INCIDENT', name: 'Incident Reports', priority: 5 },
    { id: 'SAFETY', name: 'Safety Circulars', priority: 4 },
    { id: 'TRAINING', name: 'Training Materials', priority: 3 }
  ],
  ROLLING_STOCK: [
    { id: 'MAINTENANCE', name: 'Maintenance Cards', priority: 3 },
    { id: 'TRAINING', name: 'Technical Training', priority: 3 }
  ],
  PROCUREMENT: [
    { id: 'PROCUREMENT', name: 'Procurement Documents', priority: 2 },
    { id: 'FINANCIAL', name: 'Financial Reports', priority: 3 }
  ],
  HR: [
    { id: 'HR_POLICY', name: 'HR Policies', priority: 2 },
    { id: 'TRAINING', name: 'Training Materials', priority: 3 }
  ],
  SAFETY: [
    { id: 'REGULATORY', name: 'Regulatory Directives', priority: 5 },
    { id: 'SAFETY', name: 'Safety Circulars', priority: 4 }
  ],
  EXECUTIVE: [
    { id: 'INCIDENT', name: 'Incident Reports', priority: 5 },
    { id: 'REGULATORY', name: 'Regulatory Directives', priority: 5 },
    { id: 'FINANCIAL', name: 'Financial Reports', priority: 3 }
  ]
}

export function RoleBasedUpload() {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const { user } = useAuth()
  const { currentRole } = useRole()
  const uploadToast = useUploadToast()

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending',
      progress: 0,
    }))

    setUploadFiles((prev) => [...prev, ...newFiles])
    
    // Process each file
    newFiles.forEach(processFile)
  }, [])

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
        }).join(' ').substring(0, 2000)
      }
      
      return `PDF content from ${file.name}`
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

  const getBucketForFileType = (fileType: string) => {
    if (fileType === 'application/pdf') {
      return 'pdf-documents'
    } else if (fileType.startsWith('image/')) {
      return 'image-documents'
    }
    return 'pdf-documents'
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
      
      // Extract text content
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
          f.id === uploadFile.id ? { ...f, progress: 50 } : f
        )
      )

      // Upload file to storage
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

      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, progress: 70 } : f
        )
      )

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath)

      // Get default category for current role
      const roleCategories = CATEGORY_OPTIONS[currentRole?.role_code as keyof typeof CATEGORY_OPTIONS] || []
      const defaultCategory = roleCategories[0]

      // Get category ID from database
      let categoryId = null
      if (defaultCategory) {
        const { data: categoryData } = await supabase
          .from('document_categories')
          .select('id')
          .eq('category_code', defaultCategory.id)
          .single()
        
        categoryId = categoryData?.id
      }

      // Save document to database
      const { data: dbData, error: dbError } = await supabase
        .from('documents')
        .insert({
          title: file.name,
          content: extractedText,
          file_type: file.type === 'application/pdf' ? 'pdf' : 'image',
          file_size: file.size,
          file_url: publicUrl,
          user_id: user?.id,
          category_id: categoryId,
          is_public: false,
          tags: [],
          severity_level: defaultCategory?.priority || 1,
          status: 'active',
          metadata: {
            original_name: file.name,
            mime_type: file.type,
            storage_path: filePath,
            storage_bucket: bucketName,
            uploaded_by_role: currentRole?.role_code
          },
        })
        .select()
        .single()

      if (dbError) {
        await supabase.storage.from(bucketName).remove([filePath])
        throw new Error(`Database save failed: ${dbError.message}`)
      }

      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, progress: 85 } : f
        )
      )

      // Generate AI summaries for all roles
      if (dbData) {
        try {
          await huggingFaceService.summarizeForAllRoles(dbData.id, extractedText, file.name)
        } catch (summaryError) {
          console.error('Summary generation failed:', summaryError)
          // Don't fail the upload if summarization fails
        }
      }

      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: 'completed', progress: 100 } : f
        )
      )

      uploadToast.showUploadSuccess(file.name, false)

      // Create notifications for relevant roles
      if (dbData && categoryId) {
        const { data: categoryData } = await supabase
          .from('document_categories')
          .select('target_roles, category_name')
          .eq('id', categoryId)
          .single()

        if (categoryData?.target_roles) {
          // Get users with target roles
          const { data: targetUsers } = await supabase
            .from('user_roles')
            .select('user_id, roles(role_code)')
            .in('roles.role_code', categoryData.target_roles)
            .eq('is_active', true)

          // Create notifications
          if (targetUsers) {
            for (const targetUser of targetUsers) {
              if (targetUser.user_id !== user?.id) { // Don't notify the uploader
                await supabase.rpc('create_notification', {
                  user_uuid: targetUser.user_id,
                  title_param: `New ${categoryData.category_name}`,
                  message_param: `${file.name} has been uploaded and is ready for review.`,
                  type_param: 'info',
                  document_uuid: dbData.id
                })
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('Upload error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      
      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: 'error', error: errorMessage }
            : f
        )
      )

      uploadToast.showUploadError(file.name, errorMessage)
    }
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

  if (!currentRole) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">No Role Assigned</h3>
        <p className="text-gray-600 dark:text-gray-400">Please contact your administrator to assign a role before uploading documents.</p>
      </div>
    )
  }

  const roleCategories = CATEGORY_OPTIONS[currentRole.role_code as keyof typeof CATEGORY_OPTIONS] || []

  return (
    <div className="space-y-6">
      {/* Role Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <Tag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span className="font-medium text-blue-900 dark:text-blue-300">
            Uploading as: {currentRole.role_name}
          </span>
        </div>
        <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
          Documents will be categorized and shared with relevant departments automatically.
        </p>
      </div>

      {/* Upload Area */}
      <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text mb-6">Upload Documents</h2>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-blue-400 dark:border-accent-primary bg-blue-50 dark:bg-accent-primary/10'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
          {isDragActive ? (
            <p className="text-lg text-blue-600 dark:text-accent-primary">Drop the files here...</p>
          ) : (
            <div>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
                Drag & drop files here, or click to select files
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Supports PDF and image files up to 50MB each
              </p>
              {roleCategories.length > 0 && (
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                  Will be categorized as: {roleCategories.map(c => c.name).join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload Progress */}
      {uploadFiles.length > 0 && (
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-4">Upload Progress</h3>
          <div className="space-y-4">
            {uploadFiles.map((uploadFile) => (
              <div
                key={uploadFile.id}
                className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-dark-search"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    {uploadFile.file.type === 'application/pdf' ? (
                      <FileText className="w-8 h-8 text-red-500" />
                    ) : (
                      <Image className="w-8 h-8 text-blue-500" />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-dark-text">{uploadFile.file.name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatFileSize(uploadFile.file.size)} • {uploadFile.file.type === 'application/pdf' ? 'PDF' : 'Image'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {uploadFile.status === 'completed' && (
                      <CheckCircle className="w-5 h-5 text-green-500 dark:text-accent-success" />
                    )}
                    {uploadFile.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-red-500 dark:text-accent-warning" />
                    )}
                    <button
                      onClick={() => removeFile(uploadFile.id)}
                      className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {uploadFile.status !== 'completed' && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          uploadFile.status === 'error'
                            ? 'bg-red-500 dark:bg-accent-warning'
                            : 'bg-blue-600 dark:bg-accent-primary'
                        }`}
                        style={{ width: `${uploadFile.progress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {uploadFile.status === 'processing' && uploadFile.progress < 30 && 'Extracting text content...'}
                      {uploadFile.status === 'processing' && uploadFile.progress >= 30 && uploadFile.progress < 50 && 'Processing content...'}
                      {uploadFile.status === 'processing' && uploadFile.progress >= 50 && uploadFile.progress < 70 && 'Uploading file...'}
                      {uploadFile.status === 'processing' && uploadFile.progress >= 70 && uploadFile.progress < 85 && 'Saving to database...'}
                      {uploadFile.status === 'processing' && uploadFile.progress >= 85 && 'Generating AI summaries...'}
                      {uploadFile.error && uploadFile.status === 'error' && uploadFile.error}
                    </p>
                  </div>
                )}

                {uploadFile.status === 'completed' && (
                  <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs">
                    <p className="text-green-800 dark:text-green-300">
                      ✓ Document uploaded and processed successfully. AI summaries generated for all relevant roles.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}