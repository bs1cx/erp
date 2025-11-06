<template>
  <div class="user-management">
    <h2 class="section-title">User Management</h2>
    <p class="section-description">
      Create new users for your company. All users will be assigned to your company (Company ID: {{ companyId }}).
    </p>

    <!-- Success Message -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- Create User Form -->
    <div class="form-card">
      <h3 class="form-title">Create New User</h3>
      <form @submit.prevent="handleCreateUser" class="user-form">
        <div class="form-group">
          <label for="email" class="form-label">Email *</label>
          <input
            id="email"
            v-model="formData.email"
            type="email"
            class="form-input"
            placeholder="user@example.com"
            required
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label for="password" class="form-label">Temporary Password *</label>
          <input
            id="password"
            v-model="formData.password"
            type="password"
            class="form-input"
            placeholder="Enter temporary password"
            required
            minlength="8"
            :disabled="loading"
          />
          <small class="form-hint">Minimum 8 characters</small>
        </div>

        <div class="form-group">
          <label for="role" class="form-label">Role *</label>
          <select
            id="role"
            v-model="formData.role"
            class="form-select"
            required
            :disabled="loading || loadingRoles"
          >
            <option value="">Select a role</option>
            <option v-for="role in availableRoles" :key="role" :value="role">
              {{ formatRole(role) }}
            </option>
          </select>
          <small v-if="loadingRoles" class="form-hint">Loading roles...</small>
        </div>

        <button
          type="submit"
          class="submit-button"
          :disabled="loading || !isFormValid"
        >
          <span v-if="loading">Creating User...</span>
          <span v-else>Create User</span>
        </button>
      </form>
    </div>

    <!-- Users List -->
    <div class="users-list-card">
      <div class="list-header">
        <h3 class="form-title">Company Users</h3>
        <button @click="loadUsers" class="refresh-button" :disabled="loadingUsers">
          <span v-if="loadingUsers">Refreshing...</span>
          <span v-else>Refresh</span>
        </button>
      </div>

      <div v-if="loadingUsers" class="loading-state">
        Loading users...
      </div>

      <div v-else-if="users.length === 0" class="empty-state">
        No users found. Create your first user above.
      </div>

      <div v-else class="users-table">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Job Title</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>{{ user.email }}</td>
              <td>
                <span class="role-badge" :class="getRoleClass(user.role)">
                  {{ formatRole(user.role) }}
                </span>
              </td>
              <td>
                <span v-if="user.job_titles">{{ user.job_titles.title_name }}</span>
                <span v-else class="no-job-title">Not assigned</span>
              </td>
              <td>{{ formatDate(user.created_at) }}</td>
              <td>
                <button @click="openEditModal(user)" class="edit-button">
                  Edit
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Edit User Modal -->
    <div v-if="showEditModal" class="modal-overlay" @click="closeEditModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Edit User</h3>
          <button @click="closeEditModal" class="modal-close">×</button>
        </div>

        <form @submit.prevent="handleUpdateUser" class="user-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input
              v-model="editFormData.email"
              type="email"
              class="form-input"
              disabled
            />
            <small class="form-hint">Email cannot be changed</small>
          </div>

          <div class="form-group">
            <label for="edit-role" class="form-label">Role *</label>
            <select
              id="edit-role"
              v-model="editFormData.role"
              class="form-select"
              required
              :disabled="loadingUpdate"
            >
              <option value="">Select a role</option>
              <option v-for="role in availableRoles" :key="role" :value="role">
                {{ formatRole(role) }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label for="edit-job-title" class="form-label">Job Title</label>
            <select
              id="edit-job-title"
              v-model="editFormData.job_title_id"
              class="form-select"
              :disabled="loadingUpdate || loadingJobTitles"
            >
              <option :value="null">No Job Title</option>
              <option
                v-for="jobTitle in jobTitles"
                :key="jobTitle.id"
                :value="jobTitle.id"
              >
                {{ jobTitle.title_name }}
                <span v-if="jobTitle.department"> - {{ jobTitle.department }}</span>
              </option>
            </select>
            <small v-if="loadingJobTitles" class="form-hint">Loading job titles...</small>
          </div>

          <div class="form-group">
            <label for="edit-password" class="form-label">Reset Password</label>
            <input
              id="edit-password"
              v-model="editFormData.password"
              type="password"
              class="form-input"
              placeholder="Leave empty to keep current password"
              :disabled="loadingUpdate"
            />
            <small class="form-hint">Enter new password to reset (minimum 8 characters)</small>
          </div>

          <div class="modal-actions">
            <button
              type="button"
              @click="closeEditModal"
              class="cancel-button"
              :disabled="loadingUpdate"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="submit-button"
              :disabled="loadingUpdate || !isEditFormValid"
            >
              <span v-if="loadingUpdate">Updating...</span>
              <span v-else>Update User</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { createUser, getAvailableRoles, getCompanyUsers, updateUser } from '../../services/userService'
import { getCompanyJobTitles } from '../../services/itService'

const formData = ref({
  email: '',
  password: '',
  role: ''
})

const loading = ref(false)
const loadingRoles = ref(false)
const loadingUsers = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const availableRoles = ref([])
const users = ref([])
const companyId = ref(null)
const showEditModal = ref(false)
const editFormData = ref({
  id: null,
  email: '',
  role: '',
  job_title_id: null,
  password: ''
})
const loadingUpdate = ref(false)
const loadingJobTitles = ref(false)
const jobTitles = ref([])

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
  
  loadRoles()
  loadUsers()
  loadJobTitles()
})

// Form validation
const isFormValid = computed(() => {
  return formData.value.email &&
         formData.value.password &&
         formData.value.password.length >= 8 &&
         formData.value.role
})

