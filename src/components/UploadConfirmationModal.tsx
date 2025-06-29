import React, { useState } from 'react'
import { X, Upload, Globe, Lock, Tag, Plus, FileText, Image } from 'lucide-react'

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

interface UploadConfirmationModalProps {
  files: UploadFile[]
  onConfirm: (files: UploadFile[]) => void
  onCancel: () => void
}

export function UploadConfirmationModal({ files, onConfirm, onCancel }: UploadConfirmationModalProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>(files)
  const [newTag, setNewTag] = useState('')

  const updateFilePrivacy = (fileId: string, isPublic: boolean) => {
    setUploadFiles(prev => 
      prev.map(file => 
        file.id === fileId ? { ...file, isPublic } : file
      )
    )
  }

  const updateFileTags = (fileId: string, tags: string[]) => {
    setUploadFiles(prev => 
      prev.map(file => 
        file.id === fileId ? { ...file, tags } : file
      )
    )
  }

  const addTagToFile = (fileId: string) => {
    if (newTag.trim()) {
      const file = uploadFiles.find(f => f.id === fileId)
      if (file && !file.tags.includes(newTag.trim())) {
        updateFileTags(fileId, [...file.tags, newTag.trim()])
      }
      setNewTag('')
    }
  }

  const removeTagFromFile = (fileId: string, tagToRemove: string) => {
    const file = uploadFiles.find(f => f.id === fileId)
    if (file) {
      updateFileTags(fileId, file.tags.filter(tag => tag !== tagToRemove))
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleConfirm = () => {
    onConfirm(uploadFiles)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-card rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-3">
            <Upload className="w-6 h-6 text-blue-600 dark:text-accent-primary" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text">Confirm Upload Settings</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Configure privacy and tags for {files.length} file{files.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-4">
            {uploadFiles.map((file) => (
              <div
                key={file.id}
                className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-dark-search transition-colors duration-200"
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    {file.file.type === 'application/pdf' ? (
                      <FileText className="w-8 h-8 text-red-500" />
                    ) : (
                      <Image className="w-8 h-8 text-blue-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-dark-text truncate">{file.file.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatFileSize(file.file.size)} • {file.file.type === 'application/pdf' ? 'PDF' : 'Image'}
                        </p>
                      </div>
                    </div>

                    {/* Privacy Setting */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Privacy</label>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="radio"
                            checked={!file.isPublic}
                            onChange={() => updateFilePrivacy(file.id, false)}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <div className="flex items-center space-x-2">
                            <Lock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Private - Only visible to you</span>
                          </div>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="radio"
                            checked={file.isPublic}
                            onChange={() => updateFilePrivacy(file.id, true)}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <div className="flex items-center space-x-2">
                            <Globe className="w-4 h-4 text-green-600 dark:text-accent-success" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Public - Visible to all users</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</label>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                addTagToFile(file.id)
                              }
                            }}
                            placeholder="Add a tag..."
                            className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text"
                          />
                          <button
                            onClick={() => addTagToFile(file.id)}
                            className="flex items-center space-x-1 px-3 py-1 bg-blue-600 dark:bg-accent-primary text-white rounded-md hover:bg-blue-700 dark:hover:bg-accent-primary/90 transition-colors text-sm"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add</span>
                          </button>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          {file.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-100 dark:bg-accent-primary/20 text-blue-800 dark:text-accent-primary rounded-full text-xs"
                            >
                              <Tag className="w-3 h-3" />
                              <span>{tag}</span>
                              <button
                                onClick={() => removeTagFromFile(file.id, tag)}
                                className="text-blue-600 dark:text-accent-primary hover:text-blue-800 dark:hover:text-accent-primary/80"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-4 md:p-6 border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-dark-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex items-center space-x-2 px-6 py-2 bg-blue-600 dark:bg-accent-primary text-white rounded-md hover:bg-blue-700 dark:hover:bg-accent-primary/90 transition-colors text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            <span>Upload {files.length} File{files.length !== 1 ? 's' : ''}</span>
          </button>
        </div>
      </div>
    </div>
  )
}