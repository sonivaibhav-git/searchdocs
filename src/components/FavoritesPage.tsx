import React, { useState, useEffect } from 'react'
import { Heart, FileText, Image, Calendar, Eye, Share2, User, Globe, Lock, Tag, Search, AlertCircle } from 'lucide-react'
import { supabase, DocumentWithProfile } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ProfilePage } from './ProfilePage'
import { ImageViewer } from './ImageViewer'
import { ShareModal } from './ShareModal'
import { DocumentViewer } from './SearchPage'

export function FavoritesPage() {
  const [favorites, setFavorites] = useState<DocumentWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithProfile | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState<DocumentWithProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    fetchFavorites()
  }, [])

  const fetchFavorites = async () => {
    try {
      setError(null)
      
      if (!user?.id) {
        setFavorites([])
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('favorites')
        .select(`
          document_id,
          documents (
            *,
            user_profiles (
              user_id,
              username,
              display_name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching favorites:', error)
        throw error
      }

      // Extract documents from the favorites data
      const favoriteDocuments = data
        ?.map(fav => fav.documents)
        .filter(doc => doc !== null) as DocumentWithProfile[]

      setFavorites(favoriteDocuments || [])
    } catch (error: any) {
      console.error('Error fetching favorites:', error)
      setError('Failed to load favorites. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const removeFavorite = async (documentId: string) => {
    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user?.id)
        .eq('document_id', documentId)

      if (!error) {
        setFavorites(prev => prev.filter(doc => doc.id !== documentId))
      }
    } catch (error) {
      console.error('Error removing favorite:', error)
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

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-accent-primary mx-auto"></div>
        <p className="mt-2 text-gray-600 dark:text-gray-300">Loading favorites...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 px-4">
        <AlertCircle className="w-12 h-12 text-red-500 dark:text-accent-warning mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">Error Loading Favorites</h3>
        <p className="text-red-600 dark:text-accent-warning mb-4 max-w-md mx-auto text-sm">{error}</p>
        <button
          onClick={() => {
            setError(null)
            setLoading(true)
            fetchFavorites()
          }}
          className="px-4 py-2 bg-blue-600 dark:bg-accent-primary text-white rounded-md hover:bg-blue-700 dark:hover:bg-accent-primary/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 md:p-6 transition-colors duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-3">
              <Heart className="w-6 h-6 text-red-500 dark:text-accent-warning" />
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-dark-text">My Favorites</h2>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {favorites.length} favorite document{favorites.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {favorites.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Heart className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">No favorites yet</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Add documents to your favorites by clicking the heart icon when viewing them.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {favorites.map((doc) => (
              <div
                key={doc.id}
                onClick={() => handleDocumentClick(doc)}
                className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-3 md:p-4 hover:shadow-md hover:border-blue-300 dark:hover:border-accent-primary transition-all duration-200 cursor-pointer group flex flex-col h-full"
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
                    <Heart className="w-3 h-3 md:w-4 md:h-4 text-red-500 dark:text-accent-warning fill-current" />
                    {doc.is_public ? (
                      <Globe className="w-3 h-3 md:w-4 md:h-4 text-green-600 dark:text-accent-success" />
                    ) : (
                      <Lock className="w-3 h-3 md:w-4 md:h-4 text-gray-600 dark:text-gray-400" />
                    )}
                    {doc.user_id !== user?.id && (
                      <User className="w-3 h-3 md:w-4 md:h-4 text-blue-600 dark:text-accent-primary" />
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

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-600">
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
                      className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded transition-colors"
                      title="Share document"
                    >
                      <Share2 className="w-3 h-3" />
                      <span className="hidden sm:inline">Share</span>
                    </button>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFavorite(doc.id)
                    }}
                    className="flex items-center space-x-1 px-2 py-1 text-xs text-red-600 dark:text-accent-warning hover:text-red-700 dark:hover:text-accent-warning/80 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Remove from favorites"
                  >
                    <Heart className="w-3 h-3 fill-current" />
                    <span className="hidden sm:inline">Remove</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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