/**
 * Load available roles from permissions table
 */
async function loadRoles() {
  loadingRoles.value = true
  try {
    const roles = await getAvailableRoles()
    availableRoles.value = roles
  } catch (error) {
    console.error('Error loading roles:', error)
    errorMessage.value = 'Failed to load available roles'
  } finally {
    loadingRoles.value = false
  }
}

/**
 * Load users for the current company
 */
async function loadUsers() {
  loadingUsers.value = true
  errorMessage.value = ''
  
  try {
    const result = await getCompanyUsers()
    
    if (result.success) {
      users.value = result.users || []
    } else {
      errorMessage.value = result.error || 'Failed to load users'
    }
  } catch (error) {
    console.error('Error loading users:', error)
    errorMessage.value = 'An unexpected error occurred while loading users'
  } finally {
    loadingUsers.value = false
  }
}

/**
 * Handle form submission to create new user
 */
async function handleCreateUser() {
  errorMessage.value = ''
  successMessage.value = ''
  loading.value = true

  try {
    // Validate form
    if (!isFormValid.value) {
      errorMessage.value = 'Please fill in all fields correctly'
      loading.value = false
      return
    }

    // Call user service to create user
    const result = await createUser(
      formData.value.email.trim(),
      formData.value.password,
      formData.value.role
    )

    if (result.success) {
      successMessage.value = `User created successfully! Email: ${result.user.email}`
      
      // Reset form
      formData.value = {
        email: '',
        password: '',
        role: ''
      }

      // Reload users list
      await loadUsers()
    } else {
      errorMessage.value = result.error || 'Failed to create user'
    }
  } catch (error) {
    console.error('Error creating user:', error)
    errorMessage.value = 'An unexpected error occurred. Please try again.'
  } finally {
    loading.value = false
  }
}

/**
 * Format role name for display
 */
function formatRole(role) {
  if (!role) return ''
  
  // Convert IT_ADMIN to "IT Admin", HR_USER to "HR User", etc.
  return role
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Get CSS class for role badge
 */
function getRoleClass(role) {
  const roleClasses = {
    'IT_ADMIN': 'role-it',
    'HR_USER': 'role-hr',
    'FINANCE_MANAGER': 'role-finance'
  }
  return roleClasses[role] || 'role-default'
}

/**
 * Load job titles for dropdown
 */
async function loadJobTitles() {
  loadingJobTitles.value = true
  try {
    const result = await getCompanyJobTitles()
    if (result.success) {
      jobTitles.value = result.jobTitles || []
    }
  } catch (error) {
    console.error('Error loading job titles:', error)
  } finally {
    loadingJobTitles.value = false
  }
}

/**
 * Open edit modal for a user
 */
function openEditModal(user) {
  editFormData.value = {
    id: user.id,
    email: user.email,
    role: user.role,
    job_title_id: user.job_title_id || null,
    password: ''
  }
  showEditModal.value = true
}

/**
 * Close edit modal
 */
function closeEditModal() {
  showEditModal.value = false
  editFormData.value = {
    id: null,
    email: '',
    role: '',
    job_title_id: null,
    password: ''
  }
}

/**
 * Edit form validation
 */
const isEditFormValid = computed(() => {
  return editFormData.value.role &&
         (!editFormData.value.password || editFormData.value.password.length >= 8)
})

/**
 * Handle user update
 */
async function handleUpdateUser() {
  errorMessage.value = ''
  successMessage.value = ''
  loadingUpdate.value = true

  try {
    if (!isEditFormValid.value) {
      errorMessage.value = 'Please fill in all required fields correctly'
      loadingUpdate.value = false
      return
    }

    const updateData = {
      role: editFormData.value.role,
      job_title_id: editFormData.value.job_title_id
    }

    // Only include password if provided
    if (editFormData.value.password && editFormData.value.password.trim().length > 0) {
      updateData.password = editFormData.value.password
    }

    const result = await updateUser(editFormData.value.id, updateData)

    if (result.success) {
      successMessage.value = 'User updated successfully!'
      closeEditModal()
      await loadUsers()
    } else {
      errorMessage.value = result.error || 'Failed to update user'
    }
  } catch (error) {
    console.error('Error updating user:', error)
    errorMessage.value = 'An unexpected error occurred. Please try again.'
  } finally {
    loadingUpdate.value = false
  }
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
.user-management {
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
.users-list-card {
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

.user-form {
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
.form-select {
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  transition: all 0.2s;
  background: white;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.form-input:disabled,
.form-select:disabled {
  background: #f7fafc;
  cursor: not-allowed;
  opacity: 0.6;
}

.form-hint {
  font-size: 12px;
  color: #718096;
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
  margin-top: 8px;
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

.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 40px;
  color: #718096;
}

.users-table {
  overflow-x: auto;
}

.users-table table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th,
.users-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.users-table th {
  font-weight: 600;
  color: #4a5568;
  background: #f7fafc;
}

.users-table td {
  color: #2d3748;
}

.role-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.role-it {
  background: #bee3f8;
  color: #2c5282;
}

.role-hr {
  background: #fbb6ce;
  color: #97266d;
}

.role-finance {
  background: #c6f6d5;
  color: #22543d;
}

.role-default {
  background: #e2e8f0;
  color: #4a5568;
}

.no-job-title {
  color: #718096;
  font-style: italic;
}

.edit-button {
  padding: 6px 12px;
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.edit-button:hover {
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
  max-width: 500px;
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
  .list-header {
    flex-direction: column;
    gap: 15px;
    align-items: flex-start;
  }

  .users-table {
    font-size: 14px;
  }
}
</style>

