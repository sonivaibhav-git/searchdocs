import React, { useState, useEffect } from 'react'
import { User, Edit3, Save, X, Calendar, FileText, Image, Globe, Lock, Tag, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { supabase, UserProfile, Document } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface ProfilePageProps {
  userId?: string
  onClose: () => void
}

export function ProfilePage({ userId, onClose }: ProfilePageProps) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [userDocuments, setUserDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Form state
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [username, setUsername] = useState('')

  const isOwnProfile = !userId || userId === user?.id
  const targetUserId = userId || user?.id

  useEffect(() => {
    if (targetUserId) {
      fetchProfile()
      fetchUserDocuments()
    }
  }, [targetUserId])

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', targetUserId)
        .single()

      if (error) throw error

      setProfile(data)
      setDisplayName(data.display_name || '')
      setBio(data.bio || '')
      setUsername(data.username)
    } catch (error) {
      console.error('Error fetching profile:', error)
      setError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserDocuments = async () => {
    try {
      let query = supabase
        .from('documents')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })

      // If viewing someone else's profile, only show public documents
      if (!isOwnProfile) {
        query = query.eq('is_public', true)
      }

      const { data, error } = await query

      if (error) throw error
      setUserDocuments(data || [])
    } catch (error) {
      console.error('Error fetching user documents:', error)
    }
  }

  const canEditUsername = () => {
    if (!profile) return false
    
    const createdAt = new Date(profile.created_at)
    const lastChange = new Date(profile.last_username_change)
    const now = new Date()
    
    // Check if it's the same day as account creation
    const creationDate = createdAt.toDateString()
    const currentDate = now.toDateString()
    
    if (creationDate === currentDate) {
      return true
    }
    
    // Check if 15 days have passed since last change
    const daysSinceLastChange = (now.getTime() - lastChange.getTime()) / (1000 * 3600 * 24)
    return daysSinceLastChange >= 15
  }

  const getDaysUntilUsernameEdit = () => {
    if (!profile) return 0
    
    const createdAt = new Date(profile.created_at)
    const lastChange = new Date(profile.last_username_change)
    const now = new Date()
    
    // If it's the same day as account creation, can edit
    const creationDate = createdAt.toDateString()
    const currentDate = now.toDateString()
    
    if (creationDate === currentDate) {
      return 0
    }
    
    // Calculate days remaining
    const daysSinceLastChange = (now.getTime() - lastChange.getTime()) / (1000 * 3600 * 24)
    return Math.max(0, Math.ceil(15 - daysSinceLastChange))
  }

  const getNextEditDate = () => {
    if (!profile) return null
    
    const createdAt = new Date(profile.created_at)
    const lastChange = new Date(profile.last_username_change)
    const now = new Date()
    
    // If it's the same day as account creation, can edit now
    const creationDate = createdAt.toDateString()
    const currentDate = now.toDateString()
    
    if (creationDate === currentDate) {
      return null // Can edit now
    }
    
    // Calculate next edit date (15 days from last change)
    const nextEditDate = new Date(lastChange.getTime() + (15 * 24 * 60 * 60 * 1000))
    return nextEditDate
  }

  const validateUsername = (username: string) => {
    const trimmed = username.trim()
    
    if (!trimmed) {
      return 'Username cannot be empty'
    }
    
    if (trimmed.length < 3 || trimmed.length > 30) {
      return 'Username must be 3-30 characters long'
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return 'Username can only contain letters, numbers, and underscores'
    }
    
    if (!/^[a-zA-Z0-9]/.test(trimmed)) {
      return 'Username must start with a letter or number'
    }
    
    return null
  }

  const handleSave = async () => {
    if (!profile) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const updates: any = {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      }

      // Only update username if it changed
      if (username !== profile.username) {
        if (!canEditUsername()) {
          const daysRemaining = getDaysUntilUsernameEdit()
          const nextEditDate = getNextEditDate()
          
          if (nextEditDate) {
            throw new Error(`Username can only be changed after ${nextEditDate.toLocaleDateString()}. ${daysRemaining} days remaining.`)
          } else {
            throw new Error('Username can only be changed on the day of account creation or after 15 days from the last change')
          }
        }
        
        // Validate username format
        const validationError = validateUsername(username)
        if (validationError) {
          throw new Error(validationError)
        }

        updates.username = username.trim().toLowerCase()
        // Note: last_username_change will be updated automatically by the database trigger
      }

      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('user_id', targetUserId)

      if (error) {
        if (error.code === '23505') {
          throw new Error('Username is already taken')
        }
        if (error.message.includes('Username can only be changed')) {
          throw new Error(error.message)
        }
        if (error.message.includes('Username must be')) {
          throw new Error(error.message)
        }
        throw error
      }

      setSuccess('Profile updated successfully!')
      setEditing(false)
      await fetchProfile() // Refresh profile data
    } catch (error: any) {
      console.error('Error updating profile:', error)
      setError(error.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading profile...</span>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Profile Not Found</h3>
            <p className="text-gray-600 mb-4">The requested profile could not be found.</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  const nextEditDate = getNextEditDate()
  const daysUntilEdit = getDaysUntilUsernameEdit()
  const canEdit = canEditUsername()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[95vh] md:h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2 md:space-x-3 min-w-0 flex-1">
            <User className="w-6 h-6 md:w-8 md:h-8 text-blue-600 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg md:text-2xl font-bold text-gray-900 truncate">
                {isOwnProfile ? 'My Profile' : `${profile.display_name || profile.username}'s Profile`}
              </h2>
              <p className="text-sm md:text-base text-gray-600 truncate">@{profile.username}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 flex-shrink-0">
            {isOwnProfile && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center space-x-1 md:space-x-2 px-2 md:px-4 py-1 md:py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors text-sm md:text-base"
              >
                <Edit3 className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Edit Profile</span>
              </button>
            )}
            
            <button
              onClick={onClose}
              className="p-1 md:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              <X className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            {/* Profile Info */}
            <div className="lg:col-span-1">
              <div className="bg-gray-50 rounded-lg p-4 md:p-6">
                <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Profile Information</h3>
                
                {error && (
                  <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-md border border-red-200 mb-4">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                {success && (
                  <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-3 rounded-md border border-green-200 mb-4">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{success}</span>
                  </div>
                )}

                <div className="space-y-3 md:space-y-4">
                  {/* Username */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username
                    </label>
                    {editing && isOwnProfile ? (
                      <div>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          disabled={!canEdit}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-sm md:text-base"
                          placeholder="Enter username"
                        />
                        {!canEdit && (
                          <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
                            <div className="flex items-center space-x-2 text-orange-700">
                              <Clock className="w-4 h-4" />
                              <span className="text-xs font-medium">Username Edit Restriction</span>
                            </div>
                            <p className="text-xs text-orange-600 mt-1">
                              {nextEditDate ? (
                                <>
                                  Next edit available on {nextEditDate.toLocaleDateString()}
                                  <br />
                                  ({daysUntilEdit} days remaining)
                                </>
                              ) : (
                                'Username can only be changed on the day of account creation or after 15 days from the last change'
                              )}
                            </p>
                          </div>
                        )}
                        {canEdit && (
                          <p className="text-xs text-green-600 mt-1">
                            ✓ Username can be changed now
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-900 text-sm md:text-base">@{profile.username}</p>
                    )}
                  </div>

                  {/* Display Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Name
                    </label>
                    {editing && isOwnProfile ? (
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:text-base"
                        placeholder="Enter display name"
                      />
                    ) : (
                      <p className="text-gray-900 text-sm md:text-base">{profile.display_name || 'Not set'}</p>
                    )}
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bio
                    </label>
                    {editing && isOwnProfile ? (
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:text-base"
                        placeholder="Tell us about yourself..."
                      />
                    ) : (
                      <p className="text-gray-900 text-sm md:text-base">{profile.bio || 'No bio available'}</p>
                    )}
                  </div>

                  {/* Member Since */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Member Since
                    </label>
                    <div className="flex items-center space-x-2 text-gray-900 text-sm md:text-base">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(profile.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Last Username Change (for own profile) */}
                  {isOwnProfile && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Last Username Change
                      </label>
                      <div className="flex items-center space-x-2 text-gray-900 text-sm md:text-base">
                        <Clock className="w-4 h-4" />
                        <span>{new Date(profile.last_username_change).toLocaleDateString()}</span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {editing && isOwnProfile && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm md:text-base"
                      >
                        {saving ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>Save Changes</span>
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => {
                          setEditing(false)
                          setDisplayName(profile.display_name || '')
                          setBio(profile.bio || '')
                          setUsername(profile.username)
                          setError('')
                          setSuccess('')
                        }}
                        className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors text-sm md:text-base"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Documents */}
            <div className="lg:col-span-2">
              <div className="bg-gray-50 rounded-lg p-4 md:p-6">
                <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">
                  {isOwnProfile ? 'My Documents' : 'Public Documents'} ({userDocuments.length})
                </h3>
                
                {userDocuments.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 text-sm md:text-base">
                      {isOwnProfile ? 'No documents uploaded yet' : 'No public documents available'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    {userDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-2 md:mb-3">
                          <div className="flex items-center space-x-2">
                            {doc.file_type === 'pdf' ? (
                              <FileText className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
                            ) : (
                              <Image className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                            )}
                            <div className="flex items-center space-x-1">
                              {doc.is_public ? (
                                <Globe className="w-3 h-3 md:w-4 md:h-4 text-green-600" />
                              ) : (
                                <Lock className="w-3 h-3 md:w-4 md:h-4 text-gray-600" />
                              )}
                            </div>
                          </div>
                        </div>

                        <h4 className="font-medium text-gray-900 mb-2 line-clamp-2 text-sm md:text-base">
                          {doc.title}
                        </h4>

                        {/* Tags */}
                        {doc.tags && doc.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2 md:mb-3">
                            {doc.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                              >
                                <Tag className="w-2 h-2 mr-1" />
                                <span>{tag}</span>
                              </span>
                            ))}
                            {doc.tags.length > 2 && (
                              <span className="text-xs text-gray-500">+{doc.tags.length - 2}</span>
                            )}
                          </div>
                        )}

                        <div className="space-y-1 text-xs text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                          </div>
                          <div>
                            Size: {formatFileSize(doc.file_size)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}