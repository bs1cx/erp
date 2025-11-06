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
 * Get company ID from current user session
 * @returns {string|null} Company ID or null
 */
function getCompanyId() {
  const user = getCurrentUser()
  return user?.company_id || null
}

// ============================================================================
// ASSET MANAGEMENT (CMDB) FUNCTIONS
// ============================================================================

/**
 * Create a new IT asset
 * @param {Object} data - Asset data (asset_tag, name, type, assigned_to_user_id, purchase_date, warranty_end_date, status)
 * @returns {Promise<Object>} Success object with asset data or error object
 */
export async function createAsset(data) {
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
        error: 'Unauthorized: Only IT_ADMIN users can create assets'
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
    if (!data.asset_tag || !data.name || !data.type) {
      return {
        success: false,
        error: 'Asset tag, name, and type are required'
      }
    }

    // Insert new asset with company_id (tenant isolation)
    const { data: newAsset, error } = await supabase
      .from('it_assets')
      .insert({
        company_id: companyId, // CRITICAL: Tenant isolation
        asset_tag: data.asset_tag,
        name: data.name,
        type: data.type,
        assigned_to_user_id: data.assigned_to_user_id || null,
        purchase_date: data.purchase_date || null,
        warranty_end_date: data.warranty_end_date || null,
        status: data.status || 'Stock'
      })
      .select()
      .single()

    if (error) {
      console.error('Asset creation error:', error)
      
      if (error.code === '23505') { // Unique violation
        return {
          success: false,
          error: 'Asset tag already exists'
        }
      }

      return {
        success: false,
        error: error.message || 'Failed to create asset'
      }
    }

    return {
      success: true,
      asset: newAsset
    }
  } catch (error) {
    console.error('Create asset error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating asset'
    }
  }
}

/**
 * Get all assets for the current company
 * @returns {Promise<Object>} Success object with assets array or error object
 */
export async function getCompanyAssets() {
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

    // Fetch all assets for the current company (tenant isolation)
    const { data: assets, error } = await supabase
      .from('it_assets')
      .select(`
        id,
        asset_tag,
        name,
        type,
        status,
        purchase_date,
        warranty_end_date,
        assigned_to_user_id,
        created_at,
        updated_at,
        users:assigned_to_user_id(email)
      `)
      .eq('company_id', companyId) // CRITICAL: Tenant isolation
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching assets:', error)
      return {
        success: false,
        error: 'Failed to fetch assets'
      }
    }

    return {
      success: true,
      assets: assets || []
    }
  } catch (error) {
    console.error('Get assets error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching assets'
    }
  }
}

/**
 * Assign an asset to a user (Zimmetleme)
 * @param {string} assetId - Asset ID
 * @param {string} userId - User ID to assign to (null to unassign)
 * @returns {Promise<Object>} Success object with updated asset or error object
 */
export async function assignAsset(assetId, userId) {
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
        error: 'Unauthorized: Only IT_ADMIN users can assign assets'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Verify asset belongs to the company
    const { data: asset, error: assetError } = await supabase
      .from('it_assets')
      .select('id, company_id, status')
      .eq('id', assetId)
      .eq('company_id', companyId)
      .single()

    if (assetError || !asset) {
      return {
        success: false,
        error: 'Asset not found or access denied'
      }
    }

    // If assigning to a user, verify they belong to the same company
    if (userId) {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, company_id')
        .eq('id', userId)
        .eq('company_id', companyId)
        .single()

      if (userError || !user) {
        return {
          success: false,
          error: 'User not found or does not belong to your company'
        }
      }
    }

    // Update asset assignment
    const { data: updatedAsset, error } = await supabase
      .from('it_assets')
      .update({
        assigned_to_user_id: userId || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', assetId)
      .eq('company_id', companyId) // CRITICAL: Ensure tenant isolation
      .select(`
        id,
        asset_tag,
        name,
        type,
        status,
        assigned_to_user_id,
        users:assigned_to_user_id(email)
      `)
      .single()

    if (error) {
      console.error('Asset assignment error:', error)
      return {
        success: false,
        error: error.message || 'Failed to assign asset'
      }
    }

    return {
      success: true,
      asset: updatedAsset
    }
  } catch (error) {
    console.error('Assign asset error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while assigning asset'
    }
  }
}

/**
 * Unassign an asset (set assigned_to_user_id to NULL)
 * @param {string} assetId - Asset ID
 * @returns {Promise<Object>} Success object with updated asset or error object
 */
export async function unassignAsset(assetId) {
  return await assignAsset(assetId, null)
}

/**
 * Update an asset
 * @param {string} assetId - Asset ID
 * @param {Object} data - Updated asset data
 * @returns {Promise<Object>} Success object with updated asset or error object
 */
export async function updateAsset(assetId, data) {
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
        error: 'Unauthorized: Only IT_ADMIN users can update assets'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Verify asset belongs to the company (security check)
    const { data: existingAsset, error: checkError } = await supabase
      .from('it_assets')
      .select('id, company_id')
      .eq('id', assetId)
      .eq('company_id', companyId)
      .single()

    if (checkError || !existingAsset) {
      return {
        success: false,
        error: 'Asset not found or access denied'
      }
    }

    // Update asset
    const { data: updatedAsset, error } = await supabase
      .from('it_assets')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', assetId)
      .eq('company_id', companyId) // CRITICAL: Ensure tenant isolation
      .select()
      .single()

    if (error) {
      console.error('Asset update error:', error)
      return {
        success: false,
        error: error.message || 'Failed to update asset'
      }
    }

    return {
      success: true,
      asset: updatedAsset
    }
  } catch (error) {
    console.error('Update asset error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating asset'
    }
  }
}

