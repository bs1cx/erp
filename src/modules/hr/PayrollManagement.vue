<template>
  <div class="payroll-management">
    <!-- 
      PAYROLL SCOPE DEFINITION (Bordro Kapsamı):
      ==========================================
      This component is designed for Payroll Data Display and Export (Ön Yüz/Görüntüleme).
      It does NOT handle Tax Calculation and Compliance (Bordro Hesaplama).
      
      The system displays payroll records, allows status updates, and provides export functionality.
      For actual payroll calculations, tax compliance, and legal reporting, integration with
      a dedicated payroll service or accounting system is required.
      
      This scope definition addresses enterprise concerns about complexity by clearly
      separating display/management from calculation/compliance.
    -->
    <div class="scope-notice">
      <h3 class="notice-title">Payroll Scope Definition</h3>
      <p class="notice-text">
        <strong>Current Functionality:</strong> Payroll Data Display, Status Management, and Export (Ön Yüz/Görüntüleme)
      </p>
      <p class="notice-text">
        <strong>Not Included:</strong> Tax Calculation, Compliance Reporting, and Legal Bordro Hesaplama
      </p>
      <p class="notice-text">
        <strong>Note:</strong> For full payroll calculation and compliance, integration with a dedicated payroll service is required.
      </p>
    </div>
    
    <div class="section-header">
      <h2 class="section-title">Payroll Management</h2>
      <button @click="openCreateModal" class="primary-button">
        Create Payroll Record
      </button>
    </div>

    <!-- Success/Error Messages -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- Filters -->
    <div class="filters-bar">
      <div class="filters-group">
        <select
          v-model="filters.status"
          class="filter-select"
          @change="handleFilterChange"
        >
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Processing">Processing</option>
          <option value="Paid">Paid</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <select
          v-model="filters.user_id"
          class="filter-select"
          @change="handleFilterChange"
        >
          <option value="">All Employees</option>
          <option
            v-for="employee in employees"
            :key="employee.id"
            :value="employee.id"
          >
            {{ employee.full_name || employee.email }}
          </option>
        </select>
        <input
          v-model="filters.period_start"
          type="date"
          class="filter-input"
          @change="handleFilterChange"
        />
        <input
          v-model="filters.period_end"
          type="date"
          class="filter-input"
          @change="handleFilterChange"
        />
      </div>
    </div>

    <!-- Payroll Records Table -->
    <div v-if="loading" class="loading-state">
      Loading payroll records...
    </div>

    <div v-else-if="payrollRecords.length === 0" class="empty-state">
      No payroll records found.
    </div>

    <div v-else class="payroll-table">
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Period</th>
            <th>Gross Salary</th>
            <th>Tax</th>
            <th>Contributions</th>
            <th>Deductions</th>
            <th>Bonuses</th>
            <th>Net Salary</th>
            <th>Status</th>
            <th>Payment Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in payrollRecords" :key="record.id">
            <td>
              <div class="employee-cell">
                <strong>{{ getEmployeeName(record.users) }}</strong>
                <span class="email-subtext">{{ record.users?.email }}</span>
              </div>
            </td>
            <td>
              {{ formatDate(record.period_start) }} - {{ formatDate(record.period_end) }}
            </td>
            <td class="amount-cell">{{ formatCurrency(record.gross_salary) }}</td>
            <td class="amount-cell">{{ formatCurrency(record.tax_amount) }}</td>
            <td class="amount-cell">{{ formatCurrency(record.contribution_amount) }}</td>
            <td class="amount-cell">{{ formatCurrency(record.deductions) }}</td>
            <td class="amount-cell">{{ formatCurrency(record.bonuses) }}</td>
            <td class="amount-cell net-salary">{{ formatCurrency(record.net_salary) }}</td>
            <td>
              <span class="status-badge" :class="getStatusClass(record.status)">
                {{ record.status }}
              </span>
            </td>
            <td>{{ record.payment_date ? formatDate(record.payment_date) : 'N/A' }}</td>
            <td>
              <div class="action-buttons">
                <button
                  v-if="record.status === 'Pending'"
                  @click="openUpdateStatusModal(record)"
                  class="action-button"
                >
                  Update Status
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
          Previous
        </button>
        <span class="pagination-info">
          Page {{ pagination.page }} of {{ pagination.totalPages }} ({{ pagination.total }} total)
        </span>
        <button
          @click="goToPage(pagination.page + 1)"
          :disabled="!pagination.hasNextPage || loading"
          class="pagination-button"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Create Payroll Record Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click="closeCreateModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Create Payroll Record</h3>
          <button @click="closeCreateModal" class="modal-close">×</button>
        </div>

        <form @submit.prevent="handleCreatePayroll" class="payroll-form">
          <div class="form-group">
            <label class="form-label">Employee *</label>
            <select
              v-model="payrollForm.user_id"
              class="form-select"
              required
            >
              <option value="">Select Employee</option>
              <option
                v-for="employee in employees"
                :key="employee.id"
                :value="employee.id"
              >
                {{ employee.full_name || employee.email }}
              </option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Period Start *</label>
              <input
                v-model="payrollForm.period_start"
                type="date"
                class="form-input"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label">Period End *</label>
              <input
                v-model="payrollForm.period_end"
                type="date"
                class="form-input"
                required
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Gross Salary *</label>
              <input
                v-model.number="payrollForm.gross_salary"
                type="number"
                step="0.01"
                min="0"
                class="form-input"
                required
                @input="calculateNetSalary"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Tax Amount</label>
              <input
                v-model.number="payrollForm.tax_amount"
                type="number"
                step="0.01"
                min="0"
                class="form-input"
                @input="calculateNetSalary"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Contributions</label>
              <input
                v-model.number="payrollForm.contribution_amount"
                type="number"
                step="0.01"
                min="0"
                class="form-input"
                @input="calculateNetSalary"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Deductions</label>
              <input
                v-model.number="payrollForm.deductions"
                type="number"
                step="0.01"
                min="0"
                class="form-input"
                @input="calculateNetSalary"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Bonuses</label>
              <input
                v-model.number="payrollForm.bonuses"
                type="number"
                step="0.01"
                min="0"
                class="form-input"
                @input="calculateNetSalary"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Net Salary</label>
              <input
                :value="calculatedNetSalary"
                type="text"
                class="form-input"
                readonly
                disabled
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Status *</label>
              <select
                v-model="payrollForm.status"
                class="form-select"
                required
              >
                <option value="Pending">Pending</option>
                <option value="Processing">Processing</option>
                <option value="Paid">Paid</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Payment Date</label>
              <input
                v-model="payrollForm.payment_date"
                type="date"
                class="form-input"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Payment Method</label>
            <select
              v-model="payrollForm.payment_method"
              class="form-select"
            >
              <option value="">Select Method</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Check">Check</option>
              <option value="Cash">Cash</option>
              <option value="Direct Deposit">Direct Deposit</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea
              v-model="payrollForm.notes"
              class="form-textarea"
              rows="3"
            ></textarea>
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeCreateModal" class="secondary-button" :disabled="loading">
              Cancel
            </button>
            <button type="submit" class="primary-button" :disabled="loading || !isFormValid">
              <span v-if="loading">Creating...</span>
              <span v-else>Create Payroll Record</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Update Status Modal -->
    <div v-if="showStatusModal && selectedRecord" class="modal-overlay" @click="closeStatusModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Update Payroll Status</h3>
          <button @click="closeStatusModal" class="modal-close">×</button>
        </div>

        <form @submit.prevent="handleUpdateStatus" class="status-form">
          <div class="form-group">
            <label class="form-label">Status *</label>
            <select
              v-model="statusForm.status"
              class="form-select"
              required
            >
              <option value="Pending">Pending</option>
              <option value="Processing">Processing</option>
              <option value="Paid">Paid</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div v-if="statusForm.status === 'Paid'" class="form-group">
            <label class="form-label">Payment Date *</label>
            <input
              v-model="statusForm.payment_date"
              type="date"
              class="form-input"
              :required="statusForm.status === 'Paid'"
            />
          </div>

          <div v-if="statusForm.status === 'Paid'" class="form-group">
            <label class="form-label">Payment Method</label>
            <select
              v-model="statusForm.payment_method"
              class="form-select"
            >
              <option value="">Select Method</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Check">Check</option>
              <option value="Cash">Cash</option>
              <option value="Direct Deposit">Direct Deposit</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea
              v-model="statusForm.notes"
              class="form-textarea"
              rows="3"
            ></textarea>
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeStatusModal" class="secondary-button" :disabled="loading">
              Cancel
            </button>
            <button type="submit" class="primary-button" :disabled="loading">
              <span v-if="loading">Updating...</span>
              <span v-else>Update Status</span>
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
  createPayrollRecord,
  getAllPayrollRecords,
  updatePayrollStatus
} from '../../services/hrService'
import { getAllCompanyEmployees } from '../../services/hrService'

