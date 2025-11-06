<template>
  <div class="automation-rules">
    <h2 class="section-title">Automation & Rules Engine</h2>
    <p class="section-description">
      Configure automated workflows and rules to streamline IT operations. All automation rules are isolated to your company (Company ID: {{ companyId }}).
    </p>

    <!-- Success Message -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- Create/Edit Rule Form -->
    <div class="form-card">
      <h3 class="form-title">{{ editingRule ? 'Edit Automation Rule' : 'Create New Automation Rule' }}</h3>
      <form @submit.prevent="handleSaveRule" class="rule-form">
        <div class="form-group">
          <label for="name" class="form-label">Rule Name *</label>
          <input
            id="name"
            v-model="formData.name"
            type="text"
            class="form-input"
            placeholder="Auto-create tickets on user creation"
            required
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label for="description" class="form-label">Description</label>
          <textarea
            id="description"
            v-model="formData.description"
            class="form-textarea"
            rows="3"
            placeholder="Describe what this automation rule does..."
            :disabled="loading"
          ></textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="trigger_event" class="form-label">Trigger Event *</label>
            <select
              id="trigger_event"
              v-model="formData.trigger_event"
              class="form-select"
              required
              :disabled="loading"
            >
              <option value="">Select trigger event</option>
              <option value="USER_CREATED">User Created</option>
              <option value="USER_UPDATED">User Updated</option>
              <option value="ASSET_CREATED">Asset Created</option>
              <option value="ASSET_STATUS_CHANGE">Asset Status Changed</option>
              <option value="ASSET_ASSIGNED">Asset Assigned</option>
              <option value="TICKET_CREATED">Ticket Created</option>
              <option value="TICKET_STATUS_CHANGE">Ticket Status Changed</option>
              <option value="TICKET_PRIORITY_CHANGE">Ticket Priority Changed</option>
              <option value="ARTICLE_PUBLISHED">Article Published</option>
              <option value="WARRANTY_EXPIRING">Warranty Expiring</option>
            </select>
          </div>

          <div class="form-group">
            <label for="action" class="form-label">Action *</label>
            <select
              id="action"
              v-model="formData.action"
              class="form-select"
              required
              :disabled="loading"
            >
              <option value="">Select action</option>
              <option value="CREATE_TICKET">Create Ticket</option>
              <option value="SEND_NOTIFICATION">Send Notification</option>
              <option value="UPDATE_ASSET">Update Asset</option>
              <option value="ASSIGN_USER">Assign User</option>
              <option value="CREATE_REMINDER">Create Reminder</option>
              <option value="UPDATE_STATUS">Update Status</option>
              <option value="EXECUTE_WORKFLOW">Execute Workflow</option>
            </select>
          </div>
        </div>

        <!-- Action Configuration (for CREATE_TICKET) -->
        <div v-if="formData.action === 'CREATE_TICKET'" class="action-config">
          <h4 class="config-title">Action Configuration</h4>
          
          <div class="form-group">
            <label for="ticket_count" class="form-label">Number of Tickets to Create</label>
            <input
              id="ticket_count"
              v-model.number="formData.action_config.count"
              type="number"
              class="form-input"
              min="1"
              max="10"
              placeholder="1"
              :disabled="loading"
            />
          </div>

          <div class="form-group">
            <label for="ticket_title" class="form-label">Ticket Title Template</label>
            <input
              id="ticket_title"
              v-model="formData.action_config.title_template"
              type="text"
              class="form-input"
              placeholder="Onboarding Ticket {index}"
              :disabled="loading"
            />
            <small class="form-hint">Use {index} for ticket number, {event} for event data</small>
          </div>

          <div class="form-group">
            <label for="ticket_description" class="form-label">Ticket Description Template</label>
            <textarea
              id="ticket_description"
              v-model="formData.action_config.description_template"
              class="form-textarea"
              rows="3"
              placeholder="Automated ticket created when user was created"
              :disabled="loading"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="ticket_priority" class="form-label">Priority</label>
            <select
              id="ticket_priority"
              v-model="formData.action_config.priority"
              class="form-select"
              :disabled="loading"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">
            <input
              v-model="formData.is_active"
              type="checkbox"
              class="checkbox-input"
              :disabled="loading"
            />
            <span class="checkbox-label">Active (rule will execute when triggered)</span>
          </label>
        </div>

        <div class="form-actions">
          <button
            type="submit"
            class="submit-button"
            :disabled="loading || !isFormValid"
          >
            <span v-if="loading">{{ editingRule ? 'Updating...' : 'Creating...' }}</span>
            <span v-else>{{ editingRule ? 'Update Rule' : 'Create Rule' }}</span>
          </button>
          <button
            v-if="editingRule"
            type="button"
            @click="cancelEdit"
            class="cancel-button"
            :disabled="loading"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>

    <!-- Rules List -->
    <div class="rules-list-card">
      <div class="list-header">
        <h3 class="form-title">Automation Rules</h3>
        <button @click="loadRules" class="refresh-button" :disabled="loadingRules">
          <span v-if="loadingRules">Refreshing...</span>
          <span v-else>Refresh</span>
        </button>
      </div>

      <div v-if="loadingRules" class="loading-state">
        Loading automation rules...
      </div>

      <div v-else-if="rules.length === 0" class="empty-state">
        No automation rules found. Create your first rule above.
      </div>

      <div v-else class="rules-list">
        <div
          v-for="rule in rules"
          :key="rule.id"
          class="rule-card"
          :class="{ inactive: !rule.is_active }"
        >
          <div class="rule-header">
            <div>
              <h4 class="rule-name">{{ rule.name }}</h4>
              <p v-if="rule.description" class="rule-description">{{ rule.description }}</p>
            </div>
            <div class="rule-status">
              <span v-if="rule.is_active" class="status-badge status-active">Active</span>
              <span v-else class="status-badge status-inactive">Inactive</span>
            </div>
          </div>

          <div class="rule-details">
            <div class="detail-item">
              <span class="detail-label">Trigger:</span>
              <span class="detail-value">{{ formatTriggerEvent(rule.trigger_event) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Action:</span>
              <span class="detail-value">{{ formatAction(rule.action) }}</span>
            </div>
            <div v-if="rule.action_config?.count" class="detail-item">
              <span class="detail-label">Tickets to Create:</span>
              <span class="detail-value">{{ rule.action_config.count }}</span>
            </div>
          </div>

          <div class="rule-footer">
            <span class="rule-meta">
              Created by {{ rule.users?.email || 'Unknown' }} • {{ formatDate(rule.created_at) }}
            </span>
            <div class="rule-actions">
              <button @click="toggleRuleStatus(rule)" class="toggle-button">
                {{ rule.is_active ? 'Deactivate' : 'Activate' }}
              </button>
              <button @click="editRule(rule)" class="edit-button">Edit</button>
              <button @click="deleteRule(rule.id)" class="delete-button">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import {
  createAutomationRule,
  getCompanyAutomationRules,
  updateAutomationRule,
  deleteAutomationRule
} from '../../services/itService'

const formData = ref({
  name: '',
  description: '',
  trigger_event: '',
  action: '',
  action_config: {
    count: 1,
    title_template: '',
    description_template: '',
    priority: 'Medium'
  },
  is_active: true
})

const loading = ref(false)
const loadingRules = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const rules = ref([])
const companyId = ref(null)
const editingRule = ref(null)

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
  
  loadRules()
})

