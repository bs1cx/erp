import { supabase } from './supabaseClient'

/**
 * Get current user from localStorage
 * @returns {Object|null} User object or null
 */
function getCurrentUser() {
  try {
    const userData = localStorage.getItem('user_data')
    if (!userData) return null
    return JSON.parse(userData)
  } catch {
    return null
  }
}

/**
 * Get company ID from current user
 * @returns {string|null} Company ID or null
 */
function getCompanyId() {
  const user = getCurrentUser()
  return user?.company_id || null
}

/**
 * Check if user has finance read permission
 * @returns {boolean}
 */
function hasFinancePermission() {
  try {
    const permissions = JSON.parse(localStorage.getItem('user_permissions') || '{}')
    return permissions.module_finance_read === true || permissions.access_finance === true
  } catch {
    return false
  }
}

/**
 * Check if user has finance write permission
 * @returns {boolean}
 */
function canWriteFinance() {
  try {
    const permissions = JSON.parse(localStorage.getItem('user_permissions') || '{}')
    return permissions.module_finance_write === true
  } catch {
    return false
  }
}

// ============================================================================
// TURKISH PAYROLL EXPORT
// ============================================================================

/**
 * Generate Turkish payroll export (CSV format for Logo Payroll, Mikro Jump, etc.)
 * Includes all required Turkish compliance fields: TC Identity Number, SGK Registration Number
 * @param {string} companyId - Company ID
 * @param {string} periodStart - Period start date (YYYY-MM-DD)
 * @param {string} periodEnd - Period end date (YYYY-MM-DD)
 * @returns {Promise<Object>} Success object with CSV data or error object
 */
