import { supabase } from './supabaseClient'

/**
 * Get current user data from localStorage
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
 * Get company ID from current user session
 */
function getCompanyId() {
  const currentUser = getCurrentUser()
  return currentUser?.company_id || null
}

/**
 * Check if current user has HR permissions
 */
function hasHRPermission() {
  const permissions = localStorage.getItem('user_permissions')
  if (!permissions) return false
  
  try {
    const perms = JSON.parse(permissions)
    return perms.module_hr_read === true || perms.access_hr === true
  } catch (error) {
    return false
  }
}

/**
 * Check if current user can write HR data
 */
function canWriteHR() {
  const permissions = localStorage.getItem('user_permissions')
  if (!permissions) return false
  
  try {
    const perms = JSON.parse(permissions)
    return perms.module_hr_write === true || perms.access_hr === true
  } catch (error) {
    return false
  }
}

// ============================================================================
// EMPLOYEE MANAGEMENT
// ============================================================================

/**
 * Create a new employee profile
 * CRITICAL: Creates records in both users and employee_details tables within a transaction
 * @param {Object} data - Employee data (email must exist as user)
 * @returns {Promise<Object>} Success object or error object
 */
export async function createEmployee(data) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteHR()) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to create employees'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Find user by email (user must already exist)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('email', data.email)
      .eq('company_id', companyId)
      .single()

    if (userError || !user) {
      return {
        success: false,
        error: 'User not found. Please create the user account first.'
      }
    }

    // Build user update object
    const userUpdateData = {}
    if (data.first_name !== undefined) userUpdateData.first_name = data.first_name?.trim() || null
    if (data.last_name !== undefined) userUpdateData.last_name = data.last_name?.trim() || null
    if (data.department !== undefined) userUpdateData.department = data.department?.trim() || null
    if (data.salary !== undefined) userUpdateData.salary = data.salary ? parseFloat(data.salary) : null
    if (data.annual_leave_days !== undefined) userUpdateData.annual_leave_days = parseInt(data.annual_leave_days) || 20
    userUpdateData.used_leave_days = 0

    // Update user with HR profile data
    const { data: updatedUser, error: userUpdateError } = await supabase
      .from('users')
      .update(userUpdateData)
      .eq('id', user.id)
      .eq('company_id', companyId)
      .select(`
        id,
        email,
        first_name,
        last_name,
        department,
        salary,
        annual_leave_days,
        used_leave_days,
        job_title_id,
        job_titles:job_title_id(title_name)
      `)
      .single()

    if (userUpdateError) {
      console.error('Employee creation error:', userUpdateError)
      return {
        success: false,
        error: userUpdateError.message || 'Failed to create employee profile'
      }
    }

    // Create or update employee_details (sensitive data)
    const employeeDetailsData = {
      user_id: user.id,
      company_id: companyId,
      date_of_birth: data.date_of_birth || null,
      marital_status: data.marital_status?.trim() || null,
      driving_license_status: data.driving_license_status?.trim() || null,
      military_service_status: data.military_service_status?.trim() || null,
      medical_conditions: data.medical_conditions?.trim() || null,
      emergency_contact_name: data.emergency_contact_name?.trim() || null,
      emergency_contact_phone: data.emergency_contact_phone?.trim() || null,
      emergency_contact_relationship: data.emergency_contact_relationship?.trim() || null
    }

    // Use upsert to handle both insert and update
    const { error: detailsError } = await supabase
      .from('employee_details')
      .upsert(employeeDetailsData, {
        onConflict: 'user_id'
      })

    if (detailsError) {
      console.error('Employee details creation error:', detailsError)
      // Don't fail the entire operation, but log the error
      // The user table was updated successfully
    }

    // Log audit entry for employee creation
    await logAuditAction(
      companyId,
      currentUser.id,
      'EMPLOYEE_CREATED',
      null,
      {
        user_id: user.id,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        department: updatedUser.department,
        salary: updatedUser.salary
      },
      user.id
    )

    return {
      success: true,
      employee: updatedUser
    }
  } catch (error) {
    console.error('Create employee error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating employee'
    }
  }
}

/**
 * Get comprehensive employee profile
 * Joins users, employee_details, job_titles, and departments
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Success object with full profile or error object
 */
