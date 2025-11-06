<template>
  <div class="finance-dashboard">
    <!-- Dashboard Header -->
    <div class="dashboard-header">
      <div class="header-content">
        <h1 class="dashboard-title">Finance Dashboard</h1>
        <div class="header-actions">
          <span class="user-badge">{{ userData?.email }}</span>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs-container">
      <button
        @click="activeTab = 'overview'"
        :class="['tab-button', { active: activeTab === 'overview' }]"
      >
        Overview
      </button>
      <button
        @click="activeTab = 'integrations'"
        :class="['tab-button', { active: activeTab === 'integrations' }]"
      >
        Entegrasyon Yönetimi (Bordro/Muhasebe)
      </button>
      <button
        @click="activeTab = 'invoices'"
        :class="['tab-button', { active: activeTab === 'invoices' }]"
      >
        Fatura & Tedarikçi Yönetimi
      </button>
    </div>

    <!-- Success/Error Messages -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- Overview Tab -->
    <div v-if="activeTab === 'overview'" class="dashboard-content">
      <div class="kpi-section">
        <div class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-value">{{ kpis.pendingInvoices }}</div>
            <div class="kpi-label">Pending Invoices</div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-value">{{ formatCurrency(kpis.totalPaid) }}</div>
            <div class="kpi-label">Total Paid</div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-value">{{ formatCurrency(kpis.totalPending) }}</div>
            <div class="kpi-label">Total Pending</div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-value">{{ kpis.activeIntegrations }}</div>
            <div class="kpi-label">Active Integrations</div>
          </div>
        </div>
      </div>

      <div class="info-card">
        <h2>Finance Module</h2>
        <p class="module-description">
          Manage invoices, vendor relationships, and payroll integrations with Turkish accounting software.
        </p>
      </div>
    </div>

    <!-- Integrations Tab -->
    <div v-if="activeTab === 'integrations'" class="dashboard-content">
      <div class="section-header">
        <h2 class="section-title">Payroll Integrations</h2>
        <button @click="openIntegrationModal" class="primary-button">
          Add Integration
        </button>
      </div>

      <!-- Turkish Payroll Export -->
      <div class="export-section">
        <h3 class="subsection-title">Aylık Bordro Verisi İhracı (CSV)</h3>
        <div class="export-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Period Start *</label>
              <input
                v-model="exportForm.period_start"
                type="date"
                class="form-input"
                required
                :disabled="loadingExport"
              />
            </div>
            <div class="form-group">
              <label class="form-label">Period End *</label>
              <input
                v-model="exportForm.period_end"
                type="date"
                class="form-input"
                required
                :disabled="loadingExport"
                :min="exportForm.period_start"
              />
            </div>
          </div>
          <button
            @click="handleExportPayroll"
            class="export-button"
            :disabled="loadingExport || !isExportFormValid"
          >
            <span v-if="loadingExport">Exporting...</span>
            <span v-else>Export Payroll Data (CSV)</span>
          </button>
        </div>
      </div>

      <!-- Integration List -->
      <div v-if="loadingIntegrations" class="loading-state">
        Loading integrations...
      </div>

      <div v-else-if="integrations.length === 0" class="empty-state">
        No integrations configured. Add your first integration above.
      </div>

      <div v-else class="integrations-list">
        <div
          v-for="integration in integrations"
          :key="integration.id"
          class="integration-card"
        >
          <div class="integration-header">
            <div class="integration-info">
              <h3 class="integration-name">{{ integration.service_name }}</h3>
              <div class="integration-meta">
                <span class="integration-status" :class="getStatusClass(integration.is_active)">
                  {{ integration.is_active ? 'Active' : 'Inactive' }}
                </span>
                <span v-if="integration.last_sync_date" class="integration-sync">
                  Last Sync: {{ formatDate(integration.last_sync_date) }}
                </span>
              </div>
            </div>
            <div class="integration-actions">
              <button
                @click="editIntegration(integration)"
                class="edit-button"
              >
                Edit
              </button>
              <button
                @click="deleteIntegration(integration.id)"
                class="delete-button"
              >
                Delete
              </button>
            </div>
          </div>
          <div v-if="integration.api_url" class="integration-details">
            <div class="detail-item">
              <span class="detail-label">API URL:</span>
              <span class="detail-value">{{ integration.api_url }}</span>
            </div>
            <div v-if="integration.api_username" class="detail-item">
              <span class="detail-label">Username:</span>
              <span class="detail-value">{{ integration.api_username }}</span>
            </div>
            <div v-if="integration.sync_status" class="detail-item">
              <span class="detail-label">Sync Status:</span>
              <span class="detail-value" :class="getSyncStatusClass(integration.sync_status)">
                {{ integration.sync_status }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Invoices Tab -->
    <div v-if="activeTab === 'invoices'" class="dashboard-content">
      <div class="section-header">
        <h2 class="section-title">Invoice Management</h2>
        <button @click="openInvoiceModal" class="primary-button">
          Create Invoice
        </button>
      </div>

      <!-- Filters -->
      <div class="filters-bar">
        <div class="filters-group">
          <select
            v-model="invoiceFilters.status"
            class="filter-select"
            @change="loadInvoices"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <input
            v-model="invoiceFilters.vendor_name"
            type="text"
            class="filter-input"
            placeholder="Search vendor..."
            @input="debouncedLoadInvoices"
          />
        </div>
      </div>

      <!-- Invoice List -->
      <div v-if="loadingInvoices" class="loading-state">
        Loading invoices...
      </div>

      <div v-else-if="invoices.length === 0" class="empty-state">
        No invoices found.
      </div>

      <div v-else class="invoices-table">
        <table>
          <thead>
            <tr>
              <th>Invoice Number</th>
              <th>Vendor</th>
              <th>Amount</th>
              <th>Tax</th>
              <th>Total</th>
              <th>Date</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="invoice in invoices" :key="invoice.id">
              <td>{{ invoice.invoice_number }}</td>
              <td>{{ invoice.vendor_name }}</td>
              <td class="amount-cell">{{ formatCurrency(invoice.amount) }}</td>
              <td class="amount-cell">{{ formatCurrency(invoice.tax_amount) }}</td>
              <td class="amount-cell total-cell">{{ formatCurrency(invoice.total_amount) }}</td>
              <td>{{ formatDate(invoice.invoice_date) }}</td>
              <td>{{ formatDate(invoice.due_date) }}</td>
              <td>
                <span class="status-badge" :class="getStatusClass(invoice.status)">
                  {{ invoice.status }}
                </span>
              </td>
              <td>
                <button
                  v-if="invoice.status === 'Pending'"
                  @click="markAsPaid(invoice.id)"
                  class="action-button-small"
                >
                  Mark Paid
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="invoicePagination && invoicePagination.totalPages > 1" class="pagination">
        <button
          @click="goToInvoicePage(invoicePagination.page - 1)"
          :disabled="invoicePagination.page === 1"
          class="pagination-button"
        >
          Previous
        </button>
        <span class="pagination-info">
          Page {{ invoicePagination.page }} of {{ invoicePagination.totalPages }}
        </span>
        <button
          @click="goToInvoicePage(invoicePagination.page + 1)"
          :disabled="invoicePagination.page >= invoicePagination.totalPages"
          class="pagination-button"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Integration Modal -->
    <div v-if="showIntegrationModal" class="modal-overlay" @click="closeIntegrationModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingIntegration ? 'Edit Integration' : 'Add Integration' }}</h3>
          <button @click="closeIntegrationModal" class="modal-close">×</button>
        </div>

        <form @submit.prevent="handleSaveIntegration" class="integration-form">
          <div class="form-group">
            <label class="form-label">Service Name *</label>
            <select
              v-model="integrationForm.service_name"
              class="form-select"
              required
              :disabled="loadingIntegration"
            >
              <option value="">Select service</option>
              <option value="Logo Payroll">Logo Payroll</option>
              <option value="Mikro Jump">Mikro Jump</option>
              <option value="Netsis">Netsis</option>
              <option value="Parasoft">Parasoft</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">API URL</label>
            <input
              v-model="integrationForm.api_url"
              type="url"
              class="form-input"
              placeholder="https://api.example.com"
              :disabled="loadingIntegration"
            />
          </div>

          <div class="form-group">
            <label class="form-label">API Username</label>
            <input
              v-model="integrationForm.api_username"
              type="text"
              class="form-input"
              :disabled="loadingIntegration"
            />
          </div>

          <div class="form-group">
            <label class="form-label">API Key</label>
            <input
              v-model="integrationForm.api_key"
              type="password"
              class="form-input"
              placeholder="Enter API key"
              :disabled="loadingIntegration"
            />
          </div>

          <div class="form-group">
            <label class="form-label">
              <input
                v-model="integrationForm.is_active"
                type="checkbox"
                :disabled="loadingIntegration"
              />
              Active
            </label>
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeIntegrationModal" class="secondary-button" :disabled="loadingIntegration">
              Cancel
            </button>
            <button type="submit" class="primary-button" :disabled="loadingIntegration || !integrationForm.service_name">
              <span v-if="loadingIntegration">Saving...</span>
              <span v-else>Save Integration</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Invoice Modal -->
    <div v-if="showInvoiceModal" class="modal-overlay" @click="closeInvoiceModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Create Invoice</h3>
          <button @click="closeInvoiceModal" class="modal-close">×</button>
        </div>

        <form @submit.prevent="handleCreateInvoice" class="invoice-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Invoice Number *</label>
              <input
                v-model="invoiceForm.invoice_number"
                type="text"
                class="form-input"
                required
                :disabled="loadingInvoice"
              />
            </div>
            <div class="form-group">
              <label class="form-label">Invoice Date *</label>
              <input
                v-model="invoiceForm.invoice_date"
                type="date"
                class="form-input"
                required
                :disabled="loadingInvoice"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Vendor Name *</label>
            <input
              v-model="invoiceForm.vendor_name"
              type="text"
              class="form-input"
              required
              :disabled="loadingInvoice"
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Vendor Tax ID</label>
              <input
                v-model="invoiceForm.vendor_tax_id"
                type="text"
                class="form-input"
                placeholder="Vergi No"
                :disabled="loadingInvoice"
              />
            </div>
            <div class="form-group">
              <label class="form-label">Amount (TRY) *</label>
              <input
                v-model.number="invoiceForm.amount"
                type="number"
                step="0.01"
                class="form-input"
                required
                :disabled="loadingInvoice"
                @input="calculateTotal"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tax Rate (%)</label>
              <input
                v-model.number="invoiceForm.tax_rate"
                type="number"
                step="0.01"
                class="form-input"
                :disabled="loadingInvoice"
                @input="calculateTotal"
              />
            </div>
            <div class="form-group">
              <label class="form-label">Total Amount</label>
              <input
                :value="calculatedTotal"
                type="text"
                class="form-input"
                readonly
                disabled
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input
              v-model="invoiceForm.due_date"
              type="date"
              class="form-input"
              :disabled="loadingInvoice"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea
              v-model="invoiceForm.description"
              class="form-textarea"
              rows="3"
              :disabled="loadingInvoice"
            ></textarea>
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeInvoiceModal" class="secondary-button" :disabled="loadingInvoice">
              Cancel
            </button>
            <button type="submit" class="primary-button" :disabled="loadingInvoice || !isInvoiceFormValid">
              <span v-if="loadingInvoice">Creating...</span>
              <span v-else>Create Invoice</span>
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
  getFinanceOverview,
  generateTurkishPayrollExport,
  getPayrollIntegrations,
  savePayrollIntegration,
  deletePayrollIntegration,
  getInvoices,
  createInvoice,
  updateInvoiceStatus
} from '../../services/financeService'