// ============================================================================
// KNOWLEDGE BASE FUNCTIONS
// ============================================================================

/**
 * Create a new knowledge article
 * @param {Object} data - Article data (title, content, category, is_published)
 * @returns {Promise<Object>} Success object with article data or error object
 */
export async function createArticle(data) {
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
        error: 'Unauthorized: Only IT_ADMIN users can create articles'
      }
    }

    const companyId = getCompanyId()
    const userId = currentUser.id

    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Validate required fields
    if (!data.title || !data.content) {
      return {
        success: false,
        error: 'Title and content are required'
      }
    }

    // Insert new article with company_id (tenant isolation)
    const { data: newArticle, error } = await supabase
      .from('knowledge_articles')
      .insert({
        company_id: companyId, // CRITICAL: Tenant isolation
        title: data.title,
        content: data.content,
        category: data.category || null,
        author_user_id: userId,
        is_published: data.is_published || false
      })
      .select()
      .single()

    if (error) {
      console.error('Article creation error:', error)
      return {
        success: false,
        error: error.message || 'Failed to create article'
      }
    }

    return {
      success: true,
      article: newArticle
    }
  } catch (error) {
    console.error('Create article error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating article'
    }
  }
}

/**
 * Get published articles (visible to all users for self-service)
 * @returns {Promise<Object>} Success object with articles array or error object
 */
export async function getPublishedArticles() {
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

    // Fetch published articles for the current company (tenant isolation)
    const { data: articles, error } = await supabase
      .from('knowledge_articles')
      .select(`
        id,
        title,
        content,
        category,
        created_at,
        updated_at,
        users:author_user_id(email)
      `)
      .eq('company_id', companyId) // CRITICAL: Tenant isolation
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching published articles:', error)
      return {
        success: false,
        error: 'Failed to fetch articles'
      }
    }

    return {
      success: true,
      articles: articles || []
    }
  } catch (error) {
    console.error('Get published articles error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching articles'
    }
  }
}

/**
 * Get draft articles (visible only to IT_ADMIN/editors)
 * @returns {Promise<Object>} Success object with articles array or error object
 */
export async function getDraftArticles() {
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
        error: 'Unauthorized: Only IT_ADMIN users can view draft articles'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Fetch draft articles for the current company (tenant isolation)
    const { data: articles, error } = await supabase
      .from('knowledge_articles')
      .select(`
        id,
        title,
        content,
        category,
        is_published,
        created_at,
        updated_at,
        users:author_user_id(email)
      `)
      .eq('company_id', companyId) // CRITICAL: Tenant isolation
      .eq('is_published', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching draft articles:', error)
      return {
        success: false,
        error: 'Failed to fetch draft articles'
      }
    }

    return {
      success: true,
      articles: articles || []
    }
  } catch (error) {
    console.error('Get draft articles error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching draft articles'
    }
  }
}

/**
 * Update an article (including publish/unpublish)
 * @param {string} articleId - Article ID
 * @param {Object} data - Updated article data
 * @returns {Promise<Object>} Success object with updated article or error object
 */
export async function updateArticle(articleId, data) {
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
        error: 'Unauthorized: Only IT_ADMIN users can update articles'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Verify article belongs to the company (security check)
    const { data: existingArticle, error: checkError } = await supabase
      .from('knowledge_articles')
      .select('id, company_id')
      .eq('id', articleId)
      .eq('company_id', companyId)
      .single()

    if (checkError || !existingArticle) {
      return {
        success: false,
        error: 'Article not found or access denied'
      }
    }

    // Update article
    const { data: updatedArticle, error } = await supabase
      .from('knowledge_articles')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', articleId)
      .eq('company_id', companyId) // CRITICAL: Ensure tenant isolation
      .select()
      .single()

    if (error) {
      console.error('Article update error:', error)
      return {
        success: false,
        error: error.message || 'Failed to update article'
      }
    }

    return {
      success: true,
      article: updatedArticle
    }
  } catch (error) {
    console.error('Update article error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating article'
    }
  }
}

// ============================================================================
// TICKET MANAGEMENT & SLA FUNCTIONS
// ============================================================================

/**
 * Create a new support ticket
 * @param {Object} data - Ticket data (title, description, priority)
 * @returns {Promise<Object>} Success object with ticket data or error object
 */
