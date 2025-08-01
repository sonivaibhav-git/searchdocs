import React, { useState, useEffect } from 'react'
import { 
  FileText, 
  Image, 
  Calendar, 
  Eye, 
  Download, 
  Trash2, 
  Search,
  Filter,
  ChevronDown,
  MoreVertical,
  Move,
  CheckSquare,
  Square,
  X
} from 'lucide-react'
import { supabase, DocumentWithProfile } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { FolderTree } from './FolderTree'
import { FolderAPI } from '../lib/folderApi'
import { EnhancedDocumentViewer } from './EnhancedDocumentViewer'
import { ImageViewer } from './ImageViewer'
import { useToast } from './Toast'

export function EnhancedDocumentsPage() {
  const [documents, setDocuments] = useState<DocumentWithProfile[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>()
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithProfile | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFileType, setSelectedFileType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set())
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const { user } = useAuth()
  const { showToast } = useToast()

  useEffect(() => {
    fetchDocuments()
  }, [selectedFolderId])

  useEffect(() => {
    filterAndSortDocuments()
  }, [documents, searchQuery, selectedFileType, sortBy, sortOrder])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const docs = await FolderAPI.getDocumentsInFolder(selectedFolderId)
      setDocuments(docs)
    } catch (error) {
      console.error('Error fetching documents:', error)
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load documents'
      })
    } finally {
      setLoading(false)
    }
  }

  const filterAndSortDocuments = () => {
    let filtered = [...documents]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(doc => 
        doc.title.toLowerCase().includes(query) ||
        doc.content.toLowerCase().includes(query) ||
        doc.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    // Apply file type filter
    if (selectedFileType !== 'all') {
      filtered = filtered.filter(doc => doc.file_type === selectedFileType)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'name':
          comparison = a.title.localeCompare(b.title)
          break
        case 'size':
          comparison = a.file_size - b.file_size
          break
        case 'date':
        default:
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })

    setFilteredDocuments(filtered)
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!searchQuery.trim()) {
      filterAndSortDocuments()
      return
    }

    try {
      setLoading(true)
      const results = await FolderAPI.searchDocuments(searchQuery, selectedFolderId)
      setDocuments(results)
    } catch (error) {
      console.error('Search error:', error)
      showToast({
        type: 'error',
        title: 'Search Error',
        message: 'Failed to search documents'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDocumentSelect = (documentId: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(documentId)) {
        newSet.delete(documentId)
      } else {
        newSet.add(documentId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedDocuments.size === filteredDocuments.length) {
      setSelectedDocuments(new Set())
    } else {
      setSelectedDocuments(new Set(filteredDocuments.map(doc => doc.id)))
    }
  }

  const handleBulkMove = async (targetFolderId?: string) => {
    try {
      await FolderAPI.moveDocumentsToFolder(Array.from(selectedDocuments), targetFolderId)
      setSelectedDocuments(new Set())
      setShowMoveModal(false)
      await fetchDocuments()
      showToast({
        type: 'success',
        title: 'Documents Moved',
        message: `${selectedDocuments.size} document(s) moved successfully`
      })
    } catch (error) {
      console.error('Error moving documents:', error)
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to move documents'
      })
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedDocuments.size} document(s)? This action cannot be undone.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .in('id', Array.from(selectedDocuments))

      if (error) throw error

      setSelectedDocuments(new Set())
      await fetchDocuments()
      showToast({
        type: 'success',
        title: 'Documents Deleted',
        message: `${selectedDocuments.size} document(s) deleted successfully`
      })
    } catch (error) {
      console.error('Error deleting documents:', error)
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete documents'
      })
    }
  }

  const handleDocumentMove = async (documentIds: string[], folderId?: string) => {
    try {
      await FolderAPI.moveDocumentsToFolder(documentIds, folderId)
      await fetchDocuments()
    } catch (error) {
      console.error('Error moving documents:', error)
      throw error
    }
  }

  const handleDownload = async (doc: DocumentWithProfile) => {
    if (!doc.file_url) return
    
    try {
      const response = await fetch(doc.file_url)
      if (!response.ok) throw new Error('Failed to fetch file')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = doc.title || 'document'
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download failed:', error)
      window.open(doc.file_url, '_blank')
    }
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
        <FolderTree
          selectedFolderId={selectedFolderId}
          onFolderSelect={setSelectedFolderId}
          onDocumentMove={handleDocumentMove}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-gray-600 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text">
              {selectedFolderId ? 'Folder Documents' : 'All Documents'}
            </h2>
            
            {selectedDocuments.size > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedDocuments.size} selected
                </span>
                <button
                  onClick={() => setShowMoveModal(true)}
                  className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-600 dark:bg-accent-primary text-white rounded-md hover:bg-blue-700 dark:hover:bg-accent-primary/90 transition-colors"
                >
                  <Move className="w-4 h-4" />
                  <span>Move</span>
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center space-x-1 px-3 py-1 text-sm bg-red-600 dark:bg-accent-warning text-white rounded-md hover:bg-red-700 dark:hover:bg-accent-warning/90 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
                <button
                  onClick={() => setSelectedDocuments(new Set())}
                  className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Search and Filters */}
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documents..."
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-dark-search text-gray-900 dark:text-dark-text placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent transition-colors"
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-blue-600 dark:bg-accent-primary text-white rounded-md hover:bg-blue-700 dark:hover:bg-accent-primary/90 focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:ring-offset-2 dark:focus:ring-offset-dark-card disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
              
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-dark-search focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:ring-offset-2 dark:focus:ring-offset-dark-card transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-dark-search rounded-lg border border-gray-200 dark:border-gray-600 transition-colors duration-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">File Type</label>
                  <select
                    value={selectedFileType}
                    onChange={(e) => setSelectedFileType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent text-sm"
                  >
                    <option value="all">All Types</option>
                    <option value="pdf">PDF Documents</option>
                    <option value="image">Images</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'size')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent text-sm"
                  >
                    <option value="date">Date</option>
                    <option value="name">Name</option>
                    <option value="size">Size</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Order</label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent text-sm"
                  >
                    <option value="desc">Newest First</option>
                    <option value="asc">Oldest First</option>
                  </select>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-accent-primary mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-300">Loading documents...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">
                {searchQuery ? 'No documents found' : 'No documents in this folder'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery 
                  ? 'Try adjusting your search terms or filters'
                  : 'Upload documents to get started'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Bulk Actions Header */}
              {filteredDocuments.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-search rounded-lg">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-dark-text"
                    >
                      {selectedDocuments.size === filteredDocuments.length ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      <span>Select All ({filteredDocuments.length})</span>
                    </button>
                  </div>
                  
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Document Grid */}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className={`bg-white dark:bg-dark-card rounded-lg shadow-sm border transition-all duration-200 cursor-pointer group ${
                      selectedDocuments.has(doc.id)
                        ? 'border-blue-500 dark:border-accent-primary ring-2 ring-blue-200 dark:ring-accent-primary/20'
                        : 'border-gray-200 dark:border-gray-600 hover:shadow-md hover:border-blue-300 dark:hover:border-accent-primary'
                    }`}
                    draggable
                    onDragStart={(e) => {
                      const dragData = {
                        type: 'documents',
                        documentIds: selectedDocuments.has(doc.id) 
                          ? Array.from(selectedDocuments)
                          : [doc.id]
                      }
                      e.dataTransfer.setData('text/plain', JSON.stringify(dragData))
                    }}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDocumentSelect(doc.id)
                            }}
                            className="flex-shrink-0"
                          >
                            {selectedDocuments.has(doc.id) ? (
                              <CheckSquare className="w-4 h-4 text-blue-600 dark:text-accent-primary" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                            )}
                          </button>
                          
                          {doc.file_type === 'pdf' ? (
                            <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
                          ) : (
                            <Image className="w-5 h-5 text-blue-500 flex-shrink-0" />
                          )}
                        </div>
                        
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              // Handle dropdown menu
                            }}
                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-opacity"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <h3 
                        className="font-medium text-gray-900 dark:text-dark-text mb-3 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-accent-primary transition-colors"
                        onClick={() => setSelectedDocument(doc)}
                      >
                        {doc.title}
                      </h3>

                      {doc.tags && doc.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {doc.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-2 py-1 bg-blue-100 dark:bg-accent-primary/20 text-blue-800 dark:text-accent-primary rounded-full"
                            >
                              #{tag}
                            </span>
                          ))}
                          {doc.tags.length > 2 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">+{doc.tags.length - 2}</span>
                          )}
                        </div>
                      )}

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                          <Calendar className="w-3 h-3 mr-1" />
                          <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                        </div>
                        
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Size: {formatFileSize(doc.file_size)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-600">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedDocument(doc)
                          }}
                          className="flex items-center space-x-1 px-2 py-1 text-xs text-blue-600 dark:text-accent-primary hover:text-blue-700 dark:hover:text-accent-primary/80 hover:bg-blue-50 dark:hover:bg-accent-primary/10 rounded transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownload(doc)
                          }}
                          className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              <span>Folder functionality coming soon</span>
            </div>
          )}
        </div>
      </div>

      {/* Document Viewer */}
      {selectedDocument && (
        <>
          {selectedDocument.file_type === 'image' ? (
            <ImageViewer
              document={selectedDocument}
              onClose={() => setSelectedDocument(null)}
            />
          ) : (
            <EnhancedDocumentViewer
              document={selectedDocument}
              onClose={() => setSelectedDocument(null)}
            />
          )}
        </>
      )}

      {/* Move Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-card rounded-lg shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text">
                Move {selectedDocuments.size} Document{selectedDocuments.size !== 1 ? 's' : ''}
              </h3>
              <button
                onClick={() => setShowMoveModal(false)}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="max-h-64 overflow-y-auto">
                <FolderTree
                  selectedFolderId={undefined}
                  onFolderSelect={(folderId) => {
                    handleBulkMove(folderId)
                  }}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg"
                />
              </div>
              
              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowMoveModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-dark-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleBulkMove(undefined)}
                  className="px-4 py-2 text-sm bg-blue-600 dark:bg-accent-primary text-white rounded-md hover:bg-blue-700 dark:hover:bg-accent-primary/90 transition-colors"
                >
                  Move to Root
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}