const activeTab = ref('overview')
const userData = ref(null)
const kpis = ref({
  pendingInvoices: 0,
  totalPaid: 0,
  totalPending: 0,
  activeIntegrations: 0
})
const integrations = ref([])
const invoices = ref([])
const invoicePagination = ref(null)
const loadingIntegrations = ref(false)
const loadingInvoices = ref(false)
const loadingExport = ref(false)
const loadingIntegration = ref(false)
const loadingInvoice = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const showIntegrationModal = ref(false)
const showInvoiceModal = ref(false)
const editingIntegration = ref(null)

const exportForm = ref({
  period_start: '',
  period_end: ''
})

const integrationForm = ref({
  service_name: '',
  api_url: '',
  api_username: '',
  api_key: '',
  is_active: true
})

const invoiceForm = ref({
  invoice_number: '',
  invoice_date: '',
  vendor_name: '',
  vendor_tax_id: '',
  amount: 0,
  tax_rate: 0,
  due_date: '',
  description: ''
})

const invoiceFilters = ref({
  status: '',
  vendor_name: ''
})

const currentInvoicePage = ref(1)
const invoicePageLimit = ref(50)

const isExportFormValid = computed(() => {
  return exportForm.value.period_start && exportForm.value.period_end
})

const isInvoiceFormValid = computed(() => {
  return invoiceForm.value.invoice_number &&
         invoiceForm.value.vendor_name &&
         invoiceForm.value.amount > 0 &&
         invoiceForm.value.invoice_date
})

