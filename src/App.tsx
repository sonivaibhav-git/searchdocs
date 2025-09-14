import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { RoleProvider } from './contexts/RoleContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './components/Toast'
import { AuthForm } from './components/AuthForm'
import { RoleDashboard } from './components/RoleDashboard'
import { RoleBasedUpload } from './components/RoleBasedUpload'
import { DocumentViewerPage } from './components/DocumentViewerPage'
import { useRole } from './contexts/RoleContext'
import { Users, Upload, FileText, BarChart3, LogOut, User, ChevronDown } from 'lucide-react'
import { ThemeToggle } from './components/ThemeToggle'
import { ProfilePage } from './components/ProfilePage'

function AppContent() {
  const { user, loading, signOut } = useAuth()
  const { currentRole, userRoles, setCurrentRole } = useRole()
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [showProfile, setShowProfile] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)

  // Fetch user profile to get username
  React.useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        try {
          const { supabase } = await import('./lib/supabase')
          const { data, error } = await supabase
            .from('user_profiles')
            .select('username, display_name')
            .eq('user_id', user.id)
            .single()

          if (!error && data) {
            setUserProfile(data)
          }
        } catch (error) {
          console.error('Error fetching user profile:', error)
        }
      }
    }

    fetchUserProfile()
  }, [user?.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors duration-200">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    )
  }

  if (!user) {
    return <AuthForm />
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'upload', label: 'Upload', icon: Upload },
    { id: 'documents', label: 'Documents', icon: FileText },
  ]

  const displayName = userProfile?.username || user?.email || 'User'

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <RoleDashboard />
      case 'upload':
        return <RoleBasedUpload />
      case 'documents':
        return <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">Documents View</h3>
          <p className="text-gray-600 dark:text-gray-400">Document management interface coming soon</p>
        </div>
      default:
        return <RoleDashboard />
    }
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <div className="min-h-screen bg-gray-50 dark:bg-dark-bg pb-20 md:pb-0 transition-colors duration-200">
            {/* Desktop Header */}
            <header className="bg-white dark:bg-dark-card shadow-sm border-b border-gray-200 dark:border-gray-700 hidden md:block transition-colors duration-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                  <div className="flex items-center space-x-8">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="w-8 h-8 text-blue-600 dark:text-accent-primary" />
                      <h1 className="text-xl font-bold text-gray-900 dark:text-dark-text">Metro Operations</h1>
                    </div>
                    
                    <nav className="flex space-x-6">
                      {navItems.map((item) => {
                        const Icon = item.icon
                        return (
                          <button
                            key={item.id}
                            onClick={() => setCurrentPage(item.id)}
                            className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                              currentPage === item.id
                                ? 'bg-blue-50 dark:bg-accent-primary/20 text-blue-700 dark:text-accent-primary'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-search'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{item.label}</span>
                          </button>
                        )
                      })}
                    </nav>
                  </div>

                  <div className="flex items-center space-x-3">
                    {/* Role Switcher */}
                    {userRoles.length > 1 && currentRole && (
                      <select
                        value={currentRole.role_code}
                        onChange={(e) => {
                          const role = userRoles.find(r => r.role_code === e.target.value)
                          if (role) setCurrentRole(role)
                        }}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-dark-search text-gray-900 dark:text-dark-text focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary text-sm"
                      >
                        {userRoles.map(role => (
                          <option key={role.role_code} value={role.role_code}>
                            {role.role_name}
                          </option>
                        ))}
                      </select>
                    )}

                    <ThemeToggle size="md" />
                    
                    <div className="relative">
                      <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-search rounded-md px-3 py-2 transition-colors"
                      >
                        <User className="w-4 h-4" />
                        <span className="max-w-32 truncate">@{displayName}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showDropdown && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-card rounded-md shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-50">
                          <button
                            onClick={() => {
                              setShowProfile(true)
                              setShowDropdown(false)
                            }}
                            className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-search transition-colors"
                          >
                            <User className="w-4 h-4" />
                            <span>View Profile</span>
                          </button>
                          
                          <div className="border-t border-gray-100 dark:border-gray-600 my-1"></div>
                          
                          <button
                            onClick={() => {
                              handleSignOut()
                              setShowDropdown(false)
                            }}
                            className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-600 dark:text-accent-warning hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </header>

            {/* Mobile Header */}
            <header className="bg-white dark:bg-dark-card shadow-sm border-b border-gray-200 dark:border-gray-700 md:hidden sticky top-0 z-40 transition-colors duration-200">
              <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="w-6 h-6 text-blue-600 dark:text-accent-primary" />
                    <h1 className="text-lg font-bold text-gray-900 dark:text-dark-text">Metro Ops</h1>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <ThemeToggle size="sm" />
                    
                    <div className="relative">
                      <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-dark-text rounded-md px-2 py-1 transition-colors"
                      >
                        <User className="w-4 h-4" />
                        <ChevronDown className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showDropdown && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-card rounded-md shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-50">
                          <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-600 truncate">
                            @{displayName}
                          </div>
                          {currentRole && (
                            <div className="px-4 py-2 text-xs text-blue-600 dark:text-accent-primary border-b border-gray-100 dark:border-gray-600">
                              {currentRole.role_name}
                            </div>
                          )}
                          <button
                            onClick={() => {
                              setShowProfile(true)
                              setShowDropdown(false)
                            }}
                            className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-search transition-colors"
                          >
                            <User className="w-4 h-4" />
                            <span>View Profile</span>
                          </button>
                          
                          <div className="border-t border-gray-100 dark:border-gray-600 my-1"></div>
                          
                          <button
                            onClick={() => {
                              handleSignOut()
                              setShowDropdown(false)
                            }}
                            className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-600 dark:text-accent-warning hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </header>

            {showDropdown && (
              <div 
                className="fixed inset-0 z-30" 
                onClick={() => setShowDropdown(false)}
              ></div>
            )}

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
              {renderPage()}
            </main>

            {/* Mobile Bottom Navigation */}
            <nav 
              data-bottom-nav
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-dark-card border-t border-gray-200 dark:border-gray-700 md:hidden z-50 safe-area-inset-bottom transition-colors duration-200"
            >
              <div className="grid grid-cols-3 h-16">
                {navItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      onClick={() => setCurrentPage(item.id)}
                      className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
                        currentPage === item.id
                          ? 'text-blue-600 dark:text-accent-primary bg-blue-50 dark:bg-accent-primary/20'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-search'
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
        } />
        
        <Route path="/document/:documentId" element={<DocumentViewerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showProfile && (
        <ProfilePage
          onClose={() => setShowProfile(false)}
        />
      )}
    </Router>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RoleProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </RoleProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App