const emit = defineEmits(['updated'])

const payrollRecords = ref([])
const employees = ref([])
const pagination = ref(null)
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const showCreateModal = ref(false)
const showStatusModal = ref(false)
const selectedRecord = ref(null)
const currentPage = ref(1)
const pageLimit = ref(50)
const filters = ref({
  status: '',
  user_id: '',
  period_start: '',
  period_end: ''
})

const payrollForm = ref({
  user_id: '',
  period_start: '',
  period_end: '',
  gross_salary: 0,
  tax_amount: 0,
  contribution_amount: 0,
  deductions: 0,
  bonuses: 0,
  status: 'Pending',
  payment_date: '',
  payment_method: '',
  notes: ''
})

const statusForm = ref({
  status: '',
  payment_date: '',
  payment_method: '',
  notes: ''
})

const isFormValid = computed(() => {
  return payrollForm.value.user_id &&
         payrollForm.value.period_start &&
         payrollForm.value.period_end &&
         payrollForm.value.gross_salary > 0
})

const calculatedNetSalary = computed(() => {
  const gross = parseFloat(payrollForm.value.gross_salary) || 0
  const tax = parseFloat(payrollForm.value.tax_amount) || 0
  const contribution = parseFloat(payrollForm.value.contribution_amount) || 0
  const deductions = parseFloat(payrollForm.value.deductions) || 0
  const bonuses = parseFloat(payrollForm.value.bonuses) || 0
  const net = gross + bonuses - tax - contribution - deductions
  return formatCurrency(net)
})

