<template>
  <div v-if="visible" class="modal-overlay" @click="handleClose">
    <div class="modal-content large-modal" @click.stop>
      <div class="modal-header">
        <h2>Employee Profile: {{ employee?.full_name || employee?.email || 'Loading...' }}</h2>
        <button @click="handleClose" class="modal-close">×</button>
      </div>

      <div v-if="loading" class="loading-state">
        Loading employee profile...
      </div>

      <div v-else-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>

      <div v-else-if="employee" class="profile-content">
        <!-- Personal Information Section -->
        <div class="profile-section">
          <h3 class="section-title">Personal Information</h3>
          <div class="info-grid">
            <div class="info-item">
              <label>Full Name:</label>
              <span>{{ employee.full_name || employee.email }}</span>
            </div>
            <div class="info-item">
              <label>Email:</label>
              <span>{{ employee.email }}</span>
            </div>
            <div class="info-item" v-if="employee.details?.date_of_birth">
              <label>Date of Birth:</label>
              <span>{{ formatDate(employee.details.date_of_birth) }}</span>
            </div>
            <div class="info-item" v-if="employee.age">
              <label>Age:</label>
              <span>{{ employee.age }} years</span>
            </div>
            <div class="info-item" v-if="employee.details?.marital_status">
              <label>Marital Status:</label>
              <span>{{ employee.details.marital_status }}</span>
            </div>
          </div>
        </div>

        <!-- HR Information Section (Only visible to HR_MANAGER) -->
        <div class="profile-section" v-if="canViewHRDetails">
          <h3 class="section-title">HR Information</h3>
          <div class="info-grid">
            <div class="info-item">
              <label>Department:</label>
              <span>{{ employee.department || 'N/A' }}</span>
            </div>
            <div class="info-item">
              <label>Job Title:</label>
              <span>{{ employee.job_titles?.title_name || 'Not assigned' }}</span>
            </div>
            <div class="info-item">
              <label>Salary:</label>
              <span>{{ employee.salary ? formatCurrency(employee.salary) : 'N/A' }}</span>
            </div>
            <div class="info-item">
              <label>Leave Balance:</label>
              <span>{{ (employee.annual_leave_days || 20) - (employee.used_leave_days || 0) }} / {{ employee.annual_leave_days || 20 }} days</span>
            </div>
          </div>
        </div>

        <!-- Compliance Information Section -->
        <div class="profile-section">
          <h3 class="section-title">Compliance Information</h3>
          <div class="info-grid">
            <div class="info-item" v-if="employee.details?.driving_license_status">
              <label>Driving License:</label>
              <span class="status-badge" :class="getLicenseStatusClass(employee.details.driving_license_status)">
                {{ employee.details.driving_license_status }}
              </span>
            </div>
            <div class="info-item" v-if="employee.details?.military_service_status">
              <label>Military Service:</label>
              <span>{{ employee.details.military_service_status }}</span>
            </div>
          </div>
        </div>

        <!-- Benefits Section (Only visible to HR_MANAGER) -->
        <div class="profile-section" v-if="canViewHRDetails">
          <div class="section-header-inline">
            <h3 class="section-title">Employee Benefits</h3>
            <button @click="openBenefitModal" class="add-benefit-button">
              Add Benefit
            </button>
          </div>
          <div v-if="loadingBenefits" class="loading-state-small">
            Loading benefits...
          </div>
          <div v-else-if="benefits.length === 0" class="empty-state-small">
            No benefits assigned.
          </div>
          <div v-else class="benefits-list">
            <div v-for="benefit in benefits" :key="benefit.id" class="benefit-item">
              <div class="benefit-header">
                <div class="benefit-info">
                  <strong>{{ benefit.benefit_type }}</strong>
                  <span class="benefit-amount">{{ formatCurrency(benefit.monthly_amount) }}/month</span>
                </div>
                <div class="benefit-actions">
                  <span class="status-badge" :class="benefit.is_active ? 'status-active' : 'status-inactive'">
                    {{ benefit.is_active ? 'Active' : 'Inactive' }}
                  </span>
                  <button
                    @click="toggleBenefitStatus(benefit.id, !benefit.is_active)"
                    class="toggle-button"
                    :title="benefit.is_active ? 'Deactivate' : 'Activate'"
                  >
                    {{ benefit.is_active ? 'Deactivate' : 'Activate' }}
                  </button>
                  <button
                    @click="removeBenefitItem(benefit.id)"
                    class="remove-button"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div v-if="benefit.provider || benefit.policy_number" class="benefit-details">
                <span v-if="benefit.provider">Provider: {{ benefit.provider }}</span>
                <span v-if="benefit.policy_number">Policy: {{ benefit.policy_number }}</span>
              </div>
              <div v-if="benefit.notes" class="benefit-notes">
                {{ benefit.notes }}
              </div>
            </div>
          </div>
        </div>

        <!-- Medical & Emergency Information Section -->
        <div class="profile-section">
          <h3 class="section-title">Medical & Emergency Information</h3>
          <div class="info-grid">
            <div class="info-item full-width" v-if="employee.details?.medical_conditions">
              <label>Medical Conditions:</label>
              <span class="medical-info">{{ employee.details.medical_conditions }}</span>
            </div>
            <div class="info-item" v-if="employee.details?.emergency_contact_name">
              <label>Emergency Contact Name:</label>
              <span>{{ employee.details.emergency_contact_name }}</span>
            </div>
            <div class="info-item" v-if="employee.details?.emergency_contact_phone">
              <label>Emergency Contact Phone:</label>
              <span>{{ employee.details.emergency_contact_phone }}</span>
            </div>
            <div class="info-item" v-if="employee.details?.emergency_contact_relationship">
              <label>Relationship:</label>
              <span>{{ employee.details.emergency_contact_relationship }}</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="profile-actions">
          <button @click="openEditModal" class="edit-profile-button">
            Edit Profile
          </button>
          <button @click="handleTerminate" class="terminate-button">
            Terminate Employee
          </button>
        </div>
      </div>

      <!-- Edit Profile Modal (Nested) -->
      <div v-if="showEditModal" class="edit-modal-overlay" @click="closeEditModal">
        <div class="edit-modal-content" @click.stop>
          <div class="modal-header">
            <h3>Edit Employee Profile</h3>
            <button @click="closeEditModal" class="modal-close">×</button>
          </div>

          <form @submit.prevent="handleUpdateProfile" class="profile-edit-form">
            <!-- Personal Info -->
            <div class="form-section">
              <h4>Personal Information</h4>
              <div class="form-row">
                <div class="form-group">
                  <label>First Name</label>
                  <input v-model="editForm.first_name" type="text" class="form-input" />
                </div>
                <div class="form-group">
                  <label>Last Name</label>
                  <input v-model="editForm.last_name" type="text" class="form-input" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Date of Birth</label>
                  <input v-model="editForm.date_of_birth" type="date" class="form-input" />
                </div>
                <div class="form-group">
                  <label>Marital Status</label>
                  <select v-model="editForm.marital_status" class="form-select">
                    <option value="">Select...</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- HR Info (HR_MANAGER only) -->
            <div class="form-section" v-if="canViewHRDetails">
              <h4>HR Information</h4>
              <div class="form-row">
                <div class="form-group">
                  <label>Department</label>
                  <input v-model="editForm.department" type="text" class="form-input" />
                </div>
                <div class="form-group">
                  <label>Salary</label>
                  <input v-model="editForm.salary" type="number" step="0.01" class="form-input" />
                </div>
              </div>
            </div>

            <!-- Compliance Info -->
            <div class="form-section">
              <h4>Compliance Information</h4>
              <div class="form-row">
                <div class="form-group">
                  <label>Driving License Status</label>
                  <select v-model="editForm.driving_license_status" class="form-select">
                    <option value="">Select...</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Military Service Status</label>
                  <select v-model="editForm.military_service_status" class="form-select">
                    <option value="">Select...</option>
                    <option value="Completed">Completed</option>
                    <option value="Exempt">Exempt</option>
                    <option value="Pending">Pending</option>
                    <option value="Not Applicable">Not Applicable</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Emergency Contact -->
            <div class="form-section">
              <h4>Emergency Contact</h4>
              <div class="form-row">
                <div class="form-group">
                  <label>Contact Name</label>
                  <input v-model="editForm.emergency_contact_name" type="text" class="form-input" />
                </div>
                <div class="form-group">
                  <label>Contact Phone</label>
                  <input v-model="editForm.emergency_contact_phone" type="tel" class="form-input" />
                </div>
              </div>
              <div class="form-group">
                <label>Relationship</label>
                <input v-model="editForm.emergency_contact_relationship" type="text" class="form-input" />
              </div>
              <div class="form-group">
                <label>Medical Conditions</label>
                <textarea v-model="editForm.medical_conditions" class="form-textarea" rows="3"></textarea>
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" @click="closeEditModal" class="cancel-button">Cancel</button>
              <button type="submit" class="submit-button" :disabled="loadingUpdate">
                {{ loadingUpdate ? 'Updating...' : 'Update Profile' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Add Benefit Modal -->
    <div v-if="showBenefitModal" class="edit-modal-overlay" @click="closeBenefitModal">
      <div class="edit-modal-content" @click.stop>
        <div class="modal-header">
          <h3>Add Employee Benefit</h3>
          <button @click="closeBenefitModal" class="modal-close">×</button>
        </div>

        <form @submit.prevent="handleAddBenefit" class="profile-edit-form">
          <div class="form-group">
            <label>Benefit Type *</label>
            <select v-model="benefitForm.benefit_type" class="form-select" required>
              <option value="">Select Benefit Type</option>
              <option value="Meal Card">Meal Card</option>
              <option value="Transport">Transport</option>
              <option value="Private Health">Private Health Insurance</option>
              <option value="Gym">Gym Membership</option>
              <option value="Education">Education Allowance</option>
              <option value="Housing">Housing Allowance</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div class="form-group">
            <label>Monthly Amount *</label>
            <input
              v-model.number="benefitForm.monthly_amount"
              type="number"
              step="0.01"
              min="0"
              class="form-input"
              required
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Provider</label>
              <input v-model="benefitForm.provider" type="text" class="form-input" />
            </div>
            <div class="form-group">
              <label>Policy Number</label>
              <input v-model="benefitForm.policy_number" type="text" class="form-input" />
            </div>
          </div>

          <div class="form-group">
            <label>Notes</label>
            <textarea v-model="benefitForm.notes" class="form-textarea" rows="3"></textarea>
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeBenefitModal" class="cancel-button" :disabled="loadingUpdate">
              Cancel
            </button>
            <button type="submit" class="submit-button" :disabled="loadingUpdate">
              {{ loadingUpdate ? 'Adding...' : 'Add Benefit' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { 
  getEmployeeProfile, 
  updateEmployeeProfile, 
  terminateEmployee,
  getEmployeeBenefits,
  assignBenefit,
  updateBenefitStatus,
  removeBenefit
} from '../../services/hrService'

const props = defineProps({
  employeeId: {
    type: String,
    required: true
  },
  visible: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['close', 'updated'])

const employee = ref(null)
const loading = ref(false)
const loadingUpdate = ref(false)
const loadingBenefits = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const showEditModal = ref(false)
const showBenefitModal = ref(false)
const benefits = ref([])
const editForm = ref({})
const benefitForm = ref({
  benefit_type: '',
  monthly_amount: 0,
  provider: '',
  policy_number: '',
  notes: '',
  is_active: true
})

const canViewHRDetails = computed(() => {
  const permissions = localStorage.getItem('user_permissions')
  if (!permissions) return false
  try {
    const perms = JSON.parse(permissions)
    return perms.module_hr_write === true || perms.access_hr === true
  } catch {
    return false
  }
})

watch(() => props.employeeId, (newId) => {
  if (newId && props.visible) {
    loadProfile()
  }
}, { immediate: true })

onMounted(() => {
  if (props.employeeId && props.visible) {
    loadProfile()
  }
})

async function loadProfile() {
  loading.value = true
  errorMessage.value = ''
  
  try {
    const result = await getEmployeeProfile(props.employeeId)
    if (result.success) {
      employee.value = {
        ...result.employee,
        full_name: `${result.employee.first_name || ''} ${result.employee.last_name || ''}`.trim() || result.employee.email
      }
      // Calculate age if date of birth is available
      if (result.employee.details?.date_of_birth) {
        const dob = new Date(result.employee.details.date_of_birth)
        const today = new Date()
        let age = today.getFullYear() - dob.getFullYear()
        const monthDiff = today.getMonth() - dob.getMonth()
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
          age--
        }
        employee.value.age = age
      }
      // Load benefits if HR manager
      if (canViewHRDetails.value) {
        await loadBenefits()
      }
    } else {
      errorMessage.value = result.error || 'Failed to load employee profile'
    }
  } catch (error) {
    console.error('Error loading profile:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}

function openEditModal() {
  if (!employee.value) return
  
  editForm.value = {
    first_name: employee.value.first_name || '',
    last_name: employee.value.last_name || '',
    department: employee.value.department || '',
    salary: employee.value.salary || '',
    date_of_birth: employee.value.details?.date_of_birth || '',
    marital_status: employee.value.details?.marital_status || '',
    driving_license_status: employee.value.details?.driving_license_status || '',
    military_service_status: employee.value.details?.military_service_status || '',
    medical_conditions: employee.value.details?.medical_conditions || '',
    emergency_contact_name: employee.value.details?.emergency_contact_name || '',
    emergency_contact_phone: employee.value.details?.emergency_contact_phone || '',
    emergency_contact_relationship: employee.value.details?.emergency_contact_relationship || ''
  }
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
  editForm.value = {}
}

async function handleUpdateProfile() {
  loadingUpdate.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await updateEmployeeProfile(props.employeeId, editForm.value)
    if (result.success) {
      successMessage.value = 'Profile updated successfully!'
      closeEditModal()
      await loadProfile()
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to update profile'
    }
  } catch (error) {
    console.error('Error updating profile:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loadingUpdate.value = false
  }
}

async function handleTerminate() {
  if (!confirm('Are you sure you want to terminate this employee? This action cannot be undone.')) {
    return
  }

  const reason = prompt('Please provide a termination reason:')
  if (!reason) return

  loading.value = true
  errorMessage.value = ''

  try {
    const result = await terminateEmployee(props.employeeId, reason)
    if (result.success) {
      alert('Employee termination processed successfully.')
      handleClose()
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to terminate employee'
    }
  } catch (error) {
    console.error('Error terminating employee:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}

function handleClose() {
  emit('close')
}

function formatDate(dateString) {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return dateString
  }
}

function formatCurrency(amount) {
  if (!amount) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(amount)
}

function getLicenseStatusClass(status) {
  if (status === 'Yes') return 'status-success'
  if (status === 'Expired') return 'status-warning'
  return 'status-default'
}

async function loadBenefits() {
  loadingBenefits.value = true
  try {
    const result = await getEmployeeBenefits(props.employeeId)
    if (result.success) {
      benefits.value = result.benefits || []
    }
  } catch (error) {
    console.error('Error loading benefits:', error)
  } finally {
    loadingBenefits.value = false
  }
}

function openBenefitModal() {
  benefitForm.value = {
    benefit_type: '',
    monthly_amount: 0,
    provider: '',
    policy_number: '',
    notes: '',
    is_active: true
  }
  showBenefitModal.value = true
}

function closeBenefitModal() {
  showBenefitModal.value = false
}

async function handleAddBenefit() {
  loadingUpdate.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await assignBenefit(props.employeeId, benefitForm.value)
    if (result.success) {
      successMessage.value = 'Benefit added successfully!'
      closeBenefitModal()
      await loadBenefits()
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to add benefit'
    }
  } catch (error) {
    console.error('Error adding benefit:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loadingUpdate.value = false
  }
}

async function toggleBenefitStatus(benefitId, isActive) {
  loadingUpdate.value = true
  try {
    const result = await updateBenefitStatus(benefitId, isActive)
    if (result.success) {
      await loadBenefits()
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to update benefit status'
    }
  } catch (error) {
    console.error('Error updating benefit status:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loadingUpdate.value = false
  }
}

async function removeBenefitItem(benefitId) {
  if (!confirm('Are you sure you want to remove this benefit?')) return
  
  loadingUpdate.value = true
  try {
    const result = await removeBenefit(benefitId)
    if (result.success) {
      await loadBenefits()
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to remove benefit'
    }
  } catch (error) {
    console.error('Error removing benefit:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loadingUpdate.value = false
  }
}
</script>

<style scoped>
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

.large-modal {
  max-width: 900px;
  width: 95%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: 2px solid var(--color-border);
}

.modal-header h2 {
  font-size: var(--font-size-2xl);
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

.profile-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.profile-section {
  background: var(--color-surface);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.section-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-dark);
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--color-border);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.info-item label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-medium);
}

.info-item span {
  font-size: var(--font-size-base);
  color: var(--color-text-dark);
}

.medical-info {
  background: var(--color-surface);
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.status-badge {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  display: inline-block;
}

.status-success {
  background: var(--color-success-light);
  color: var(--color-text-on-primary);
}

.status-warning {
  background: var(--color-warning);
  color: var(--color-text-on-primary);
}

.profile-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-lg);
  border-top: 2px solid var(--color-border);
}

.edit-profile-button,
.terminate-button {
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
  border: none;
}

.edit-profile-button {
  background: var(--color-primary);
  color: var(--color-text-on-primary);
}

.edit-profile-button:hover {
  background: var(--color-primary-dark);
}

.terminate-button {
  background: var(--color-danger);
  color: var(--color-text-on-primary);
}

.terminate-button:hover {
  background: var(--color-danger-light);
}

.section-header-inline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.add-benefit-button {
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.add-benefit-button:hover {
  background: var(--color-primary-dark);
}

.benefits-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.benefit-item {
  padding: var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.benefit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.benefit-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.benefit-amount {
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
  font-weight: 600;
}

.benefit-actions {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.status-active {
  background: var(--color-success-light);
  color: var(--color-text-on-primary);
}

.status-inactive {
  background: var(--color-surface);
  color: var(--color-text-medium);
}

.toggle-button,
.remove-button {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.toggle-button {
  background: var(--color-surface);
  color: var(--color-text-dark);
}

.toggle-button:hover {
  background: var(--color-border-light);
}

.remove-button {
  background: var(--color-danger-light);
  color: var(--color-text-on-primary);
  border-color: var(--color-danger-light);
}

.remove-button:hover {
  background: var(--color-danger-dark);
}

.benefit-details {
  display: flex;
  gap: var(--spacing-md);
  font-size: var(--font-size-xs);
  color: var(--color-text-medium);
  margin-top: var(--spacing-xs);
}

.benefit-notes {
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--color-background);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
}

.loading-state-small,
.empty-state-small {
  padding: var(--spacing-md);
  text-align: center;
  color: var(--color-text-medium);
  font-size: var(--font-size-sm);
}

.edit-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.edit-modal-content {
  background: var(--color-background);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  max-width: 700px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.profile-edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.form-section {
  background: var(--color-surface);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.form-section h4 {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text-dark);
  margin-bottom: var(--spacing-md);
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

.form-group label {
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

.cancel-button:hover {
  background: var(--color-border-light);
}

.loading-state,
.error-message {
  text-align: center;
  padding: var(--spacing-xl);
}

.error-message {
  color: var(--color-danger);
  background: var(--color-danger-light);
  border-radius: var(--radius-md);
}

@media (max-width: 768px) {
  .info-grid,
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>

