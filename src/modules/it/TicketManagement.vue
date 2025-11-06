<template>
  <div class="ticket-management">
    <h2 class="section-title">Ticket Management & SLA</h2>
    <p class="section-description">
      Manage support tickets and monitor SLA compliance. All tickets are isolated to your company (Company ID: {{ companyId }}).
    </p>

    <!-- Success Message -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- SLA Statistics -->
    <div v-if="slaStats" class="sla-stats-card">
      <h3 class="form-title">SLA Statistics</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">{{ slaStats.totalClosed }}</div>
          <div class="stat-label">Total Closed Tickets</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ slaStats.slaMetPercentage }}%</div>
          <div class="stat-label">SLA Compliance Rate</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ formatMinutes(slaStats.avgResolutionTimeMinutes) }}</div>
          <div class="stat-label">Average Resolution Time</div>
        </div>
      </div>
    </div>

    <!-- Create Ticket Form -->
    <div class="form-card">
      <h3 class="form-title">Create New Ticket</h3>
      <form @submit.prevent="handleCreateTicket" class="ticket-form">
        <div class="form-group">
          <label for="title" class="form-label">Title *</label>
          <input
            id="title"
            v-model="ticketForm.title"
            type="text"
            class="form-input"
            placeholder="Cannot access email"
            required
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label for="description" class="form-label">Description *</label>
          <textarea
            id="description"
            v-model="ticketForm.description"
            class="form-textarea"
            rows="4"
            placeholder="Describe the issue..."
            required
            :disabled="loading"
          ></textarea>
        </div>

        <div class="form-group">
          <label for="priority" class="form-label">Priority *</label>
          <select
            id="priority"
            v-model="ticketForm.priority"
            class="form-select"
            required
            :disabled="loading"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </div>

        <button
          type="submit"
          class="submit-button"
          :disabled="loading || !isTicketFormValid"
        >
          <span v-if="loading">Creating...</span>
          <span v-else>Create Ticket</span>
        </button>
      </form>
    </div>

    <!-- Tickets List -->
    <div v-if="!selectedTicketId" class="tickets-list-card">
      <div class="list-header">
        <h3 class="form-title">All Tickets</h3>
        <button @click="loadTickets" class="refresh-button" :disabled="loadingTickets">
          <span v-if="loadingTickets">Refreshing...</span>
          <span v-else>Refresh</span>
        </button>
      </div>

      <div v-if="loadingTickets" class="loading-state">
        Loading tickets...
      </div>

      <div v-else-if="tickets.length === 0" class="empty-state">
        No tickets found. Create your first ticket above.
      </div>

      <div v-else class="tickets-table">
        <table>
          <thead>
            <tr>
              <th>Ticket #</th>
              <th>Title</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Assigned To</th>
              <th>Requester</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ticket in tickets" :key="ticket.id">
              <td>{{ ticket.ticket_number }}</td>
              <td>
                <button @click="viewTicketDetail(ticket.id)" class="ticket-link">
                  {{ ticket.title }}
                </button>
              </td>
              <td>
                <span class="status-badge" :class="getStatusClass(ticket.status)">
                  {{ ticket.status }}
                </span>
              </td>
              <td>
                <span class="priority-badge" :class="getPriorityClass(ticket.priority)">
                  {{ ticket.priority }}
                </span>
              </td>
              <td>
                <span v-if="ticket.assignee?.email" class="assignee-name">
                  {{ ticket.assignee.email }}
                </span>
                <span v-else class="unassigned">Unassigned</span>
              </td>
              <td>{{ ticket.requester?.email || 'N/A' }}</td>
              <td>{{ formatDate(ticket.created_at) }}</td>
              <td>
                <button @click="viewTicketDetail(ticket.id)" class="view-button">
                  View Details
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Ticket Detail View -->
    <div v-if="selectedTicketId" class="ticket-detail-wrapper">
      <TicketDetail
        :ticket-id="selectedTicketId"
        @close="closeTicketDetail"
        @updated="handleTicketUpdated"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { createTicket, getCompanyTickets, updateTicketStatus, getSLAMetrics } from '../../services/itService'
