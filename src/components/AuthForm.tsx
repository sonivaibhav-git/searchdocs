import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Search, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

export function AuthForm() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { signIn, signUp } = useAuth()

  const validateForm = () => {
    if (!email.trim()) {
      setError('Email is required')
      return false
    }
    
    if (!email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address')
      return false
    }
    
    if (!password) {
      setError('Password is required')
      return false
    }
    
    if (isSignUp && password.length < 6) {
      setError('Password must be at least 6 characters long')
      return false
    }
    
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (isSignUp) {
        await signUp(email, password)
        setSuccess('Account created successfully! You are now signed in.')
      } else {
        await signIn(email, password)
        setSuccess('Signed in successfully!')
      }
    } catch (err: any) {
      console.error('Auth error:', err)
      
      // Handle specific error messages
      let errorMessage = 'An error occurred'
      
      if (err.message) {
        if (err.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password'
        } else if (err.message.includes('Email not confirmed')) {
          errorMessage = 'Please check your email and confirm your account'
        } else if (err.message.includes('User already registered')) {
          errorMessage = 'An account with this email already exists'
        } else if (err.message.includes('Password should be at least')) {
          errorMessage = 'Password must be at least 6 characters long'
        } else if (err.message.includes('Unable to validate email address')) {
          errorMessage = 'Please enter a valid email address'
        } else {
          errorMessage = err.message
        }
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleModeSwitch = () => {
    setIsSignUp(!isSignUp)
    setError('')
    setSuccess('')
    setEmail('')
    setPassword('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-dark-bg dark:to-dark-card flex items-center justify-center px-4 transition-colors duration-200">
      {/* Theme Toggle - Positioned absolutely */}
      <div className="absolute top-4 right-4">
        <ThemeToggle size="md" />
      </div>

      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <Search className="w-12 h-12 text-blue-600 dark:text-accent-primary" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-dark-text">DeepSearch</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        <div className="bg-white dark:bg-dark-card py-8 px-6 shadow-lg rounded-lg border border-gray-200 dark:border-gray-600 transition-colors duration-200">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center space-x-2 text-red-600 dark:text-accent-warning bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-200 dark:border-red-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center space-x-2 text-green-600 dark:text-accent-success bg-green-50 dark:bg-green-900/20 p-3 rounded-md border border-green-200 dark:border-green-800">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{success}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-dark-search text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-blue-500 dark:focus:border-accent-primary transition-colors"
                placeholder="Enter your email"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-dark-search text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-blue-500 dark:focus:border-accent-primary transition-colors"
                  placeholder={isSignUp ? "Create a password (min 6 characters)" : "Enter your password"}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" />
                  )}
                </button>
              </div>
              {isSignUp && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Password must be at least 6 characters long
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 dark:bg-accent-primary hover:bg-blue-700 dark:hover:bg-accent-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-accent-primary dark:focus:ring-offset-dark-card disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{isSignUp ? 'Creating account...' : 'Signing in...'}</span>
                </div>
              ) : (
                isSignUp ? 'Create Account' : 'Sign In'
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleModeSwitch}
                disabled={loading}
                className="text-sm text-blue-600 dark:text-accent-primary hover:text-blue-500 dark:hover:text-accent-primary/80 transition-colors disabled:opacity-50"
              >
                {isSignUp
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            By signing up, you agree to our terms of service and privacy policy
          </p>
        </div>
      </div>
    </div>
  )
}