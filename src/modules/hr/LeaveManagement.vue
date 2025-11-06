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

    <!-- HR Manager Actions -->
    <div v-if="canManageLeave" class="hr-actions-section">
      <h3 class="subsection-title">Manage Employee Leave</h3>
      <div class="hr-actions-bar">
        <button @click="openAdjustLeaveModal" class="action-button">
          Adjust Leave Balance
        </button>
      </div>
    </div>

    <!-- Manager-Approved Requests (HR Final Approval) -->
    <div class="requests-section">
      <div class="section-header-inline">
        <h3 class="subsection-title">Manager-Approved Requests (HR Final Approval)</h3>
        <div class="leave-info-note">
          <strong>Note:</strong> Leave requests are validated against leave type rules and available balance before submission.
        </div>
      </div>
      
      <div v-if="loading" class="loading-state">
        Loading leave requests...
      </div>

      <div v-else-if="pendingRequests.length === 0" class="empty-state">
        No pending leave requests requiring HR approval.
      </div>

      <div v-else class="requests-list">
        <div
          v-for="request in pendingRequests"
          :key="request.id"
          class="request-card"
        >
          <div class="request-header">
            <div class="request-info">
              <div class="request-employee">
                {{ getEmployeeName(request.users) }}
                <span class="employee-email">{{ request.users?.email }}</span>
              </div>
              <div class="request-meta">
                <span class="request-type">{{ request.type }}</span>
                <span class="request-date-range">
                  {{ formatDate(request.start_date) }} - {{ formatDate(request.end_date) }}
                </span>
              </div>
              <div v-if="request.manager" class="manager-approval-info">
                <span class="approval-label">Approved by Manager:</span>
                <span class="approval-name">{{ getEmployeeName(request.manager) }}</span>
                <span v-if="request.manager_approval_date" class="approval-date">
                  on {{ formatDate(request.manager_approval_date) }}
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
          <div v-if="request.manager_approval_notes" class="request-notes">
            <strong>Manager Notes:</strong> {{ request.manager_approval_notes }}
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

    <!-- Adjust Leave Balance Modal (HR Manager Only) -->
    <div v-if="showAdjustModal && canManageLeave" class="modal-overlay" @click="closeAdjustModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Adjust Employee Leave Balance</h3>
          <button @click="closeAdjustModal" class="modal-close">×</button>
        </div>

        <form @submit.prevent="handleAdjustLeave" class="leave-form">
          <div class="form-group">
            <label class="form-label">Employee *</label>
            <select
              v-model="adjustForm.user_id"
              class="form-select"
              required
              :disabled="loadingAdjust"
            >
              <option value="">Select Employee</option>
              <option
                v-for="employee in employees"
                :key="employee.id"
                :value="employee.id"
              >
                {{ employee.full_name || employee.email }}
                <span v-if="employee.department"> - {{ employee.department }}</span>
              </option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Annual Leave Days</label>
              <input
                v-model.number="adjustForm.annual_leave_days"
                type="number"
                min="0"
                class="form-input"
                :disabled="loadingAdjust"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Used Leave Days</label>
              <input
                v-model.number="adjustForm.used_leave_days"
                type="number"
                min="0"
                class="form-input"
                :disabled="loadingAdjust"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea
              v-model="adjustForm.notes"
              class="form-textarea"
              rows="3"
              placeholder="Reason for adjustment..."
              :disabled="loadingAdjust"
            ></textarea>
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeAdjustModal" class="cancel-button" :disabled="loadingAdjust">
              Cancel
            </button>
            <button type="submit" class="submit-button" :disabled="loadingAdjust || !adjustForm.user_id">
              <span v-if="loadingAdjust">Updating...</span>
              <span v-else>Update Leave Balance</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { 
  submitLeaveRequest, 
  getPendingLeaveRequests, 
  getManagerApprovedRequests,
  approveLeaveRequest, 
  rejectLeaveRequest,
  updateEmployeeProfile,
  getAllCompanyEmployees
} from '../../services/hrService'