export async function createTicket(data) {
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
    if (!data.title || !data.description) {
      return {
        success: false,
        error: 'Title and description are required'
      }
    }

    // Generate ticket number
    const ticketNumber = `TICK-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    // Insert new ticket with company_id (tenant isolation)
    const { data: newTicket, error } = await supabase
      .from('it_tickets')
      .insert({
        company_id: companyId, // CRITICAL: Tenant isolation
        ticket_number: ticketNumber,
        title: data.title,
        description: data.description,
        priority: data.priority || 'Medium',
        requester_user_id: currentUser.id,
        status: 'Open'
      })
      .select()
      .single()

    if (error) {
      console.error('Ticket creation error:', error)
      return {
        success: false,
        error: error.message || 'Failed to create ticket'
      }
    }

    // Create initial SLA metrics entry
    await supabase
      .from('sla_metrics')
      .insert({
        ticket_id: newTicket.id,
        company_id: companyId,
        target_resolution_minutes: 480 // 8 hours default
      })

    return {
      success: true,
      ticket: newTicket
    }
  } catch (error) {
    console.error('Create ticket error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating ticket'
    }
  }
}

/**
 * Update ticket status and calculate SLA metrics
 * CRITICAL: Calculates time_to_resolve_minutes ONLY when status changes to 'Closed'
 * @param {string} ticketId - Ticket ID
 * @param {string} newStatus - New status (Open, In Progress, Resolved, Closed)
 * @param {string} resolvingUserId - User ID resolving the ticket
 * @returns {Promise<Object>} Success object with updated ticket or error object
 */
export async function updateTicketStatus(ticketId, newStatus, resolvingUserId) {
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

    // Verify ticket belongs to the company (security check)
    const { data: existingTicket, error: checkError } = await supabase
      .from('it_tickets')
      .select('id, company_id, status, created_at')
      .eq('id', ticketId)
      .eq('company_id', companyId)
      .single()

    if (checkError || !existingTicket) {
      return {
        success: false,
        error: 'Ticket not found or access denied'
      }
    }

    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString()
    }

    // Set resolved_at when status changes to Resolved or Closed
    if (newStatus === 'Resolved' || newStatus === 'Closed') {
      if (!existingTicket.resolved_at) {
        updateData.resolved_at = new Date().toISOString()
      }
    }

    // Set closed_at when status changes to Closed
    if (newStatus === 'Closed') {
      updateData.closed_at = new Date().toISOString()
    }

    // If assigning to a user, set assigned_to_user_id
    if (resolvingUserId) {
      updateData.assigned_to_user_id = resolvingUserId
    }

    // Update ticket
    const { data: updatedTicket, error } = await supabase
      .from('it_tickets')
      .update(updateData)
      .eq('id', ticketId)
      .eq('company_id', companyId) // CRITICAL: Ensure tenant isolation
      .select()
      .single()

    if (error) {
      console.error('Ticket update error:', error)
      return {
        success: false,
        error: error.message || 'Failed to update ticket'
      }
    }

    // CRITICAL: Calculate and log SLA metrics ONLY when status changes to 'Closed'
    if (newStatus === 'Closed' && existingTicket.status !== 'Closed') {
      const ticketCreatedAt = new Date(existingTicket.created_at)
      const ticketClosedAt = new Date(updatedTicket.closed_at)
      const timeToResolveMinutes = Math.floor((ticketClosedAt - ticketCreatedAt) / (1000 * 60))

      // Get SLA metrics for this ticket
      const { data: slaMetrics, error: slaError } = await supabase
        .from('sla_metrics')
        .select('id, target_resolution_minutes')
        .eq('ticket_id', ticketId)
        .single()

      if (!slaError && slaMetrics) {
        const targetMinutes = slaMetrics.target_resolution_minutes || 480
        const slaMet = timeToResolveMinutes <= targetMinutes

        // Update SLA metrics with calculated time_to_resolve_minutes
        await supabase
          .from('sla_metrics')
          .update({
            time_to_resolve_minutes: timeToResolveMinutes,
            sla_met: slaMet
          })
          .eq('id', slaMetrics.id)
      } else {
        // Create SLA metrics entry if it doesn't exist
        await supabase
          .from('sla_metrics')
          .insert({
            ticket_id: ticketId,
            company_id: companyId,
            time_to_resolve_minutes: timeToResolveMinutes,
            target_resolution_minutes: 480,
            sla_met: timeToResolveMinutes <= 480
          })
      }
    }

    return {
      success: true,
      ticket: updatedTicket
    }
  } catch (error) {
    console.error('Update ticket status error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating ticket'
    }
  }
}

/**
 * Get all tickets for the current company
 * @returns {Promise<Object>} Success object with tickets array or error object
 */
export async function getCompanyTickets() {
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

    // Fetch all tickets for the current company (tenant isolation)
    const { data: tickets, error } = await supabase
      .from('it_tickets')
      .select(`
        id,
        ticket_number,
        title,
        description,
        status,
        priority,
        created_at,
        updated_at,
        resolved_at,
        closed_at,
        assigned_to_user_id,
        requester:requester_user_id(email),
        assignee:assigned_to_user_id(email)
      `)
      .eq('company_id', companyId) // CRITICAL: Tenant isolation
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching tickets:', error)
      return {
        success: false,
        error: 'Failed to fetch tickets'
      }
    }

    return {
      success: true,
      tickets: tickets || []
    }
  } catch (error) {
    console.error('Get tickets error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching tickets'
    }
  }
}

/**
 * Get detailed ticket information with messages
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<Object>} Success object with ticket details and messages or error object
 */
export async function getTicketDetails(ticketId) {
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

    // Fetch ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from('it_tickets')
      .select(`
        id,
        ticket_number,
        title,
        description,
        status,
        priority,
        created_at,
        updated_at,
        resolved_at,
        closed_at,
        assigned_to_user_id,
        requester:requester_user_id(id, email, role),
        assignee:assigned_to_user_id(id, email, role)
      `)
      .eq('id', ticketId)
      .eq('company_id', companyId) // CRITICAL: Tenant isolation
      .single()

    if (ticketError || !ticket) {
      return {
        success: false,
        error: 'Ticket not found or access denied'
      }
    }

    // Fetch all messages for this ticket
    const { data: messages, error: messagesError } = await supabase
      .from('ticket_messages')
      .select(`
        id,
        message_text,
        is_internal,
        created_at,
        users:user_id(id, email, role)
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Error fetching ticket messages:', messagesError)
      // Don't fail if messages can't be fetched, just return empty array
    }

    return {
      success: true,
      ticket: ticket,
      messages: messages || []
    }
  } catch (error) {
    console.error('Get ticket details error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching ticket details'
    }
  }
}

