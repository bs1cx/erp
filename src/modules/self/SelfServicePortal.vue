<template>
  <div class="self-service-portal">
    <div class="portal-header">
      <h1 class="portal-title">Employee Self-Service Portal</h1>
      <p class="portal-subtitle">Manage your profile, leave requests, and access your payslips</p>
    </div>

    <!-- Success/Error Messages -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- Navigation Tabs -->
    <div class="portal-tabs">
      <button
        @click="activeTab = 'profile'"
        :class="['tab-button', { active: activeTab === 'profile' }]"
      >
        My Profile
      </button>
      <button
        @click="activeTab = 'leave'"
        :class="['tab-button', { active: activeTab === 'leave' }]"
      >
        Leave Requests
      </button>
      <button
        @click="activeTab = 'payslips'"
        :class="['tab-button', { active: activeTab === 'payslips' }]"
      >
        Payslips
      </button>
    </div>

    <!-- Profile Tab -->
    <div v-if="activeTab === 'profile'" class="portal-content">
      <div class="content-section">
        <div class="section-header-inline">
          <h2 class="section-title">My Profile</h2>
          <button @click="openEditContactModal" class="edit-button">
            Update Contact Info
          </button>
        </div>

        <div v-if="loadingProfile" class="loading-state">
          Loading profile...
        </div>

        <div v-else-if="profile" class="profile-details">
          <div class="profile-grid">
            <div class="profile-item">
              <label>Full Name:</label>
              <span>{{ profile.full_name || profile.email }}</span>
            </div>
            <div class="profile-item">
              <label>Email:</label>
              <span>{{ profile.email }}</span>
            </div>
            <div class="profile-item">
              <label>Department:</label>
              <span>{{ profile.department || 'N/A' }}</span>
            </div>
            <div class="profile-item">
              <label>Job Title:</label>
              <span>{{ profile.job_titles?.title_name || 'Not assigned' }}</span>
            </div>
            <div class="profile-item">
              <label>Leave Balance:</label>
              <span class="leave-balance">
                {{ (profile.annual_leave_days || 20) - (profile.used_leave_days || 0) }} / {{ profile.annual_leave_days || 20 }} days
              </span>
            </div>
            <div v-if="profile.details?.date_of_birth" class="profile-item">
              <label>Date of Birth:</label>
              <span>{{ formatDate(profile.details.date_of_birth) }}</span>
            </div>
            <div v-if="profile.details?.emergency_contact_name" class="profile-item">
              <label>Emergency Contact:</label>
              <span>{{ profile.details.emergency_contact_name }}</span>
            </div>
            <div v-if="profile.details?.emergency_contact_phone" class="profile-item">
              <label>Emergency Phone:</label>
              <span>{{ profile.details.emergency_contact_phone }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Leave Requests Tab -->
    <div v-if="activeTab === 'leave'" class="portal-content">
      <div class="content-section">
        <div class="section-header-inline">
          <h2 class="section-title">My Leave Requests</h2>
          <button @click="openSubmitLeaveModal" class="primary-button">
            Submit Leave Request
          </button>
        </div>

        <div v-if="loadingLeave" class="loading-state">
          Loading leave requests...
        </div>

        <div v-else-if="myLeaveRequests.length === 0" class="empty-state">
          No leave requests found.
        </div>

        <div v-else class="leave-requests-list">
          <div
            v-for="request in myLeaveRequests"
            :key="request.id"
            class="request-card"
          >
            <div class="request-header">
              <div class="request-info">
                <div class="request-type-badge" :class="getStatusClass(request.status)">
                  {{ request.status }}
                </div>
                <div class="request-dates">
                  {{ formatDate(request.start_date) }} - {{ formatDate(request.end_date) }}
                </div>
                <div class="request-type">{{ request.type }}</div>
              </div>
              <div class="request-status">
                <div v-if="request.manager_approval_status" class="approval-status">
                  <span class="status-label">Manager:</span>
                  <span class="status-badge" :class="getApprovalClass(request.manager_approval_status)">
                    {{ request.manager_approval_status }}
                  </span>
                </div>
                <div class="approval-status">
                  <span class="status-label">HR:</span>
                  <span class="status-badge" :class="getStatusClass(request.status)">
                    {{ request.status }}
                  </span>
                </div>
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
    </div>

    <!-- Payslips Tab -->
    <div v-if="activeTab === 'payslips'" class="portal-content">
      <div class="content-section">
        <h2 class="section-title">My Payslips</h2>

        <div v-if="loadingPayslips" class="loading-state">
          Loading payslips...
        </div>

        <div v-else-if="payslips.length === 0" class="empty-state">
          No payslips available.
        </div>

        <div v-else class="payslips-list">
          <div
            v-for="payslip in payslips"
            :key="payslip.id"
            class="payslip-card"
          >
            <div class="payslip-header">
              <div class="payslip-info">
                <div class="payslip-period">
                  {{ formatDate(payslip.period_start) }} - {{ formatDate(payslip.period_end) }}
                </div>
                <div class="payslip-amount">{{ formatCurrency(payslip.net_salary) }}</div>
              </div>
              <div class="payslip-status">
                <span class="status-badge" :class="getStatusClass(payslip.status)">
                  {{ payslip.status }}
                </span>
              </div>
            </div>
            <div class="payslip-details">
              <div class="detail-row">
                <span>Gross Salary:</span>
                <strong>{{ formatCurrency(payslip.gross_salary) }}</strong>
              </div>
              <div class="detail-row">
                <span>Tax:</span>
                <span>{{ formatCurrency(payslip.tax_amount) }}</span>
              </div>
              <div class="detail-row">
                <span>Contributions:</span>
                <span>{{ formatCurrency(payslip.contribution_amount) }}</span>
              </div>
              <div class="detail-row">
                <span>Deductions:</span>
                <span>{{ formatCurrency(payslip.deductions) }}</span>
              </div>
              <div class="detail-row">
                <span>Bonuses:</span>
                <span>{{ formatCurrency(payslip.bonuses) }}</span>
              </div>
            </div>
            <div class="payslip-actions">
              <button
                @click="downloadPayslipFile(payslip.id)"
                class="download-button"
                :disabled="payslip.status !== 'Paid'"
              >
                Download Payslip
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Submit Leave Request Modal -->
    <div v-if="showLeaveModal" class="modal-overlay" @click="closeLeaveModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Submit Leave Request</h3>
          <button @click="closeLeaveModal" class="modal-close">×</button>
        </div>

        <form @submit.prevent="handleSubmitLeave" class="leave-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Start Date *</label>
              <input
                v-model="leaveForm.start_date"
                type="date"
                class="form-input"
                required
                :disabled="loadingSubmit"
                :min="minDate"
              />
            </div>

            <div class="form-group">
              <label class="form-label">End Date *</label>
              <input
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
            <label class="form-label">Leave Type *</label>
            <select
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
            <label class="form-label">Reason</label>
            <textarea
              v-model="leaveForm.reason"
              class="form-textarea"
              rows="4"
              placeholder="Optional reason for leave..."
              :disabled="loadingSubmit"
            ></textarea>
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeLeaveModal" class="secondary-button" :disabled="loadingSubmit">
              Cancel
            </button>
            <button type="submit" class="primary-button" :disabled="loadingSubmit || !isLeaveFormValid">
              <span v-if="loadingSubmit">Submitting...</span>
              <span v-else>Submit Request</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Contact Info Modal -->
    <div v-if="showContactModal" class="modal-overlay" @click="closeContactModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Update Contact Information</h3>
          <button @click="closeContactModal" class="modal-close">×</button>
        </div>

        <form @submit.prevent="handleUpdateContact" class="contact-form">
          <div class="form-group">
            <label class="form-label">Emergency Contact Name</label>
            <input
              v-model="contactForm.emergency_contact_name"
              type="text"
              class="form-input"
              :disabled="loadingUpdate"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Emergency Contact Phone</label>
            <input
              v-model="contactForm.emergency_contact_phone"
              type="tel"
              class="form-input"
              :disabled="loadingUpdate"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Emergency Contact Relationship</label>
            <input
              v-model="contactForm.emergency_contact_relationship"
              type="text"
              class="form-input"
              placeholder="e.g., Spouse, Parent, Sibling"
              :disabled="loadingUpdate"
            />
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeContactModal" class="secondary-button" :disabled="loadingUpdate">
              Cancel
            </button>
            <button type="submit" class="primary-button" :disabled="loadingUpdate">
              <span v-if="loadingUpdate">Updating...</span>
              <span v-else>Update Contact Info</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../../services/supabaseClient'
import {
  getSelfProfile,
  submitSelfLeaveRequest,
  downloadPayslip,
  getEmployeePayrollHistory,
  updateEmployeeProfile
} from '../../services/hrService'

const activeTab = ref('profile')
const profile = ref(null)
const myLeaveRequests = ref([])
const payslips = ref([])
const loadingProfile = ref(false)
const loadingLeave = ref(false)
const loadingPayslips = ref(false)
const loadingSubmit = ref(false)
const loadingUpdate = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const showLeaveModal = ref(false)
const showContactModal = ref(false)

const leaveForm = ref({
  start_date: '',
  end_date: '',
  type: '',
  reason: ''
})

const contactForm = ref({
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relationship: ''
})

const currentUserId = computed(() => {
  const userData = localStorage.getItem('user_data')
  if (!userData) return null
  try {
    const user = JSON.parse(userData)
    return user.id
  } catch {
    return null
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
  if (currentUserId.value) {
    loadProfile()
    loadMyLeaveRequests()
    loadPayslips()
  }
})

async function loadProfile() {
  if (!currentUserId.value) return
  
  loadingProfile.value = true
  try {
    const result = await getSelfProfile(currentUserId.value)
    if (result.success) {
      profile.value = {
        ...result.profile,
        full_name: `${result.profile.first_name || ''} ${result.profile.last_name || ''}`.trim() || result.profile.email
      }
    } else {
      errorMessage.value = result.error || 'Failed to load profile'
    }
  } catch (error) {
    console.error('Error loading profile:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loadingProfile.value = false
  }
}

async function loadMyLeaveRequests() {
  if (!currentUserId.value) return
  
  loadingLeave.value = true
  try {
    // Get all leave requests for current user
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
        manager_approval_notes,
        created_at
      `)
      .eq('user_id', currentUserId.value)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading leave requests:', error)
      return
    }

    myLeaveRequests.value = requests || []
  } catch (error) {
    console.error('Error loading leave requests:', error)
  } finally {
    loadingLeave.value = false
  }
}

async function loadPayslips() {
  if (!currentUserId.value) return
  
  loadingPayslips.value = true
  try {
    const result = await getEmployeePayrollHistory(currentUserId.value, 12)
    if (result.success) {
      payslips.value = result.payrollRecords || []
    }
  } catch (error) {
    console.error('Error loading payslips:', error)
  } finally {
    loadingPayslips.value = false
  }
}

function openSubmitLeaveModal() {
  leaveForm.value = {
    start_date: '',
    end_date: '',
    type: '',
    reason: ''
  }
  showLeaveModal.value = true
}

function closeLeaveModal() {
  showLeaveModal.value = false
}

async function handleSubmitLeave() {
  if (!currentUserId.value) return
  
  loadingSubmit.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await submitSelfLeaveRequest(currentUserId.value, leaveForm.value)
    if (result.success) {
      successMessage.value = 'Leave request submitted successfully! It will be reviewed by your manager first.'
      closeLeaveModal()
      await loadMyLeaveRequests()
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

function openEditContactModal() {
  if (profile.value?.details) {
    contactForm.value = {
      emergency_contact_name: profile.value.details.emergency_contact_name || '',
      emergency_contact_phone: profile.value.details.emergency_contact_phone || '',
      emergency_contact_relationship: profile.value.details.emergency_contact_relationship || ''
    }
  } else {
    contactForm.value = {
      emergency_contact_name: '',
      emergency_contact_phone: '',
      emergency_contact_relationship: ''
    }
  }
  showContactModal.value = true
}

function closeContactModal() {
  showContactModal.value = false
}

async function handleUpdateContact() {
  if (!currentUserId.value) return
  
  loadingUpdate.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await updateEmployeeProfile(currentUserId.value, {
      emergency_contact_name: contactForm.value.emergency_contact_name,
      emergency_contact_phone: contactForm.value.emergency_contact_phone,
      emergency_contact_relationship: contactForm.value.emergency_contact_relationship
    })
    
    if (result.success) {
      successMessage.value = 'Contact information updated successfully!'
      closeContactModal()
      await loadProfile()
    } else {
      errorMessage.value = result.error || 'Failed to update contact information'
    }
  } catch (error) {
    console.error('Error updating contact info:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loadingUpdate.value = false
  }
}

async function downloadPayslipFile(recordId) {
  if (!currentUserId.value) return
  
  try {
    const result = await downloadPayslip(currentUserId.value, recordId)
    if (result.success) {
      // Generate downloadable content (mock - in production, generate PDF)
      const payslip = result.payslip
      const content = generatePayslipContent(payslip)
      
      // Create and download file
      const blob = new Blob([content], { type: 'text/plain' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `payslip_${payslip.payroll.period_start}_${payslip.payroll.period_end}.txt`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      successMessage.value = 'Payslip downloaded successfully!'
    } else {
      errorMessage.value = result.error || 'Failed to download payslip'
    }
  } catch (error) {
    console.error('Error downloading payslip:', error)
    errorMessage.value = 'An unexpected error occurred'
  }
}

function generatePayslipContent(payslip) {
  const emp = payslip.employee
  const pay = payslip.payroll
  
  return `
PAYSLIP
========

Employee: ${emp.name}
Email: ${emp.email}
Department: ${emp.department || 'N/A'}

Period: ${formatDate(pay.period_start)} - ${formatDate(pay.period_end)}
Payment Date: ${pay.payment_date ? formatDate(pay.payment_date) : 'N/A'}
Status: ${pay.status}

EARNINGS
--------
Gross Salary: ${formatCurrency(pay.gross_salary)}
Bonuses: ${formatCurrency(pay.bonuses)}
Total Earnings: ${formatCurrency(pay.gross_salary + pay.bonuses)}

DEDUCTIONS
----------
Tax: ${formatCurrency(pay.tax_amount)}
Contributions: ${formatCurrency(pay.contribution_amount)}
Other Deductions: ${formatCurrency(pay.deductions)}
Total Deductions: ${formatCurrency(pay.tax_amount + pay.contribution_amount + pay.deductions)}

NET PAY
-------
${formatCurrency(pay.net_salary)}

Generated: ${new Date(payslip.generated_at).toLocaleString()}
`
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
  } catch {
    return dateString
  }
}

function formatCurrency(amount) {
  if (!amount && amount !== 0) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount)
}

function getStatusClass(status) {
  const statusMap = {
    'Approved': 'status-success',
    'Pending': 'status-warning',
    'Rejected': 'status-danger',
    'Paid': 'status-success',
    'Processing': 'status-info'
  }
  return statusMap[status] || 'status-default'
}

function getApprovalClass(status) {
  const statusMap = {
    'Approved': 'status-success',
    'Pending': 'status-warning',
    'Rejected': 'status-danger'
  }
  return statusMap[status] || 'status-default'
}
</script>

<style scoped>
.self-service-portal {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--spacing-xl);
}

.portal-header {
  margin-bottom: var(--spacing-xl);
  text-align: center;
}

.portal-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-text-dark);
  margin: 0 0 var(--spacing-sm) 0;
}

.portal-subtitle {
  font-size: var(--font-size-base);
  color: var(--color-text-medium);
  margin: 0;
}

.portal-tabs {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xl);
  border-bottom: 2px solid var(--color-border);
}

.tab-button {
  padding: var(--spacing-md) var(--spacing-lg);
  background: transparent;
  color: var(--color-text-medium);
  border: none;
  border-bottom: 3px solid transparent;
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.tab-button:hover {
  color: var(--color-primary);
  background: rgba(42, 99, 62, 0.05);
}

.tab-button.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  background: rgba(42, 99, 62, 0.05);
}

.portal-content {
  min-height: 400px;
}

.content-section {
  background: var(--color-background);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  border: 1px solid var(--color-border);
}

.section-header-inline {
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

.edit-button,
.primary-button {
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

.edit-button:hover,
.primary-button:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.profile-details {
  margin-top: var(--spacing-lg);
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-lg);
}

.profile-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.profile-item label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-medium);
}

.profile-item span {
  font-size: var(--font-size-base);
  color: var(--color-text-dark);
}

.leave-balance {
  font-weight: 600;
  color: var(--color-primary);
}

.leave-requests-list,
.payslips-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
}

.request-card,
.payslip-card {
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.request-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-md);
}

.request-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.request-type-badge {
  display: inline-block;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
}

.request-dates {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text-dark);
}

.request-type {
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
}

.request-status {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  align-items: flex-end;
}

.approval-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.status-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-medium);
}

.status-badge {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.status-success {
  background: var(--color-success-light);
  color: var(--color-text-on-primary);
}

.status-warning {
  background: var(--color-warning);
  color: var(--color-text-on-primary);
}

.status-danger {
  background: var(--color-danger-light);
  color: var(--color-text-on-primary);
}

.status-info {
  background: var(--color-info-light);
  color: var(--color-text-on-primary);
}

.status-default {
  background: var(--color-surface);
  color: var(--color-text-dark);
}

.request-reason,
.request-notes {
  margin-top: var(--spacing-sm);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
}

.payslip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.payslip-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.payslip-period {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text-dark);
}

.payslip-amount {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-primary);
}

.payslip-details {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-xs) 0;
  font-size: var(--font-size-sm);
}

.detail-row span:first-child {
  color: var(--color-text-medium);
}

.detail-row strong {
  color: var(--color-text-dark);
  font-weight: 600;
}

.payslip-actions {
  display: flex;
  justify-content: flex-end;
}

.download-button {
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

.download-button:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.download-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.leave-form,
.contact-form {
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
  gap: var(--spacing-xs);
}

.form-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-dark);
}

.form-input,
.form-select,
.form-textarea {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  background: var(--color-background);
  transition: all var(--transition-base);
  font-family: inherit;
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
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.modal-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
  margin-top: var(--spacing-lg);
}

.secondary-button {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-surface);
  color: var(--color-text-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.secondary-button:hover:not(:disabled) {
  background: var(--color-border-light);
}

.secondary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.success-message {
  padding: var(--spacing-md);
  background: var(--color-success-light);
  color: var(--color-text-on-primary);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-lg);
}

.error-message {
  padding: var(--spacing-md);
  background: var(--color-danger-light);
  color: var(--color-text-on-primary);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-lg);
}

.loading-state,
.empty-state {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-medium);
}

@media (max-width: 768px) {
  .profile-grid,
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .portal-tabs {
    flex-wrap: wrap;
  }
}
</style>