import TicketDetail from './TicketDetail.vue'

const ticketForm = ref({
  title: '',
  description: '',
  priority: 'Medium'
})

const loading = ref(false)
const loadingTickets = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const tickets = ref([])
const slaStats = ref(null)
const companyId = ref(null)
const selectedTicketId = ref(null)

// Get company ID from current user session
onMounted(() => {
  const userData = localStorage.getItem('user_data')
  if (userData) {
    try {
      const user = JSON.parse(userData)
      companyId.value = user.company_id
    } catch (error) {
      console.error('Error parsing user data:', error)
    }
  }
  
  loadTickets()
  loadSLAMetrics()
})

// Form validation
const isTicketFormValid = computed(() => {
  return ticketForm.value.title &&
         ticketForm.value.description &&
         ticketForm.value.priority
})

/**
 * Load tickets for the current company
 */
async function loadTickets() {
  loadingTickets.value = true
  errorMessage.value = ''
  
  try {
    const result = await getCompanyTickets()
    
    if (result.success) {
      tickets.value = result.tickets || []
    } else {
      errorMessage.value = result.error || 'Failed to load tickets'
    }
  } catch (error) {
    console.error('Error loading tickets:', error)
    errorMessage.value = 'An unexpected error occurred while loading tickets'
  } finally {
    loadingTickets.value = false
  }
}

/**
 * Load SLA metrics
 */
async function loadSLAMetrics() {
  try {
    const result = await getSLAMetrics()
    
    if (result.success) {
      slaStats.value = result.statistics
    }
  } catch (error) {
    console.error('Error loading SLA metrics:', error)
  }
}

/**
 * Handle form submission to create ticket
 */
async function handleCreateTicket() {
  errorMessage.value = ''
  successMessage.value = ''
  loading.value = true

  try {
    if (!isTicketFormValid.value) {
      errorMessage.value = 'Please fill in all required fields'
      loading.value = false
      return
    }

    const result = await createTicket(ticketForm.value)

    if (result.success) {
      successMessage.value = 'Ticket created successfully!'
      
      // Reset form
      ticketForm.value = {
        title: '',
        description: '',
        priority: 'Medium'
      }
      
      // Reload tickets
      await loadTickets()
    } else {
      errorMessage.value = result.error || 'Failed to create ticket'
    }
  } catch (error) {
    console.error('Error creating ticket:', error)
    errorMessage.value = 'An unexpected error occurred. Please try again.'
  } finally {
    loading.value = false
  }
}

/**
 * Handle ticket status update
 */
async function handleUpdateTicketStatus(ticketId, newStatus) {
  try {
    const userData = localStorage.getItem('user_data')
    const user = userData ? JSON.parse(userData) : null
    const userId = user?.id || null

    const result = await updateTicketStatus(ticketId, newStatus, userId)

    if (result.success) {
      successMessage.value = 'Ticket status updated successfully!'
      await loadTickets()
      await loadSLAMetrics()
    } else {
      errorMessage.value = result.error || 'Failed to update ticket status'
    }
  } catch (error) {
    console.error('Error updating ticket status:', error)
    errorMessage.value = 'An unexpected error occurred while updating ticket'
  }
}

/**
 * Get CSS class for status badge
 */
function getStatusClass(status) {
  const statusClasses = {
    'Open': 'status-open',
    'In Progress': 'status-in-progress',
    'Resolved': 'status-resolved',
    'Closed': 'status-closed'
  }
  return statusClasses[status] || 'status-default'
}

/**
 * Get CSS class for priority badge
 */
function getPriorityClass(priority) {
  const priorityClasses = {
    'Low': 'priority-low',
    'Medium': 'priority-medium',
    'High': 'priority-high',
    'Critical': 'priority-critical'
  }
  return priorityClasses[priority] || 'priority-default'
}