/**
 * Assign ticket to a user
 * @param {string} ticketId - Ticket ID
 * @param {string} userId - User ID to assign to (null to unassign)
 * @returns {Promise<Object>} Success object with updated ticket or error object
 */
export async function assignTicket(ticketId, userId) {
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
        error: 'Unauthorized: Only IT_ADMIN users can assign tickets'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Verify ticket belongs to the company (security check)
    const { data: existingTicket, error: checkError } = await supabase
      .from('it_tickets')
      .select('id, company_id')
      .eq('id', ticketId)
      .eq('company_id', companyId)
      .single()

    if (checkError || !existingTicket) {
      return {
        success: false,
        error: 'Ticket not found or access denied'
      }
    }

    // If assigning to a user, verify they belong to the same company
    if (userId) {
      const { data: targetUser, error: userError } = await supabase
        .from('users')
        .select('id, company_id, role')
        .eq('id', userId)
        .eq('company_id', companyId)
        .single()

      if (userError || !targetUser) {
        return {
          success: false,
          error: 'User not found or does not belong to your company'
        }
      }

      // Only allow assignment to IT_ADMIN users
      if (targetUser.role !== 'IT_ADMIN') {
        return {
          success: false,
          error: 'Tickets can only be assigned to IT_ADMIN users'
        }
      }
    }

    // Update ticket assignment
    const { data: updatedTicket, error } = await supabase
      .from('it_tickets')
      .update({
        assigned_to_user_id: userId || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)
      .eq('company_id', companyId) // CRITICAL: Ensure tenant isolation
      .select(`
        id,
        ticket_number,
        title,
        assigned_to_user_id,
        assignee:assigned_to_user_id(email)
      `)
      .single()

    if (error) {
      console.error('Ticket assignment error:', error)
      return {
        success: false,
        error: error.message || 'Failed to assign ticket'
      }
    }

    // Log assignment as internal message
    if (userId) {
      const assigneeEmail = updatedTicket.assignee?.email || 'Unknown'
      await postTicketMessage(ticketId, currentUser.id, `Ticket assigned to ${assigneeEmail}`, true)
    } else {
      await postTicketMessage(ticketId, currentUser.id, 'Ticket unassigned', true)
    }

    return {
      success: true,
      ticket: updatedTicket
    }
  } catch (error) {
    console.error('Assign ticket error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while assigning ticket'
    }
  }
}

/**
 * Post a message to a ticket
 * @param {string} ticketId - Ticket ID
 * @param {string} userId - User ID posting the message
 * @param {string} message - Message text
 * @param {boolean} isInternal - Whether this is an internal note (visible only to IT staff)
 * @returns {Promise<Object>} Success object with message data or error object
 */
export async function postTicketMessage(ticketId, userId, message, isInternal = false) {
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

    // Verify ticket belongs to the company (security check)
    const { data: ticket, error: ticketError } = await supabase
      .from('it_tickets')
      .select('id, company_id')
      .eq('id', ticketId)
      .eq('company_id', companyId)
      .single()

    if (ticketError || !ticket) {
      return {
        success: false,
        error: 'Ticket not found or access denied'
      }
    }

    // Verify user belongs to the company
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('id', userId)
      .eq('company_id', companyId)
      .single()

    if (userError || !user) {
      return {
        success: false,
        error: 'User not found or does not belong to your company'
      }
    }

    // Validate message
    if (!message || message.trim().length === 0) {
      return {
        success: false,
        error: 'Message cannot be empty'
      }
    }

    // Insert message
    const { data: newMessage, error } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        user_id: userId,
        message_text: message.trim(),
        is_internal: isInternal
      })
      .select(`
        id,
        message_text,
        is_internal,
        created_at,
        users:user_id(id, email, role)
      `)
      .single()

    if (error) {
      console.error('Post message error:', error)
      return {
        success: false,
        error: error.message || 'Failed to post message'
      }
    }

    // Update ticket's updated_at timestamp
    await supabase
      .from('it_tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', ticketId)

    return {
      success: true,
      message: newMessage
    }
  } catch (error) {
    console.error('Post ticket message error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while posting message'
    }
  }
}

/**
 * Get all company users for assignment (not just IT_ADMIN)
 * @returns {Promise<Object>} Success object with users array or error object
 */
