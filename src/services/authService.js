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
            module_finance_read: permissions.some(p => p.module_finance_read === true),
            module_finance_write: permissions.some(p => p.module_finance_write === true),
            module_it_read: permissions.some(p => p.module_it_read === true),
            module_it_write: permissions.some(p => p.module_it_write === true),
            access_hr: permissions.some(p => p.access_hr === true),
            access_finance: permissions.some(p => p.access_finance === true),
            access_it: permissions.some(p => p.access_it === true)
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
          module_finance_read: directPermission.module_finance_read || false,
          module_finance_write: directPermission.module_finance_write || false,
          module_it_read: directPermission.module_it_read || false,
          module_it_write: directPermission.module_it_write || false,
          access_hr: directPermission.access_hr || false,
          access_finance: directPermission.access_finance || false,
          access_it: directPermission.access_it || false
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
 * Logout the current user
 */
export async function logout() {
  try {
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
 */
export function getAuthToken() {
  return localStorage.getItem('auth_token')
}

/**
 * Store auth token
 */
export function setAuthToken(token) {
  localStorage.setItem('auth_token', token)
}

/**
 * Remove auth token
 */
export function removeAuthToken() {
  localStorage.removeItem('auth_token')
}