/**
 * Format minutes to readable time
 */
function formatMinutes(minutes) {
  if (!minutes) return 'N/A'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

/**
 * View ticket detail
 */
function viewTicketDetail(ticketId) {
  selectedTicketId.value = ticketId
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

/**
 * Close ticket detail view
 */
function closeTicketDetail() {
  selectedTicketId.value = null
}

/**
 * Handle ticket updated event
 */
async function handleTicketUpdated() {
  await loadTickets()
  await loadSLAMetrics()
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A'
  
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch (error) {
    return dateString
  }
}
</script>

<style scoped>
.ticket-management {
  max-width: 100%;
  margin: 0;
}

.section-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-text-dark);
  margin-bottom: var(--spacing-sm);
}

.section-description {
  color: var(--color-text-medium);
  margin-bottom: var(--spacing-xl);
  line-height: 1.6;
}

.sla-stats-card,
.form-card,
.tickets-list-card {
  background: var(--color-background);
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  box-shadow: 0 1px 3px var(--color-shadow);
  margin-bottom: var(--spacing-xl);
}

.form-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text-dark);
  margin-bottom: var(--spacing-lg);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.stat-item {
  text-align: center;
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-light);
}

.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: var(--spacing-sm);
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
}

.ticket-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: #4a5568;
}

.form-input,
.form-textarea,
.form-select {
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  transition: all 0.2s;
  background: white;
  font-family: inherit;
}

.form-textarea {
  resize: vertical;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.submit-button {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
  margin-top: var(--spacing-sm);
}

.submit-button:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(42, 99, 62, 0.3);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.success-message {
  padding: 12px 16px;
  background: #c6f6d5;
  border: 1px solid #68d391;
  border-radius: 8px;
  color: #22543d;
  font-size: 14px;
  margin-bottom: 20px;
}

.error-message {
  padding: 12px 16px;
  background: #fed7d7;
  border: 1px solid #fc8181;
  border-radius: 8px;
  color: #c53030;
  font-size: 14px;
  margin-bottom: 20px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.refresh-button {
  padding: 8px 16px;
  background: #edf2f7;
  color: #4a5568;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.refresh-button:hover:not(:disabled) {
  background: #e2e8f0;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 40px;
  color: #718096;
}

.tickets-table {
  overflow-x: auto;
}

.tickets-table table {
  width: 100%;
  border-collapse: collapse;
}

.tickets-table th,
.tickets-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.tickets-table th {
  font-weight: 600;
  color: #4a5568;
  background: #f7fafc;
}

.status-badge,
.priority-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-open {
  background: var(--color-info-light);
  color: var(--color-text-on-primary);
}

.status-in-progress {
  background: var(--color-warning);
  color: var(--color-text-on-primary);
}

.status-resolved {
  background: var(--color-success-light);
  color: var(--color-text-on-primary);
}

.status-closed {
  background: var(--color-success);
  color: var(--color-text-on-primary);
}

.priority-low {
  background: var(--color-success-light);
  color: var(--color-text-on-primary);
}

.priority-medium {
  background: var(--color-warning);
  color: var(--color-text-on-primary);
}

.priority-high {
  background: var(--color-warning-light);
  color: var(--color-text-dark);
}

.priority-critical {
  background: var(--color-danger);
  color: var(--color-text-on-primary);
}

.ticket-link {
  background: none;
  border: none;
  color: var(--color-primary);
  text-decoration: none;
  cursor: pointer;
  font-size: var(--font-size-sm);
  padding: 0;
  text-align: left;
  font-weight: 500;
  transition: color var(--transition-base);
}

.ticket-link:hover {
  color: var(--color-primary-dark);
  text-decoration: underline;
}

.assignee-name {
  color: #2d3748;
  font-weight: 500;
}

.unassigned {
  color: #718096;
  font-style: italic;
}

.view-button {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.view-button:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.ticket-detail-wrapper {
  margin-top: 30px;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .tickets-table {
    font-size: 14px;
  }
}
</style>