export async function generateTurkishPayrollExport(companyId, periodStart, periodEnd) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteFinance()) {
      return {
        success: false,
        error: 'Unauthorized: Only Finance Managers can export payroll data'
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

    // Fetch payroll records for the period
    const { data: payrollRecords, error: payrollError } = await supabase
      .from('payroll_records')
      .select(`
        id,
        user_id,
        period_start,
        period_end,
        gross_salary,
        net_salary,
        tax_amount,
        contribution_amount,
        deductions,
        bonuses,
        status,
        users:user_id(
          id,
          email,
          first_name,
          last_name,
          tc_identity_number,
          sgk_registration_number,
          department
        ),
        employee_benefits:user_id(
          benefit_type,
          monthly_amount,
          is_active
        )
      `)
      .eq('company_id', companyId)
      .gte('period_start', periodStart)
      .lte('period_end', periodEnd)
      .eq('status', 'Paid')
      .order('period_start', { ascending: true })

    if (payrollError) {
      console.error('Error fetching payroll records:', payrollError)
      return {
        success: false,
        error: 'Failed to fetch payroll records'
      }
    }

    if (!payrollRecords || payrollRecords.length === 0) {
      return {
        success: false,
        error: 'No payroll records found for the specified period'
      }
    }

    // Generate CSV content (Turkish payroll format)
    const csvRows = []
    
    // CSV Header (Turkish payroll software compatible)
    csvRows.push([
      'TC Kimlik No',
      'SGK Sicil No',
      'Ad Soyad',
      'Departman',
      'Dönem Başlangıç',
      'Dönem Bitiş',
      'Brüt Maaş',
      'Net Maaş',
      'Gelir Vergisi',
      'SGK Primi',
      'Kesintiler',
      'Primler',
      'Toplam Yan Haklar',
      'Durum'
    ].join(','))

    // Process each payroll record
    for (const record of payrollRecords) {
      const user = record.users
      if (!user) continue

      // Calculate total benefits
      const totalBenefits = (record.employee_benefits || [])
        .filter(b => b.is_active)
        .reduce((sum, b) => sum + parseFloat(b.monthly_amount || 0), 0)

      // Build CSV row
      const row = [
        user.tc_identity_number || '', // TC Identity Number (mandatory for Turkish compliance)
        user.sgk_registration_number || '', // SGK Registration Number
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email, // Full Name
        user.department || '', // Department
        record.period_start, // Period Start
        record.period_end, // Period End
        parseFloat(record.gross_salary || 0).toFixed(2), // Gross Salary
        parseFloat(record.net_salary || 0).toFixed(2), // Net Salary
        parseFloat(record.tax_amount || 0).toFixed(2), // Income Tax
        parseFloat(record.contribution_amount || 0).toFixed(2), // SGK Contribution
        parseFloat(record.deductions || 0).toFixed(2), // Deductions
        parseFloat(record.bonuses || 0).toFixed(2), // Bonuses
        totalBenefits.toFixed(2), // Total Benefits
        record.status // Status
      ]

      // Escape commas and quotes in CSV
      const escapedRow = row.map(cell => {
        const cellStr = String(cell)
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`
        }
        return cellStr
      })

      csvRows.push(escapedRow.join(','))
    }

    const csvContent = csvRows.join('\n')

    // Generate filename with period
    const filename = `bordro_export_${periodStart}_${periodEnd}.csv`

    return {
      success: true,
      csvContent: csvContent,
      filename: filename,
      recordCount: payrollRecords.length,
      period: {
        start: periodStart,
        end: periodEnd
      }
    }
  } catch (error) {
    console.error('Generate Turkish payroll export error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while generating payroll export'
    }
  }
}

// ============================================================================
// PAYROLL INTEGRATIONS
// ============================================================================

/**
 * Create or update payroll integration
 * @param {Object} data - Integration data
 * @returns {Promise<Object>} Success object or error object
 */
export async function savePayrollIntegration(data) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteFinance()) {
      return {
        success: false,
        error: 'Unauthorized: Only Finance Managers can manage integrations'
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
    if (!data.service_name) {
      return {
        success: false,
        error: 'Service name is required'
      }
    }

    // Hash API key if provided (in production, use proper encryption)
    let apiKeyHash = data.api_key_hash || null
    if (data.api_key && !apiKeyHash) {
      // Simple hash (in production, use proper encryption like bcrypt)
      apiKeyHash = btoa(data.api_key).substring(0, 255)
    }

    // Check if integration exists
    const { data: existing, error: checkError } = await supabase
      .from('payroll_integrations')
      .select('id')
      .eq('company_id', companyId)
      .eq('service_name', data.service_name)
      .single()

    let result
    if (existing) {
      // Update existing integration
      const { data: updated, error } = await supabase
        .from('payroll_integrations')
        .update({
          api_url: data.api_url || null,
          api_key_hash: apiKeyHash,
          api_username: data.api_username || null,
          is_active: data.is_active !== undefined ? data.is_active : true,
          configuration: data.configuration || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .eq('company_id', companyId)
        .select()
        .single()

      if (error) {
        console.error('Update payroll integration error:', error)
        return {
          success: false,
          error: error.message || 'Failed to update integration'
        }
      }

      result = updated
    } else {
      // Create new integration
      const { data: created, error } = await supabase
        .from('payroll_integrations')
        .insert({
          company_id: companyId,
          service_name: data.service_name.trim(),
          api_url: data.api_url?.trim() || null,
          api_key_hash: apiKeyHash,
          api_username: data.api_username?.trim() || null,
          is_active: data.is_active !== undefined ? data.is_active : true,
          configuration: data.configuration || null
        })
        .select()
        .single()

      if (error) {
        console.error('Create payroll integration error:', error)
        return {
          success: false,
          error: error.message || 'Failed to create integration'
        }
      }

      result = created
    }

    return {
      success: true,
      integration: result
    }
  } catch (error) {
    console.error('Save payroll integration error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while saving integration'
    }
  }
}

/**
 * Get all payroll integrations for the company
 * @returns {Promise<Object>} Success object with integrations array or error object
 */
export async function getPayrollIntegrations() {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!hasFinancePermission()) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to view integrations'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    const { data: integrations, error } = await supabase
      .from('payroll_integrations')
      .select(`
        id,
        service_name,
        api_url,
        api_username,
        is_active,
        last_sync_date,
        sync_status,
        sync_error_message,
        configuration,
        created_at,
        updated_at
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching payroll integrations:', error)
      return {
        success: false,
        error: 'Failed to fetch integrations'
      }
    }

    return {
      success: true,
      integrations: integrations || []
    }
  } catch (error) {
    console.error('Get payroll integrations error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching integrations'
    }
  }
}

/**
 * Delete payroll integration
 * @param {string} integrationId - Integration ID
 * @returns {Promise<Object>} Success object or error object
 */
export async function deletePayrollIntegration(integrationId) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteFinance()) {
      return {
        success: false,
        error: 'Unauthorized: Only Finance Managers can delete integrations'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    const { error } = await supabase
      .from('payroll_integrations')
      .delete()
      .eq('id', integrationId)
      .eq('company_id', companyId)

    if (error) {
      console.error('Delete payroll integration error:', error)
      return {
        success: false,
        error: error.message || 'Failed to delete integration'
      }
    }

    return {
      success: true
    }
  } catch (error) {
    console.error('Delete payroll integration error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while deleting integration'
    }
  }
}

// ============================================================================
// INVOICE MANAGEMENT
// ============================================================================

/**
 * Create invoice record
 * @param {Object} data - Invoice data
 * @returns {Promise<Object>} Success object with invoice or error object
 */
export async function createInvoice(data) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteFinance()) {
      return {
        success: false,
        error: 'Unauthorized: Only Finance Managers can create invoices'
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
    if (!data.invoice_number || !data.vendor_name || !data.amount || !data.invoice_date) {
      return {
        success: false,
        error: 'Invoice number, vendor name, amount, and invoice date are required'
      }
    }

    // Calculate total amount (amount + tax)
    const taxAmount = data.tax_amount || (data.amount * (data.tax_rate || 0) / 100)
    const totalAmount = parseFloat(data.amount) + parseFloat(taxAmount)

    // Insert invoice
    const { data: invoice, error } = await supabase
      .from('invoice_records')
      .insert({
        company_id: companyId,
        invoice_number: data.invoice_number.trim(),
        vendor_name: data.vendor_name.trim(),
        vendor_tax_id: data.vendor_tax_id?.trim() || null,
        vendor_address: data.vendor_address?.trim() || null,
        vendor_contact_email: data.vendor_contact_email?.trim() || null,
        vendor_contact_phone: data.vendor_contact_phone?.trim() || null,
        amount: parseFloat(data.amount),
        currency: data.currency || 'TRY',
        invoice_date: data.invoice_date,
        due_date: data.due_date || null,
        status: data.status || 'Pending',
        payment_date: data.payment_date || null,
        payment_method: data.payment_method || null,
        payment_reference: data.payment_reference?.trim() || null,
        description: data.description?.trim() || null,
        category: data.category?.trim() || null,
        tax_amount: parseFloat(taxAmount),
        tax_rate: data.tax_rate || 0,
        total_amount: totalAmount,
        notes: data.notes?.trim() || null,
        attachment_url: data.attachment_url || null,
        created_by_user_id: currentUser.id
      })
      .select()
      .single()

    if (error) {
      console.error('Create invoice error:', error)
      return {
        success: false,
        error: error.message || 'Failed to create invoice'
      }
    }

    return {
      success: true,
      invoice: invoice
    }
  } catch (error) {
    console.error('Create invoice error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating invoice'
    }
  }
}