const calculatedTotal = computed(() => {
  const amount = parseFloat(invoiceForm.value.amount) || 0
  const taxRate = parseFloat(invoiceForm.value.tax_rate) || 0
  const tax = amount * (taxRate / 100)
  return (amount + tax).toFixed(2)
})

onMounted(() => {
  loadUserData()
  loadOverview()
  loadIntegrations()
  loadInvoices()
})

function loadUserData() {
  try {
    const userDataStr = localStorage.getItem('user_data')
    if (userDataStr) {
      userData.value = JSON.parse(userDataStr)
    }
  } catch (error) {
    console.error('Error loading user data:', error)
  }
}

async function loadOverview() {
  try {
    const result = await getFinanceOverview()
    if (result.success) {
      kpis.value = result.kpis
    }
  } catch (error) {
    console.error('Error loading overview:', error)
  }
}

async function loadIntegrations() {
  loadingIntegrations.value = true
  try {
    const result = await getPayrollIntegrations()
    if (result.success) {
      integrations.value = result.integrations || []
    } else {
      errorMessage.value = result.error || 'Failed to load integrations'
    }
  } catch (error) {
    console.error('Error loading integrations:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loadingIntegrations.value = false
  }
}

async function loadInvoices() {
  loadingInvoices.value = true
  try {
    const result = await getInvoices(currentInvoicePage.value, invoicePageLimit.value, invoiceFilters.value)
    if (result.success) {
      invoices.value = result.invoices || []
      invoicePagination.value = result.pagination
    } else {
      errorMessage.value = result.error || 'Failed to load invoices'
    }
  } catch (error) {
    console.error('Error loading invoices:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loadingInvoices.value = false
  }
}

const debouncedLoadInvoices = debounce(loadInvoices, 500)

function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

function openIntegrationModal() {
  editingIntegration.value = null
  integrationForm.value = {
    service_name: '',
    api_url: '',
    api_username: '',
    api_key: '',
    is_active: true
  }
  showIntegrationModal.value = true
}

function closeIntegrationModal() {
  showIntegrationModal.value = false
  editingIntegration.value = null
}

function editIntegration(integration) {
  editingIntegration.value = integration
  integrationForm.value = {
    service_name: integration.service_name,
    api_url: integration.api_url || '',
    api_username: integration.api_username || '',
    api_key: '', // Don't show existing key
    is_active: integration.is_active
  }
  showIntegrationModal.value = true
}

async function handleSaveIntegration() {
  loadingIntegration.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = editingIntegration.value
      ? await savePayrollIntegration({ ...integrationForm.value, id: editingIntegration.value.id })
      : await savePayrollIntegration(integrationForm.value)

    if (result.success) {
      successMessage.value = 'Integration saved successfully!'
      closeIntegrationModal()
      await loadIntegrations()
      await loadOverview()
    } else {
      errorMessage.value = result.error || 'Failed to save integration'
    }
  } catch (error) {
    console.error('Error saving integration:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loadingIntegration.value = false
  }
}

async function deleteIntegration(integrationId) {
  if (!confirm('Are you sure you want to delete this integration?')) return

  try {
    const result = await deletePayrollIntegration(integrationId)
    if (result.success) {
      successMessage.value = 'Integration deleted successfully!'
      await loadIntegrations()
      await loadOverview()
    } else {
      errorMessage.value = result.error || 'Failed to delete integration'
    }
  } catch (error) {
    console.error('Error deleting integration:', error)
    errorMessage.value = 'An unexpected error occurred'
  }
}

async function handleExportPayroll() {
  if (!isExportFormValid.value) return

  loadingExport.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await generateTurkishPayrollExport(
      null,
      exportForm.value.period_start,
      exportForm.value.period_end
    )

    if (result.success) {
      // Download CSV file
      const blob = new Blob([result.csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', result.filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      successMessage.value = `Payroll export generated successfully! ${result.recordCount} records exported.`
    } else {
      errorMessage.value = result.error || 'Failed to export payroll data'
    }
  } catch (error) {
    console.error('Error exporting payroll:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loadingExport.value = false
  }
}

function openInvoiceModal() {
  invoiceForm.value = {
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    vendor_name: '',
    vendor_tax_id: '',
    amount: 0,
    tax_rate: 20, // Default 20% VAT for Turkey
    due_date: '',
    description: ''
  }
  showInvoiceModal.value = true
}

function closeInvoiceModal() {
  showInvoiceModal.value = false
}

function calculateTotal() {
  // Computed property handles this automatically
}

async function handleCreateInvoice() {
  loadingInvoice.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await createInvoice(invoiceForm.value)
    if (result.success) {
      successMessage.value = 'Invoice created successfully!'
      closeInvoiceModal()
      await loadInvoices()
      await loadOverview()
    } else {
      errorMessage.value = result.error || 'Failed to create invoice'
    }
  } catch (error) {
    console.error('Error creating invoice:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loadingInvoice.value = false
  }
}

async function markAsPaid(invoiceId) {
  if (!confirm('Mark this invoice as paid?')) return

  try {
    const result = await updateInvoiceStatus(invoiceId, {
      status: 'Paid',
      payment_date: new Date().toISOString().split('T')[0]
    })
    if (result.success) {
      successMessage.value = 'Invoice marked as paid!'
      await loadInvoices()
      await loadOverview()
    } else {
      errorMessage.value = result.error || 'Failed to update invoice'
    }
  } catch (error) {
    console.error('Error updating invoice:', error)
    errorMessage.value = 'An unexpected error occurred'
  }
}

function goToInvoicePage(page) {
  currentInvoicePage.value = page
  loadInvoices()
}

function formatCurrency(amount) {
  if (!amount && amount !== 0) return 'N/A'
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2
  }).format(amount)
}

function formatDate(dateString) {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('tr-TR', {
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
    'Active': 'status-success',
    'Inactive': 'status-default',
    'Paid': 'status-success',
    'Pending': 'status-warning',
    'Overdue': 'status-danger',
    'Cancelled': 'status-default'
  }
  return statusMap[status] || 'status-default'
}

function getSyncStatusClass(status) {
  const statusMap = {
    'Success': 'status-success',
    'Syncing': 'status-warning',
    'Failed': 'status-danger',
    'Not Synced': 'status-default'
  }
  return statusMap[status] || 'status-default'
}
</script>

<style scoped>
.finance-dashboard {
  width: 100%;
  padding: var(--spacing-xl);
}

.dashboard-header {
  margin-bottom: var(--spacing-xl);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-text-dark);
  margin: 0;
}

.user-badge {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
}

.tabs-container {
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

.dashboard-content {
  min-height: 400px;
}

.kpi-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.kpi-card {
  padding: var(--spacing-lg);
  background: var(--color-background);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.kpi-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.kpi-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-primary);
}

.kpi-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
}

.info-card {
  padding: var(--spacing-xl);
  background: var(--color-background);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.module-description {
  color: var(--color-text-medium);
  line-height: 1.6;
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

.export-section {
  padding: var(--spacing-lg);
  background: var(--color-background);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  margin-bottom: var(--spacing-xl);
}

.subsection-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-dark);
  margin: 0 0 var(--spacing-md) 0;
}

.export-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
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

.export-button {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
  align-self: flex-start;
}

.export-button:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.export-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.integrations-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.integration-card {
  padding: var(--spacing-lg);
  background: var(--color-background);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.integration-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-md);
}

