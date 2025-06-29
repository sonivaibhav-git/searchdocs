import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing')
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing')
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

// Validate URL format
try {
  new URL(supabaseUrl)
} catch (error) {
  console.error('Invalid Supabase URL format:', supabaseUrl)
  throw new Error('Invalid Supabase URL format. Please check your VITE_SUPABASE_URL in .env file.')
}

// Log the configuration (without exposing sensitive data)
console.log('Supabase configuration:')
console.log('URL:', supabaseUrl)
console.log('Anon Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'Missing')

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

export type Document = {
  id: string
  title: string
  content: string
  file_type: string
  file_size: number
  created_at: string
  updated_at: string
  user_id: string
  file_url?: string
  metadata?: any
  is_public: boolean
  tags: string[]
}

export type UserProfile = {
  id: string
  user_id: string
  username: string
  display_name?: string
  bio?: string
  avatar_url?: string
  last_username_change: string
  created_at: string
  updated_at: string
}

export type DocumentWithProfile = Document & {
  user_profiles?: UserProfile
}

// Test the connection with better error handling
const testConnection = async () => {
  try {
    console.log('Testing Supabase connection...')
    
    // Test basic connectivity
    const { data, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Supabase connection error:', error)
      return false
    }
    
    console.log('Supabase connected successfully')
    if (data.session) {
      console.log('Existing session found for:', data.session.user.email)
    }
    
    // Test database connectivity
    const { data: testData, error: testError } = await supabase
      .from('documents')
      .select('count')
      .limit(1)
      .single()
    
    if (testError && testError.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine
      console.error('Database connection test failed:', testError)
      return false
    }
    
    console.log('Database connection test passed')
    return true
    
  } catch (error) {
    console.error('Connection test failed:', error)
    return false
  }
}

// Run connection test
testConnection().then(success => {
  if (!success) {
    console.warn('Supabase connection test failed. Please check your environment variables and network connection.')
  }
})