onMounted(() => {
  loadEmployees()
  loadPayrollRecords()
})

async function loadEmployees() {
  try {
    const result = await getAllCompanyEmployees(1, 1000, {})
    if (result.success) {
      employees.value = result.employees || []
    }
  } catch (error) {
    console.error('Error loading employees:', error)
  }
}

async function loadPayrollRecords() {
  loading.value = true
  errorMessage.value = ''
  
  try {
    const result = await getAllPayrollRecords(currentPage.value, pageLimit.value, filters.value)
    if (result.success) {
      payrollRecords.value = result.payrollRecords || []
      pagination.value = result.pagination || null
    } else {
      errorMessage.value = result.error || 'Failed to load payroll records'
    }
  } catch (error) {
    console.error('Error loading payroll records:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}

function handleFilterChange() {
  currentPage.value = 1
  loadPayrollRecords()
}

function goToPage(page) {
  if (page < 1 || (pagination.value && page > pagination.value.totalPages)) return
  currentPage.value = page
  loadPayrollRecords()
}

function openCreateModal() {
  payrollForm.value = {
    user_id: '',
    period_start: '',
    period_end: '',
    gross_salary: 0,
    tax_amount: 0,
    contribution_amount: 0,
    deductions: 0,
    bonuses: 0,
    status: 'Pending',
    payment_date: '',
    payment_method: '',
    notes: ''
  }
  showCreateModal.value = true
}

function closeCreateModal() {
  showCreateModal.value = false
}

function calculateNetSalary() {
  // Auto-calculate tax if not provided (20% default)
  if (!payrollForm.value.tax_amount && payrollForm.value.gross_salary) {
    payrollForm.value.tax_amount = (payrollForm.value.gross_salary * 0.20).toFixed(2)
  }
  
  // Auto-calculate contribution if not provided (10% default)
  if (!payrollForm.value.contribution_amount && payrollForm.value.gross_salary) {
    payrollForm.value.contribution_amount = (payrollForm.value.gross_salary * 0.10).toFixed(2)
  }
}

async function handleCreatePayroll() {
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await createPayrollRecord(payrollForm.value)
    if (result.success) {
      successMessage.value = 'Payroll record created successfully!'
      closeCreateModal()
      await loadPayrollRecords()
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to create payroll record'
    }
  } catch (error) {
    console.error('Error creating payroll record:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}

function openUpdateStatusModal(record) {
  selectedRecord.value = record
  statusForm.value = {
    status: record.status,
    payment_date: record.payment_date || '',
    payment_method: record.payment_method || '',
    notes: record.notes || ''
  }
  showStatusModal.value = true
}

function closeStatusModal() {
  showStatusModal.value = false
  selectedRecord.value = null
}

async function handleUpdateStatus() {
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await updatePayrollStatus(
      selectedRecord.value.id,
      statusForm.value.status,
      {
        payment_date: statusForm.value.payment_date,
        payment_method: statusForm.value.payment_method,
        notes: statusForm.value.notes
      }
    )
    if (result.success) {
      successMessage.value = 'Payroll status updated successfully!'
      closeStatusModal()
      await loadPayrollRecords()
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to update payroll status'
    }
  } catch (error) {
    console.error('Error updating payroll status:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}

function getEmployeeName(user) {
  if (!user) return 'N/A'
  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim()
  return fullName || user.email || 'N/A'
}

function formatCurrency(amount) {
  if (!amount && amount !== 0) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount)
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

function getStatusClass(status) {
  const statusMap = {
    'Paid': 'status-success',
    'Pending': 'status-warning',
    'Processing': 'status-info',
    'Cancelled': 'status-danger'
  }
  return statusMap[status] || 'status-default'
}
</script>

<style scoped>
.payroll-management {
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

.primary-button:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.filters-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.filters-group {
  display: flex;
  gap: var(--spacing-md);
  flex: 1;
  flex-wrap: wrap;
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

.payroll-table {
  overflow-x: auto;
}

.payroll-table table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-background);
}

.payroll-table th,
.payroll-table td {
  padding: var(--spacing-md);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.payroll-table th {
  font-weight: 600;
  color: var(--color-text-medium);
  background: var(--color-surface);
  position: sticky;
  top: 0;
}

.employee-cell {
  display: flex;
  flex-direction: column;
}

.email-subtext {
  font-size: var(--font-size-xs);
  color: var(--color-text-medium);
  font-weight: normal;
  margin-top: var(--spacing-xs);
}

.amount-cell {
  font-family: 'Courier New', monospace;
  text-align: right;
}

.net-salary {
  font-weight: 600;
  color: var(--color-primary);
}

.status-badge {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
}

.status-success {
  background: var(--color-success-light);
  color: var(--color-text-on-primary);
}

.status-warning {
  background: var(--color-warning);
  color: var(--color-text-on-primary);
}

.status-info {
  background: var(--color-info-light);
  color: var(--color-text-on-primary);
}

.status-danger {
  background: var(--color-danger-light);
  color: var(--color-text-on-primary);
}

.status-default {
  background: var(--color-surface);
  color: var(--color-text-dark);
}

.action-buttons {
  display: flex;
  gap: var(--spacing-sm);
}

.action-button {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.action-button:hover {
  background: var(--color-primary-dark);
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
  max-width: 700px;
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

.payroll-form,
.status-form {
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

.form-input:disabled {
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

.scope-notice {
  padding: var(--spacing-lg);
  background: var(--color-info-light);
  border: 2px solid var(--color-info);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-xl);
}

.notice-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-dark);
  margin: 0 0 var(--spacing-md) 0;
}

.notice-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-dark);
  margin: var(--spacing-xs) 0;
  line-height: 1.6;
}

.notice-text strong {
  color: var(--color-primary);
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .filters-group {
    flex-direction: column;
  }
}
</style>


