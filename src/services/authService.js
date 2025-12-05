import { supabase } from './supabaseClient'

/**
 * Authenticates a user with company code, email, and password
 * @param {string} companyCode - The company code identifier
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {Promise<Object>} Success object with token and user data, or error object
 */
export async function login(companyCode, email, password) {
  try {
    // First, verify the company exists
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('company_code', companyCode)
      .single()

    if (companyError || !company) {
      return {
        success: false,
        error: 'Invalid company code'
      }
    }

    // Find user by email and company_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, company_id, email, role, password_hash')
      .eq('email', email)
      .eq('company_id', company.id)
      .single()

    if (userError || !user) {
      return {
        success: false,
        error: 'Invalid email or password'
      }
    }

    // Verify password using Supabase RPC function
    // This calls a database function that securely verifies the password hash
    const { data: passwordValid, error: verifyError } = await supabase
      .rpc('verify_user_password', {
        user_email: email,
        user_company_id: company.id,
        plain_password: password
      })

    if (verifyError || !passwordValid) {
      return {
        success: false,
        error: 'Invalid email or password'
      }
    }

    // Get permissions from job title roles (if user has a job title)
    let mergedPermissions = {}
    
    if (user.job_title_id) {
      // Fetch all roles assigned to this job title
      const { data: roleAssignments, error: rolesError } = await supabase
        .from('job_role_assignments')
        .select('role_name')
        .eq('job_title_id', user.job_title_id)

      if (!rolesError && roleAssignments && roleAssignments.length > 0) {
        // Get all unique role names
        const roleNames = [...new Set(roleAssignments.map(a => a.role_name))]
        
        // Fetch permissions for all assigned roles
        const { data: permissions, error: permsError } = await supabase
          .from('permissions')
          .select('*')
          .in('role', roleNames)

        if (!permsError && permissions && permissions.length > 0) {
          // Merge permissions from all roles (OR logic: if any role has permission, grant it)
          mergedPermissions = {
            module_hr_read: permissions.some(p => p.module_hr_read === true),
            module_hr_write: permissions.some(p => p.module_hr_write === true),
            access_hr: permissions.some(p => p.access_hr === true)
          }
        }
      }
    }

    // If no job title or no permissions found, fall back to user's direct role
    if (Object.keys(mergedPermissions).length === 0 && user.role) {
      const { data: directPermission, error: directPermError } = await supabase
        .from('permissions')
        .select('*')
        .eq('role', user.role)
        .single()

      if (!directPermError && directPermission) {
        mergedPermissions = {
          module_hr_read: directPermission.module_hr_read || false,
          module_hr_write: directPermission.module_hr_write || false,
          access_hr: directPermission.access_hr || false
        }
      }
    }

    // Generate a session token using Supabase Auth
    // Create a custom JWT token with user data and merged permissions
    // For production, you should use Supabase's built-in auth or generate secure JWT tokens
    const token = await generateSessionToken(user, mergedPermissions)

    if (!token) {
      return {
        success: false,
        error: 'Failed to create session token'
      }
    }

    // Record attendance (login time)
    try {
      await recordAttendanceLogin(user.id, user.company_id)
    } catch (attendanceError) {
      // Log error but don't fail login if attendance recording fails
      console.error('Error recording attendance login:', attendanceError)
    }

    // Return success with user data, token, and permissions
    return {
      success: true,
      token: token,
      user: {
        id: user.id,
        company_id: user.company_id,
        email: user.email,
        role: user.role,
        job_title_id: user.job_title_id,
        permissions: mergedPermissions
      }
    }
  } catch (error) {
    console.error('Login error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred during login'
    }
  }
}

/**
 * Alternative login method using direct password verification
 * Use this if you're storing password hashes in your users table
 * and want to verify them directly (not using Supabase Auth)
 */
