import React, { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './components/Toast'
import { AuthForm } from './components/AuthForm'
import { Layout } from './components/Layout'
import { SearchPage } from './components/SearchPage'
import { UploadPage } from './components/UploadPage'
import { DocumentsPage } from './components/DocumentsPage'

function AppContent() {
  const { user, loading } = useAuth()
  const [currentPage, setCurrentPage] = useState('search')

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return <AuthForm />
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'search':
        return <SearchPage />
      case 'upload':
        return <UploadPage />
      case 'documents':
        return <DocumentsPage />
      default:
        return <SearchPage />
    }
  }

  return (
    <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
      {renderPage()}
    </Layout>
  )
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  )
}

export default App