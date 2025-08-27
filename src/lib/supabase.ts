import { createClient } from '@supabase/supabase-js'

// Declare supabase client at module level
let supabase: any

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = `
Missing Supabase environment variables. Please:
1. Create a .env file in your project root
2. Add the following variables:
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
3. Restart your development server

Current status:
- VITE_SUPABASE_URL: ${supabaseUrl ? 'Set' : 'Missing'}
- VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'Set' : 'Missing'}
  `
  console.error(errorMessage)
  
  // Create a mock client that will show helpful error messages
  const mockClient = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: { message: 'Supabase not configured' } }),
      signInWithPassword: () => Promise.reject(new Error('Please configure Supabase environment variables')),
      signUp: () => Promise.reject(new Error('Please configure Supabase environment variables')),
      signOut: () => Promise.reject(new Error('Please configure Supabase environment variables')),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: () => ({
      select: () => Promise.reject(new Error('Please configure Supabase environment variables')),
      insert: () => Promise.reject(new Error('Please configure Supabase environment variables')),
      update: () => Promise.reject(new Error('Please configure Supabase environment variables')),
      delete: () => Promise.reject(new Error('Please configure Supabase environment variables'))
    }),
    storage: {
      from: () => ({
        upload: () => Promise.reject(new Error('Please configure Supabase environment variables')),
        getPublicUrl: () => ({ data: { publicUrl: '' } })
      })
    }
  }
  
  // Assign the mock client to prevent app crashes
  supabase = mockClient as any
  
  // Stop execution here
  throw new Error('Supabase configuration required')
}

// Validate URL format
try {
  new URL(supabaseUrl)
} catch (error) {
  console.error('Invalid Supabase URL format:', supabaseUrl)
  const mockClient = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: { message: 'Invalid Supabase URL' } }),
      signInWithPassword: () => Promise.reject(new Error('Invalid Supabase URL format')),
      signUp: () => Promise.reject(new Error('Invalid Supabase URL format')),
      signOut: () => Promise.reject(new Error('Invalid Supabase URL format')),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: () => ({
      select: () => Promise.reject(new Error('Invalid Supabase URL format')),
      insert: () => Promise.reject(new Error('Invalid Supabase URL format')),
      update: () => Promise.reject(new Error('Invalid Supabase URL format')),
      delete: () => Promise.reject(new Error('Invalid Supabase URL format'))
    }),
    storage: {
      from: () => ({
        upload: () => Promise.reject(new Error('Invalid Supabase URL format')),
        getPublicUrl: () => ({ data: { publicUrl: '' } })
      })
    }
  }
  
  supabase = mockClient as any
  throw new Error('Invalid Supabase URL format. Please check your VITE_SUPABASE_URL in .env file.')
}

supabase = createClient(supabaseUrl, supabaseAnonKey, {
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

// Export the supabase client
export { supabase }

// Log the configuration (without exposing sensitive data)
console.log('Supabase configuration:')
console.log('URL:', supabaseUrl)
console.log('Anon Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'Missing')

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
    console.log('✅ Testing Supabase connection...')
    
    // Test basic connectivity
    const { data, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('❌ Supabase connection error:', error)
      return false
    }
    
    console.log('✅ Supabase connected successfully')
    if (data.session) {
      console.log('👤 Existing session found for:', data.session.user.email)
    }
    
    // Test database connectivity
    const { data: testData, error: testError } = await supabase
      .from('documents')
      .select('count')
      .limit(1)
      .single()
    
    if (testError && testError.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine
      console.error('❌ Database connection test failed:', testError)
      return false
    }
    
    console.log('✅ Database connection test passed')
    return true
    
  } catch (error) {
    console.error('❌ Connection test failed:', error)
    return false
  }
}

// Run connection test
testConnection().then(success => {
  if (!success) {
    console.warn('⚠️ Supabase connection test failed. Please check your environment variables and network connection.')
  }
})