export async function getAllCompanyUsers() {
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

    // Fetch all users for the current company (tenant isolation)
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, role, job_titles:job_title_id(title_name)')
      .eq('company_id', companyId) // CRITICAL: Tenant isolation
      .order('email')

    if (error) {
      console.error('Error fetching company users:', error)
      return {
        success: false,
        error: 'Failed to fetch company users'
      }
    }

    return {
      success: true,
      users: users || []
    }
  } catch (error) {
    console.error('Get company users error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching company users'
    }
  }
}

/**
 * Get IT users for ticket assignment (only IT_ADMIN users)
 * @returns {Promise<Object>} Success object with users array or error object
 */
export async function getITUsers() {
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

    // Fetch IT_ADMIN users for the current company (tenant isolation)
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('company_id', companyId) // CRITICAL: Tenant isolation
      .eq('role', 'IT_ADMIN')
      .order('email')

    if (error) {
      console.error('Error fetching IT users:', error)
      return {
        success: false,
        error: 'Failed to fetch IT users'
      }
    }

    return {
      success: true,
      users: users || []
    }
  } catch (error) {
    console.error('Get IT users error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching IT users'
    }
  }
}

/**
 * Get SLA metrics for tickets
 * @returns {Promise<Object>} Success object with SLA metrics or error object
 */
export async function getSLAMetrics() {
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
        error: 'Unauthorized: Only IT_ADMIN users can view SLA metrics'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Fetch SLA metrics for the current company (tenant isolation)
    const { data: metrics, error } = await supabase
      .from('sla_metrics')
      .select(`
        id,
        time_to_resolve_minutes,
        target_resolution_minutes,
        sla_met,
        created_at,
        it_tickets:ticket_id(ticket_number, title, status)
      `)
      .eq('company_id', companyId) // CRITICAL: Tenant isolation
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching SLA metrics:', error)
      return {
        success: false,
        error: 'Failed to fetch SLA metrics'
      }
    }

    // Calculate aggregate statistics
    const closedTickets = metrics.filter(m => m.time_to_resolve_minutes !== null)
    const slaMetCount = closedTickets.filter(m => m.sla_met === true).length
    const avgResolutionTime = closedTickets.length > 0
      ? Math.round(closedTickets.reduce((sum, m) => sum + (m.time_to_resolve_minutes || 0), 0) / closedTickets.length)
      : 0

    return {
      success: true,
      metrics: metrics || [],
      statistics: {
        totalClosed: closedTickets.length,
        slaMetCount: slaMetCount,
        slaMetPercentage: closedTickets.length > 0 ? Math.round((slaMetCount / closedTickets.length) * 100) : 0,
        avgResolutionTimeMinutes: avgResolutionTime
      }
    }
  } catch (error) {
    console.error('Get SLA metrics error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching SLA metrics'
    }
  }
}

/**
 * Create a new job title
 * @param {Object} data - Job title data (title_name, department, level)
 * @returns {Promise<Object>} Success object with job title data or error object
 */
export async function createJobTitle(data) {
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
        error: 'Unauthorized: Only IT_ADMIN users can create job titles'
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
    if (!data.title_name || data.title_name.trim().length === 0) {
      return {
        success: false,
        error: 'Job title name is required'
      }
    }

    // Insert job title
    const { data: newJobTitle, error } = await supabase
      .from('job_titles')
      .insert({
        company_id: companyId, // CRITICAL: Tenant isolation
        title_name: data.title_name.trim(),
        department: data.department?.trim() || null,
        level: data.level?.trim() || null
      })
      .select()
      .single()

    if (error) {
      console.error('Job title creation error:', error)
      return {
        success: false,
        error: error.message || 'Failed to create job title'
      }
    }

    return {
      success: true,
      jobTitle: newJobTitle
    }
  } catch (error) {
    console.error('Create job title error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating job title'
    }
  }
}

/**
 * Get all job titles for the current company
 * @returns {Promise<Object>} Success object with job titles array or error object
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

    // Fetch all job titles for the current company (tenant isolation)
    const { data: jobTitles, error } = await supabase
      .from('job_titles')
      .select('id, title_name, department, level, created_at')
      .eq('company_id', companyId) // CRITICAL: Tenant isolation
      .order('department', { ascending: true })
      .order('title_name', { ascending: true })

    if (error) {
      console.error('Error fetching job titles:', error)
      return {
        success: false,
        error: 'Failed to fetch job titles'
      }
    }

    return {
      success: true,
      jobTitles: jobTitles || []
    }
  } catch (error) {
    console.error('Get job titles error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching job titles'
    }
  }
}

/**
 * Get all roles assigned to a job title
 * @param {string} jobTitleId - Job title ID
 * @returns {Promise<Object>} Success object with roles array or error object
 */
export async function getRolesForJobTitle(jobTitleId) {
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

    // Verify job title belongs to the company
    const { data: jobTitle, error: checkError } = await supabase
      .from('job_titles')
      .select('id, company_id')
      .eq('id', jobTitleId)
      .eq('company_id', companyId)
      .single()

    if (checkError || !jobTitle) {
      return {
        success: false,
        error: 'Job title not found or access denied'
      }
    }

    // Fetch all roles assigned to this job title
    const { data: assignments, error } = await supabase
      .from('job_role_assignments')
      .select('role_name, created_at')
      .eq('job_title_id', jobTitleId)
      .order('role_name')

    if (error) {
      console.error('Error fetching job title roles:', error)
      return {
        success: false,
        error: 'Failed to fetch job title roles'
      }
    }

    return {
      success: true,
      roles: assignments?.map(a => a.role_name) || []
    }
  } catch (error) {
    console.error('Get roles for job title error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching job title roles'
    }
  }
}