export async function loginWithPasswordHash(companyCode, email, password) {
  try {
    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('company_code', companyCode)
      .single()

    if (companyError || !company) {
      return {
        success: false,
        error: 'Invalid company code'
      }
    }

    // Find user by email and company_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, company_id, email, role, password_hash')
      .eq('email', email)
      .eq('company_id', company.id)
      .single()

    if (userError || !user) {
      return {
        success: false,
        error: 'Invalid email or password'
      }
    }

    // Verify password using bcrypt (you'll need to implement this on the backend)
    // For now, we'll use Supabase Edge Function or RPC call
    // This is a placeholder - implement proper password verification
    const { data: verifyResult, error: verifyError } = await supabase
      .rpc('verify_password', {
        password_hash: user.password_hash,
        plain_password: password
      })

    if (verifyError || !verifyResult) {
      return {
        success: false,
        error: 'Invalid email or password'
      }
    }

    // Create a session token (you may need to use Supabase Auth or JWT)
    // For now, return user data - implement proper token generation
    const token = await generateSessionToken(user)

    return {
      success: true,
      token: token,
      user: {
        id: user.id,
        company_id: user.company_id,
        email: user.email,
        role: user.role
      }
    }
  } catch (error) {
    console.error('Login error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred during login'
    }
  }
}

/**
 * Generate a session token for the user
 * Uses Supabase RPC to generate a secure JWT token
 * @param {Object} user - User object
 * @param {Object} permissions - Merged permissions object
 */
async function generateSessionToken(user, permissions = {}) {
  try {
    // Call Supabase RPC to generate a custom JWT token
    // This function should be created in your Supabase database
    const { data: tokenData, error } = await supabase
      .rpc('generate_user_token', {
        user_id: user.id,
        user_email: user.email,
        company_id: user.company_id,
        user_role: user.role
      })

    if (error || !tokenData) {
      console.error('Token generation error:', error)
      // Fallback: Create a simple token (NOT SECURE for production)
      // In production, you MUST use proper JWT generation
      return btoa(JSON.stringify({
        userId: user.id,
        email: user.email,
        companyId: user.company_id,
        role: user.role,
        job_title_id: user.job_title_id,
        permissions: permissions,
        exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      }))
    }

    // Merge permissions into token data
    const tokenWithPermissions = {
      ...tokenData,
      permissions: permissions,
      job_title_id: user.job_title_id
    }

    // Token data is a JSON object, encode it as a base64 string
    // In production, use proper JWT signing
    return btoa(JSON.stringify(tokenWithPermissions))
  } catch (error) {
    console.error('Token generation error:', error)
    // Fallback token (NOT SECURE - implement proper JWT in production)
    return btoa(JSON.stringify({
      userId: user.id,
      email: user.email,
      companyId: user.company_id,
      role: user.role,
      job_title_id: user.job_title_id,
      permissions: permissions,
      exp: Date.now() + (24 * 60 * 60 * 1000)
    }))
  }
}

/**
 * Record attendance login
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 */
async function recordAttendanceLogin(userId, companyId) {
  try {
    const { supabase } = await import('./supabaseClient')
    
    // First, close any existing active sessions for this user (safety measure)
    const { error: updateError } = await supabase
      .from('attendance_records')
      .update({
        logout_time: new Date().toISOString(),
        is_active: false,
        notes: 'Auto-closed on new login'
      })
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .eq('is_active', true)

    // Log update errors but don't fail
    if (updateError) {
      console.warn('Error closing existing attendance sessions:', updateError)
    }

    // Get client IP and user agent if available
    const ipAddress = typeof window !== 'undefined' ? null : null // Server-side only
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null

    // Insert new attendance record
    const { error: insertError } = await supabase
      .from('attendance_records')
      .insert({
        user_id: userId,
        company_id: companyId,
        login_time: new Date().toISOString(),
        is_active: true,
        ip_address: ipAddress,
        user_agent: userAgent
      })

    if (insertError) {
      console.error('Error recording attendance login:', insertError)
    }
  } catch (error) {
    console.error('Error in recordAttendanceLogin:', error)
    // Don't throw - attendance recording should not block login
  }
}

/**
 * Record attendance logout
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 */
async function recordAttendanceLogout(userId, companyId) {
  try {
    const { supabase } = await import('./supabaseClient')
    
    // Find the latest active session for this user
    const { data: activeSession, error: findError } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('login_time', { ascending: false })
      .limit(1)
      .maybeSingle() // Use maybeSingle() instead of single() to avoid errors when no record exists

    if (findError) {
      console.warn('Error finding active attendance session:', findError)
      return
    }

    if (!activeSession || !activeSession.id) {
      console.warn('No active attendance session found for user:', userId)
      return
    }

    // Update the session with logout time
    const { error: updateError } = await supabase
      .from('attendance_records')
      .update({
        logout_time: new Date().toISOString(),
        is_active: false,
        notes: 'Manual logout'
      })
      .eq('id', activeSession.id)

    if (updateError) {
      console.error('Error recording attendance logout:', updateError)
    }
  } catch (error) {
    console.error('Error in recordAttendanceLogout:', error)
    // Don't throw - attendance recording should not block logout
  }
}