export async function getEmployeeProfile(userId) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!hasHRPermission()) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to view employee profiles'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Fetch user with all related data
    const { data: employee, error: employeeError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        first_name,
        last_name,
        department,
        salary,
        annual_leave_days,
        used_leave_days,
        job_title_id,
        created_at,
        job_titles:job_title_id(
          id,
          title_name,
          department,
          level
        )
      `)
      .eq('id', userId)
      .eq('company_id', companyId)
      .single()

    if (employeeError || !employee) {
      return {
        success: false,
        error: 'Employee not found or access denied'
      }
    }

    // Fetch employee_details (sensitive data)
    const { data: employeeDetails, error: detailsError } = await supabase
      .from('employee_details')
      .select('*')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .single()

    // Combine user and details data
    const fullProfile = {
      ...employee,
      details: employeeDetails || null,
      // Calculate age from date_of_birth
      age: employeeDetails?.date_of_birth 
        ? Math.floor((new Date() - new Date(employeeDetails.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000))
        : null
    }

    return {
      success: true,
      employee: fullProfile
    }
  } catch (error) {
    console.error('Get employee profile error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching employee profile'
    }
  }
}

/**
 * Update employee profile
 * Updates both users and employee_details tables
 * @param {string} userId - User ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Success object or error object
 */
export async function updateEmployeeProfile(userId, data) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteHR()) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to update employees'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Verify user belongs to the company
    const { data: user, error: checkError } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('id', userId)
      .eq('company_id', companyId)
      .single()

    if (checkError || !user) {
      return {
        success: false,
        error: 'Employee not found or access denied'
      }
    }

    // Build user update object
    const userUpdateData = {}
    if (data.first_name !== undefined) userUpdateData.first_name = data.first_name?.trim() || null
    if (data.last_name !== undefined) userUpdateData.last_name = data.last_name?.trim() || null
    if (data.department !== undefined) userUpdateData.department = data.department?.trim() || null
    if (data.salary !== undefined) userUpdateData.salary = data.salary ? parseFloat(data.salary) : null
    if (data.annual_leave_days !== undefined) userUpdateData.annual_leave_days = parseInt(data.annual_leave_days)
    if (data.used_leave_days !== undefined) userUpdateData.used_leave_days = parseInt(data.used_leave_days)
    if (data.job_title_id !== undefined) userUpdateData.job_title_id = data.job_title_id || null

    // Update user table
    let updatedEmployee = null
    if (Object.keys(userUpdateData).length > 0) {
      const { data: updated, error: userUpdateError } = await supabase
        .from('users')
        .update(userUpdateData)
        .eq('id', userId)
        .eq('company_id', companyId)
        .select(`
          id,
          email,
          first_name,
          last_name,
          department,
          salary,
          annual_leave_days,
          used_leave_days,
          job_title_id,
          job_titles:job_title_id(title_name, department, level)
        `)
        .single()

      if (userUpdateError) {
        console.error('Employee update error:', userUpdateError)
        return {
          success: false,
          error: userUpdateError.message || 'Failed to update employee profile'
        }
      }
      updatedEmployee = updated
    }

    // Build employee_details update object
    const detailsUpdateData = {}
    if (data.date_of_birth !== undefined) detailsUpdateData.date_of_birth = data.date_of_birth || null
    if (data.marital_status !== undefined) detailsUpdateData.marital_status = data.marital_status?.trim() || null
    if (data.driving_license_status !== undefined) detailsUpdateData.driving_license_status = data.driving_license_status?.trim() || null
    if (data.military_service_status !== undefined) detailsUpdateData.military_service_status = data.military_service_status?.trim() || null
    if (data.medical_conditions !== undefined) detailsUpdateData.medical_conditions = data.medical_conditions?.trim() || null
    if (data.emergency_contact_name !== undefined) detailsUpdateData.emergency_contact_name = data.emergency_contact_name?.trim() || null
    if (data.emergency_contact_phone !== undefined) detailsUpdateData.emergency_contact_phone = data.emergency_contact_phone?.trim() || null
    if (data.emergency_contact_relationship !== undefined) detailsUpdateData.emergency_contact_relationship = data.emergency_contact_relationship?.trim() || null

    // Update or insert employee_details
    if (Object.keys(detailsUpdateData).length > 0) {
      const { error: detailsError } = await supabase
        .from('employee_details')
        .upsert({
          user_id: userId,
          company_id: companyId,
          ...detailsUpdateData
        }, {
          onConflict: 'user_id'
        })

      if (detailsError) {
        console.error('Employee details update error:', detailsError)
        // Don't fail if details update fails, but log it
      }
    }

    // Log audit entry for sensitive updates
    const oldData = {
      department: user.department,
      salary: user.salary,
      annual_leave_days: user.annual_leave_days,
      used_leave_days: user.used_leave_days
    }
    
    const newData = {
      department: userUpdateData.department !== undefined ? userUpdateData.department : user.department,
      salary: userUpdateData.salary !== undefined ? userUpdateData.salary : user.salary,
      annual_leave_days: userUpdateData.annual_leave_days !== undefined ? userUpdateData.annual_leave_days : user.annual_leave_days,
      used_leave_days: userUpdateData.used_leave_days !== undefined ? userUpdateData.used_leave_days : user.used_leave_days
    }

    // Determine action type
    let action = 'EMPLOYEE_UPDATED'
    if (userUpdateData.salary !== undefined && userUpdateData.salary !== user.salary) {
      action = 'SALARY_UPDATED'
    }

    // Log audit entry
    await logAuditAction(companyId, currentUser.id, action, oldData, newData, userId)

    // Get full updated profile
    const profileResult = await getEmployeeProfile(userId)
    if (profileResult.success) {
      return {
        success: true,
        employee: profileResult.employee
      }
    }

    return {
      success: true,
      employee: updatedEmployee
    }
  } catch (error) {
    console.error('Update employee error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating employee'
    }
  }
}

/**
 * Get all employees for the current company with pagination and filtering
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 50)
 * @param {Object} filters - Filter options (name, department, job_title_id)
 * @returns {Promise<Object>} Success object with employees array, pagination info, or error object
 */
export async function getAllCompanyEmployees(page = 1, limit = 50, filters = {}) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!hasHRPermission()) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to view employees'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Calculate offset
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('users')
      .select(`
        id,
        email,
        first_name,
        last_name,
        department,
        salary,
        annual_leave_days,
        used_leave_days,
        created_at,
        job_title_id,
        job_titles:job_title_id(title_name, department, level)
      `, { count: 'exact' })
      .eq('company_id', companyId)

    // Apply filters
    if (filters.name) {
      const nameFilter = filters.name.trim().toLowerCase()
      query = query.or(`first_name.ilike.%${nameFilter}%,last_name.ilike.%${nameFilter}%,email.ilike.%${nameFilter}%`)
    }

    if (filters.department) {
      query = query.eq('department', filters.department)
    }

    if (filters.job_title_id) {
      query = query.eq('job_title_id', filters.job_title_id)
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: employees, error, count } = await query

    if (error) {
      console.error('Error fetching employees:', error)
      // Return empty array on error to prevent frontend crashes
      return {
        success: false,
        error: error.message || 'Failed to fetch employees',
        employees: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false
        }
      }
    }

    // Ensure employees is always an array
    const employeesArray = Array.isArray(employees) ? employees : []

    // Add full_name field (concatenated first_name + last_name)
    const employeesWithFullName = employeesArray.map(emp => {
      try {
        return {
          ...emp,
          full_name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email || 'Unknown'
        }
      } catch (mapError) {
        console.error('Error mapping employee:', mapError, emp)
        return {
          ...emp,
          full_name: emp.email || 'Unknown'
        }
      }
    })

    // Calculate pagination info
    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)

    return {
      success: true,
      employees: employeesWithFullName,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }
  } catch (error) {
    console.error('Get employees error:', error)
    // Always return a valid structure even on unexpected errors
    return {
      success: false,
      error: 'An unexpected error occurred while fetching employees',
      employees: [],
      pagination: {
        page: 1,
        limit,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false
      }
    }
  }
}

/**
 * Get all job titles for the current company
 * @returns {Promise<Object>} Success object with jobTitles array or error object
 */
export async function getCompanyJobTitles() {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Fetch job titles for the company
    const { data: jobTitles, error } = await supabase
      .from('job_titles')
      .select('*')
      .eq('company_id', companyId)
      .order('title_name', { ascending: true })

    if (error) {
      console.error('Error fetching job titles:', error)
      return {
        success: false,
        error: error.message || 'Failed to fetch job titles'
      }
    }

    return {
      success: true,
      jobTitles: jobTitles || []
    }
  } catch (error) {
    console.error('Get company job titles error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching job titles'
    }
  }
}

/**
 * Terminate employee (Employee Separation)
 * Calls IT automation for EMPLOYEE_TERMINATED event
 * @param {string} userId - User ID
 * @param {string} reason - Termination reason
 * @returns {Promise<Object>} Success object or error object
 */
export async function terminateEmployee(userId, reason) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteHR()) {
      return {
        success: false,
        error: 'Unauthorized: Only HR Managers can terminate employees'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Verify employee belongs to the company
    const { data: employee, error: checkError } = await supabase
      .from('users')
      .select('id, company_id, email, first_name, last_name')
      .eq('id', userId)
      .eq('company_id', companyId)
      .single()

    if (checkError || !employee) {
      return {
        success: false,
        error: 'Employee not found or access denied'
      }
    }

    // Get employee data for audit log
    const { data: fullEmployee } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    // Log audit entry before termination
    await logAuditAction(
      companyId,
      currentUser.id,
      'USER_TERMINATED',
      fullEmployee ? { ...fullEmployee } : null,
      { termination_reason: reason || 'Not specified' },
      userId
    )

    // Note: Automation removed with IT module

    // Note: In a production system, you might want to:
    // - Mark user as inactive/deleted
    // - Archive employee data
    // - Revoke access to systems
    // For now, we just trigger the automation

    return {
      success: true,
      message: 'Employee termination processed. Automation triggered.'
    }
  } catch (error) {
    console.error('Terminate employee error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while terminating employee'
    }
  }
}

// ============================================================================
// LEAVE MANAGEMENT
// ============================================================================

/**
 * Submit a leave request
 * @param {Object} data - Leave request data
 * @returns {Promise<Object>} Success object or error object
 */
export async function submitLeaveRequest(data) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Validate dates
    const startDate = new Date(data.start_date)
    const endDate = new Date(data.end_date)
    
    if (endDate < startDate) {
      return {
        success: false,
        error: 'End date must be after start date'
      }
    }

    // Get user's leave balance
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('annual_leave_days, used_leave_days')
      .eq('id', currentUser.id)
      .eq('company_id', companyId)
      .single()

    if (userError || !user) {
      return {
        success: false,
        error: 'User not found'
      }
    }

    // Calculate leave days (using RPC function if available, otherwise simple calculation)
    const { data: leaveDays, error: calcError } = await supabase
      .rpc('calculate_leave_days', {
        start_date: data.start_date,
        end_date: data.end_date
      })

    const daysRequested = leaveDays || Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1

    // Check if user has enough leave balance (only for Annual leave)
    if (data.type === 'Annual') {
      const availableDays = (user.annual_leave_days || 20) - (user.used_leave_days || 0)
      if (daysRequested > availableDays) {
        return {
          success: false,
          error: `Insufficient leave balance. Available: ${availableDays} days, Requested: ${daysRequested} days`
        }
      }
    }

    // Insert leave request
    const { data: newRequest, error } = await supabase
      .from('leave_requests')
      .insert({
        user_id: currentUser.id,
        company_id: companyId,
        start_date: data.start_date,
        end_date: data.end_date,
        type: data.type,
        reason: data.reason?.trim() || null,
        status: 'Pending'
      })
      .select(`
        id,
        start_date,
        end_date,
        type,
        status,
        reason,
        created_at,
        users:user_id(email, annual_leave_days, used_leave_days)
      `)
      .single()

    if (error) {
      console.error('Leave request submission error:', error)
      return {
        success: false,
        error: error.message || 'Failed to submit leave request'
      }
    }

    return {
      success: true,
      request: newRequest
    }
  } catch (error) {
    console.error('Submit leave request error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while submitting leave request'
    }
  }
}

/**
 * Get pending leave requests for HR Manager approval
 * @returns {Promise<Object>} Success object with requests array or error object
 */
export async function getPendingLeaveRequests() {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!hasHRPermission()) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to view leave requests'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Fetch pending leave requests
    const { data: requests, error } = await supabase
      .from('leave_requests')
      .select(`
        id,
        start_date,
        end_date,
        type,
        status,
        reason,
        created_at,
        users:user_id(email, department, job_titles:job_title_id(title_name))
      `)
      .eq('company_id', companyId)
      .eq('status', 'Pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching leave requests:', error)
      return {
        success: false,
        error: 'Failed to fetch leave requests'
      }
    }

    return {
      success: true,
      requests: requests || []
    }
  } catch (error) {
    console.error('Get leave requests error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching leave requests'
    }
  }
}

/**
 * Approve a leave request
 * CRITICAL: This function must update used_leave_days in the users table
 * @param {string} requestId - Leave request ID
 * @param {number} duration - Number of days (optional, calculated if not provided)
 * @returns {Promise<Object>} Success object or error object
 */
export async function approveLeaveRequest(requestId, duration = null) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteHR()) {
      return {
        success: false,
        error: 'Unauthorized: Only HR Managers can approve leave requests'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Fetch leave request
    const { data: request, error: requestError } = await supabase
      .from('leave_requests')
      .select('id, user_id, start_date, end_date, type, status, company_id')
      .eq('id', requestId)
      .eq('company_id', companyId)
      .single()

    if (requestError || !request) {
      return {
        success: false,
        error: 'Leave request not found or access denied'
      }
    }

    if (request.status !== 'Pending') {
      return {
        success: false,
        error: 'Leave request has already been processed'
      }
    }

    // Calculate duration if not provided
    let leaveDays = duration
    if (!leaveDays) {
      const { data: calculatedDays, error: calcError } = await supabase
        .rpc('calculate_leave_days', {
          start_date: request.start_date,
          end_date: request.end_date
        })

      if (calcError) {
        // Fallback calculation
        const start = new Date(request.start_date)
        const end = new Date(request.end_date)
        leaveDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
      } else {
        leaveDays = calculatedDays || 1
      }
    }

    // Update leave request status
    const { error: updateError } = await supabase
      .from('leave_requests')
      .update({
        status: 'Approved',
        approved_by_user_id: currentUser.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .eq('company_id', companyId)

    if (updateError) {
      console.error('Leave request approval error:', updateError)
      return {
        success: false,
        error: 'Failed to approve leave request'
      }
    }

    // CRITICAL: Update used_leave_days in users table (only for Annual leave)
    if (request.type === 'Annual') {
      // Get current used_leave_days
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('used_leave_days')
        .eq('id', request.user_id)
        .eq('company_id', companyId)
        .single()

      if (userError || !user) {
        console.error('Error fetching user for leave update:', userError)
        // Don't fail the approval, but log the error
      } else {
        const newUsedDays = (user.used_leave_days || 0) + leaveDays

        const { error: userUpdateError } = await supabase
          .from('users')
          .update({
            used_leave_days: newUsedDays
          })
          .eq('id', request.user_id)
          .eq('company_id', companyId)

        if (userUpdateError) {
          console.error('Error updating used leave days:', userUpdateError)
          // Don't fail the approval, but log the error
        }
      }
    }

    return {
      success: true,
      message: 'Leave request approved successfully'
    }
  } catch (error) {
    console.error('Approve leave request error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while approving leave request'
    }
  }
}

/**
 * Reject a leave request
 * @param {string} requestId - Leave request ID
 * @returns {Promise<Object>} Success object or error object
 */
export async function rejectLeaveRequest(requestId) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteHR()) {
      return {
        success: false,
        error: 'Unauthorized: Only HR Managers can reject leave requests'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Fetch and verify leave request
    const { data: request, error: requestError } = await supabase
      .from('leave_requests')
      .select('id, status, company_id')
      .eq('id', requestId)
      .eq('company_id', companyId)
      .single()

    if (requestError || !request) {
      return {
        success: false,
        error: 'Leave request not found or access denied'
      }
    }

    if (request.status !== 'Pending') {
      return {
        success: false,
        error: 'Leave request has already been processed'
      }
    }

    // Update leave request status
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'Rejected',
        approved_by_user_id: currentUser.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .eq('company_id', companyId)

    if (error) {
      console.error('Leave request rejection error:', error)
      return {
        success: false,
        error: error.message || 'Failed to reject leave request'
      }
    }

    return {
      success: true,
      message: 'Leave request rejected'
    }
  } catch (error) {
    console.error('Reject leave request error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while rejecting leave request'
    }
  }
}

// ============================================================================
// RECRUITMENT
// ============================================================================
// NOTE: External integration with job boards (LinkedIn, Kariyer.net, etc.) is
// implemented as a secure API key configuration placeholder ready for integration
// via a dedicated microservice or third-party API wrapper. This is the standard
// enterprise architecture approach for scalable, secure integrations.

/**
 * Create a new job posting
 * @param {Object} data - Job posting data
 * @returns {Promise<Object>} Success object or error object
 */
export async function createJobPosting(data) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteHR()) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to create job postings'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Validate required fields
    if (!data.title || !data.description) {
      return {
        success: false,
        error: 'Title and description are required'
      }
    }

    // Insert job posting
    const { data: newPosting, error } = await supabase
      .from('job_postings')
      .insert({
        company_id: companyId,
        title: data.title.trim(),
        description: data.description.trim(),
        department: data.department?.trim() || null,
        status: data.status || 'Open',
        closing_date: data.closing_date || null,
        created_by_user_id: currentUser.id
      })
      .select()
      .single()

    if (error) {
      console.error('Job posting creation error:', error)
      return {
        success: false,
        error: error.message || 'Failed to create job posting'
      }
    }

    return {
      success: true,
      posting: newPosting
    }
  } catch (error) {
    console.error('Create job posting error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating job posting'
    }
  }
}

/**
 * Get all job postings for the current company
 * @returns {Promise<Object>} Success object with postings array or error object
 */
export async function getJobPostings() {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!hasHRPermission()) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to view job postings'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Fetch job postings with candidate counts
    const { data: postings, error } = await supabase
      .from('job_postings')
      .select(`
        id,
        title,
        description,
        department,
        status,
        posted_date,
        closing_date,
        created_at,
        users:created_by_user_id(email)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching job postings:', error)
      return {
        success: false,
        error: 'Failed to fetch job postings'
      }
    }

    // Get candidate counts for each posting
    const postingsWithCounts = await Promise.all(
      (postings || []).map(async (posting) => {
        const { count } = await supabase
          .from('candidates')
          .select('*', { count: 'exact', head: true })
          .eq('job_posting_id', posting.id)

        return {
          ...posting,
          candidate_count: count || 0
        }
      })
    )

    return {
      success: true,
      postings: postingsWithCounts
    }
  } catch (error) {
    console.error('Get job postings error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching job postings'
    }
  }
}

