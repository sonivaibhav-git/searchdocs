import React, { useState, useEffect } from 'react'
import { Search, Filter, FileText, Image, Calendar, User, Globe, Lock, Tag, Heart, Eye, Share2, ChevronDown, AlertCircle } from 'lucide-react'
import { supabase, DocumentWithProfile } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ProfilePage } from './ProfilePage'
import { ImageViewer } from './ImageViewer'
import { ShareModal } from './ShareModal'
import { DocumentViewer } from './DocumentsPage'
import { useSearchToast } from './Toast'

export function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [documents, setDocuments] = useState<DocumentWithProfile[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentWithProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedFileType, setSelectedFileType] = useState<string>('all')
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithProfile | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState<DocumentWithProfile | null>(null)
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFilters, setShowFilters] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const { user } = useAuth()
  const searchToast = useSearchToast()

  useEffect(() => {
    fetchDocuments()
    if (user?.id) {
      fetchUserFavorites()
    }
  }, [user?.id])

  useEffect(() => {
    filterAndSortDocuments()
  }, [documents, searchQuery, selectedFileType, sortBy, sortOrder])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          user_profiles (
            user_id,
            username,
            display_name
          )
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocuments(data || [])
    } catch (error) {
      console.error('Error fetching documents:', error)
      searchToast.showSearchError('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserFavorites = async () => {
    if (!user?.id) return

    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('document_id')
        .eq('user_id', user.id)

      if (error) throw error
      
      const favoriteIds = new Set(data?.map(fav => fav.document_id) || [])
      setFavorites(favoriteIds)
    } catch (error) {
      console.error('Error fetching favorites:', error)
    }
  }

  const checkIfFavorited = async (documentId: string): Promise<boolean> => {
    if (!user?.id) return false

    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('document_id', documentId)
        .maybeSingle() // Changed from .single() to .maybeSingle()

      if (error) throw error
      return !!data
    } catch (error) {
      console.error('Error checking favorite status:', error)
      return false
    }
  }

  const toggleFavorite = async (documentId: string) => {
    if (!user?.id) return

    try {
      const isFavorited = favorites.has(documentId)
      
      if (isFavorited) {
        // Remove from favorites
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('document_id', documentId)

        if (error) throw error
        
        setFavorites(prev => {
          const newFavorites = new Set(prev)
          newFavorites.delete(documentId)
          return newFavorites
        })
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('favorites')
          .insert({
            user_id: user.id,
            document_id: documentId
          })

        if (error) throw error
        
        setFavorites(prev => new Set([...prev, documentId]))
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
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
        doc.tags.some(tag => tag.toLowerCase().includes(query)) ||
        (doc.user_profiles?.username && doc.user_profiles.username.toLowerCase().includes(query))
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
      setFilteredDocuments(documents)
      return
    }

    try {
      setLoading(true)
      
      // Perform full-text search using PostgreSQL
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          user_profiles (
            user_id,
            username,
            display_name
          )
        `)
        .eq('is_public', true)
        .textSearch('content', searchQuery, {
          type: 'websearch',
          config: 'english'
        })
        .order('created_at', { ascending: false })

      if (error) throw error
      
      if (data && data.length === 0) {
        searchToast.showNoResults(searchQuery)
      }
      
      setDocuments(data || [])
    } catch (error) {
      console.error('Search error:', error)
      searchToast.showSearchError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDocumentClick = (doc: DocumentWithProfile) => {
    setSelectedDocument(doc)
  }

  const handleShare = (doc: DocumentWithProfile, event: React.MouseEvent) => {
    event.stopPropagation()
    setShowShareModal(doc)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getTagColor = (tag: string, index: number) => {
    const colors = [
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
      'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    ]
    
    const colorIndex = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
    return colors[colorIndex]
  }

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        {/* Search Header */}
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 md:p-6 transition-colors duration-200">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-dark-text mb-4 md:mb-6">Search Documents</h2>
          
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4 md:w-5 md:h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documents, content, tags, or users..."
                  className="w-full pl-9 md:pl-12 pr-4 py-2 md:py-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-dark-search text-gray-900 dark:text-dark-text placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent transition-colors text-sm md:text-base"
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="px-4 md:px-6 py-2 md:py-3 bg-blue-600 dark:bg-accent-primary text-white rounded-md hover:bg-blue-700 dark:hover:bg-accent-primary/90 focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:ring-offset-2 dark:focus:ring-offset-dark-card disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm md:text-base font-medium"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
              
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 px-4 md:px-6 py-2 md:py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-dark-search focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:ring-offset-2 dark:focus:ring-offset-dark-card transition-colors text-sm md:text-base"
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 p-3 md:p-4 bg-gray-50 dark:bg-dark-search rounded-lg border border-gray-200 dark:border-gray-600 transition-colors duration-200">
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

        {/* Results */}
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 md:p-6 transition-colors duration-200">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-dark-text">
              {searchQuery ? `Search Results for "${searchQuery}"` : 'All Public Documents'}
            </h3>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="text-center py-8 md:py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-accent-primary mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-300">Searching documents...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-8 md:py-12">
              <Search className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">
                {searchQuery ? 'No documents found' : 'No public documents available'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery 
                  ? 'Try adjusting your search terms or filters'
                  : 'Be the first to upload and share a public document!'
                }
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => handleDocumentClick(doc)}
                  className="bg-gray-50 dark:bg-dark-search rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-3 md:p-4 hover:shadow-md hover:border-blue-300 dark:hover:border-accent-primary transition-all duration-200 cursor-pointer group flex flex-col h-full"
                >
                  <div className="flex items-start justify-between mb-2 md:mb-3">
                    <div className="flex items-center space-x-2">
                      {doc.file_type === 'pdf' ? (
                        <FileText className="w-4 h-4 md:w-5 md:h-5 text-red-500 flex-shrink-0" />
                      ) : (
                        <Image className="w-4 h-4 md:w-5 md:h-5 text-blue-500 flex-shrink-0" />
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <Globe className="w-3 h-3 md:w-4 md:h-4 text-green-600 dark:text-accent-success" />
                      {user?.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFavorite(doc.id)
                          }}
                          className={`p-1 rounded-full transition-colors ${
                            favorites.has(doc.id)
                              ? 'text-red-500 dark:text-accent-warning hover:text-red-600 dark:hover:text-accent-warning/80'
                              : 'text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-accent-warning'
                          }`}
                          title={favorites.has(doc.id) ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Heart className={`w-3 h-3 md:w-4 md:h-4 ${favorites.has(doc.id) ? 'fill-current' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="font-medium text-gray-900 dark:text-dark-text mb-2 md:mb-3 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-accent-primary transition-colors text-sm md:text-base">
                    {doc.title}
                  </h3>

                  {doc.user_profiles && (
                    <div className="mb-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedProfile(doc.user_profiles!.user_id)
                        }}
                        className="text-xs text-blue-600 dark:text-accent-primary hover:text-blue-700 dark:hover:text-accent-primary/80 hover:underline transition-colors"
                      >
                        by @{doc.user_profiles.username}
                      </button>
                    </div>
                  )}

                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2 md:mb-3 flex-1">
                      {doc.tags.slice(0, 2).map((tag, index) => (
                        <span
                          key={tag}
                          className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${getTagColor(tag, index)}`}
                        >
                          #{tag}
                        </span>
                      ))}
                      {doc.tags.length > 2 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">+{doc.tags.length - 2} more</span>
                      )}
                    </div>
                  )}

                  <div className="space-y-1 md:space-y-2 mb-3 md:mb-4 mt-auto">
                    <div className="flex items-center text-xs md:text-sm text-gray-500 dark:text-gray-400">
                      <Calendar className="w-3 h-3 mr-1" />
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                      Size: {formatFileSize(doc.file_size)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedDocument(doc)
                        }}
                        className="flex items-center space-x-1 px-2 py-1 text-xs text-blue-600 dark:text-accent-primary hover:text-blue-700 dark:hover:text-accent-primary/80 hover:bg-blue-50 dark:hover:bg-accent-primary/10 rounded transition-colors"
                        title="View document"
                      >
                        <Eye className="w-3 h-3" />
                        <span className="hidden sm:inline">View</span>
                      </button>
                      
                      <button
                        onClick={(e) => handleShare(doc, e)}
                        className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                        title="Share document"
                      >
                        <Share2 className="w-3 h-3" />
                        <span className="hidden sm:inline">Share</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedDocument && (
        <>
          {selectedDocument.file_type === 'image' ? (
            <ImageViewer
              document={selectedDocument}
              onClose={() => setSelectedDocument(null)}
            />
          ) : (
            <DocumentViewer
              document={selectedDocument}
              onClose={() => setSelectedDocument(null)}
            />
          )}
        </>
      )}

      {showShareModal && (
        <ShareModal
          document={showShareModal}
          onClose={() => setShowShareModal(null)}
        />
      )}

      {selectedProfile && (
        <ProfilePage
          userId={selectedProfile}
          onClose={() => setSelectedProfile(null)}
        />
      )}
    </>
  )
}