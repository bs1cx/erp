<template>
  <div class="job-title-management">
    <h2 class="section-title">Job Title Management</h2>
    <p class="section-description">
      Manage job titles and organizational structure for your company. All job titles are isolated to your company (Company ID: {{ companyId }}).
    </p>

    <!-- Success Message -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- Create Job Title Form -->
    <div class="form-card">
      <h3 class="form-title">Create New Job Title</h3>
      <form @submit.prevent="handleCreateJobTitle" class="job-title-form">
        <div class="form-row">
          <div class="form-group">
            <label for="title_name" class="form-label">Job Title Name *</label>
            <input
              id="title_name"
              v-model="formData.title_name"
              type="text"
              class="form-input"
              placeholder="Senior Software Engineer"
              required
              :disabled="loading"
            />
          </div>

          <div class="form-group">
            <label for="department" class="form-label">Department</label>
            <input
              id="department"
              v-model="formData.department"
              type="text"
              class="form-input"
              placeholder="Engineering"
              :disabled="loading"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="level" class="form-label">Level</label>
          <select
            id="level"
            v-model="formData.level"
            class="form-select"
            :disabled="loading"
          >
            <option value="">Select level</option>
            <option value="Junior">Junior</option>
            <option value="Specialist">Specialist</option>
            <option value="Senior">Senior</option>
            <option value="Lead">Lead</option>
            <option value="Manager">Manager</option>
            <option value="Senior Manager">Senior Manager</option>
            <option value="Director">Director</option>
            <option value="VP">VP</option>
            <option value="C-Level">C-Level</option>
          </select>
        </div>

        <button
          type="submit"
          class="submit-button"
          :disabled="loading || !isFormValid"
        >
          <span v-if="loading">Creating...</span>
          <span v-else>Create Job Title</span>
        </button>
      </form>
    </div>

    <!-- Job Titles List -->
    <div class="job-titles-list-card">
      <div class="list-header">
        <h3 class="form-title">Company Job Titles</h3>
        <button @click="loadJobTitles" class="refresh-button" :disabled="loadingJobTitles">
          <span v-if="loadingJobTitles">Refreshing...</span>
          <span v-else>Refresh</span>
        </button>
      </div>

      <div v-if="loadingJobTitles" class="loading-state">
        Loading job titles...
      </div>

      <div v-else-if="jobTitles.length === 0" class="empty-state">
        No job titles found. Create your first job title above.
      </div>

      <div v-else class="job-titles-table">
        <table>
          <thead>
            <tr>
              <th>Job Title</th>
              <th>Department</th>
              <th>Level</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="jobTitle in jobTitles" :key="jobTitle.id">
              <td>{{ jobTitle.title_name }}</td>
              <td>{{ jobTitle.department || 'N/A' }}</td>
              <td>
                <span v-if="jobTitle.level" class="level-badge">
                  {{ jobTitle.level }}
                </span>
                <span v-else class="no-level">N/A</span>
              </td>
              <td>{{ formatDate(jobTitle.created_at) }}</td>
              <td>
                <div class="action-buttons">
                  <button
                    @click="openRoleAssignmentModal(jobTitle)"
                    class="assign-roles-button"
                  >
                    Manage Roles
                  </button>
                  <button
                    @click="handleDeleteJobTitle(jobTitle.id)"
                    class="delete-button"
                    :disabled="deletingJobTitleId === jobTitle.id"
                  >
                    <span v-if="deletingJobTitleId === jobTitle.id">Deleting...</span>
                    <span v-else>Delete</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Role Assignment Modal -->
    <div v-if="showRoleModal" class="modal-overlay" @click="closeRoleModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Assign System Roles: {{ selectedJobTitle?.title_name }}</h3>
          <button @click="closeRoleModal" class="modal-close">×</button>
        </div>

        <div v-if="loadingRoles" class="loading-state">
          Loading roles...
        </div>

        <div v-else class="role-assignment-form">
          <p class="modal-description">
            Select which system roles (permissions) should be assigned to this job title. Users with this job title will inherit all permissions from the selected roles.
          </p>

          <div class="roles-list">
            <div
              v-for="role in availableRoles"
              :key="role.role"
              class="role-checkbox-item"
            >
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :value="role.role"
                  :checked="isRoleAssigned(role.role)"
                  @change="handleRoleToggle(role.role, $event.target.checked)"
                  :disabled="loadingRoleAssignment"
                />
                <span class="role-name">{{ formatRole(role.role) }}</span>
                <span class="role-description">
                  <span v-if="role.module_hr_read || role.module_hr_write">HR</span>
                  <span v-if="role.module_finance_read || role.module_finance_write">Finance</span>
                  <span v-if="role.module_it_read || role.module_it_write">IT</span>
                </span>
              </label>
            </div>
          </div>

          <div v-if="assignedRoles.length > 0" class="assigned-roles-summary">
            <strong>Assigned Roles:</strong>
            <span
              v-for="role in assignedRoles"
              :key="role"
              class="assigned-role-badge"
            >
              {{ formatRole(role) }}
            </span>
          </div>

          <div class="modal-actions">
            <button
              type="button"
              @click="closeRoleModal"
              class="cancel-button"
              :disabled="loadingRoleAssignment"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../../services/supabaseClient'