/**
 * Logout the current user
 */
export async function logout() {
  try {
    const currentUser = getCurrentUser()
    const companyId = currentUser?.company_id

    // Record attendance logout before clearing session
    if (currentUser && companyId) {
      await recordAttendanceLogout(currentUser.id, companyId)
    }
    // Clear stored token
    removeAuthToken()
    localStorage.removeItem('user_data')
    
    // Sign out from Supabase if using Supabase Auth
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Logout error:', error)
      // Still return success since we cleared local storage
    }
    return { success: true }
  } catch (error) {
    console.error('Logout error:', error)
    // Clear local storage even if there's an error
    removeAuthToken()
    localStorage.removeItem('user_data')
    return { success: true }
  }
}

/**
 * Get the current user session
 */
export async function getCurrentUser() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) {
    return null
  }
  return session.user
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
  const token = localStorage.getItem('auth_token')
  return !!token
}

/**
 * Get stored auth token
 * Uses in-memory cache to avoid excessive localStorage access
 */
let tokenCache = null
let tokenCacheTime = null
const TOKEN_CACHE_DURATION = 60000 // 1 minute cache

export function getAuthToken() {
  // Use cached token if available and recent
  if (tokenCache && tokenCacheTime && (Date.now() - tokenCacheTime) < TOKEN_CACHE_DURATION) {
    return tokenCache
  }
  
  // Fetch from localStorage and cache
  tokenCache = localStorage.getItem('auth_token')
  tokenCacheTime = Date.now()
  return tokenCache
}

/**
 * Store auth token
 * Updates both localStorage and cache
 */
export function setAuthToken(token) {
  localStorage.setItem('auth_token', token)
  tokenCache = token
  tokenCacheTime = Date.now()
}

/**
 * Remove auth token
 * Clears both localStorage and cache
 */
export function removeAuthToken() {
  localStorage.removeItem('auth_token')
  tokenCache = null
  tokenCacheTime = null
}

/**
 * Validate token expiration
 * @returns {boolean} True if token is valid and not expired
 */
export function isTokenValid() {
  const token = getAuthToken()
  if (!token) return false

  try {
    // Decode token (base64 encoded JSON)
    const tokenData = JSON.parse(atob(token))
    
    // Check expiration (exp is in milliseconds)
    if (tokenData.exp && tokenData.exp < Date.now()) {
      return false
    }
    
    // Check if token is nearing expiry (within 5 minutes)
    const fiveMinutes = 5 * 60 * 1000
    if (tokenData.exp && (tokenData.exp - Date.now()) < fiveMinutes) {
      // Token is valid but expiring soon - could trigger refresh here
      return true // Still valid, but caller should handle refresh
    }
    
    return true
  } catch (error) {
    console.error('Error validating token:', error)
    return false
  }
}

/**
 * Check if token is nearing expiration (within 5 minutes)
 * @returns {boolean} True if token expires soon
 */
export function isTokenExpiringSoon() {
  const token = getAuthToken()
  if (!token) return false

  try {
    const tokenData = JSON.parse(atob(token))
    if (!tokenData.exp) return false
    
    const fiveMinutes = 5 * 60 * 1000
    return (tokenData.exp - Date.now()) < fiveMinutes
  } catch (error) {
    return false
  }
}

/**
 * Handle 401/403 errors by checking token and prompting re-login if needed
 * @param {Error} error - API error object
 * @returns {Promise<boolean>} True if error was handled, false otherwise
 */
export async function handleAuthError(error) {
  // Check for 401 (Unauthorized) or 403 (Forbidden) errors
  if (error?.status === 401 || error?.status === 403 || error?.code === 'PGRST301') {
    // Token is invalid or expired
    const tokenValid = isTokenValid()
    
    if (!tokenValid) {
      // Token is invalid - clear session and redirect to login
      await logout()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      return true
    }
    
    // Token is valid but request was rejected - might be permission issue
    return false
  }
  
  return false
}