/**
 * Assign a role to a job title
 * @param {string} jobTitleId - Job title ID
 * @param {string} roleName - Role name (must exist in permissions table)
 * @returns {Promise<Object>} Success object or error object
 */
export async function assignRoleToJobTitle(jobTitleId, roleName) {
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
        error: 'Unauthorized: Only IT_ADMIN users can assign roles to job titles'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Verify job title belongs to the company
    const { data: jobTitle, error: jobTitleError } = await supabase
      .from('job_titles')
      .select('id, company_id')
      .eq('id', jobTitleId)
      .eq('company_id', companyId)
      .single()

    if (jobTitleError || !jobTitle) {
      return {
        success: false,
        error: 'Job title not found or access denied'
      }
    }

    // Verify role exists in permissions table
    const { data: role, error: roleError } = await supabase
      .from('permissions')
      .select('role')
      .eq('role', roleName)
      .single()

    if (roleError || !role) {
      return {
        success: false,
        error: `Role '${roleName}' does not exist in permissions table`
      }
    }

    // Insert role assignment (or ignore if already exists due to unique constraint)
    const { error } = await supabase
      .from('job_role_assignments')
      .insert({
        job_title_id: jobTitleId,
        role_name: roleName
      })

    if (error) {
      // Check if it's a unique constraint violation (already assigned)
      if (error.code === '23505') {
        return {
          success: true,
          message: 'Role already assigned to this job title'
        }
      }
      
      console.error('Role assignment error:', error)
      return {
        success: false,
        error: error.message || 'Failed to assign role to job title'
      }
    }

    return {
      success: true,
      message: 'Role assigned successfully'
    }
  } catch (error) {
    console.error('Assign role to job title error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while assigning role'
    }
  }
}

/**
 * Remove a role from a job title
 * @param {string} jobTitleId - Job title ID
 * @param {string} roleName - Role name to remove
 * @returns {Promise<Object>} Success object or error object
 */
export async function removeRoleFromJobTitle(jobTitleId, roleName) {
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
        error: 'Unauthorized: Only IT_ADMIN users can remove roles from job titles'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Verify job title belongs to the company
    const { data: jobTitle, error: jobTitleError } = await supabase
      .from('job_titles')
      .select('id, company_id')
      .eq('id', jobTitleId)
      .eq('company_id', companyId)
      .single()

    if (jobTitleError || !jobTitle) {
      return {
        success: false,
        error: 'Job title not found or access denied'
      }
    }

    // Delete role assignment
    const { error } = await supabase
      .from('job_role_assignments')
      .delete()
      .eq('job_title_id', jobTitleId)
      .eq('role_name', roleName)

    if (error) {
      console.error('Remove role from job title error:', error)
      return {
        success: false,
        error: error.message || 'Failed to remove role from job title'
      }
    }

    return {
      success: true,
      message: 'Role removed successfully'
    }
  } catch (error) {
    console.error('Remove role from job title error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while removing role'
    }
  }
}

/**
 * Delete a job title
 * @param {string} jobTitleId - Job title ID
 * @returns {Promise<Object>} Success object or error object
 */
export async function deleteJobTitle(jobTitleId) {
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
        error: 'Unauthorized: Only IT_ADMIN users can delete job titles'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Verify job title belongs to the company
    const { data: jobTitle, error: checkError } = await supabase
      .from('job_titles')
      .select('id, company_id')
      .eq('id', jobTitleId)
      .eq('company_id', companyId)
      .single()

    if (checkError || !jobTitle) {
      return {
        success: false,
        error: 'Job title not found or access denied'
      }
    }

    // Check if any users are using this job title
    const { data: usersWithTitle, error: usersError } = await supabase
      .from('users')
      .select('id')
      .eq('job_title_id', jobTitleId)
      .limit(1)

    if (usersError) {
      console.error('Error checking users with job title:', usersError)
    }

    if (usersWithTitle && usersWithTitle.length > 0) {
      return {
        success: false,
        error: 'Cannot delete job title: Some users are still assigned to this title. Please reassign them first.'
      }
    }

    // Delete job title
    const { error } = await supabase
      .from('job_titles')
      .delete()
      .eq('id', jobTitleId)
      .eq('company_id', companyId) // CRITICAL: Ensure tenant isolation

    if (error) {
      console.error('Job title deletion error:', error)
      return {
        success: false,
        error: error.message || 'Failed to delete job title'
      }
    }

    return {
      success: true,
      message: 'Job title deleted successfully'
    }
  } catch (error) {
    console.error('Delete job title error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while deleting job title'
    }
  }
}

// ============================================================================
// AUTOMATION ENGINE FUNCTIONS
// ============================================================================

/**
 * Execute automation rules based on trigger event
 * CRITICAL: This function is called automatically when events occur
 * @param {string} event - Trigger event (e.g., 'USER_CREATED', 'ASSET_STATUS_CHANGE')
 * @param {Object} data - Event data that triggered the automation
 * @returns {Promise<Object>} Success object with execution results
 */
