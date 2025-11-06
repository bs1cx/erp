<template>
  <div class="ticket-detail">
    <div class="detail-header">
      <button @click="$emit('close')" class="back-button">
        ← Back to Tickets
      </button>
      <h2 class="ticket-title">{{ ticket?.ticket_number }}: {{ ticket?.title }}</h2>
    </div>

    <!-- Success Message -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      Loading ticket details...
    </div>

    <!-- Ticket Details -->
    <div v-else-if="ticket" class="ticket-content">
      <!-- Ticket Info Card -->
      <div class="info-card">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Status:</span>
            <select
              v-model="ticket.status"
              @change="handleStatusChange"
              class="status-select"
            >
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div class="info-item">
            <span class="info-label">Priority:</span>
            <span class="priority-badge" :class="getPriorityClass(ticket.priority)">
              {{ ticket.priority }}
            </span>
          </div>

          <div class="info-item">
            <span class="info-label">Requester:</span>
            <span class="info-value">{{ ticket.requester?.email || 'N/A' }}</span>
          </div>

          <div class="info-item">
            <span class="info-label">Assigned To:</span>
            <div class="assignee-selector">
              <select
                v-model="selectedAssigneeId"
                @change="handleAssignmentChange"
                class="assignee-select"
                :disabled="loadingAssignment"
              >
                <option :value="null">Unassigned</option>
                <option
                  v-for="user in itUsers"
                  :key="user.id"
                  :value="user.id"
                >
                  {{ user.email }}
                </option>
              </select>
              <span v-if="loadingAssignment" class="loading-spinner">Updating...</span>
            </div>
          </div>

          <div class="info-item">
            <span class="info-label">Created:</span>
            <span class="info-value">{{ formatDate(ticket.created_at) }}</span>
          </div>

          <div v-if="ticket.resolved_at" class="info-item">
            <span class="info-label">Resolved:</span>
            <span class="info-value">{{ formatDate(ticket.resolved_at) }}</span>
          </div>
        </div>

        <div class="ticket-description">
          <h3>Description</h3>
          <p>{{ ticket.description }}</p>
        </div>
      </div>

      <!-- Conversation Log -->
      <div class="conversation-card">
        <h3 class="conversation-title">Conversation Log</h3>
        
        <div class="messages-container">
          <div v-if="messages.length === 0" class="empty-messages">
            No messages yet. Start the conversation below.
          </div>

          <div
            v-for="message in messages"
            :key="message.id"
            class="message-item"
            :class="{ 'internal-note': message.is_internal }"
          >
            <div class="message-header">
              <span class="message-author">{{ message.users?.email || 'Unknown' }}</span>
              <span class="message-time">{{ formatDateTime(message.created_at) }}</span>
              <span v-if="message.is_internal" class="internal-badge">Internal Note</span>
            </div>
            <div class="message-content">
              {{ message.message_text }}
            </div>
          </div>
        </div>

        <!-- Message Input Form -->
        <div class="message-form-card">
          <form @submit.prevent="handleSendMessage" class="message-form">
            <div class="form-group">
              <textarea
                v-model="newMessage"
                class="message-input"
                rows="4"
                placeholder="Type your message..."
                required
                :disabled="loadingMessage"
              ></textarea>
            </div>

            <div class="form-actions">
              <label class="internal-checkbox">
                <input
                  v-model="isInternalNote"
                  type="checkbox"
                  :disabled="loadingMessage"
                />
                <span>Internal Note (visible only to IT staff)</span>
              </label>
              <button
                type="submit"
                class="send-button"
                :disabled="loadingMessage || !newMessage.trim()"
              >
                <span v-if="loadingMessage">Sending...</span>
                <span v-else>Send Message</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import {
  getTicketDetails,
  assignTicket,
  postTicketMessage,
  getITUsers,
  updateTicketStatus
} from '../../services/itService'

const props = defineProps({
  ticketId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['close', 'updated'])

const ticket = ref(null)
const messages = ref([])
const itUsers = ref([])
const loading = ref(false)
const loadingAssignment = ref(false)
const loadingMessage = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const selectedAssigneeId = ref(null)
const newMessage = ref('')
const isInternalNote = ref(false)

// Watch for ticket ID changes
watch(() => props.ticketId, () => {
  if (props.ticketId) {
    loadTicketDetails()
  }
}, { immediate: true })

onMounted(() => {
  loadTicketDetails()
  loadITUsers()
})

/**
 * Load ticket details with messages
 */
async function loadTicketDetails() {
  if (!props.ticketId) return

  loading.value = true
  errorMessage.value = ''
  
  try {
    const result = await getTicketDetails(props.ticketId)
    
    if (result.success) {
      ticket.value = result.ticket
      messages.value = result.messages || []
      selectedAssigneeId.value = ticket.value.assigned_to_user_id
    } else {
      errorMessage.value = result.error || 'Failed to load ticket details'
    }
  } catch (error) {
    console.error('Error loading ticket details:', error)
    errorMessage.value = 'An unexpected error occurred while loading ticket details'
  } finally {
    loading.value = false
  }
}

/**
 * Load IT users for assignment dropdown
 */
async function loadITUsers() {
  try {
    const result = await getITUsers()
    
    if (result.success) {
      itUsers.value = result.users || []
    }
  } catch (error) {
    console.error('Error loading IT users:', error)
  }
}

/**
 * Handle assignment change
 */
async function handleAssignmentChange() {
  loadingAssignment.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await assignTicket(props.ticketId, selectedAssigneeId.value)

    if (result.success) {
      successMessage.value = selectedAssigneeId.value
        ? 'Ticket assigned successfully!'
        : 'Ticket unassigned successfully!'
      
      // Reload ticket details to get updated messages
      await loadTicketDetails()
      
      // Emit update event to parent
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to assign ticket'
      // Revert selection
      selectedAssigneeId.value = ticket.value?.assigned_to_user_id
    }
  } catch (error) {
    console.error('Error assigning ticket:', error)
    errorMessage.value = 'An unexpected error occurred while assigning ticket'
    selectedAssigneeId.value = ticket.value?.assigned_to_user_id
  } finally {
    loadingAssignment.value = false
  }
}

