import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './components/Toast'
import { AuthForm } from './components/AuthForm'
import { Layout } from './components/Layout'
import { SearchPage } from './components/SearchPage'
import { UploadPage } from './components/UploadPage'
import { DocumentsPage } from './components/DocumentsPage'
import { DocumentViewerPage } from './components/DocumentViewerPage'

function AppContent() {
  const { user, loading } = useAuth()
  const [currentPage, setCurrentPage] = useState('search')
  const [isViewerOpen, setIsViewerOpen] = useState(false)

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

  const renderPage = () => {
    switch (currentPage) {
      case 'search':
        return <SearchPage onViewerStateChange={setIsViewerOpen} />
      case 'upload':
        return <UploadPage />
      case 'documents':
        return <DocumentsPage onViewerStateChange={setIsViewerOpen} />
      default:
        return <SearchPage onViewerStateChange={setIsViewerOpen} />
    }
  }

  return (
    <Router>
      <Routes>
        {/* Main app routes */}
        <Route path="/" element={
          <Layout 
            currentPage={currentPage} 
            onPageChange={setCurrentPage}
            hideBottomNav={isViewerOpen}
          >
            {renderPage()}
          </Layout>
        } />
        
        {/* Document viewer route for shared links */}
        <Route path="/document/:documentId" element={<DocumentViewerPage />} />
        
        {/* Redirect any unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App