export async function executeAutomation(event, data) {
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

    // Find all active automation rules for this event and company
    const { data: rules, error: rulesError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('company_id', companyId) // CRITICAL: Tenant isolation
      .eq('trigger_event', event)
      .eq('is_active', true)

    if (rulesError) {
      console.error('Error fetching automation rules:', rulesError)
      return {
        success: false,
        error: 'Failed to fetch automation rules'
      }
    }

    if (!rules || rules.length === 0) {
      return {
        success: true,
        executed: 0,
        message: 'No automation rules found for this event'
      }
    }

    const executionResults = []

    // Execute each matching rule
    for (const rule of rules) {
      try {
        // Check conditions if specified
        if (rule.conditions && !evaluateConditions(rule.conditions, data)) {
          // Log skipped execution
          await logAutomationExecution(companyId, rule.id, event, rule.action, 'SKIPPED', null, null, data)
          executionResults.push({
            ruleId: rule.id,
            ruleName: rule.name,
            status: 'SKIPPED',
            reason: 'Conditions not met'
          })
          continue
        }

        // Execute the action
        const actionResult = await executeAction(rule.action, rule.action_config, data, companyId)

        // Log successful execution
        await logAutomationExecution(
          companyId,
          rule.id,
          event,
          rule.action,
          actionResult.success ? 'SUCCESS' : 'FAILED',
          actionResult,
          actionResult.error || null,
          data
        )

        executionResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          status: actionResult.success ? 'SUCCESS' : 'FAILED',
          result: actionResult
        })
      } catch (error) {
        console.error(`Error executing rule ${rule.id}:`, error)
        
        // Log failed execution
        await logAutomationExecution(
          companyId,
          rule.id,
          event,
          rule.action,
          'FAILED',
          null,
          error.message,
          data
        )

        executionResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          status: 'FAILED',
          error: error.message
        })
      }
    }

    return {
      success: true,
      executed: executionResults.filter(r => r.status === 'SUCCESS').length,
      skipped: executionResults.filter(r => r.status === 'SKIPPED').length,
      failed: executionResults.filter(r => r.status === 'FAILED').length,
      results: executionResults
    }
  } catch (error) {
    console.error('Execute automation error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while executing automation'
    }
  }
}

/**
 * Evaluate automation rule conditions
 * @param {Object} conditions - Conditions object
 * @param {Object} data - Event data
 * @returns {boolean} True if conditions are met
 */
function evaluateConditions(conditions, data) {
  if (!conditions || typeof conditions !== 'object') {
    return true // No conditions means always true
  }

  // Simple condition evaluation
  for (const [key, value] of Object.entries(conditions)) {
    if (data[key] !== value) {
      return false
    }
  }

  return true
}

/**
 * Execute automation action
 * @param {string} action - Action type
 * @param {Object} config - Action configuration
 * @param {Object} data - Event data
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Action execution result
 */
async function executeAction(action, config, data, companyId) {
  switch (action) {
    case 'CREATE_TICKET':
      // config should contain: { title, description, priority, count? }
      const ticketCount = config.count || 1
      const createdTickets = []

      for (let i = 0; i < ticketCount; i++) {
        const ticketTitle = config.title_template
          ? config.title_template.replace('{index}', i + 1).replace('{event}', JSON.stringify(data))
          : config.title || `Automated Ticket ${i + 1}`

        const ticketDescription = config.description_template
          ? config.description_template.replace('{event}', JSON.stringify(data))
          : config.description || `Automated ticket created by automation rule`

        const result = await createTicket({
          title: ticketTitle,
          description: ticketDescription,
          priority: config.priority || 'Medium'
        })

        if (result.success) {
          createdTickets.push(result.ticket)
        }
      }

      return {
        success: createdTickets.length > 0,
        tickets: createdTickets,
        count: createdTickets.length
      }

    case 'SEND_NOTIFICATION':
      // Placeholder for notification service
      return {
        success: true,
        message: 'Notification sent (placeholder)'
      }

    case 'UPDATE_ASSET':
      if (data.asset_id && config.status) {
        const result = await updateAsset(data.asset_id, { status: config.status })
        return result
      }
      return {
        success: false,
        error: 'Missing asset_id or status in config'
      }

    case 'UPDATE_STATUS':
      // Generic status update
      return {
        success: true,
        message: 'Status updated (placeholder)'
      }

    default:
      return {
        success: false,
        error: `Unknown action: ${action}`
      }
  }
}

/**
 * Log automation execution
 * @param {string} companyId - Company ID
 * @param {string} ruleId - Rule ID
 * @param {string} event - Trigger event
 * @param {string} action - Action executed
 * @param {string} status - Execution status
 * @param {Object} result - Execution result
 * @param {string} errorMessage - Error message if failed
 * @param {Object} triggerData - Data that triggered the automation
 */
async function logAutomationExecution(companyId, ruleId, event, action, status, result, errorMessage, triggerData) {
  try {
    await supabase
      .from('automation_logs')
      .insert({
        company_id: companyId,
        rule_id: ruleId,
        trigger_event: event,
        action: action,
        execution_status: status,
        execution_result: result,
        error_message: errorMessage,
        triggered_by_data: triggerData
      })
  } catch (error) {
    console.error('Error logging automation execution:', error)
  }
}

