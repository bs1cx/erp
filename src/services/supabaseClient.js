import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client - SINGLE INSTANCE for entire application
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

// Create single instance of Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)