/**
 * Apply to a job (for future external integration)
 * @param {Object} data - Application data
 * @returns {Promise<Object>} Success object or error object
 */
export async function applyToJob(data) {
  try {
    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Verify job posting exists and is open
    const { data: posting, error: postingError } = await supabase
      .from('job_postings')
      .select('id, status, company_id')
      .eq('id', data.job_posting_id)
      .eq('company_id', companyId)
      .single()

    if (postingError || !posting) {
      return {
        success: false,
        error: 'Job posting not found'
      }
    }

    if (posting.status !== 'Open') {
      return {
        success: false,
        error: 'This job posting is no longer accepting applications'
      }
    }

    // Insert candidate application
    const { data: candidate, error } = await supabase
      .from('candidates')
      .insert({
        job_posting_id: data.job_posting_id,
        company_id: companyId,
        name: data.name.trim(),
        email: data.email.trim(),
        phone: data.phone?.trim() || null,
        resume_url: data.resume_url || null,
        status: 'Applied',
        notes: data.notes?.trim() || null
      })
      .select()
      .single()

    if (error) {
      console.error('Job application error:', error)
      return {
        success: false,
        error: error.message || 'Failed to submit application'
      }
    }

    return {
      success: true,
      candidate: candidate
    }
  } catch (error) {
    console.error('Apply to job error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while submitting application'
    }
  }
}

// ============================================================================
// PERFORMANCE REVIEWS
// ============================================================================

/**
 * Submit a performance review
 * @param {Object} data - Review data
 * @returns {Promise<Object>} Success object or error object
 */
export async function submitPerformanceReview(data) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteHR()) {
      return {
        success: false,
        error: 'Unauthorized: Only HR Managers can submit performance reviews'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Validate required fields
    if (!data.employee_user_id || !data.review_date || !data.rating || !data.summary) {
      return {
        success: false,
        error: 'Employee, review date, rating, and summary are required'
      }
    }

    // Validate rating (1-5)
    if (data.rating < 1 || data.rating > 5) {
      return {
        success: false,
        error: 'Rating must be between 1 and 5'
      }
    }

    // Verify employee belongs to the company
    const { data: employee, error: empError } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('id', data.employee_user_id)
      .eq('company_id', companyId)
      .single()

    if (empError || !employee) {
      return {
        success: false,
        error: 'Employee not found or access denied'
      }
    }

    // Insert performance review
    const { data: newReview, error } = await supabase
      .from('performance_reviews')
      .insert({
        employee_user_id: data.employee_user_id,
        company_id: companyId,
        reviewer_user_id: currentUser.id,
        review_date: data.review_date,
        rating: parseInt(data.rating),
        summary: data.summary.trim(),
        goals: data.goals?.trim() || null,
        achievements: data.achievements?.trim() || null,
        areas_for_improvement: data.areas_for_improvement?.trim() || null
      })
      .select(`
        id,
        review_date,
        rating,
        summary,
        created_at,
        employee:employee_user_id(email, job_titles:job_title_id(title_name)),
        reviewer:reviewer_user_id(email)
      `)
      .single()

    if (error) {
      console.error('Performance review submission error:', error)
      return {
        success: false,
        error: error.message || 'Failed to submit performance review'
      }
    }

    return {
      success: true,
      review: newReview
    }
  } catch (error) {
    console.error('Submit performance review error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while submitting performance review'
    }
  }
}

/**
 * Get performance review history for an employee
 * @param {string} userId - Employee user ID
 * @returns {Promise<Object>} Success object with reviews array or error object
 */
export async function getEmployeeReviewHistory(userId) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!hasHRPermission()) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to view performance reviews'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Verify employee belongs to the company
    const { data: employee, error: empError } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('id', userId)
      .eq('company_id', companyId)
      .single()

    if (empError || !employee) {
      return {
        success: false,
        error: 'Employee not found or access denied'
      }
    }

    // Fetch performance reviews
    const { data: reviews, error } = await supabase
      .from('performance_reviews')
      .select(`
        id,
        review_date,
        rating,
        summary,
        goals,
        achievements,
        areas_for_improvement,
        created_at,
        reviewer:reviewer_user_id(email)
      `)
      .eq('employee_user_id', userId)
      .eq('company_id', companyId)
      .order('review_date', { ascending: false })

    if (error) {
      console.error('Error fetching performance reviews:', error)
      return {
        success: false,
        error: 'Failed to fetch performance reviews'
      }
    }

    return {
      success: true,
      reviews: reviews || []
    }
  } catch (error) {
    console.error('Get review history error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching performance reviews'
    }
  }
}

// ============================================================================
// BULK ACTIONS
// ============================================================================

/**
 * Update multiple employees in bulk
 * @param {Array<string>} userIds - Array of user IDs
 * @param {Object} data - Update data (department, job_title_id, etc.)
 * @returns {Promise<Object>} Success object or error object
 */
export async function updateBulkEmployees(userIds, data) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteHR()) {
      return {
        success: false,
        error: 'Unauthorized: Only HR Managers can perform bulk updates'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    if (!userIds || userIds.length === 0) {
      return {
        success: false,
        error: 'No employees selected'
      }
    }

    // Build update object
    const updateData = {}
    if (data.department !== undefined) updateData.department = data.department?.trim() || null
    if (data.job_title_id !== undefined) updateData.job_title_id = data.job_title_id || null

    if (Object.keys(updateData).length === 0) {
      return {
        success: false,
        error: 'No valid fields to update'
      }
    }

    // Update all selected employees
    const { data: updatedEmployees, error } = await supabase
      .from('users')
      .update(updateData)
      .in('id', userIds)
      .eq('company_id', companyId)
      .select('id, email, first_name, last_name')

    if (error) {
      console.error('Bulk update error:', error)
      return {
        success: false,
        error: error.message || 'Failed to update employees'
      }
    }

    // Log audit entry for bulk update
    await logAuditAction(
      companyId,
      currentUser.id,
      'BULK_EMPLOYEE_UPDATED',
      { affected_users: userIds.length },
      { ...updateData, affected_users: userIds.length },
      null
    )

    return {
      success: true,
      updatedCount: updatedEmployees?.length || 0,
      employees: updatedEmployees || []
    }
  } catch (error) {
    console.error('Bulk update error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while performing bulk update'
    }
  }
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Log an audit action
 * @param {string} companyId - Company ID
 * @param {string} userId - User ID who performed the action
 * @param {string} action - Action type (e.g., 'SALARY_UPDATED')
 * @param {Object} oldData - Previous state (optional)
 * @param {Object} newData - New state (optional)
 * @param {string} targetUserId - Target user ID if applicable (optional)
 * @returns {Promise<Object>} Success object or error object
 */
export async function logAuditAction(companyId, userId, action, oldData = null, newData = null, targetUserId = null) {
  try {
    // Prepare audit data
    const auditData = {
      company_id: companyId,
      user_id: userId,
      action: action,
      module: 'HR',
      old_data: oldData ? JSON.parse(JSON.stringify(oldData)) : null,
      new_data: newData ? JSON.parse(JSON.stringify(newData)) : null
    }

    // Add target user ID to metadata if provided
    if (targetUserId) {
      auditData.new_data = auditData.new_data || {}
      auditData.new_data.target_user_id = targetUserId
    }

    // Insert audit log
    const { error } = await supabase
      .from('audit_logs')
      .insert(auditData)

    if (error) {
      console.error('Audit logging error:', error)
      // Don't fail the main operation if audit logging fails
      return {
        success: false,
        error: 'Failed to log audit entry'
      }
    }

    return {
      success: true
    }
  } catch (error) {
    console.error('Log audit action error:', error)
    // Don't fail the main operation
    return {
      success: false,
      error: 'An unexpected error occurred while logging audit entry'
    }
  }
}

/**
 * Get audit logs for HR module
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 50)
 * @param {Object} filters - Filter options (action, user_id, date_from, date_to)
 * @returns {Promise<Object>} Success object with audit logs or error object
 */
export async function getAuditLogs(page = 1, limit = 50, filters = {}) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteHR()) {
      return {
        success: false,
        error: 'Unauthorized: Only HR Managers can view audit logs'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Calculate offset
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('audit_logs')
      .select(`
        id,
        action,
        module,
        old_data,
        new_data,
        created_at,
        users:user_id(email, first_name, last_name)
      `, { count: 'exact' })
      .eq('company_id', companyId)
      .eq('module', 'HR')

    // Apply filters
    if (filters.action) {
      query = query.eq('action', filters.action)
    }

    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id)
    }

    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from)
    }

    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to)
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: logs, error, count } = await query

    if (error) {
      console.error('Error fetching audit logs:', error)
      return {
        success: false,
        error: 'Failed to fetch audit logs'
      }
    }

    // Calculate pagination info
    const totalPages = Math.ceil((count || 0) / limit)

    return {
      success: true,
      logs: logs || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }
  } catch (error) {
    console.error('Get audit logs error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching audit logs'
    }
  }
}