/**
 * Create automation rule
 * @param {Object} data - Rule data (name, description, trigger_event, action, action_config, conditions, is_active)
 * @returns {Promise<Object>} Success object with rule data or error object
 */
export async function createAutomationRule(data) {
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
        error: 'Unauthorized: Only IT_ADMIN users can create automation rules'
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
    if (!data.name || !data.trigger_event || !data.action) {
      return {
        success: false,
        error: 'Name, trigger event, and action are required'
      }
    }

    // Insert new automation rule
    const { data: newRule, error } = await supabase
      .from('automation_rules')
      .insert({
        company_id: companyId, // CRITICAL: Tenant isolation
        name: data.name,
        description: data.description || null,
        trigger_event: data.trigger_event,
        action: data.action,
        action_config: data.action_config || {},
        conditions: data.conditions || null,
        is_active: data.is_active !== undefined ? data.is_active : true,
        created_by_user_id: currentUser.id
      })
      .select()
      .single()

    if (error) {
      console.error('Automation rule creation error:', error)
      return {
        success: false,
        error: error.message || 'Failed to create automation rule'
      }
    }

    return {
      success: true,
      rule: newRule
    }
  } catch (error) {
    console.error('Create automation rule error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating automation rule'
    }
  }
}

/**
 * Get all automation rules for the current company
 * @returns {Promise<Object>} Success object with rules array or error object
 */
export async function getCompanyAutomationRules() {
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
        error: 'Unauthorized: Only IT_ADMIN users can view automation rules'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Fetch all automation rules for the current company (tenant isolation)
    const { data: rules, error } = await supabase
      .from('automation_rules')
      .select(`
        id,
        name,
        description,
        trigger_event,
        action,
        action_config,
        conditions,
        is_active,
        created_at,
        updated_at,
        users:created_by_user_id(email)
      `)
      .eq('company_id', companyId) // CRITICAL: Tenant isolation
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching automation rules:', error)
      return {
        success: false,
        error: 'Failed to fetch automation rules'
      }
    }

    return {
      success: true,
      rules: rules || []
    }
  } catch (error) {
    console.error('Get automation rules error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching automation rules'
    }
  }
}

/**
 * Update automation rule
 * @param {string} ruleId - Rule ID
 * @param {Object} data - Updated rule data
 * @returns {Promise<Object>} Success object with updated rule or error object
 */
export async function updateAutomationRule(ruleId, data) {
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
        error: 'Unauthorized: Only IT_ADMIN users can update automation rules'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Verify rule belongs to the company (security check)
    const { data: existingRule, error: checkError } = await supabase
      .from('automation_rules')
      .select('id, company_id')
      .eq('id', ruleId)
      .eq('company_id', companyId)
      .single()

    if (checkError || !existingRule) {
      return {
        success: false,
        error: 'Automation rule not found or access denied'
      }
    }

    // Update rule
    const { data: updatedRule, error } = await supabase
      .from('automation_rules')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', ruleId)
      .eq('company_id', companyId) // CRITICAL: Ensure tenant isolation
      .select()
      .single()

    if (error) {
      console.error('Automation rule update error:', error)
      return {
        success: false,
        error: error.message || 'Failed to update automation rule'
      }
    }

    return {
      success: true,
      rule: updatedRule
    }
  } catch (error) {
    console.error('Update automation rule error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating automation rule'
    }
  }
}

/**
 * Delete automation rule
 * @param {string} ruleId - Rule ID
 * @returns {Promise<Object>} Success or error object
 */
export async function deleteAutomationRule(ruleId) {
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
        error: 'Unauthorized: Only IT_ADMIN users can delete automation rules'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Verify rule belongs to the company and delete
    const { error } = await supabase
      .from('automation_rules')
      .delete()
      .eq('id', ruleId)
      .eq('company_id', companyId) // CRITICAL: Ensure tenant isolation

    if (error) {
      console.error('Automation rule deletion error:', error)
      return {
        success: false,
        error: error.message || 'Failed to delete automation rule'
      }
    }

    return {
      success: true,
      message: 'Automation rule deleted successfully'
    }
  } catch (error) {
    console.error('Delete automation rule error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while deleting automation rule'
    }
  }
}

/**
 * Get automation execution logs
 * @param {number} limit - Number of logs to retrieve (default: 50)
 * @returns {Promise<Object>} Success object with logs array or error object
 */
export async function getAutomationLogs(limit = 50) {
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
        error: 'Unauthorized: Only IT_ADMIN users can view automation logs'
      }
    }

    const companyId = getCompanyId()
    if (!companyId) {
      return {
        success: false,
        error: 'Company ID not found in session'
      }
    }

    // Fetch automation logs for the current company (tenant isolation)
    const { data: logs, error } = await supabase
      .from('automation_logs')
      .select(`
        id,
        trigger_event,
        action,
        execution_status,
        error_message,
        executed_at,
        automation_rules:rule_id(name)
      `)
      .eq('company_id', companyId) // CRITICAL: Tenant isolation
      .order('executed_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching automation logs:', error)
      return {
        success: false,
        error: 'Failed to fetch automation logs'
      }
    }

    return {
      success: true,
      logs: logs || []
    }
  } catch (error) {
    console.error('Get automation logs error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching automation logs'
    }
  }
}

