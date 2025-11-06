import { supabase } from './supabaseClient'

/**
 * Get current user data from localStorage
 * @returns {Object|null} User data object or null
 */
function getCurrentUser() {
  const userData = localStorage.getItem('user_data')
  if (!userData) return null
  
  try {
    return JSON.parse(userData)
  } catch (error) {
    console.error('Error parsing user data:', error)
    return null
  }
}

/**
 * Check if current user is IT_ADMIN
 * @returns {boolean} True if user is IT_ADMIN
 */
function isITAdmin() {
  const user = getCurrentUser()
  return user?.role === 'IT_ADMIN'
}

/**
 * Get available roles from permissions table
 * @returns {Promise<Array>} Array of role objects
 */
export async function getAvailableRoles() {
  try {
    const { data: roles, error } = await supabase
      .from('permissions')
      .select('role')
      .order('role')

    if (error) {
      console.error('Error fetching roles:', error)
      return []
    }

    return roles.map(r => r.role)
  } catch (error) {
    console.error('Error fetching roles:', error)
    return []
  }
}

/**
 * Create a new user in the system
 * CRITICAL: Uses the current user's companyId to ensure multi-tenant isolation
 * Only IT_ADMIN users can create new users
 * 
 * @param {string} email - User's email address
 * @param {string} password - Temporary password (will be hashed)
 * @param {string} role - User role (must exist in permissions table)
 * @returns {Promise<Object>} Success object with user data or error object
 */
export async function createUser(email, password, role) {
  try {
    // Security check: Verify user is IT_ADMIN
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!isITAdmin()) {
      return {
        success: false,
        error: 'Unauthorized: Only IT_ADMIN users can create new users'
      }
    }

    // Get companyId from current user session (CRITICAL for multi-tenant isolation)
    const companyId = currentUser.company_id

    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Validate inputs
    if (!email || !password || !role) {
      return {
        success: false,
        error: 'Email, password, and role are required'
      }
    }

    // Verify email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return {
        success: false,
        error: 'Invalid email format'
      }
    }

    // Check if role exists in permissions table
    const { data: roleCheck, error: roleError } = await supabase
      .from('permissions')
      .select('role')
      .eq('role', role)
      .single()

    if (roleError || !roleCheck) {
      return {
        success: false,
        error: `Invalid role: ${role}. Role must exist in permissions table.`
      }
    }

    // Check if email already exists (globally unique constraint)
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('email', email)
      .maybeSingle()

    // If user exists (not an error, but actual data), reject
    if (existingUser && !checkError) {
      return {
        success: false,
        error: 'Email already exists in the system'
      }
    }

    // Hash password using Supabase RPC function
    // This calls a database function that securely hashes the password using bcrypt
    const { data: passwordHash, error: hashError } = await supabase
      .rpc('hash_password', {
        plain_password: password
      })

    if (hashError || !passwordHash) {
      console.error('Password hashing error:', hashError)
      return {
        success: false,
        error: 'Failed to hash password. Please try again.'
      }
    }

    // Insert new user with company_id from current session (ensures tenant isolation)
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        company_id: companyId, // CRITICAL: Uses IT_ADMIN's company_id
        email: email,
        password_hash: passwordHash, // Hashed password from database function
        role: role
      })
      .select()
      .single()

    if (insertError) {
      console.error('User creation error:', insertError)
      
      // Check for specific error types
      if (insertError.code === '23505') { // Unique violation
        return {
          success: false,
          error: 'Email already exists in the system'
        }
      }
      
      if (insertError.code === '23503') { // Foreign key violation
        return {
          success: false,
          error: 'Invalid role or company ID'
        }
      }

      return {
        success: false,
        error: insertError.message || 'Failed to create user'
      }
    }

    // Trigger automation for USER_CREATED event
    try {
      const { executeAutomation } = await import('./itService.js')
      await executeAutomation('USER_CREATED', {
        user_id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        company_id: newUser.company_id
      })
    } catch (error) {
      // Don't fail user creation if automation fails
      console.error('Automation execution error:', error)
    }

    // Return success (exclude password_hash from response)
    return {
      success: true,
      user: {
        id: newUser.id,
        company_id: newUser.company_id,
        email: newUser.email,
        role: newUser.role,
        created_at: newUser.created_at
      },
      message: 'User created successfully'
    }
  } catch (error) {
    console.error('Create user error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating user'
    }
  }
}