// ============================================================================
// EXPORT FUNCTIONALITY
// ============================================================================

/**
 * Export employees to CSV
 * @param {Object} filters - Filter options (same as getAllCompanyEmployees)
 * @returns {Promise<Object>} Success object with CSV data or error object
 */
export async function exportEmployeesToCSV(filters = {}) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!hasHRPermission()) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to export employees'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Fetch all employees (no pagination for export)
    const result = await getAllCompanyEmployees(1, 10000, filters)
    
    if (!result.success) {
      return result
    }

    const employees = result.employees || []

    // Generate CSV content
    const headers = [
      'Full Name',
      'Email',
      'Department',
      'Job Title',
      'Salary',
      'Annual Leave Days',
      'Used Leave Days',
      'Leave Balance',
      'Created At'
    ]

    const rows = employees.map(emp => [
      emp.full_name || emp.email,
      emp.email,
      emp.department || 'N/A',
      emp.job_titles?.title_name || 'Not assigned',
      emp.salary ? formatCurrency(emp.salary) : 'N/A',
      emp.annual_leave_days || 20,
      emp.used_leave_days || 0,
      (emp.annual_leave_days || 20) - (emp.used_leave_days || 0),
      emp.created_at ? new Date(emp.created_at).toLocaleDateString() : 'N/A'
    ])

    // Convert to CSV format
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    // Log export action
    await logAuditAction(
      companyId,
      currentUser.id,
      'EMPLOYEES_EXPORTED',
      null,
      { export_count: employees.length, filters: filters },
      null
    )

    return {
      success: true,
      csvContent: csvContent,
      filename: `employees_export_${new Date().toISOString().split('T')[0]}.csv`
    }
  } catch (error) {
    console.error('Export employees error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while exporting employees'
    }
  }
}

/**
 * Format currency for CSV export
 */
function formatCurrency(amount) {
  if (!amount) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(amount)
}

// ============================================================================
// PAYROLL MANAGEMENT
// ============================================================================

/**
 * Create a payroll record for an employee
 * @param {Object} data - Payroll data (user_id, period_start, period_end, gross_salary, etc.)
 * @returns {Promise<Object>} Success object or error object
 */
export async function createPayrollRecord(data) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteHR()) {
      return {
        success: false,
        error: 'Unauthorized: Only HR Managers can create payroll records'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Validate required fields
    if (!data.user_id || !data.period_start || !data.period_end || !data.gross_salary) {
      return {
        success: false,
        error: 'Missing required fields: user_id, period_start, period_end, and gross_salary are required'
      }
    }

    // Verify employee belongs to the company
    const { data: employee, error: empError } = await supabase
      .from('users')
      .select('id, company_id, salary')
      .eq('id', data.user_id)
      .eq('company_id', companyId)
      .single()

    if (empError || !employee) {
      return {
        success: false,
        error: 'Employee not found or access denied'
      }
    }

    // Calculate net salary if not provided
    const grossSalary = parseFloat(data.gross_salary) || 0
    const taxAmount = parseFloat(data.tax_amount) || (grossSalary * 0.20)
    const contributionAmount = parseFloat(data.contribution_amount) || (grossSalary * 0.10)
    const deductions = parseFloat(data.deductions) || 0
    const bonuses = parseFloat(data.bonuses) || 0
    const netSalary = grossSalary + bonuses - taxAmount - contributionAmount - deductions

    // Insert payroll record
    const { data: payrollRecord, error } = await supabase
      .from('payroll_records')
      .insert({
        user_id: data.user_id,
        company_id: companyId,
        period_start: data.period_start,
        period_end: data.period_end,
        gross_salary: grossSalary,
        net_salary: netSalary,
        tax_amount: taxAmount,
        contribution_amount: contributionAmount,
        deductions: deductions,
        bonuses: bonuses,
        status: data.status || 'Pending',
        payment_date: data.payment_date || null,
        payment_method: data.payment_method || null,
        notes: data.notes?.trim() || null,
        created_by_user_id: currentUser.id
      })
      .select()
      .single()

    if (error) {
      console.error('Payroll creation error:', error)
      return {
        success: false,
        error: error.message || 'Failed to create payroll record'
      }
    }

    // Log audit entry
    await logAuditAction(
      companyId,
      currentUser.id,
      'PAYROLL_CREATED',
      null,
      {
        payroll_id: payrollRecord.id,
        user_id: data.user_id,
        period_start: data.period_start,
        period_end: data.period_end,
        gross_salary: grossSalary,
        net_salary: netSalary
      },
      data.user_id
    )

    return {
      success: true,
      payrollRecord: payrollRecord
    }
  } catch (error) {
    console.error('Create payroll record error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating payroll record'
    }
  }
}

/**
 * Get payroll history for an employee
 * @param {string} userId - User ID
 * @param {number} limit - Number of records to retrieve (default: 12)
 * @returns {Promise<Object>} Success object with payroll records or error object
 */
export async function getEmployeePayrollHistory(userId, limit = 12) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!hasHRPermission()) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to view payroll records'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Verify employee belongs to the company
    const { data: employee, error: empError } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('id', userId)
      .eq('company_id', companyId)
      .single()

    if (empError || !employee) {
      return {
        success: false,
        error: 'Employee not found or access denied'
      }
    }

    // Fetch payroll records
    const { data: payrollRecords, error } = await supabase
      .from('payroll_records')
      .select(`
        id,
        period_start,
        period_end,
        gross_salary,
        net_salary,
        tax_amount,
        contribution_amount,
        deductions,
        bonuses,
        status,
        payment_date,
        payment_method,
        notes,
        created_at
      `)
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .order('period_start', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching payroll history:', error)
      return {
        success: false,
        error: 'Failed to fetch payroll history'
      }
    }

    return {
      success: true,
      payrollRecords: payrollRecords || []
    }
  } catch (error) {
    console.error('Get payroll history error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching payroll history'
    }
  }
}

/**
 * Get all payroll records for the company
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 50)
 * @param {Object} filters - Filter options (status, period_start, period_end, user_id)
 * @returns {Promise<Object>} Success object with payroll records and pagination or error object
 */
export async function getAllPayrollRecords(page = 1, limit = 50, filters = {}) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!hasHRPermission()) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to view payroll records'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Calculate offset
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('payroll_records')
      .select(`
        id,
        period_start,
        period_end,
        gross_salary,
        net_salary,
        tax_amount,
        contribution_amount,
        deductions,
        bonuses,
        status,
        payment_date,
        payment_method,
        notes,
        created_at,
        users:user_id(id, email, first_name, last_name)
      `, { count: 'exact' })
      .eq('company_id', companyId)

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id)
    }

    if (filters.period_start) {
      query = query.gte('period_start', filters.period_start)
    }

    if (filters.period_end) {
      query = query.lte('period_end', filters.period_end)
    }

    // Apply pagination and ordering
    query = query
      .order('period_start', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: payrollRecords, error, count } = await query

    if (error) {
      console.error('Error fetching payroll records:', error)
      return {
        success: false,
        error: 'Failed to fetch payroll records'
      }
    }

    // Calculate pagination info
    const totalPages = Math.ceil((count || 0) / limit)

    return {
      success: true,
      payrollRecords: payrollRecords || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }
  } catch (error) {
    console.error('Get payroll records error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching payroll records'
    }
  }
}

/**
 * Update payroll record status
 * @param {string} payrollId - Payroll record ID
 * @param {string} status - New status
 * @param {Object} additionalData - Additional data (payment_date, payment_method, notes)
 * @returns {Promise<Object>} Success object or error object
 */
export async function updatePayrollStatus(payrollId, status, additionalData = {}) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteHR()) {
      return {
        success: false,
        error: 'Unauthorized: Only HR Managers can update payroll records'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Build update object
    const updateData = {
      status: status
    }

    if (additionalData.payment_date) {
      updateData.payment_date = additionalData.payment_date
    }

    if (additionalData.payment_method) {
      updateData.payment_method = additionalData.payment_method
    }

    if (additionalData.notes !== undefined) {
      updateData.notes = additionalData.notes?.trim() || null
    }

    // Update payroll record
    const { data: updatedRecord, error } = await supabase
      .from('payroll_records')
      .update(updateData)
      .eq('id', payrollId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) {
      console.error('Payroll update error:', error)
      return {
        success: false,
        error: error.message || 'Failed to update payroll record'
      }
    }

    // Log audit entry
    await logAuditAction(
      companyId,
      currentUser.id,
      'PAYROLL_UPDATED',
      { status: 'Previous status' },
      { status: status, payroll_id: payrollId },
      updatedRecord.user_id
    )

    return {
      success: true,
      payrollRecord: updatedRecord
    }
  } catch (error) {
    console.error('Update payroll status error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating payroll record'
    }
  }
}

// ============================================================================
// BENEFITS MANAGEMENT
// ============================================================================