import { createJobTitle, getCompanyJobTitles, deleteJobTitle, getRolesForJobTitle, assignRoleToJobTitle, removeRoleFromJobTitle } from '../../services/itService'
import { getAvailableRoles } from '../../services/userService'

const formData = ref({
  title_name: '',
  department: '',
  level: ''
})

const loading = ref(false)
const loadingJobTitles = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const jobTitles = ref([])
const companyId = ref(null)
const deletingJobTitleId = ref(null)
const showRoleModal = ref(false)
const selectedJobTitle = ref(null)
const availableRoles = ref([])
const assignedRoles = ref([])
const loadingRoles = ref(false)
const loadingRoleAssignment = ref(false)

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
  
  loadJobTitles()
  loadAvailableRoles()
})

// Form validation
const isFormValid = computed(() => {
  return formData.value.title_name && formData.value.title_name.trim().length > 0
})

/**
 * Load job titles for the current company
 */
async function loadJobTitles() {
  loadingJobTitles.value = true
  errorMessage.value = ''
  
  try {
    const result = await getCompanyJobTitles()
    
    if (result.success) {
      jobTitles.value = result.jobTitles || []
    } else {
      errorMessage.value = result.error || 'Failed to load job titles'
    }
  } catch (error) {
    console.error('Error loading job titles:', error)
    errorMessage.value = 'An unexpected error occurred while loading job titles'
  } finally {
    loadingJobTitles.value = false
  }
}

/**
 * Handle form submission to create new job title
 */
async function handleCreateJobTitle() {
  errorMessage.value = ''
  successMessage.value = ''
  loading.value = true

  try {
    if (!isFormValid.value) {
      errorMessage.value = 'Please fill in the job title name'
      loading.value = false
      return
    }

    const result = await createJobTitle({
      title_name: formData.value.title_name.trim(),
      department: formData.value.department?.trim() || null,
      level: formData.value.level?.trim() || null
    })

    if (result.success) {
      successMessage.value = `Job title created successfully!`
      
      // Reset form
      formData.value = {
        title_name: '',
        department: '',
        level: ''
      }

      // Reload job titles list
      await loadJobTitles()
    } else {
      errorMessage.value = result.error || 'Failed to create job title'
    }
  } catch (error) {
    console.error('Error creating job title:', error)
    errorMessage.value = 'An unexpected error occurred. Please try again.'
  } finally {
    loading.value = false
  }
}

/**
 * Handle job title deletion
 */
async function handleDeleteJobTitle(jobTitleId) {
  if (!confirm('Are you sure you want to delete this job title? Users assigned to this title will need to be reassigned first.')) {
    return
  }

  deletingJobTitleId.value = jobTitleId
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await deleteJobTitle(jobTitleId)

    if (result.success) {
      successMessage.value = 'Job title deleted successfully!'
      await loadJobTitles()
    } else {
      errorMessage.value = result.error || 'Failed to delete job title'
    }
  } catch (error) {
    console.error('Error deleting job title:', error)
    errorMessage.value = 'An unexpected error occurred. Please try again.'
  } finally {
    deletingJobTitleId.value = null
  }
}

/**
 * Load available roles from permissions table
 */
async function loadAvailableRoles() {
  loadingRoles.value = true
  try {
    const roles = await getAvailableRoles()
    // Fetch full role details with permissions
    const { data: rolesData, error } = await supabase
      .from('permissions')
      .select('*')
      .in('role', roles)
      .order('role')

    if (!error && rolesData) {
      availableRoles.value = rolesData
    } else {
      // Fallback to just role names
      availableRoles.value = roles.map(role => ({ role }))
    }
  } catch (error) {
    console.error('Error loading available roles:', error)
  } finally {
    loadingRoles.value = false
  }
}

/**
 * Open role assignment modal for a job title
 */