/**
 * Handle status change
 */
async function handleStatusChange() {
  try {
    const userData = localStorage.getItem('user_data')
    const user = userData ? JSON.parse(userData) : null
    const userId = user?.id || null

    const result = await updateTicketStatus(props.ticketId, ticket.value.status, userId)

    if (result.success) {
      successMessage.value = 'Ticket status updated successfully!'
      await loadTicketDetails()
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to update ticket status'
      // Revert status
      await loadTicketDetails()
    }
  } catch (error) {
    console.error('Error updating ticket status:', error)
    errorMessage.value = 'An unexpected error occurred while updating ticket status'
    await loadTicketDetails()
  }
}

/**
 * Handle sending a message
 */
async function handleSendMessage() {
  if (!newMessage.value.trim()) return

  loadingMessage.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const userData = localStorage.getItem('user_data')
    const user = userData ? JSON.parse(userData) : null

    if (!user) {
      errorMessage.value = 'User not authenticated'
      return
    }

    const result = await postTicketMessage(
      props.ticketId,
      user.id,
      newMessage.value,
      isInternalNote.value
    )

    if (result.success) {
      successMessage.value = 'Message sent successfully!'
      newMessage.value = ''
      isInternalNote.value = false
      
      // Reload messages
      await loadTicketDetails()
      
      // Emit update event
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to send message'
    }
  } catch (error) {
    console.error('Error sending message:', error)
    errorMessage.value = 'An unexpected error occurred while sending message'
  } finally {
    loadingMessage.value = false
  }
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

/**
 * Format date and time for display
 */
function formatDateTime(dateString) {
  if (!dateString) return 'N/A'
  
  try {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    return dateString
  }
}
</script>

<style scoped>
.ticket-detail {
  max-width: 1200px;
  margin: 0 auto;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 30px;
}

.back-button {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-surface);
  color: var(--color-text-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.back-button:hover {
  background: var(--color-border-light);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.ticket-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a202c;
  margin: 0;
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

.loading-state {
  text-align: center;
  padding: 40px;
  color: #718096;
}

.ticket-content {
  display: grid;
  gap: 30px;
}

.info-card,
.conversation-card {
  background: white;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-label {
  font-size: 12px;
  font-weight: 600;
  color: #718096;
  text-transform: uppercase;
}

.info-value {
  font-size: 16px;
  color: #2d3748;
  font-weight: 500;
}

.status-select,
.assignee-select {
  padding: 8px 12px;
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.status-select:focus,
.assignee-select:focus {
  outline: none;
  border-color: #4299e1;
}

.assignee-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.loading-spinner {
  font-size: 12px;
  color: #718096;
}

.priority-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.priority-low {
  background: #c6f6d5;
  color: #22543d;
}

.priority-medium {
  background: #fed7aa;
  color: #c05621;
}

.priority-high {
  background: #fbb6ce;
  color: #97266d;
}

.priority-critical {
  background: #fed7d7;
  color: #c53030;
}

.ticket-description {
  padding-top: 20px;
  border-top: 1px solid #e2e8f0;
}

.ticket-description h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1a202c;
  margin-bottom: 12px;
}

.ticket-description p {
  color: #4a5568;
  line-height: 1.6;
}

.conversation-title {
  font-size: 20px;
  font-weight: 600;
  color: #1a202c;
  margin-bottom: 20px;
}

.messages-container {
  max-height: 600px;
  overflow-y: auto;
  padding: 20px;
  background: #f7fafc;
  border-radius: 8px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-messages {
  text-align: center;
  padding: 40px;
  color: #718096;
}

.message-item {
  background: white;
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid #4299e1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.message-item.internal-note {
  border-left-color: #ed8936;
  background: #fffaf0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.message-author {
  font-weight: 600;
  color: #2d3748;
  font-size: 14px;
}

.message-time {
  font-size: 12px;
  color: #718096;
}

.internal-badge {
  padding: 2px 8px;
  background: #fed7aa;
  color: #c05621;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.message-content {
  color: #4a5568;
  line-height: 1.6;
  white-space: pre-wrap;
}

.message-form-card {
  background: #f7fafc;
  padding: 20px;
  border-radius: 8px;
}

.message-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s;
}

.message-input:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.internal-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #4a5568;
  cursor: pointer;
}

.send-button {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.send-button:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(42, 99, 62, 0.3);
}

.send-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }

  .form-actions {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .send-button {
    width: 100%;
  }
}
</style>