/**
 * Assign a benefit to an employee
 * @param {string} userId - User ID
 * @param {Object} data - Benefit data (benefit_type, monthly_amount, etc.)
 * @returns {Promise<Object>} Success object or error object
 */
export async function assignBenefit(userId, data) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteHR()) {
      return {
        success: false,
        error: 'Unauthorized: Only HR Managers can assign benefits'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Validate required fields
    if (!data.benefit_type || data.monthly_amount === undefined) {
      return {
        success: false,
        error: 'Benefit type and monthly amount are required'
      }
    }

    // Verify employee belongs to the company
    const { data: employee, error: empError } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('id', userId)
      .eq('company_id', companyId)
      .single()

    if (empError || !employee) {
      return {
        success: false,
        error: 'Employee not found or access denied'
      }
    }

    // Insert benefit
    const { data: benefit, error } = await supabase
      .from('employee_benefits')
      .insert({
        user_id: userId,
        company_id: companyId,
        benefit_type: data.benefit_type.trim(),
        monthly_amount: parseFloat(data.monthly_amount) || 0,
        is_active: data.is_active !== undefined ? data.is_active : true,
        start_date: data.start_date || new Date().toISOString().split('T')[0],
        end_date: data.end_date || null,
        provider: data.provider?.trim() || null,
        policy_number: data.policy_number?.trim() || null,
        notes: data.notes?.trim() || null,
        created_by_user_id: currentUser.id
      })
      .select()
      .single()

    if (error) {
      console.error('Benefit assignment error:', error)
      return {
        success: false,
        error: error.message || 'Failed to assign benefit'
      }
    }

    // Log audit entry
    await logAuditAction(
      companyId,
      currentUser.id,
      'BENEFIT_ASSIGNED',
      null,
      {
        benefit_id: benefit.id,
        benefit_type: benefit.benefit_type,
        monthly_amount: benefit.monthly_amount
      },
      userId
    )

    return {
      success: true,
      benefit: benefit
    }
  } catch (error) {
    console.error('Assign benefit error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while assigning benefit'
    }
  }
}

/**
 * Get all benefits for an employee
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Success object with benefits array or error object
 */
export async function getEmployeeBenefits(userId) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!hasHRPermission()) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to view benefits'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Fetch benefits
    const { data: benefits, error } = await supabase
      .from('employee_benefits')
      .select('*')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching benefits:', error)
      return {
        success: false,
        error: 'Failed to fetch benefits'
      }
    }

    return {
      success: true,
      benefits: benefits || []
    }
  } catch (error) {
    console.error('Get employee benefits error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching benefits'
    }
  }
}

/**
 * Update benefit status (activate/deactivate)
 * @param {string} benefitId - Benefit ID
 * @param {boolean} isActive - Active status
 * @returns {Promise<Object>} Success object or error object
 */
export async function updateBenefitStatus(benefitId, isActive) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteHR()) {
      return {
        success: false,
        error: 'Unauthorized: Only HR Managers can update benefits'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Get current benefit data for audit
    const { data: currentBenefit, error: fetchError } = await supabase
      .from('employee_benefits')
      .select('*')
      .eq('id', benefitId)
      .eq('company_id', companyId)
      .single()

    if (fetchError || !currentBenefit) {
      return {
        success: false,
        error: 'Benefit not found or access denied'
      }
    }

    // Update benefit status
    const { data: updatedBenefit, error } = await supabase
      .from('employee_benefits')
      .update({
        is_active: isActive,
        end_date: isActive ? null : new Date().toISOString().split('T')[0]
      })
      .eq('id', benefitId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) {
      console.error('Benefit update error:', error)
      return {
        success: false,
        error: error.message || 'Failed to update benefit'
      }
    }

    // Log audit entry
    await logAuditAction(
      companyId,
      currentUser.id,
      'BENEFIT_UPDATED',
      { is_active: currentBenefit.is_active },
      { is_active: isActive, benefit_id: benefitId },
      currentBenefit.user_id
    )

    return {
      success: true,
      benefit: updatedBenefit
    }
  } catch (error) {
    console.error('Update benefit status error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating benefit'
    }
  }
}

/**
 * Delete a benefit assignment
 * @param {string} benefitId - Benefit ID
 * @returns {Promise<Object>} Success object or error object
 */
export async function removeBenefit(benefitId) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteHR()) {
      return {
        success: false,
        error: 'Unauthorized: Only HR Managers can remove benefits'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Get benefit data for audit
    const { data: benefit, error: fetchError } = await supabase
      .from('employee_benefits')
      .select('*')
      .eq('id', benefitId)
      .eq('company_id', companyId)
      .single()

    if (fetchError || !benefit) {
      return {
        success: false,
        error: 'Benefit not found or access denied'
      }
    }

    // Delete benefit
    const { error } = await supabase
      .from('employee_benefits')
      .delete()
      .eq('id', benefitId)
      .eq('company_id', companyId)

    if (error) {
      console.error('Benefit deletion error:', error)
      return {
        success: false,
        error: error.message || 'Failed to remove benefit'
      }
    }

    // Log audit entry
    await logAuditAction(
      companyId,
      currentUser.id,
      'BENEFIT_REMOVED',
      { ...benefit },
      null,
      benefit.user_id
    )

    return {
      success: true
    }
  } catch (error) {
    console.error('Remove benefit error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while removing benefit'
    }
  }
}

// ============================================================================
// HR CALENDAR/PLANNER
// ============================================================================

/**
 * Create a calendar event
 * @param {Object} data - Event data (title, description, start_datetime, end_datetime, etc.)
 * @returns {Promise<Object>} Success object or error object
 */
export async function createCalendarEvent(data) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteHR()) {
      return {
        success: false,
        error: 'Unauthorized: Only HR Managers can create calendar events'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Validate required fields
    if (!data.title || !data.start_datetime || !data.end_datetime) {
      return {
        success: false,
        error: 'Title, start datetime, and end datetime are required'
      }
    }

    // Insert calendar event
    const { data: event, error } = await supabase
      .from('hr_calendar_events')
      .insert({
        company_id: companyId,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        start_datetime: data.start_datetime,
        end_datetime: data.end_datetime,
        assigned_user_id: data.assigned_user_id || null,
        event_type: data.event_type || 'General',
        location: data.location?.trim() || null,
        is_all_day: data.is_all_day || false,
        recurrence_pattern: data.recurrence_pattern || 'None',
        recurrence_end_date: data.recurrence_end_date || null,
        created_by_user_id: currentUser.id
      })
      .select()
      .single()

    if (error) {
      console.error('Calendar event creation error:', error)
      return {
        success: false,
        error: error.message || 'Failed to create calendar event'
      }
    }

    // Log audit entry
    await logAuditAction(
      companyId,
      currentUser.id,
      'CALENDAR_EVENT_CREATED',
      null,
      {
        event_id: event.id,
        title: event.title,
        start_datetime: event.start_datetime
      },
      null
    )

    return {
      success: true,
      event: event
    }
  } catch (error) {
    console.error('Create calendar event error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating calendar event'
    }
  }
}

/**
 * Get calendar events for a specific period
 * @param {string} startDate - Start date (ISO string)
 * @param {string} endDate - End date (ISO string)
 * @returns {Promise<Object>} Success object with events array or error object
 */
export async function getEventsForPeriod(startDate, endDate) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!hasHRPermission()) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to view calendar events'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Fetch calendar events for the period
    const { data: events, error } = await supabase
      .from('hr_calendar_events')
      .select(`
        id,
        title,
        description,
        start_datetime,
        end_datetime,
        assigned_user_id,
        event_type,
        location,
        is_all_day,
        recurrence_pattern,
        recurrence_end_date,
        created_at,
        users:assigned_user_id(id, email, first_name, last_name),
        creator:created_by_user_id(email)
      `)
      .eq('company_id', companyId)
      .gte('start_datetime', startDate)
      .lte('end_datetime', endDate)
      .order('start_datetime', { ascending: true })

    if (error) {
      console.error('Error fetching calendar events:', error)
      return {
        success: false,
        error: 'Failed to fetch calendar events'
      }
    }

    return {
      success: true,
      events: events || []
    }
  } catch (error) {
    console.error('Get events for period error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching calendar events'
    }
  }
}

/**
 * Update a calendar event
 * @param {string} eventId - Event ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Success object or error object
 */
export async function updateCalendarEvent(eventId, data) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteHR()) {
      return {
        success: false,
        error: 'Unauthorized: Only HR Managers can update calendar events'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Build update object
    const updateData = {}
    if (data.title !== undefined) updateData.title = data.title.trim()
    if (data.description !== undefined) updateData.description = data.description?.trim() || null
    if (data.start_datetime !== undefined) updateData.start_datetime = data.start_datetime
    if (data.end_datetime !== undefined) updateData.end_datetime = data.end_datetime
    if (data.assigned_user_id !== undefined) updateData.assigned_user_id = data.assigned_user_id || null
    if (data.event_type !== undefined) updateData.event_type = data.event_type
    if (data.location !== undefined) updateData.location = data.location?.trim() || null
    if (data.is_all_day !== undefined) updateData.is_all_day = data.is_all_day
    if (data.recurrence_pattern !== undefined) updateData.recurrence_pattern = data.recurrence_pattern
    if (data.recurrence_end_date !== undefined) updateData.recurrence_end_date = data.recurrence_end_date || null

    // Update event
    const { data: updatedEvent, error } = await supabase
      .from('hr_calendar_events')
      .update(updateData)
      .eq('id', eventId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) {
      console.error('Calendar event update error:', error)
      return {
        success: false,
        error: error.message || 'Failed to update calendar event'
      }
    }

    // Log audit entry
    await logAuditAction(
      companyId,
      currentUser.id,
      'CALENDAR_EVENT_UPDATED',
      null,
      { event_id: eventId, ...updateData },
      null
    )

    return {
      success: true,
      event: updatedEvent
    }
  } catch (error) {
    console.error('Update calendar event error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating calendar event'
    }
  }
}

/**
 * Delete a calendar event
 * @param {string} eventId - Event ID
 * @returns {Promise<Object>} Success object or error object
 */