/**
 * Get all users in the current company (tenant isolation)
 * @returns {Promise<Object>} Success object with users array or error object
 */
export async function getCompanyUsers() {
  try {
    // Security check: Verify user is IT_ADMIN
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!isITAdmin()) {
      return {
        success: false,
        error: 'Unauthorized: Only IT_ADMIN users can view users'
      }
    }

    const companyId = currentUser.company_id

    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Fetch all users for the current company (tenant isolation) with job titles
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        role,
        job_title_id,
        created_at,
        job_titles:job_title_id(id, title_name, department, level)
      `)
      .eq('company_id', companyId) // CRITICAL: Only get users from same company
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching users:', error)
      return {
        success: false,
        error: 'Failed to fetch users'
      }
    }

    return {
      success: true,
      users: users || []
    }
  } catch (error) {
    console.error('Get users error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching users'
    }
  }
}

/**
 * Update a user's information
 * Only IT_ADMIN can update users
 * @param {string} userId - User ID to update
 * @param {Object} data - Update data (role, job_title_id, password)
 * @returns {Promise<Object>} Success object with updated user or error object
 */
export async function updateUser(userId, data) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!isITAdmin()) {
      return {
        success: false,
        error: 'Unauthorized: Only IT_ADMIN users can update users'
      }
    }

    const companyId = currentUser.company_id
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Verify the user to update belongs to the same company (security check)
    const { data: targetUser, error: checkError } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('id', userId)
      .eq('company_id', companyId)
      .single()

    if (checkError || !targetUser) {
      return {
        success: false,
        error: 'User not found or access denied'
      }
    }

    // Build update object
    const updateData = {}

    // Update role if provided
    if (data.role !== undefined) {
      // Validate role exists in permissions table
      const { data: roleCheck, error: roleError } = await supabase
        .from('permissions')
        .select('role')
        .eq('role', data.role)
        .single()

      if (roleError || !roleCheck) {
        return {
          success: false,
          error: `Invalid role: ${data.role}. Role must exist in permissions table.`
        }
      }

      updateData.role = data.role
    }

    // Update job_title_id if provided
    if (data.job_title_id !== undefined) {
      if (data.job_title_id !== null) {
        // Verify job title belongs to the same company
        const { data: jobTitle, error: jobTitleError } = await supabase
          .from('job_titles')
          .select('id, company_id')
          .eq('id', data.job_title_id)
          .eq('company_id', companyId)
          .single()

        if (jobTitleError || !jobTitle) {
          return {
            success: false,
            error: 'Job title not found or does not belong to your company'
          }
        }
      }

      updateData.job_title_id = data.job_title_id
    }

    // Update password if provided
    if (data.password && data.password.trim().length > 0) {
      // Hash new password
      const { data: passwordHash, error: hashError } = await supabase
        .rpc('hash_password', {
          plain_password: data.password
        })

      if (hashError || !passwordHash) {
        console.error('Password hashing error:', hashError)
        return {
          success: false,
          error: 'Failed to hash password. Please try again.'
        }
      }

      updateData.password_hash = passwordHash
    }

    // If no valid updates, return error
    if (Object.keys(updateData).length === 0) {
      return {
        success: false,
        error: 'No valid fields to update'
      }
    }

    // Update user
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .eq('company_id', companyId) // CRITICAL: Ensure tenant isolation
      .select(`
        id,
        email,
        role,
        job_title_id,
        created_at,
        job_titles:job_title_id(id, title_name, department, level)
      `)
      .single()

    if (error) {
      console.error('User update error:', error)
      return {
        success: false,
        error: error.message || 'Failed to update user'
      }
    }

    return {
      success: true,
      user: updatedUser,
      message: 'User updated successfully'
    }
  } catch (error) {
    console.error('Update user error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating user'
    }
  }
}

