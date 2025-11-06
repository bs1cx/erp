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

// Add global error handler for auth errors
// This intercepts Supabase errors and handles 401/403 responses
const originalFrom = supabase.from.bind(supabase)
supabase.from = function(table) {
  const query = originalFrom(table)
  
  // Wrap methods that return promises to handle auth errors
  const methodsToWrap = ['select', 'insert', 'update', 'delete', 'upsert']
  
  methodsToWrap.forEach(method => {
    const originalMethod = query[method]
    if (originalMethod && typeof originalMethod === 'function') {
      query[method] = function(...args) {
        const result = originalMethod.apply(this, args)
        
        // If result is a promise, add error handling
        if (result && typeof result.then === 'function') {
          return result.catch(async (error) => {
            // Handle authentication errors
            const handled = await handleAuthError(error)
            if (handled) {
              // Error was handled (user redirected to login)
              throw new Error('Session expired. Please log in again.')
            }
            // Re-throw original error if not handled
            throw error
          })
        }
        
        return result
      }
    }
  })
  
  return query
}