export async function deleteCalendarEvent(eventId) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteHR()) {
      return {
        success: false,
        error: 'Unauthorized: Only HR Managers can delete calendar events'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Delete event
    const { error } = await supabase
      .from('hr_calendar_events')
      .delete()
      .eq('id', eventId)
      .eq('company_id', companyId)

    if (error) {
      console.error('Calendar event deletion error:', error)
      return {
        success: false,
        error: error.message || 'Failed to delete calendar event'
      }
    }

    // Log audit entry
    await logAuditAction(
      companyId,
      currentUser.id,
      'CALENDAR_EVENT_DELETED',
      { event_id: eventId },
      null,
      null
    )

    return {
      success: true
    }
  } catch (error) {
    console.error('Delete calendar event error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while deleting calendar event'
    }
  }
}

// ============================================================================
// SELF-SERVICE PORTAL
// ============================================================================

/**
 * Get employee's own profile (self-service)
 * @param {string} userId - User ID (should be current user)
 * @returns {Promise<Object>} Success object with profile or error object
 */
export async function getSelfProfile(userId) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    // Users can only view their own profile
    if (currentUser.id !== userId) {
      return {
        success: false,
        error: 'Unauthorized: You can only view your own profile'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Fetch user profile
    const result = await getEmployeeProfile(userId)
    if (result.success) {
      return {
        success: true,
        profile: result.employee
      }
    }

    return result
  } catch (error) {
    console.error('Get self profile error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching profile'
    }
  }
}

/**
 * Submit leave request as employee (self-service)
 * Creates request with manager_approval_status = 'Pending'
 * CRITICAL: Now validates against leave_types rules and available leave balance
 * @param {string} userId - User ID (should be current user)
 * @param {Object} data - Leave request data
 * @returns {Promise<Object>} Success object or error object
 */
export async function submitSelfLeaveRequest(userId, data) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    // Users can only submit requests for themselves
    if (currentUser.id !== userId) {
      return {
        success: false,
        error: 'Unauthorized: You can only submit leave requests for yourself'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Get user's manager
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, manager_id, annual_leave_days, used_leave_days')
      .eq('id', userId)
      .eq('company_id', companyId)
      .single()

    if (userError || !user) {
      return {
        success: false,
        error: 'User not found'
      }
    }

    // Validate required fields
    if (!data.start_date || !data.end_date || !data.type) {
      return {
        success: false,
        error: 'Start date, end date, and leave type are required'
      }
    }

    // Calculate requested leave days
    const startDate = new Date(data.start_date)
    const endDate = new Date(data.end_date)
    
    if (endDate < startDate) {
      return {
        success: false,
        error: 'End date must be after start date'
      }
    }

    // Calculate duration using RPC function or fallback
    const { data: leaveDays, error: calcError } = await supabase
      .rpc('calculate_leave_days', {
        start_date: data.start_date,
        end_date: data.end_date
      })

    const daysRequested = leaveDays || Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1

    // CRITICAL: Check leave type rules and available balance
    if (data.type === 'Annual' || data.type === 'Annual Leave') {
      // Get leave type configuration
      const { data: leaveType, error: leaveTypeError } = await supabase
        .from('leave_types')
        .select('max_days_per_year, name')
        .eq('company_id', companyId)
        .eq('name', 'Annual Leave')
        .eq('is_active', true)
        .single()

      let maxDays = 20 // Default
      if (!leaveTypeError && leaveType) {
        maxDays = leaveType.max_days_per_year
      } else {
        // Fallback to user's annual_leave_days
        maxDays = user.annual_leave_days || 20
      }

      // Calculate available days
      const availableDays = maxDays - (user.used_leave_days || 0)

      // Validate against available balance
      if (daysRequested > availableDays) {
        return {
          success: false,
          error: `Insufficient leave balance. Available: ${availableDays} days, Requested: ${daysRequested} days. Please adjust your request.`
        }
      }

      // Validate against max days per year
      if (daysRequested > maxDays) {
        return {
          success: false,
          error: `Request exceeds maximum allowed days per year (${maxDays} days). Requested: ${daysRequested} days.`
        }
      }
    } else {
      // For other leave types (Sick, Personal, etc.), check leave_types table
      const { data: leaveType, error: leaveTypeError } = await supabase
        .from('leave_types')
        .select('max_days_per_year, name')
        .eq('company_id', companyId)
        .ilike('name', `%${data.type}%`)
        .eq('is_active', true)
        .single()

      if (!leaveTypeError && leaveType) {
        // Check if request exceeds max days for this type
        if (daysRequested > leaveType.max_days_per_year) {
          return {
            success: false,
            error: `Request exceeds maximum allowed days for ${leaveType.name} (${leaveType.max_days_per_year} days). Requested: ${daysRequested} days.`
          }
        }
      }
    }

    // Insert leave request with manager approval status
    const { data: leaveRequest, error } = await supabase
      .from('leave_requests')
      .insert({
        user_id: userId,
        company_id: companyId,
        start_date: data.start_date,
        end_date: data.end_date,
        type: data.type.trim(),
        reason: data.reason?.trim() || null,
        status: 'Pending', // Overall status (pending HR approval)
        manager_approval_status: 'Pending', // Manager approval status
        manager_approval_user_id: user.manager_id || null // Will be set by manager
      })
      .select()
      .single()

    if (error) {
      console.error('Leave request submission error:', error)
      return {
        success: false,
        error: error.message || 'Failed to submit leave request'
      }
    }

    // Log audit entry
    await logAuditAction(
      companyId,
      currentUser.id,
      'LEAVE_REQUEST_SUBMITTED',
      null,
      {
        request_id: leaveRequest.id,
        start_date: leaveRequest.start_date,
        end_date: leaveRequest.end_date,
        type: leaveRequest.type,
        days_requested: daysRequested
      },
      userId
    )

    return {
      success: true,
      request: leaveRequest,
      daysRequested: daysRequested,
      availableDays: data.type === 'Annual' || data.type === 'Annual Leave' 
        ? (user.annual_leave_days || 20) - (user.used_leave_days || 0) - daysRequested
        : null
    }
  } catch (error) {
    console.error('Submit self leave request error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while submitting leave request'
    }
  }
}

/**
 * Download payslip (mock function - prepares data for download)
 * @param {string} userId - User ID (should be current user)
 * @param {string} recordId - Payroll record ID
 * @returns {Promise<Object>} Success object with payslip data or error object
 */
export async function downloadPayslip(userId, recordId) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    // Users can only download their own payslips
    if (currentUser.id !== userId) {
      return {
        success: false,
        error: 'Unauthorized: You can only download your own payslips'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Fetch payroll record
    const { data: payrollRecord, error } = await supabase
      .from('payroll_records')
      .select(`
        id,
        period_start,
        period_end,
        gross_salary,
        net_salary,
        tax_amount,
        contribution_amount,
        deductions,
        bonuses,
        status,
        payment_date,
        payment_method,
        notes
      `)
      .eq('id', recordId)
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .single()

    if (error || !payrollRecord) {
      return {
        success: false,
        error: 'Payslip not found or access denied'
      }
    }

    // Get employee details
    const { data: employee, error: empError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, department')
      .eq('id', userId)
      .single()

    // Generate payslip content (mock - in production, generate PDF)
    const payslipData = {
      employee: {
        name: `${employee?.first_name || ''} ${employee?.last_name || ''}`.trim() || employee?.email,
        email: employee?.email,
        department: employee?.department
      },
      payroll: payrollRecord,
      generated_at: new Date().toISOString()
    }

    // Log audit entry
    await logAuditAction(
      companyId,
      currentUser.id,
      'PAYSLIP_DOWNLOADED',
      null,
      { payroll_id: recordId, period_start: payrollRecord.period_start },
      userId
    )

    return {
      success: true,
      payslip: payslipData
    }
  } catch (error) {
    console.error('Download payslip error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while downloading payslip'
    }
  }
}

// ============================================================================
// MANAGER APPROVAL WORKFLOW
// ============================================================================

/**
 * Get pending leave requests for a manager to approve
 * @param {string} managerId - Manager's user ID
 * @returns {Promise<Object>} Success object with requests array or error object
 */
export async function getPendingRequestsForManager(managerId) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    // Verify current user is the manager
    if (currentUser.id !== managerId) {
      return {
        success: false,
        error: 'Unauthorized: You can only view your own pending approvals'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Fetch leave requests where manager_approval_status is 'Pending'
    // and the requester's manager_id matches the managerId
    const { data: requests, error } = await supabase
      .from('leave_requests')
      .select(`
        id,
        start_date,
        end_date,
        type,
        reason,
        status,
        manager_approval_status,
        created_at,
        users:user_id(
          id,
          email,
          first_name,
          last_name,
          department,
          manager_id
        )
      `)
      .eq('company_id', companyId)
      .eq('manager_approval_status', 'Pending')
      .eq('status', 'Pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching manager pending requests:', error)
      return {
        success: false,
        error: 'Failed to fetch pending requests'
      }
    }

    // Filter to only include requests from employees who report to this manager
    const filteredRequests = (requests || []).filter(request => {
      // Get the requester's manager_id
      return request.users?.manager_id === managerId
    })

    return {
      success: true,
      requests: filteredRequests
    }
  } catch (error) {
    console.error('Get pending requests for manager error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching pending requests'
    }
  }
}

/**
 * Approve leave request as manager
 * Updates manager_approval_status, then request goes to HR for final approval
 * @param {string} requestId - Leave request ID
 * @param {string} notes - Optional approval notes
 * @returns {Promise<Object>} Success object or error object
 */
export async function approveRequestAsManager(requestId, notes = '') {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Get the leave request
    const { data: request, error: fetchError } = await supabase
      .from('leave_requests')
      .select(`
        id,
        user_id,
        manager_approval_status,
        status,
        users:user_id(manager_id)
      `)
      .eq('id', requestId)
      .eq('company_id', companyId)
      .single()

    if (fetchError || !request) {
      return {
        success: false,
        error: 'Leave request not found or access denied'
      }
    }

    // Verify current user is the manager of the requester
    if (request.users?.manager_id !== currentUser.id) {
      return {
        success: false,
        error: 'Unauthorized: You are not the manager for this employee'
      }
    }

    // Update manager approval status
    const { data: updatedRequest, error } = await supabase
      .from('leave_requests')
      .update({
        manager_approval_status: 'Approved',
        manager_approval_user_id: currentUser.id,
        manager_approval_date: new Date().toISOString(),
        manager_approval_notes: notes?.trim() || null
      })
      .eq('id', requestId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) {
      console.error('Manager approval error:', error)
      return {
        success: false,
        error: error.message || 'Failed to approve leave request'
      }
    }

    // Log audit entry
    await logAuditAction(
      companyId,
      currentUser.id,
      'LEAVE_REQUEST_MANAGER_APPROVED',
      { manager_approval_status: 'Pending' },
      { manager_approval_status: 'Approved', request_id: requestId },
      request.user_id
    )

    return {
      success: true,
      request: updatedRequest
    }
  } catch (error) {
    console.error('Approve request as manager error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while approving leave request'
    }
  }
}

