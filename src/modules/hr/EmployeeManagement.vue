<template>
  <div class="employee-management">
    <div class="section-header">
      <h2 class="section-title">Employee Management</h2>
      <button @click="openAddEmployeeModal" class="add-button">
        + Add Employee
      </button>
    </div>

    <!-- Success/Error Messages -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- Filters and Actions Bar -->
    <div class="filters-bar">
      <div class="filters-group">
        <input
          v-model="filters.name"
          type="text"
          class="filter-input"
          placeholder="Search by name or email..."
          @input="handleFilterChange"
        />
        <select
          v-model="filters.department"
          class="filter-select"
          @change="handleFilterChange"
        >
          <option value="">All Departments</option>
          <option
            v-for="dept in uniqueDepartments"
            :key="dept"
            :value="dept"
          >
            {{ dept }}
          </option>
        </select>
        <select
          v-model="filters.job_title_id"
          class="filter-select"
          @change="handleFilterChange"
        >
          <option value="">All Job Titles</option>
          <option
            v-for="jobTitle in jobTitles"
            :key="jobTitle.id"
            :value="jobTitle.id"
          >
            {{ jobTitle.title_name }}
          </option>
        </select>
      </div>
      <div class="actions-group">
        <button
          v-if="selectedEmployees.length > 0"
          @click="openBulkActionsModal"
          class="bulk-actions-button"
        >
          Bulk Actions ({{ selectedEmployees.length }})
        </button>
        <button
          @click="handleExport"
          class="export-button"
          :disabled="loading"
        >
          📥 Export to CSV
        </button>
      </div>
    </div>

    <!-- Employees Table -->
    <div v-if="loading" class="loading-state">
      Loading employees...
    </div>

    <div v-else-if="employees.length === 0" class="empty-state">
      No employees found. Add your first employee above.
    </div>

    <div v-else class="employees-table">
      <table>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                :checked="allSelected"
                @change="toggleSelectAll"
                class="select-all-checkbox"
              />
            </th>
            <th>Full Name</th>
            <th>Job Title</th>
            <th>Department</th>
            <th>Salary</th>
            <th>Leave Balance</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="employee in employees" :key="employee.id">
            <td>
              <input
                type="checkbox"
                :value="employee.id"
                v-model="selectedEmployees"
                class="employee-checkbox"
              />
            </td>
            <td>
              <strong>{{ employee.full_name || employee.email }}</strong>
              <div class="email-subtext">{{ employee.email }}</div>
            </td>
            <td>
              <span v-if="employee.job_titles">{{ employee.job_titles.title_name }}</span>
              <span v-else class="no-data">Not assigned</span>
            </td>
            <td>{{ employee.department || 'N/A' }}</td>
            <td>
              <span v-if="employee.salary">{{ formatCurrency(employee.salary) }}</span>
              <span v-else class="no-data">N/A</span>
            </td>
            <td>
              <span class="leave-balance">
                {{ (employee.annual_leave_days || 20) - (employee.used_leave_days || 0) }} / {{ employee.annual_leave_days || 20 }}
              </span>
            </td>
            <td>
              <div class="action-buttons">
                <button @click="openProfileModal(employee.id)" class="view-button">
                  View Profile
                </button>
                <button @click="openEditModal(employee)" class="edit-button">
                  Edit
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination Controls -->
      <div v-if="pagination && pagination.totalPages > 1" class="pagination-controls">
        <button
          @click="goToPage(pagination.page - 1)"
          :disabled="!pagination.hasPrevPage || loading"
          class="pagination-button"
        >
          ← Previous
        </button>
        <span class="pagination-info">
          Page {{ pagination.page }} of {{ pagination.totalPages }} ({{ pagination.total }} total)
        </span>
        <button
          @click="goToPage(pagination.page + 1)"
          :disabled="!pagination.hasNextPage || loading"
          class="pagination-button"
        >
          Next →
        </button>
      </div>
    </div>

    <!-- Add/Edit Employee Modal -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingEmployee ? 'Edit Employee' : 'Add Employee' }}</h3>
          <button @click="closeModal" class="modal-close">×</button>
        </div>

        <form @submit.prevent="handleSaveEmployee" class="employee-form">
          <div class="form-group">
            <label for="employee-email" class="form-label">Email *</label>
            <input
              id="employee-email"
              v-model="formData.email"
              type="email"
              class="form-input"
              placeholder="employee@company.com"
              required
              :disabled="editingEmployee || loading"
            />
            <small v-if="!editingEmployee" class="form-hint">User must already exist in the system</small>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="employee-first-name" class="form-label">First Name</label>
              <input
                id="employee-first-name"
                v-model="formData.first_name"
                type="text"
                class="form-input"
                placeholder="John"
                :disabled="loading"
              />
            </div>

            <div class="form-group">
              <label for="employee-last-name" class="form-label">Last Name</label>
              <input
                id="employee-last-name"
                v-model="formData.last_name"
                type="text"
                class="form-input"
                placeholder="Doe"
                :disabled="loading"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="employee-department" class="form-label">Department</label>
              <input
                id="employee-department"
                v-model="formData.department"
                type="text"
                class="form-input"
                placeholder="Engineering"
                :disabled="loading"
              />
            </div>

            <div class="form-group">
              <label for="employee-salary" class="form-label">Salary</label>
              <input
                id="employee-salary"
                v-model="formData.salary"
                type="number"
                step="0.01"
                class="form-input"
                placeholder="50000"
                :disabled="loading"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="employee-annual-leave" class="form-label">Annual Leave Days</label>
              <input
                id="employee-annual-leave"
                v-model="formData.annual_leave_days"
                type="number"
                class="form-input"
                placeholder="20"
                min="0"
                :disabled="loading"
              />
            </div>

            <div v-if="editingEmployee" class="form-group">
              <label for="employee-used-leave" class="form-label">Used Leave Days</label>
              <input
                id="employee-used-leave"
                v-model="formData.used_leave_days"
                type="number"
                class="form-input"
                placeholder="0"
                min="0"
                :disabled="loading"
              />
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeModal" class="cancel-button" :disabled="loading">
              Cancel
            </button>
            <button type="submit" class="submit-button" :disabled="loading || !isFormValid">
              <span v-if="loading">{{ editingEmployee ? 'Updating...' : 'Creating...' }}</span>
              <span v-else>{{ editingEmployee ? 'Update' : 'Create' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Employee Detail Profile Modal -->
    <EmployeeDetailProfile
      v-if="showProfileModal"
      :employee-id="selectedEmployeeId"
      @close="closeProfileModal"
      @updated="loadEmployees"
    />

    <!-- Bulk Actions Modal -->
    <div v-if="showBulkModal" class="modal-overlay" @click="closeBulkModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Bulk Actions ({{ selectedEmployees.length }} employees)</h3>
          <button @click="closeBulkModal" class="modal-close">×</button>
        </div>

        <form @submit.prevent="handleBulkUpdate" class="bulk-form">
          <div class="form-group">
            <label class="form-label">Update Department</label>
            <input
              v-model="bulkForm.department"
              type="text"
              class="form-input"
              placeholder="Leave empty to keep current"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Update Job Title</label>
            <select
              v-model="bulkForm.job_title_id"
              class="form-select"
            >
              <option value="">Keep current job title</option>
              <option
                v-for="jobTitle in jobTitles"
                :key="jobTitle.id"
                :value="jobTitle.id"
              >
                {{ jobTitle.title_name }}
              </option>
            </select>
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeBulkModal" class="cancel-button" :disabled="loadingBulk">
              Cancel
            </button>
            <button type="submit" class="submit-button" :disabled="loadingBulk || !isBulkFormValid">
              <span v-if="loadingBulk">Updating...</span>
              <span v-else>Update {{ selectedEmployees.length }} Employees</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { createEmployee, updateEmployeeProfile, getAllCompanyEmployees, getEmployeeProfile, updateBulkEmployees, exportEmployeesToCSV } from '../../services/hrService'
import { getCompanyJobTitles } from '../../services/itService'
import EmployeeDetailProfile from './EmployeeDetailProfile.vue'

const emit = defineEmits(['updated'])

const employees = ref([])
const pagination = ref(null)
const loading = ref(false)
const loadingBulk = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const showModal = ref(false)
const showProfileModal = ref(false)
const showBulkModal = ref(false)
const selectedEmployeeId = ref(null)
const selectedEmployees = ref([])
const editingEmployee = ref(null)
const currentPage = ref(1)
const pageLimit = ref(50)
const filters = ref({
  name: '',
  department: '',
  job_title_id: ''
})
const jobTitles = ref([])
const bulkForm = ref({
  department: '',
  job_title_id: ''
})
const formData = ref({
  email: '',
  first_name: '',
  last_name: '',
  department: '',
  salary: '',
  annual_leave_days: 20,
  used_leave_days: 0
})

const isFormValid = computed(() => {
  return formData.value.email && formData.value.email.trim().length > 0
})

const isBulkFormValid = computed(() => {
  return bulkForm.value.department || bulkForm.value.job_title_id
})

const allSelected = computed(() => {
  return employees.value.length > 0 && selectedEmployees.value.length === employees.value.length
})

const uniqueDepartments = computed(() => {
  const departments = new Set()
  employees.value.forEach(emp => {
    if (emp.department) departments.add(emp.department)
  })
  return Array.from(departments).sort()
})

onMounted(() => {
  loadJobTitles()
  loadEmployees()
})

// Debounce filter changes
let filterTimeout = null
watch(() => filters.value, () => {
  if (filterTimeout) clearTimeout(filterTimeout)
  filterTimeout = setTimeout(() => {
    currentPage.value = 1
    loadEmployees()
  }, 500)
}, { deep: true })

async function loadEmployees() {
  loading.value = true
  errorMessage.value = ''
  
  try {
    const result = await getAllCompanyEmployees(currentPage.value, pageLimit.value, filters.value)
    if (result.success) {
      employees.value = result.employees || []
      pagination.value = result.pagination || null
    } else {
      errorMessage.value = result.error || 'Failed to load employees'
    }
  } catch (error) {
    console.error('Error loading employees:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}

async function loadJobTitles() {
  try {
    const result = await getCompanyJobTitles()
    if (result.success) {
      jobTitles.value = result.jobTitles || []
    }
  } catch (error) {
    console.error('Error loading job titles:', error)
  }
}

function handleFilterChange() {
  currentPage.value = 1
  loadEmployees()
}

function goToPage(page) {
  if (page < 1 || (pagination.value && page > pagination.value.totalPages)) return
  currentPage.value = page
  loadEmployees()
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedEmployees.value = []
  } else {
    selectedEmployees.value = employees.value.map(emp => emp.id)
  }
}

function openBulkActionsModal() {
  if (selectedEmployees.value.length === 0) return
  bulkForm.value = {
    department: '',
    job_title_id: ''
  }
  showBulkModal.value = true
}

function closeBulkModal() {
  showBulkModal.value = false
  bulkForm.value = {
    department: '',
    job_title_id: ''
  }
}

async function handleBulkUpdate() {
  loadingBulk.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const updateData = {}
    if (bulkForm.value.department) updateData.department = bulkForm.value.department.trim()
    if (bulkForm.value.job_title_id) updateData.job_title_id = bulkForm.value.job_title_id

    const result = await updateBulkEmployees(selectedEmployees.value, updateData)
    if (result.success) {
      successMessage.value = `Successfully updated ${result.updatedCount} employee(s)!`
      selectedEmployees.value = []
      closeBulkModal()
      await loadEmployees()
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to update employees'
    }
  } catch (error) {
    console.error('Error performing bulk update:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loadingBulk.value = false
  }
}

async function handleExport() {
  loading.value = true
  errorMessage.value = ''
  
  try {
    const result = await exportEmployeesToCSV(filters.value)
    if (result.success) {
      // Create blob and download
      const blob = new Blob([result.csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', result.filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      successMessage.value = 'Export completed successfully!'
    } else {
      errorMessage.value = result.error || 'Failed to export employees'
    }
  } catch (error) {
    console.error('Error exporting employees:', error)
    errorMessage.value = 'An unexpected error occurred while exporting'
  } finally {
    loading.value = false
  }
}

function openAddEmployeeModal() {
  editingEmployee.value = null
  formData.value = {
    email: '',
    department: '',
    salary: '',
    annual_leave_days: 20,
    used_leave_days: 0
  }
  showModal.value = true
}

function openEditModal(employee) {
  editingEmployee.value = employee
  formData.value = {
    email: employee.email,
    first_name: employee.first_name || '',
    last_name: employee.last_name || '',
    department: employee.department || '',
    salary: employee.salary || '',
    annual_leave_days: employee.annual_leave_days || 20,
    used_leave_days: employee.used_leave_days || 0
  }
  showModal.value = true
}

function openProfileModal(employeeId) {
  selectedEmployeeId.value = employeeId
  showProfileModal.value = true
}

function closeProfileModal() {
  showProfileModal.value = false
  selectedEmployeeId.value = null
}

function closeModal() {
  showModal.value = false
  editingEmployee.value = null
  formData.value = {
    email: '',
    first_name: '',
    last_name: '',
    department: '',
    salary: '',
    annual_leave_days: 20,
    used_leave_days: 0
  }
}

async function handleSaveEmployee() {
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    let result
    if (editingEmployee.value) {
      // Find user by email to get ID
      const employee = employees.value.find(e => e.email === formData.value.email)
      if (!employee) {
        errorMessage.value = 'Employee not found'
        loading.value = false
        return
      }

      result = await updateEmployeeProfile(employee.id, {
        department: formData.value.department,
        salary: formData.value.salary,
        annual_leave_days: formData.value.annual_leave_days,
        used_leave_days: formData.value.used_leave_days
      })
    } else {
      result = await createEmployee({
        email: formData.value.email,
        department: formData.value.department,
        salary: formData.value.salary,
        annual_leave_days: formData.value.annual_leave_days
      })
    }

    if (result.success) {
      successMessage.value = editingEmployee.value
        ? 'Employee updated successfully!'
        : 'Employee profile created successfully!'
      closeModal()
      await loadEmployees()
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to save employee'
    }
  } catch (error) {
    console.error('Error saving employee:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loading.value = false
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
</script>

<style scoped>
.employee-management {
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

.loading-state,
.empty-state {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-medium);
}

.employees-table {
  overflow-x: auto;
}

.employees-table table {
  width: 100%;
  border-collapse: collapse;
}

.employees-table th,
.employees-table td {
  padding: var(--spacing-md);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.employees-table th {
  font-weight: 600;
  color: var(--color-text-medium);
  background: var(--color-surface);
}

.no-data {
  color: var(--color-text-medium);
  font-style: italic;
}

.leave-balance {
  font-weight: 500;
  color: var(--color-text-dark);
}

.edit-button {
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

.edit-button:hover {
  background: var(--color-primary-dark);
}

.action-buttons {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
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
}

.email-subtext {
  font-size: var(--font-size-xs);
  color: var(--color-text-medium);
  font-weight: normal;
  margin-top: var(--spacing-xs);
}

.filters-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.filters-group {
  display: flex;
  gap: var(--spacing-md);
  flex: 1;
  flex-wrap: wrap;
}

.actions-group {
  display: flex;
  gap: var(--spacing-md);
}

.filter-input,
.filter-select {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  background: var(--color-background);
  transition: all var(--transition-base);
  min-width: 150px;
}

.filter-input:focus,
.filter-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(42, 99, 62, 0.1);
}

.bulk-actions-button,
.export-button {
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.bulk-actions-button {
  background: var(--color-warning);
  color: var(--color-text-on-primary);
}

.bulk-actions-button:hover {
  background: var(--color-warning-light);
}

.export-button {
  background: var(--color-success);
  color: var(--color-text-on-primary);
}

.export-button:hover:not(:disabled) {
  background: var(--color-success-light);
}

.export-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.select-all-checkbox,
.employee-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-lg);
  margin-top: var(--spacing-lg);
  padding: var(--spacing-lg);
}

.pagination-button {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.pagination-button:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.pagination-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pagination-info {
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
}

.bulk-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
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

.employee-form {
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

.form-input {
  padding: var(--spacing-md);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  transition: all var(--transition-base);
  background: var(--color-background);
  font-family: inherit;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(42, 99, 62, 0.1);
}

.form-input:disabled {
  background: var(--color-surface);
  cursor: not-allowed;
  opacity: 0.6;
}

.form-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-medium);
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

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>

