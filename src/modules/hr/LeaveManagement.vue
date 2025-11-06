<template>
  <div class="leave-management">
    <div class="section-header">
      <h2 class="section-title">Leave Management</h2>
      <button @click="openSubmitLeaveModal" class="add-button">
        + Submit Leave Request
      </button>
    </div>

    <!-- Success/Error Messages -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- Pending Leave Requests -->
    <div class="requests-section">
      <h3 class="subsection-title">Pending Approval</h3>
      
      <div v-if="loading" class="loading-state">
        Loading leave requests...
      </div>

      <div v-else-if="pendingRequests.length === 0" class="empty-state">
        No pending leave requests.
      </div>

      <div v-else class="requests-list">
        <div
          v-for="request in pendingRequests"
          :key="request.id"
          class="request-card"
        >
          <div class="request-header">
            <div class="request-info">
              <div class="request-employee">{{ request.users?.email }}</div>
              <div class="request-meta">
                <span class="request-type">{{ request.type }}</span>
                <span class="request-date-range">
                  {{ formatDate(request.start_date) }} - {{ formatDate(request.end_date) }}
                </span>
              </div>
            </div>
            <div class="request-actions">
              <button
                @click="approveRequest(request.id)"
                class="approve-button"
                :disabled="processingRequest === request.id"
              >
                Approve
              </button>
              <button
                @click="rejectRequest(request.id)"
                class="reject-button"
                :disabled="processingRequest === request.id"
              >
                Reject
              </button>
            </div>
          </div>
          <div v-if="request.reason" class="request-reason">
            <strong>Reason:</strong> {{ request.reason }}
          </div>
        </div>
      </div>
    </div>

    <!-- Submit Leave Request Modal -->
    <div v-if="showSubmitModal" class="modal-overlay" @click="closeSubmitModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Submit Leave Request</h3>
          <button @click="closeSubmitModal" class="modal-close">×</button>
        </div>

        <form @submit.prevent="handleSubmitLeave" class="leave-form">
          <div class="form-row">
            <div class="form-group">
              <label for="leave-start-date" class="form-label">Start Date *</label>
              <input
                id="leave-start-date"
                v-model="leaveForm.start_date"
                type="date"
                class="form-input"
                required
                :disabled="loadingSubmit"
                :min="minDate"
              />
            </div>

            <div class="form-group">
              <label for="leave-end-date" class="form-label">End Date *</label>
              <input
                id="leave-end-date"
                v-model="leaveForm.end_date"
                type="date"
                class="form-input"
                required
                :disabled="loadingSubmit"
                :min="leaveForm.start_date || minDate"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="leave-type" class="form-label">Leave Type *</label>
            <select
              id="leave-type"
              v-model="leaveForm.type"
              class="form-select"
              required
              :disabled="loadingSubmit"
            >
              <option value="">Select type</option>
              <option value="Annual">Annual</option>
              <option value="Sick">Sick</option>
              <option value="Personal">Personal</option>
              <option value="Maternity">Maternity</option>
              <option value="Paternity">Paternity</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div class="form-group">
            <label for="leave-reason" class="form-label">Reason</label>
            <textarea
              id="leave-reason"
              v-model="leaveForm.reason"
              class="form-textarea"
              rows="4"
              placeholder="Optional reason for leave..."
              :disabled="loadingSubmit"
            ></textarea>
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeSubmitModal" class="cancel-button" :disabled="loadingSubmit">
              Cancel
            </button>
            <button type="submit" class="submit-button" :disabled="loadingSubmit || !isLeaveFormValid">
              <span v-if="loadingSubmit">Submitting...</span>
              <span v-else>Submit Request</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { submitLeaveRequest, getPendingLeaveRequests, approveLeaveRequest, rejectLeaveRequest } from '../../services/hrService'

const emit = defineEmits(['updated'])

const pendingRequests = ref([])
const loading = ref(false)
const loadingSubmit = ref(false)
const processingRequest = ref(null)
const errorMessage = ref('')
const successMessage = ref('')
const showSubmitModal = ref(false)
const leaveForm = ref({
  start_date: '',
  end_date: '',
  type: '',
  reason: ''
})

const minDate = computed(() => {
  return new Date().toISOString().split('T')[0]
})

const isLeaveFormValid = computed(() => {
  return leaveForm.value.start_date &&
         leaveForm.value.end_date &&
         leaveForm.value.type &&
         new Date(leaveForm.value.end_date) >= new Date(leaveForm.value.start_date)
})

onMounted(() => {
  loadRequests()
})