/**
 * Reject leave request as manager
 * @param {string} requestId - Leave request ID
 * @param {string} notes - Rejection reason
 * @returns {Promise<Object>} Success object or error object
 */
export async function rejectRequestAsManager(requestId, notes = '') {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Get the leave request
    const { data: request, error: fetchError } = await supabase
      .from('leave_requests')
      .select(`
        id,
        user_id,
        manager_approval_status,
        users:user_id(manager_id)
      `)
      .eq('id', requestId)
      .eq('company_id', companyId)
      .single()

    if (fetchError || !request) {
      return {
        success: false,
        error: 'Leave request not found or access denied'
      }
    }

    // Verify current user is the manager
    if (request.users?.manager_id !== currentUser.id) {
      return {
        success: false,
        error: 'Unauthorized: You are not the manager for this employee'
      }
    }

    // Update manager approval status to Rejected and overall status
    const { data: updatedRequest, error } = await supabase
      .from('leave_requests')
      .update({
        manager_approval_status: 'Rejected',
        status: 'Rejected',
        manager_approval_user_id: currentUser.id,
        manager_approval_date: new Date().toISOString(),
        manager_approval_notes: notes?.trim() || null
      })
      .eq('id', requestId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) {
      console.error('Manager rejection error:', error)
      return {
        success: false,
        error: error.message || 'Failed to reject leave request'
      }
    }

    // Log audit entry
    await logAuditAction(
      companyId,
      currentUser.id,
      'LEAVE_REQUEST_MANAGER_REJECTED',
      { manager_approval_status: 'Pending' },
      { manager_approval_status: 'Rejected', request_id: requestId },
      request.user_id
    )

    return {
      success: true,
      request: updatedRequest
    }
  } catch (error) {
    console.error('Reject request as manager error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while rejecting leave request'
    }
  }
}

/**
 * Get leave requests that have manager approval but need HR final approval
 * @returns {Promise<Object>} Success object with requests array or error object
 */
export async function getManagerApprovedRequests() {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteHR()) {
      return {
        success: false,
        error: 'Unauthorized: Only HR Managers can view manager-approved requests'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Fetch requests where manager approved but HR hasn't approved yet
    const { data: requests, error } = await supabase
      .from('leave_requests')
      .select(`
        id,
        start_date,
        end_date,
        type,
        reason,
        status,
        manager_approval_status,
        manager_approval_date,
        manager_approval_notes,
        created_at,
        users:user_id(
          id,
          email,
          first_name,
          last_name,
          department
        ),
        manager:manager_approval_user_id(email, first_name, last_name)
      `)
      .eq('company_id', companyId)
      .eq('manager_approval_status', 'Approved')
      .eq('status', 'Pending')
      .order('manager_approval_date', { ascending: false })

    if (error) {
      console.error('Error fetching manager-approved requests:', error)
      return {
        success: false,
        error: 'Failed to fetch manager-approved requests'
      }
    }

    return {
      success: true,
      requests: requests || []
    }
  } catch (error) {
    console.error('Get manager-approved requests error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching requests'
    }
  }
}

// ============================================================================
// PERFORMANCE GOALS MANAGEMENT
// ============================================================================

/**
 * Get available leave days for a user based on leave type
 * @param {string} userId - User ID
 * @param {string} leaveTypeName - Leave type name (e.g., 'Annual Leave')
 * @returns {Promise<Object>} Success object with available days or error object
 */
export async function getAvailableLeaveDays(userId, leaveTypeName = 'Annual Leave') {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Use RPC function to calculate available days
    const { data: availableDays, error } = await supabase
      .rpc('calculate_available_leave_days', {
        p_user_id: userId,
        p_leave_type_name: leaveTypeName,
        p_company_id: companyId
      })

    if (error) {
      // Fallback calculation
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('annual_leave_days, used_leave_days')
        .eq('id', userId)
        .eq('company_id', companyId)
        .single()

      if (userError || !user) {
        return {
          success: false,
          error: 'User not found'
        }
      }

      const available = (user.annual_leave_days || 20) - (user.used_leave_days || 0)
      return {
        success: true,
        availableDays: available >= 0 ? available : 0,
        maxDays: user.annual_leave_days || 20,
        usedDays: user.used_leave_days || 0
      }
    }

    // Get max days and used days for additional info
    const { data: user } = await supabase
      .from('users')
      .select('annual_leave_days, used_leave_days')
      .eq('id', userId)
      .eq('company_id', companyId)
      .single()

    const { data: leaveType } = await supabase
      .from('leave_types')
      .select('max_days_per_year')
      .eq('company_id', companyId)
      .eq('name', leaveTypeName)
      .eq('is_active', true)
      .single()

    return {
      success: true,
      availableDays: availableDays || 0,
      maxDays: leaveType?.max_days_per_year || user?.annual_leave_days || 20,
      usedDays: user?.used_leave_days || 0
    }
  } catch (error) {
    console.error('Get available leave days error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while calculating available leave days'
    }
  }
}

/**
 * Create a performance goal (for employee self-service)
 * @param {string} reviewId - Performance review ID (optional, can be null for standalone goals)
 * @param {Object} data - Goal data (goal_description, weight, target_date)
 * @returns {Promise<Object>} Success object with goal or error object
 */
export async function createPerformanceGoal(reviewId, data) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Validate required fields
    if (!data.goal_description || !data.weight) {
      return {
        success: false,
        error: 'Goal description and weight are required'
      }
    }

    // Validate weight (0-100)
    if (data.weight < 0 || data.weight > 100) {
      return {
        success: false,
        error: 'Weight must be between 0 and 100'
      }
    }

    // Insert performance goal
    const { data: goal, error } = await supabase
      .from('performance_goals')
      .insert({
        review_id: reviewId || null,
        user_id: currentUser.id,
        company_id: companyId,
        goal_description: data.goal_description.trim(),
        weight: data.weight,
        target_date: data.target_date || null,
        status: 'Draft',
        employee_notes: data.employee_notes?.trim() || null
      })
      .select()
      .single()

    if (error) {
      console.error('Create performance goal error:', error)
      return {
        success: false,
        error: error.message || 'Failed to create performance goal'
      }
    }

    // Log audit entry
    await logAuditAction(
      companyId,
      currentUser.id,
      'PERFORMANCE_GOAL_CREATED',
      null,
      { goal_id: goal.id, goal_description: goal.goal_description, weight: goal.weight },
      currentUser.id
    )

    return {
      success: true,
      goal: goal
    }
  } catch (error) {
    console.error('Create performance goal error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating performance goal'
    }
  }
}

/**
 * Submit goal rating (employee or manager)
 * @param {string} goalId - Goal ID
 * @param {number} rating - Rating (1-5)
 * @param {boolean} isEmployee - True if rating is from employee, false if from manager
 * @param {string} notes - Optional notes
 * @returns {Promise<Object>} Success object or error object
 */
export async function submitGoalRating(goalId, rating, isEmployee = true, notes = '') {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Validate rating (1-5)
    if (rating < 1 || rating > 5) {
      return {
        success: false,
        error: 'Rating must be between 1 and 5'
      }
    }

    // Get the goal
    const { data: goal, error: fetchError } = await supabase
      .from('performance_goals')
      .select('id, user_id, status')
      .eq('id', goalId)
      .eq('company_id', companyId)
      .single()

    if (fetchError || !goal) {
      return {
        success: false,
        error: 'Performance goal not found or access denied'
      }
    }

    // Verify authorization
    if (isEmployee) {
      // Employee can only rate their own goals
      if (goal.user_id !== currentUser.id) {
        return {
          success: false,
          error: 'Unauthorized: You can only rate your own goals'
        }
      }
    } else {
      // Manager can rate goals of their direct reports
      // Check if current user is the manager
      const { data: employee, error: empError } = await supabase
        .from('users')
        .select('manager_id')
        .eq('id', goal.user_id)
        .eq('company_id', companyId)
        .single()

      if (empError || !employee || employee.manager_id !== currentUser.id) {
        return {
          success: false,
          error: 'Unauthorized: You can only rate goals of your direct reports'
        }
      }
    }

    // Update goal with rating
    const updateData = isEmployee
      ? {
          employee_rating: rating,
          employee_notes: notes?.trim() || null,
          status: goal.status === 'Draft' ? 'Submitted' : goal.status
        }
      : {
          manager_rating: rating,
          manager_notes: notes?.trim() || null,
          status: 'Reviewed'
        }

    const { data: updatedGoal, error } = await supabase
      .from('performance_goals')
      .update(updateData)
      .eq('id', goalId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) {
      console.error('Submit goal rating error:', error)
      return {
        success: false,
        error: error.message || 'Failed to submit goal rating'
      }
    }

    // Log audit entry
    await logAuditAction(
      companyId,
      currentUser.id,
      isEmployee ? 'PERFORMANCE_GOAL_EMPLOYEE_RATED' : 'PERFORMANCE_GOAL_MANAGER_RATED',
      isEmployee ? { employee_rating: null } : { manager_rating: null },
      isEmployee ? { employee_rating: rating } : { manager_rating: rating },
      goal.user_id
    )

    return {
      success: true,
      goal: updatedGoal
    }
  } catch (error) {
    console.error('Submit goal rating error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while submitting goal rating'
    }
  }
}

/**
 * Get performance goals for a user
 * @param {string} userId - User ID (optional, defaults to current user)
 * @param {string} status - Filter by status (optional)
 * @returns {Promise<Object>} Success object with goals array or error object
 */