async function openRoleAssignmentModal(jobTitle) {
  selectedJobTitle.value = jobTitle
  loadingRoleAssignment.value = true
  errorMessage.value = ''
  
  try {
    const result = await getRolesForJobTitle(jobTitle.id)
    if (result.success) {
      assignedRoles.value = result.roles || []
    } else {
      errorMessage.value = result.error || 'Failed to load assigned roles'
    }
  } catch (error) {
    console.error('Error loading job title roles:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loadingRoleAssignment.value = false
  }
  
  showRoleModal.value = true
}

/**
 * Close role assignment modal
 */
function closeRoleModal() {
  showRoleModal.value = false
  selectedJobTitle.value = null
  assignedRoles.value = []
}

/**
 * Check if a role is assigned to the current job title
 */
function isRoleAssigned(roleName) {
  return assignedRoles.value.includes(roleName)
}

/**
 * Handle role checkbox toggle
 */
async function handleRoleToggle(roleName, isChecked) {
  if (!selectedJobTitle.value) return

  loadingRoleAssignment.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    let result
    if (isChecked) {
      // Assign role
      result = await assignRoleToJobTitle(selectedJobTitle.value.id, roleName)
      if (result.success) {
        assignedRoles.value.push(roleName)
        successMessage.value = 'Role assigned successfully!'
      }
    } else {
      // Remove role
      result = await removeRoleFromJobTitle(selectedJobTitle.value.id, roleName)
      if (result.success) {
        assignedRoles.value = assignedRoles.value.filter(r => r !== roleName)
        successMessage.value = 'Role removed successfully!'
      }
    }

    if (!result.success) {
      errorMessage.value = result.error || 'Failed to update role assignment'
      // Revert checkbox state
      await openRoleAssignmentModal(selectedJobTitle.value)
    }
  } catch (error) {
    console.error('Error toggling role:', error)
    errorMessage.value = 'An unexpected error occurred'
    // Revert checkbox state
    await openRoleAssignmentModal(selectedJobTitle.value)
  } finally {
    loadingRoleAssignment.value = false
  }
}

/**
 * Format role name for display
 */
function formatRole(role) {
  if (!role) return ''
  return role
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
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
.job-title-management {
  max-width: 1200px;
  margin: 0 auto;
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

.form-card,
.job-titles-list-card {
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

.job-title-form {
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
.form-select {
  padding: var(--spacing-md);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  transition: all var(--transition-base);
  background: var(--color-background);
  font-family: inherit;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(42, 99, 62, 0.1);
}

.form-input:disabled,
.form-select:disabled {
  background: var(--color-surface);
  cursor: not-allowed;
  opacity: 0.6;
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

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.refresh-button {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  color: var(--color-text-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.refresh-button:hover:not(:disabled) {
  background: var(--color-border-light);
}

.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-medium);
}

.job-titles-table {
  overflow-x: auto;
}

.job-titles-table table {
  width: 100%;
  border-collapse: collapse;
}

.job-titles-table th,
.job-titles-table td {
  padding: var(--spacing-md);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.job-titles-table th {
  font-weight: 600;
  color: var(--color-text-medium);
  background: var(--color-surface);
}

.job-titles-table td {
  color: var(--color-text-dark);
}

.level-badge {
  display: inline-block;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-primary-light);
  color: var(--color-text-on-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.no-level {
  color: var(--color-text-medium);
  font-style: italic;
}

.delete-button {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-danger);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.delete-button:hover:not(:disabled) {
  background: var(--color-danger-light);
  transform: translateY(-1px);
}

.delete-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-buttons {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.assign-roles-button {
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

.assign-roles-button:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

/* Modal Styles */
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

.modal-description {
  color: var(--color-text-medium);
  margin-bottom: var(--spacing-lg);
  line-height: 1.6;
}

.role-assignment-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.roles-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  max-height: 400px;
  overflow-y: auto;
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}

.role-checkbox-item {
  display: flex;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  cursor: pointer;
  width: 100%;
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  transition: background var(--transition-base);
}

.checkbox-label:hover {
  background: var(--color-border-light);
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.role-name {
  font-weight: 600;
  color: var(--color-text-dark);
  flex: 1;
}

.role-description {
  font-size: var(--font-size-xs);
  color: var(--color-text-medium);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-border-light);
  border-radius: var(--radius-sm);
}

.assigned-roles-summary {
  padding: var(--spacing-md);
  background: var(--color-success-light);
  border-radius: var(--radius-md);
  color: var(--color-text-on-primary);
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  align-items: center;
}

.assigned-role-badge {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.modal-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
  margin-top: var(--spacing-lg);
}

.cancel-button {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-surface);
  color: var(--color-text-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.cancel-button:hover:not(:disabled) {
  background: var(--color-border-light);
}

.cancel-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .list-header {
    flex-direction: column;
    gap: var(--spacing-md);
    align-items: flex-start;
  }
}
</style>

