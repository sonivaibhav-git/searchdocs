import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Search, Upload, LogOut, User, FileText, ChevronDown } from 'lucide-react'
import { ProfilePage } from './ProfilePage'

interface LayoutProps {
  children: React.ReactNode
  currentPage?: string
  onPageChange?: (page: string) => void
}

export function Layout({ children, currentPage = 'search', onPageChange }: LayoutProps) {
  const { user, signOut } = useAuth()
  const [showProfile, setShowProfile] = React.useState(false)
  const [showDropdown, setShowDropdown] = React.useState(false)

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const navItems = [
    { id: 'search', label: 'Search', icon: Search },
    { id: 'upload', label: 'Upload', icon: Upload },
    { id: 'documents', label: 'My Documents', icon: FileText },
  ]

  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
        {/* Desktop Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 hidden md:block">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-8">
                <div className="flex items-center space-x-2">
                  <Search className="w-8 h-8 text-blue-600" />
                  <h1 className="text-xl font-bold text-gray-900">DeepSearch</h1>
                </div>
                
                <nav className="flex space-x-6">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        onClick={() => onPageChange?.(item.id)}
                        className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          currentPage === item.id
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    )
                  })}
                </nav>
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md px-3 py-2 transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span className="max-w-32 truncate">{user?.email}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                    <button
                      onClick={() => {
                        setShowProfile(true)
                        setShowDropdown(false)
                      }}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      <span>View Profile</span>
                    </button>
                    
                    <div className="border-t border-gray-100 my-1"></div>
                    
                    <button
                      onClick={() => {
                        handleSignOut()
                        setShowDropdown(false)
                      }}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 md:hidden sticky top-0 z-40">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Search className="w-6 h-6 text-blue-600" />
                <h1 className="text-lg font-bold text-gray-900">DeepSearch</h1>
              </div>
              
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900 rounded-md px-2 py-1 transition-colors"
                >
                  <User className="w-4 h-4" />
                  <ChevronDown className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                    <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100 truncate">
                      {user?.email}
                    </div>
                    <button
                      onClick={() => {
                        setShowProfile(true)
                        setShowDropdown(false)
                      }}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      <span>View Profile</span>
                    </button>
                    
                    <div className="border-t border-gray-100 my-1"></div>
                    
                    <button
                      onClick={() => {
                        handleSignOut()
                        setShowDropdown(false)
                      }}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Click outside to close dropdown */}
        {showDropdown && (
          <div 
            className="fixed inset-0 z-30" 
            onClick={() => setShowDropdown(false)}
          ></div>
        )}

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
          {children}
        </main>

        {/* Mobile Bottom Navigation - Fixed with proper z-index */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50 safe-area-inset-bottom">
          <div className="grid grid-cols-3 h-16">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => onPageChange?.(item.id)}
                  className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
                    currentPage === item.id
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      </div>

      {/* Profile Modal */}
      {showProfile && (
        <ProfilePage
          onClose={() => setShowProfile(false)}
        />
      )}
    </>
  )
}