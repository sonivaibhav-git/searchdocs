import React, { useState, useEffect } from 'react'
import { 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Edit3, 
  Trash2, 
  FileText,
  MoreVertical,
  Check,
  X
} from 'lucide-react'
import { FolderAPI, FolderTreeNode } from '../lib/folderApi'
import { useToast } from './Toast'

interface FolderTreeProps {
  selectedFolderId?: string
  onFolderSelect: (folderId?: string) => void
  onDocumentMove?: (documentIds: string[], folderId?: string) => void
  className?: string
}

export function FolderTree({ 
  selectedFolderId, 
  onFolderSelect, 
  onDocumentMove,
  className = '' 
}: FolderTreeProps) {
  const [folders, setFolders] = useState<FolderTreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [editingFolder, setEditingFolder] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [showDropdown, setShowDropdown] = useState<string | null>(null)
  const { showToast } = useToast()

  useEffect(() => {
    loadFolders()
  }, [])

  const loadFolders = async () => {
    try {
      setLoading(true)
      const folderTree = await FolderAPI.getFolderTree()
      setFolders(folderTree)
    } catch (error) {
      console.error('Error loading folders:', error)
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load folders'
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderId)) {
        newSet.delete(folderId)
      } else {
        newSet.add(folderId)
      }
      return newSet
    })
  }

  const handleCreateFolder = async (parentId?: string) => {
    if (!newFolderName.trim()) return

    try {
      await FolderAPI.createFolder(newFolderName.trim(), parentId)
      setNewFolderName('')
      setCreatingFolder(null)
      await loadFolders()
      showToast({
        type: 'success',
        title: 'Folder Created',
        message: `Folder "${newFolderName}" created successfully`
      })
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to create folder'
      })
    }
  }

  const handleUpdateFolder = async (folderId: string) => {
    if (!editingName.trim()) return

    try {
      await FolderAPI.updateFolder(folderId, editingName.trim())
      setEditingFolder(null)
      setEditingName('')
      await loadFolders()
      showToast({
        type: 'success',
        title: 'Folder Updated',
        message: 'Folder name updated successfully'
      })
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to update folder'
      })
    }
  }

  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (!confirm(`Are you sure you want to delete the folder "${folderName}"? This action cannot be undone.`)) {
      return
    }

    try {
      await FolderAPI.deleteFolder(folderId)
      await loadFolders()
      if (selectedFolderId === folderId) {
        onFolderSelect(undefined)
      }
      showToast({
        type: 'success',
        title: 'Folder Deleted',
        message: `Folder "${folderName}" deleted successfully`
      })
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to delete folder'
      })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, folderId?: string) => {
    e.preventDefault()
    
    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'))
      
      if (dragData.type === 'documents' && onDocumentMove) {
        await onDocumentMove(dragData.documentIds, folderId)
        showToast({
          type: 'success',
          title: 'Documents Moved',
          message: `${dragData.documentIds.length} document(s) moved successfully`
        })
      }
    } catch (error) {
      console.error('Error handling drop:', error)
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to move documents'
      })
    }
  }

  const renderFolder = (folder: FolderTreeNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(folder.folder_id)
    const isSelected = selectedFolderId === folder.folder_id
    const isEditing = editingFolder === folder.folder_id
    const isCreating = creatingFolder === folder.folder_id

    return (
      <div key={folder.folder_id} className="select-none">
        <div
          className={`flex items-center space-x-2 py-2 px-3 rounded-md cursor-pointer transition-colors group ${
            isSelected 
              ? 'bg-blue-100 dark:bg-accent-primary/20 text-blue-700 dark:text-accent-primary' 
              : 'hover:bg-gray-100 dark:hover:bg-dark-search text-gray-700 dark:text-gray-300'
          }`}
          style={{ paddingLeft: `${level * 20 + 12}px` }}
          onClick={() => !isEditing && onFolderSelect(folder.folder_id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, folder.folder_id)}
        >
          {/* Expand/Collapse Button */}
          {folder.has_children && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleFolder(folder.folder_id)
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Folder Icon */}
          <div className="flex-shrink-0">
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-blue-500 dark:text-accent-primary" />
            ) : (
              <Folder className="w-4 h-4 text-blue-500 dark:text-accent-primary" />
            )}
          </div>

          {/* Folder Name */}
          {isEditing ? (
            <div className="flex items-center space-x-2 flex-1">
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleUpdateFolder(folder.folder_id)
                  } else if (e.key === 'Escape') {
                    setEditingFolder(null)
                    setEditingName('')
                  }
                }}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleUpdateFolder(folder.folder_id)
                }}
                className="p-1 text-green-600 dark:text-accent-success hover:bg-green-100 dark:hover:bg-green-900/20 rounded"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingFolder(null)
                  setEditingName('')
                }}
                className="p-1 text-red-600 dark:text-accent-warning hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <span className="flex-1 text-sm font-medium truncate">
                {folder.folder_name}
              </span>
              
              {/* Document Count */}
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                {folder.document_count}
              </span>

              {/* Actions Dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowDropdown(showDropdown === folder.folder_id ? null : folder.folder_id)
                  }}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-opacity"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {showDropdown === folder.folder_id && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowDropdown(null)}
                    ></div>
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-card rounded-md shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-50">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setCreatingFolder(folder.folder_id)
                          setShowDropdown(null)
                        }}
                        className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-search transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>New Subfolder</span>
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingFolder(folder.folder_id)
                          setEditingName(folder.folder_name)
                          setShowDropdown(null)
                        }}
                        className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-search transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Rename</span>
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteFolder(folder.folder_id, folder.folder_name)
                          setShowDropdown(null)
                        }}
                        className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-600 dark:text-accent-warning hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* New Subfolder Input */}
        {isCreating && (
          <div 
            className="flex items-center space-x-2 py-2 px-3 ml-6"
            style={{ paddingLeft: `${(level + 1) * 20 + 12}px` }}
          >
            <Folder className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreateFolder(folder.folder_id)
                } else if (e.key === 'Escape') {
                  setCreatingFolder(null)
                  setNewFolderName('')
                }
              }}
              placeholder="Folder name..."
              className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent"
              autoFocus
            />
            <button
              onClick={() => handleCreateFolder(folder.folder_id)}
              className="p-1 text-green-600 dark:text-accent-success hover:bg-green-100 dark:hover:bg-green-900/20 rounded"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setCreatingFolder(null)
                setNewFolderName('')
              }}
              className="p-1 text-red-600 dark:text-accent-warning hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Render Children */}
        {isExpanded && folder.children.map(child => 
          renderFolder(child, level + 1)
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`${className} p-4`}>
        <div className="animate-pulse space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`${className} p-4`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Folders</h3>
        <button
          onClick={() => setCreatingFolder('root')}
          className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-600 dark:bg-accent-primary text-white rounded-md hover:bg-blue-700 dark:hover:bg-accent-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New</span>
        </button>
      </div>

      {/* All Documents */}
      <div
        className={`flex items-center space-x-2 py-2 px-3 rounded-md cursor-pointer transition-colors mb-2 ${
          !selectedFolderId 
            ? 'bg-blue-100 dark:bg-accent-primary/20 text-blue-700 dark:text-accent-primary' 
            : 'hover:bg-gray-100 dark:hover:bg-dark-search text-gray-700 dark:text-gray-300'
        }`}
        onClick={() => onFolderSelect(undefined)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, undefined)}
      >
        <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <span className="flex-1 text-sm font-medium">All Documents</span>
      </div>

      {/* Root Folder Creation */}
      {creatingFolder === 'root' && (
        <div className="flex items-center space-x-2 py-2 px-3 mb-2">
          <Folder className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleCreateFolder()
              } else if (e.key === 'Escape') {
                setCreatingFolder(null)
                setNewFolderName('')
              }
            }}
            placeholder="Folder name..."
            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent"
            autoFocus
          />
          <button
            onClick={() => handleCreateFolder()}
            className="p-1 text-green-600 dark:text-accent-success hover:bg-green-100 dark:hover:bg-green-900/20 rounded"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setCreatingFolder(null)
              setNewFolderName('')
            }}
            className="p-1 text-red-600 dark:text-accent-warning hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Folder Tree */}
      <div className="space-y-1">
        {folders.map(folder => renderFolder(folder))}
      </div>

      {folders.length === 0 && !creatingFolder && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No folders yet</p>
          <p className="text-xs">Create your first folder to organize documents</p>
        </div>
      )}
    </div>
  )
}