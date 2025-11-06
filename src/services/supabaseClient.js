import { createClient } from '@supabase/supabase-js'
import { handleAuthError } from './authService'

// Initialize Supabase client - SINGLE INSTANCE for entire application
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create single instance of Supabase client with proper configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We handle session manually via localStorage
    autoRefreshToken: false // We handle token refresh manually
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  },
  db: {
    schema: 'public'
  }
})

// Note: Removed the global error handler wrapper as it was breaking Promise chains
// Auth errors are now handled at the service level in authService.js