async function loadRequests() {
  loading.value = true
  errorMessage.value = ''
  
  try {
    const result = await getPendingLeaveRequests()
    if (result.success) {
      pendingRequests.value = result.requests || []
    } else {
      errorMessage.value = result.error || 'Failed to load leave requests'
    }
  } catch (error) {
    console.error('Error loading leave requests:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}

function openSubmitLeaveModal() {
  leaveForm.value = {
    start_date: '',
    end_date: '',
    type: '',
    reason: ''
  }
  showSubmitModal.value = true
}

function closeSubmitModal() {
  showSubmitModal.value = false
  leaveForm.value = {
    start_date: '',
    end_date: '',
    type: '',
    reason: ''
  }
}

async function handleSubmitLeave() {
  loadingSubmit.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await submitLeaveRequest(leaveForm.value)
    if (result.success) {
      successMessage.value = 'Leave request submitted successfully!'
      closeSubmitModal()
      await loadRequests()
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to submit leave request'
    }
  } catch (error) {
    console.error('Error submitting leave request:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loadingSubmit.value = false
  }
}

async function approveRequest(requestId) {
  processingRequest.value = requestId
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await approveLeaveRequest(requestId)
    if (result.success) {
      successMessage.value = 'Leave request approved!'
      await loadRequests()
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to approve leave request'
    }
  } catch (error) {
    console.error('Error approving leave request:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    processingRequest.value = null
  }
}

async function rejectRequest(requestId) {
  if (!confirm('Are you sure you want to reject this leave request?')) {
    return
  }

  processingRequest.value = requestId
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await rejectLeaveRequest(requestId)
    if (result.success) {
      successMessage.value = 'Leave request rejected.'
      await loadRequests()
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to reject leave request'
    }
  } catch (error) {
    console.error('Error rejecting leave request:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    processingRequest.value = null
  }
}

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
.leave-management {
  width: 100%;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.section-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text-dark);
  margin: 0;
}

.add-button {
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

.add-button:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.requests-section {
  margin-top: var(--spacing-xl);
}

.subsection-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-dark);
  margin-bottom: var(--spacing-lg);
}

.requests-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.request-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  transition: all var(--transition-base);
}

.request-card:hover {
  box-shadow: 0 2px 8px var(--color-shadow);
}

.request-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-md);
}

.request-info {
  flex: 1;
}

.request-employee {
  font-weight: 600;
  color: var(--color-text-dark);
  margin-bottom: var(--spacing-xs);
}

.request-meta {
  display: flex;
  gap: var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
}

.request-type {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-primary-light);
  color: var(--color-text-on-primary);
  border-radius: var(--radius-sm);
  font-weight: 600;
}

.request-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.approve-button,
.reject-button {
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.approve-button {
  background: var(--color-success);
  color: var(--color-text-on-primary);
}

.approve-button:hover:not(:disabled) {
  background: var(--color-success-light);
}

.reject-button {
  background: var(--color-danger);
  color: var(--color-text-on-primary);
}

.reject-button:hover:not(:disabled) {
  background: var(--color-danger-light);
}

.approve-button:disabled,
.reject-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.request-reason {
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
  color: var(--color-text-medium);
  font-size: var(--font-size-sm);
}

.leave-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.form-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-medium);
}

.form-input,
.form-select,
.form-textarea {
  padding: var(--spacing-md);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  transition: all var(--transition-base);
  background: var(--color-background);
  font-family: inherit;
}

.form-textarea {
  resize: vertical;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(42, 99, 62, 0.1);
}

.form-input:disabled,
.form-select:disabled,
.form-textarea:disabled {
  background: var(--color-surface);
  cursor: not-allowed;
  opacity: 0.6;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-background);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.modal-header h3 {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text-dark);
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 32px;
  color: var(--color-text-medium);
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--transition-base);
}

.modal-close:hover {
  color: var(--color-text-dark);
}

.modal-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
  margin-top: var(--spacing-lg);
}

.submit-button,
.cancel-button {
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.submit-button {
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
}

.submit-button:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-button {
  background: var(--color-surface);
  color: var(--color-text-dark);
  border: 1px solid var(--color-border);
}

.cancel-button:hover:not(:disabled) {
  background: var(--color-border-light);
}

.success-message {
  padding: var(--spacing-md);
  background: var(--color-success-light);
  border: 1px solid var(--color-success);
  border-radius: var(--radius-md);
  color: var(--color-text-on-primary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-lg);
}

.error-message {
  padding: var(--spacing-md);
  background: var(--color-danger-light);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  color: var(--color-text-on-primary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-lg);
}

.loading-state,
.empty-state {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-medium);
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .request-header {
    flex-direction: column;
    gap: var(--spacing-md);
  }
}
</style>