// Form validation
const isFormValid = computed(() => {
  return formData.value.name &&
         formData.value.trigger_event &&
         formData.value.action
})

/**
 * Load automation rules
 */
async function loadRules() {
  loadingRules.value = true
  errorMessage.value = ''
  
  try {
    const result = await getCompanyAutomationRules()
    
    if (result.success) {
      rules.value = result.rules || []
    } else {
      errorMessage.value = result.error || 'Failed to load automation rules'
    }
  } catch (error) {
    console.error('Error loading automation rules:', error)
    errorMessage.value = 'An unexpected error occurred while loading rules'
  } finally {
    loadingRules.value = false
  }
}

/**
 * Handle form submission
 */
async function handleSaveRule() {
  errorMessage.value = ''
  successMessage.value = ''
  loading.value = true

  try {
    if (!isFormValid.value) {
      errorMessage.value = 'Please fill in all required fields'
      loading.value = false
      return
    }

    // Prepare action_config
    const actionConfig = {}
    if (formData.value.action === 'CREATE_TICKET') {
      actionConfig.count = formData.value.action_config.count || 1
      actionConfig.title_template = formData.value.action_config.title_template || ''
      actionConfig.description_template = formData.value.action_config.description_template || ''
      actionConfig.priority = formData.value.action_config.priority || 'Medium'
    }

    const ruleData = {
      name: formData.value.name,
      description: formData.value.description,
      trigger_event: formData.value.trigger_event,
      action: formData.value.action,
      action_config: Object.keys(actionConfig).length > 0 ? actionConfig : null,
      is_active: formData.value.is_active
    }

    let result
    if (editingRule.value) {
      result = await updateAutomationRule(editingRule.value.id, ruleData)
    } else {
      result = await createAutomationRule(ruleData)
    }

    if (result.success) {
      successMessage.value = editingRule.value
        ? 'Automation rule updated successfully!'
        : 'Automation rule created successfully!'
      
      resetForm()
      await loadRules()
    } else {
      errorMessage.value = result.error || 'Failed to save automation rule'
    }
  } catch (error) {
    console.error('Error saving automation rule:', error)
    errorMessage.value = 'An unexpected error occurred. Please try again.'
  } finally {
    loading.value = false
  }
}

/**
 * Edit a rule
 */