export async function getPerformanceGoals(userId = null, status = null) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    const targetUserId = userId || currentUser.id

    // Users can only view their own goals (unless they're HR/Manager)
    if (targetUserId !== currentUser.id && !canWriteHR()) {
      // Check if current user is the manager
      const { data: employee, error: empError } = await supabase
        .from('users')
        .select('manager_id')
        .eq('id', targetUserId)
        .eq('company_id', companyId)
        .single()

      if (empError || !employee || employee.manager_id !== currentUser.id) {
        return {
          success: false,
          error: 'Unauthorized: You can only view your own goals or goals of your direct reports'
        }
      }
    }

    // Ensure proper headers for Supabase request
    // Supabase client automatically handles headers, but we ensure the query is properly formatted
    let query = supabase
      .from('performance_goals')
      .select(`
        id,
        review_id,
        goal_description,
        weight,
        employee_rating,
        manager_rating,
        employee_notes,
        manager_notes,
        status,
        target_date,
        completion_date,
        created_at,
        updated_at
      `)
      .eq('user_id', targetUserId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    // Execute query with explicit error handling
    const { data: goals, error } = await query

    if (error) {
      console.error('Error fetching performance goals:', error)
      return {
        success: false,
        error: 'Failed to fetch performance goals'
      }
    }

    return {
      success: true,
      goals: goals || []
    }
  } catch (error) {
    console.error('Get performance goals error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching performance goals'
    }
  }
}

// ============================================================================
// ATTENDANCE TRACKING (Devam/Yoklama Takibi)
// ============================================================================

/**
 * Get monthly attendance report for company/department
 * @param {string} companyId - Company ID
 * @param {number} year - Year (e.g., 2024)
 * @param {number} month - Month (1-12)
 * @param {string} departmentId - Optional department ID for filtering
 * @returns {Promise<Object>} Success object with attendance report or error object
 */
export async function getMonthlyAttendanceReport(companyId, year, month, departmentId = null) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!hasHRPermission()) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to view attendance reports'
      }
    }

    if (!companyId) {
      companyId = getCompanyId()
      if (!companyId) {
        return {
          success: false,
          error: 'Company ID not found'
        }
      }
    }

    // Validate month and year
    if (month < 1 || month > 12) {
      return {
        success: false,
        error: 'Invalid month. Must be between 1 and 12'
      }
    }

    // Calculate date range for the month (using UTC to avoid timezone issues)
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

    // Build query to get attendance records with user information
    let query = supabase
      .from('attendance_records')
      .select(`
        id,
        user_id,
        login_time,
        logout_time,
        session_duration_minutes,
        is_active,
        users:user_id(
          id,
          first_name,
          last_name,
          email,
          department,
          job_title_id,
          job_titles:job_title_id(
            title_name
          )
        )
      `)
      .eq('company_id', companyId)
      .gte('login_time', startDate.toISOString())
      .lte('login_time', endDate.toISOString())
      .order('login_time', { ascending: true })

    // Filter by department if provided
    if (departmentId) {
      query = query.eq('users.department', departmentId)
    }

    const { data: records, error } = await query

    if (error) {
      console.error('Error fetching attendance records:', error)
      return {
        success: false,
        error: 'Failed to fetch attendance records',
        report: [],
        summary: {
          totalEmployees: 0,
          totalDays: 0,
          totalHours: 0,
          totalMinutes: 0,
          month: month,
          year: year
        }
      }
    }

    // Ensure records is always an array
    const recordsArray = Array.isArray(records) ? records : []

    if (recordsArray.length === 0) {
      return {
        success: true,
        report: [],
        summary: {
          totalEmployees: 0,
          totalDays: 0,
          totalHours: 0,
          totalMinutes: 0,
          month: month,
          year: year
        }
      }
    }

    // Process records to group by user and date
    const reportMap = new Map()

    for (const record of recordsArray) {
      try {
        const user = record.users
        if (!user || !user.id) {
          console.warn('Skipping record with missing user data:', record.id)
          continue
        }

        const userId = user.id
        
        // Safely parse login time
        let loginDate
        try {
          loginDate = new Date(record.login_time)
          if (isNaN(loginDate.getTime())) {
            console.warn('Invalid login_time for record:', record.id, record.login_time)
            continue
          }
        } catch (dateError) {
          console.error('Error parsing login_time:', dateError, record.login_time)
          continue
        }

        const dateKey = `${userId}_${loginDate.toISOString().split('T')[0]}`

        if (!reportMap.has(dateKey)) {
          reportMap.set(dateKey, {
            userId: userId,
            userName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Unknown',
            userEmail: user.email || 'N/A',
            department: user.department || 'N/A',
            jobTitle: user.job_titles?.title_name || 'N/A',
            date: loginDate.toISOString().split('T')[0],
            sessions: [],
            totalMinutes: 0
          })
        }

        const dayReport = reportMap.get(dateKey)

        // Calculate session time with robust error handling
        try {
          if (record.logout_time && record.session_duration_minutes !== null && record.session_duration_minutes !== undefined) {
            // Use stored duration if available
            const loginTime = new Date(record.login_time)
            const logoutTime = new Date(record.logout_time)
            
            // Validate dates
            if (isNaN(loginTime.getTime()) || isNaN(logoutTime.getTime())) {
              console.warn('Invalid date in record:', record.id)
              continue
            }

            // Format time segments (HH:MM-HH:MM) using English locale
            const loginTimeStr = loginTime.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            })
            const logoutTimeStr = logoutTime.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            })

            const durationMinutes = Math.max(0, record.session_duration_minutes || 0)

            dayReport.sessions.push({
              loginTime: loginTimeStr,
              logoutTime: logoutTimeStr,
              segment: `${loginTimeStr}-${logoutTimeStr}`,
              durationMinutes: durationMinutes
            })

            dayReport.totalMinutes += durationMinutes
          } else if (record.is_active) {
            // Active session (no logout yet)
            const loginTime = new Date(record.login_time)
            if (!isNaN(loginTime.getTime())) {
              const loginTimeStr = loginTime.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              })

              dayReport.sessions.push({
                loginTime: loginTimeStr,
                logoutTime: null,
                segment: `${loginTimeStr}-... (Active)`,
                durationMinutes: null,
                isActive: true
              })
            }
          }
        } catch (sessionError) {
          console.error('Error processing session for record:', record.id, sessionError)
          // Continue processing other records
        }
      } catch (recordError) {
        console.error('Error processing attendance record:', recordError, record)
        // Continue processing other records
      }
    }

    // Convert map to array and format output with error handling
    const report = Array.from(reportMap.values()).map(dayReport => {
      try {
        // Sort sessions by login time
        dayReport.sessions.sort((a, b) => {
          try {
            if (!a.loginTime || !b.loginTime) return 0
            return a.loginTime.localeCompare(b.loginTime)
          } catch (sortError) {
            console.warn('Error sorting sessions:', sortError)
            return 0
          }
        })

        // Format segmented times as array
        const segmentedTimes = dayReport.sessions.map(s => {
          try {
            return s.segment || 'N/A'
          } catch {
            return 'N/A'
          }
        })

        // Calculate total hours and minutes with validation
        const totalMinutes = Math.max(0, dayReport.totalMinutes || 0)
        const totalHours = Math.floor(totalMinutes / 60)
        const totalMins = totalMinutes % 60
        const totalTimeFormatted = `${totalHours}:${totalMins.toString().padStart(2, '0')}`

        return {
          userId: dayReport.userId,
          userName: dayReport.userName || 'Unknown',
          userEmail: dayReport.userEmail || 'N/A',
          department: dayReport.department || 'N/A',
          jobTitle: dayReport.jobTitle || 'N/A',
          date: dayReport.date,
          segmentedTimes: segmentedTimes,
          totalMinutes: totalMinutes,
          totalTimeFormatted: totalTimeFormatted,
          sessionCount: dayReport.sessions.length,
          hasActiveSession: dayReport.sessions.some(s => s.isActive === true)
        }
      } catch (formatError) {
        console.error('Error formatting day report:', formatError, dayReport)
        // Return a safe default structure
        return {
          userId: dayReport.userId || 'unknown',
          userName: dayReport.userName || 'Unknown',
          userEmail: dayReport.userEmail || 'N/A',
          department: dayReport.department || 'N/A',
          jobTitle: dayReport.jobTitle || 'N/A',
          date: dayReport.date || '',
          segmentedTimes: [],
          totalMinutes: 0,
          totalTimeFormatted: '0:00',
          sessionCount: 0,
          hasActiveSession: false
        }
      }
    })

    // Calculate summary statistics with error handling
    try {
      const uniqueUsers = new Set(report.map(r => r.userId).filter(id => id))
      const uniqueDays = new Set(report.map(r => r.date).filter(date => date))
      const totalMinutes = report.reduce((sum, r) => {
        try {
          return sum + (r.totalMinutes || 0)
        } catch {
          return sum
        }
      }, 0)
      const totalHours = Math.floor(totalMinutes / 60)

      return {
        success: true,
        report: report,
        summary: {
          totalEmployees: uniqueUsers.size,
          totalDays: uniqueDays.size,
          totalHours: totalHours,
          totalMinutes: totalMinutes,
          month: month,
          year: year
        }
      }
    } catch (summaryError) {
      console.error('Error calculating summary:', summaryError)
      return {
        success: true,
        report: report,
        summary: {
          totalEmployees: 0,
          totalDays: 0,
          totalHours: 0,
          totalMinutes: 0,
          month: month,
          year: year
        }
      }
    }
  } catch (error) {
    console.error('Get monthly attendance report error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while generating attendance report',
      report: [],
      summary: {
        totalEmployees: 0,
        totalDays: 0,
        totalHours: 0,
        totalMinutes: 0,
        month: month || 0,
        year: year || 0
      }
    }
  }
}

/**
 * Get all job titles for the current company
 * @returns {Promise<Object>} Success object with jobTitles array or error object
 */
export async function getCompanyJobTitles() {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Fetch job titles for the company
    const { data: jobTitles, error } = await supabase
      .from('job_titles')
      .select('*')
      .eq('company_id', companyId)
      .order('title_name', { ascending: true })

    if (error) {
      console.error('Error fetching job titles:', error)
      return {
        success: false,
        error: error.message || 'Failed to fetch job titles'
      }
    }

    return {
      success: true,
      jobTitles: jobTitles || []
    }
  } catch (error) {
    console.error('Get company job titles error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching job titles'
    }
  }
}