const emit = defineEmits(['updated'])

const pendingRequests = ref([])
const employees = ref([])
const loading = ref(false)
const loadingSubmit = ref(false)
const loadingAdjust = ref(false)
const loadingEmployees = ref(false)
const processingRequest = ref(null)
const errorMessage = ref('')
const successMessage = ref('')
const showSubmitModal = ref(false)
const showAdjustModal = ref(false)
const leaveForm = ref({
  start_date: '',
  end_date: '',
  type: '',
  reason: ''
})
const adjustForm = ref({
  user_id: '',
  annual_leave_days: null,
  used_leave_days: null,
  notes: ''
})

const canManageLeave = computed(() => {
  const permissions = localStorage.getItem('user_permissions')
  if (!permissions) return false
  try {
    const perms = JSON.parse(permissions)
    return perms.module_hr_write === true || perms.access_hr === true
  } catch {
    return false
  }
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
  if (canManageLeave.value) {
    loadEmployees()
  }
})

async function loadRequests() {
  loading.value = true
  errorMessage.value = ''
  
  try {
    // Get manager-approved requests that need HR final approval
    const result = await getManagerApprovedRequests()
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

async function loadEmployees() {
  loadingEmployees.value = true
  try {
    const result = await getAllCompanyEmployees(1, 1000, {})
    if (result.success) {
      employees.value = result.employees || []
    }
  } catch (error) {
    console.error('Error loading employees:', error)
  } finally {
    loadingEmployees.value = false
  }
}

function openAdjustLeaveModal() {
  adjustForm.value = {
    user_id: '',
    annual_leave_days: null,
    used_leave_days: null,
    notes: ''
  }
  showAdjustModal.value = true
  if (employees.value.length === 0) {
    loadEmployees()
  }
}

function closeAdjustModal() {
  showAdjustModal.value = false
  adjustForm.value = {
    user_id: '',
    annual_leave_days: null,
    used_leave_days: null,
    notes: ''
  }
}

async function handleAdjustLeave() {
  loadingAdjust.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const updateData = {}
    if (adjustForm.value.annual_leave_days !== null) {
      updateData.annual_leave_days = adjustForm.value.annual_leave_days
    }
    if (adjustForm.value.used_leave_days !== null) {
      updateData.used_leave_days = adjustForm.value.used_leave_days
    }

    if (Object.keys(updateData).length === 0) {
      errorMessage.value = 'Please specify at least one leave value to update'
      loadingAdjust.value = false
      return
    }

    const result = await updateEmployeeProfile(adjustForm.value.user_id, updateData)
    if (result.success) {
      successMessage.value = 'Leave balance updated successfully!'
      closeAdjustModal()
      await loadRequests()
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to update leave balance'
    }
  } catch (error) {
    console.error('Error adjusting leave balance:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loadingAdjust.value = false
  }
}

function getEmployeeName(user) {
  if (!user) return 'N/A'
  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim()
  return fullName || user.email || 'N/A'
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

.hr-actions-section {
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.hr-actions-bar {
  display: flex;
  gap: var(--spacing-md);
  margin-top: var(--spacing-md);
}

.action-button {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.action-button:hover {
  background: var(--color-primary-dark);
}

.request-employee {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.employee-email {
  font-size: var(--font-size-xs);
  color: var(--color-text-medium);
  font-weight: normal;
}

.manager-approval-info {
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-xs);
  color: var(--color-text-medium);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.approval-label {
  font-weight: 600;
}

.approval-name {
  color: var(--color-primary);
  font-weight: 600;
}

.approval-date {
  color: var(--color-text-medium);
}

.request-notes {
  margin-top: var(--spacing-sm);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
}

.section-header-inline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.leave-info-note {
  font-size: var(--font-size-xs);
  color: var(--color-text-medium);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-surface);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
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