function editRule(rule) {
  editingRule.value = rule
  formData.value = {
    name: rule.name,
    description: rule.description || '',
    trigger_event: rule.trigger_event,
    action: rule.action,
    action_config: rule.action_config || {
      count: 1,
      title_template: '',
      description_template: '',
      priority: 'Medium'
    },
    is_active: rule.is_active
  }
  
  document.querySelector('.form-card')?.scrollIntoView({ behavior: 'smooth' })
}

/**
 * Toggle rule status
 */
async function toggleRuleStatus(rule) {
  try {
    const result = await updateAutomationRule(rule.id, { is_active: !rule.is_active })
    
    if (result.success) {
      successMessage.value = rule.is_active
        ? 'Rule deactivated successfully!'
        : 'Rule activated successfully!'
      await loadRules()
    } else {
      errorMessage.value = result.error || 'Failed to update rule status'
    }
  } catch (error) {
    console.error('Error toggling rule status:', error)
    errorMessage.value = 'An unexpected error occurred'
  }
}

/**
 * Delete a rule
 */
async function deleteRule(ruleId) {
  if (!confirm('Are you sure you want to delete this automation rule?')) {
    return
  }

  try {
    const result = await deleteAutomationRule(ruleId)
    
    if (result.success) {
      successMessage.value = 'Automation rule deleted successfully!'
      await loadRules()
    } else {
      errorMessage.value = result.error || 'Failed to delete rule'
    }
  } catch (error) {
    console.error('Error deleting rule:', error)
    errorMessage.value = 'An unexpected error occurred'
  }
}

/**
 * Cancel editing
 */
function cancelEdit() {
  editingRule.value = null
  resetForm()
}

/**
 * Reset form
 */
function resetForm() {
  formData.value = {
    name: '',
    description: '',
    trigger_event: '',
    action: '',
    action_config: {
      count: 1,
      title_template: '',
      description_template: '',
      priority: 'Medium'
    },
    is_active: true
  }
  editingRule.value = null
}

/**
 * Format trigger event for display
 */
function formatTriggerEvent(event) {
  return event.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

/**
 * Format action for display
 */
function formatAction(action) {
  return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
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
.automation-rules {
  max-width: 1200px;
  margin: 0 auto;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 8px;
}

.section-description {
  color: #718096;
  margin-bottom: 30px;
  line-height: 1.6;
}

.form-card,
.rules-list-card {
  background: white;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 30px;
}

.form-title {
  font-size: 20px;
  font-weight: 600;
  color: #1a202c;
  margin-bottom: 20px;
}

.rule-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
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

.form-hint {
  font-size: 12px;
  color: #718096;
}

.action-config {
  background: #f7fafc;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.config-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a202c;
  margin-bottom: 15px;
}

.checkbox-input {
  margin-right: 8px;
}

.checkbox-label {
  font-size: 14px;
  color: #4a5568;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.submit-button {
  padding: 14px 24px;
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-button:hover:not(:disabled) {
  background: #3182ce;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(66, 153, 225, 0.4);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-button {
  padding: 14px 24px;
  background: #e2e8f0;
  color: #4a5568;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.cancel-button:hover:not(:disabled) {
  background: #cbd5e0;
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

.rules-list {
  display: grid;
  gap: 20px;
}

.rule-card {
  background: #f7fafc;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  transition: all 0.2s;
}

.rule-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.rule-card.inactive {
  opacity: 0.7;
  border-left: 4px solid #cbd5e0;
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.rule-name {
  font-size: 18px;
  font-weight: 600;
  color: #1a202c;
  margin: 0 0 8px 0;
}

.rule-description {
  color: #718096;
  font-size: 14px;
  margin: 0;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-active {
  background: #c6f6d5;
  color: #22543d;
}

.status-inactive {
  background: #e2e8f0;
  color: #4a5568;
}

.rule-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 15px;
  padding-top: 15px;
  border-top: 1px solid #e2e8f0;
}

.detail-item {
  display: flex;
  gap: 8px;
}

.detail-label {
  font-weight: 600;
  color: #4a5568;
  font-size: 14px;
}

.detail-value {
  color: #2d3748;
  font-size: 14px;
}

.rule-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 15px;
  border-top: 1px solid #e2e8f0;
}

.rule-meta {
  font-size: 12px;
  color: #718096;
}

.rule-actions {
  display: flex;
  gap: 8px;
}

.toggle-button,
.edit-button,
.delete-button {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.toggle-button {
  background: #fed7aa;
  color: #c05621;
}

.toggle-button:hover {
  background: #fbd38d;
}

.edit-button {
  background: #4299e1;
  color: white;
}

.edit-button:hover {
  background: #3182ce;
}

.delete-button {
  background: #fed7d7;
  color: #c53030;
}

.delete-button:hover {
  background: #fc8181;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .rule-header {
    flex-direction: column;
    gap: 12px;
  }

  .rule-footer {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
}
</style>