/**
 * Get all invoices for the company
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 50)
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Success object with invoices array or error object
 */
export async function getInvoices(page = 1, limit = 50, filters = {}) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!hasFinancePermission()) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to view invoices'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    const offset = (page - 1) * limit

    let query = supabase
      .from('invoice_records')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('invoice_date', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.vendor_name) {
      query = query.ilike('vendor_name', `%${filters.vendor_name}%`)
    }
    if (filters.invoice_date_from) {
      query = query.gte('invoice_date', filters.invoice_date_from)
    }
    if (filters.invoice_date_to) {
      query = query.lte('invoice_date', filters.invoice_date_to)
    }

    const { data: invoices, error, count } = await query

    if (error) {
      console.error('Error fetching invoices:', error)
      return {
        success: false,
        error: 'Failed to fetch invoices'
      }
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return {
      success: true,
      invoices: invoices || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages
      }
    }
  } catch (error) {
    console.error('Get invoices error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching invoices'
    }
  }
}

/**
 * Update invoice status
 * @param {string} invoiceId - Invoice ID
 * @param {Object} data - Update data (status, payment_date, etc.)
 * @returns {Promise<Object>} Success object or error object
 */
export async function updateInvoiceStatus(invoiceId, data) {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!canWriteFinance()) {
      return {
        success: false,
        error: 'Unauthorized: Only Finance Managers can update invoices'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    const updateData = {}
    if (data.status) updateData.status = data.status
    if (data.payment_date) updateData.payment_date = data.payment_date
    if (data.payment_method) updateData.payment_method = data.payment_method
    if (data.payment_reference) updateData.payment_reference = data.payment_reference
    if (data.notes !== undefined) updateData.notes = data.notes

    const { data: updated, error } = await supabase
      .from('invoice_records')
      .update(updateData)
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) {
      console.error('Update invoice error:', error)
      return {
        success: false,
        error: error.message || 'Failed to update invoice'
      }
    }

    return {
      success: true,
      invoice: updated
    }
  } catch (error) {
    console.error('Update invoice status error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating invoice'
    }
  }
}

/**
 * Get finance overview KPIs
 * @returns {Promise<Object>} Success object with KPI data or error object
 */
export async function getFinanceOverview() {
  try {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    if (!hasFinancePermission()) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to view finance data'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Get total pending invoices
    const { count: pendingCount } = await supabase
      .from('invoice_records')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'Pending')

    // Get total paid invoices amount
    const { data: paidInvoices } = await supabase
      .from('invoice_records')
      .select('total_amount')
      .eq('company_id', companyId)
      .eq('status', 'Paid')

    const totalPaid = (paidInvoices || []).reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0)

    // Get total pending invoices amount
    const { data: pendingInvoices } = await supabase
      .from('invoice_records')
      .select('total_amount')
      .eq('company_id', companyId)
      .eq('status', 'Pending')

    const totalPending = (pendingInvoices || []).reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0)

    // Get active integrations count
    const { count: activeIntegrations } = await supabase
      .from('payroll_integrations')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_active', true)

    return {
      success: true,
      kpis: {
        pendingInvoices: pendingCount || 0,
        totalPaid: totalPaid,
        totalPending: totalPending,
        activeIntegrations: activeIntegrations || 0
      }
    }
  } catch (error) {
    console.error('Get finance overview error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching finance overview'
    }
  }
}