.integration-info {
  flex: 1;
}

.integration-name {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-dark);
  margin: 0 0 var(--spacing-xs) 0;
}

.integration-meta {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
  flex-wrap: wrap;
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
}

.integration-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.edit-button,
.delete-button {
  padding: var(--spacing-xs) var(--spacing-md);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.edit-button {
  background: var(--color-primary);
  color: var(--color-text-on-primary);
}

.edit-button:hover {
  background: var(--color-primary-dark);
}

.delete-button {
  background: var(--color-danger-light);
  color: var(--color-text-on-primary);
}

.delete-button:hover {
  background: var(--color-danger);
}

.integration-details {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
}

.detail-item {
  display: flex;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
}

.detail-label {
  font-weight: 600;
  color: var(--color-text-medium);
}

.detail-value {
  color: var(--color-text-dark);
}

.filters-bar {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.filters-group {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.filter-select,
.filter-input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  background: var(--color-background);
}

.invoices-table {
  overflow-x: auto;
  margin-bottom: var(--spacing-lg);
}

.invoices-table table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-background);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.invoices-table th,
.invoices-table td {
  padding: var(--spacing-md);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.invoices-table th {
  background: var(--color-surface);
  font-weight: 600;
  color: var(--color-text-dark);
}

.amount-cell {
  text-align: right;
  font-weight: 600;
}

.total-cell {
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

.status-danger {
  background: var(--color-danger-light);
  color: var(--color-text-on-primary);
}

.status-default {
  background: var(--color-surface);
  color: var(--color-text-dark);
}

.action-button-small {
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

.action-button-small:hover {
  background: var(--color-primary-dark);
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
}

.pagination-button {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  color: var(--color-text-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.pagination-button:hover:not(:disabled) {
  background: var(--color-border-light);
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

.integration-form,
.invoice-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
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
  .form-row {
    grid-template-columns: 1fr;
  }

  .filters-group {
    flex-direction: column;
  }

  .integration-header {
    flex-direction: column;
    gap: var(--spacing-md);
  }
}
</style>
