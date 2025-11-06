<template>
  <div class="audit-log-view">
    <div class="section-header">
      <h2 class="section-title">System Audit Log</h2>
      <span class="audit-description">View all HR-related system changes and activities</span>
    </div>

    <!-- Filters -->
    <div class="filters-bar">
      <div class="filters-group">
        <select
          v-model="filters.action"
          class="filter-select"
          @change="handleFilterChange"
        >
          <option value="">All Actions</option>
          <option value="EMPLOYEE_CREATED">Employee Created</option>
          <option value="EMPLOYEE_UPDATED">Employee Updated</option>
          <option value="SALARY_UPDATED">Salary Updated</option>
          <option value="USER_TERMINATED">User Terminated</option>
          <option value="BULK_EMPLOYEE_UPDATED">Bulk Employee Updated</option>
          <option value="EMPLOYEES_EXPORTED">Employees Exported</option>
        </select>
        <input
          v-model="filters.date_from"
          type="date"
          class="filter-input"
          @change="handleFilterChange"
        />
        <input
          v-model="filters.date_to"
          type="date"
          class="filter-input"
          @change="handleFilterChange"
        />
      </div>
    </div>

    <!-- Audit Logs Table -->
    <div v-if="loading" class="loading-state">
      Loading audit logs...
    </div>

    <div v-else-if="auditLogs.length === 0" class="empty-state">
      No audit logs found.
    </div>

    <div v-else class="audit-logs-table">
      <table>
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Action</th>
            <th>Performed By</th>
            <th>Changes</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in auditLogs" :key="log.id">
            <td>{{ formatDateTime(log.created_at) }}</td>
            <td>
              <span class="action-badge" :class="getActionClass(log.action)">
                {{ formatAction(log.action) }}
              </span>
            </td>
            <td>
              <span v-if="log.users">
                {{ formatUserName(log.users) }}
              </span>
              <span v-else>N/A</span>
            </td>
            <td>
              <div v-if="log.old_data || log.new_data" class="changes-summary">
                <span v-if="log.old_data && log.new_data" class="change-item">
                  <strong>Updated:</strong> {{ getChangedFields(log.old_data, log.new_data) }}
                </span>
                <span v-else-if="log.new_data" class="change-item created">
                  <strong>Created</strong>
                </span>
                <span v-else-if="log.old_data" class="change-item deleted">
                  <strong>Deleted</strong>
                </span>
              </div>
              <span v-else class="no-changes">No changes</span>
            </td>
            <td>
              <button @click="openDetailsModal(log)" class="view-details-button">
                View Details
              </button>
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

    <!-- Audit Log Details Modal -->
    <div v-if="showDetailsModal && selectedLog" class="modal-overlay" @click="closeDetailsModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Audit Log Details</h3>
          <button @click="closeDetailsModal" class="modal-close">×</button>
        </div>

        <div class="audit-details">
          <div class="detail-item">
            <label>Action:</label>
            <span class="action-badge" :class="getActionClass(selectedLog.action)">
              {{ formatAction(selectedLog.action) }}
            </span>
          </div>
          <div class="detail-item">
            <label>Date & Time:</label>
            <span>{{ formatDateTime(selectedLog.created_at) }}</span>
          </div>
          <div class="detail-item">
            <label>Performed By:</label>
            <span>{{ formatUserName(selectedLog.users) }}</span>
          </div>

          <div v-if="selectedLog.old_data" class="detail-section">
            <h4>Previous Data:</h4>
            <pre class="json-view">{{ JSON.stringify(selectedLog.old_data, null, 2) }}</pre>
          </div>

          <div v-if="selectedLog.new_data" class="detail-section">
            <h4>New Data:</h4>
            <pre class="json-view">{{ JSON.stringify(selectedLog.new_data, null, 2) }}</pre>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="closeDetailsModal" class="cancel-button">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { getAuditLogs } from '../../services/hrService'

const emit = defineEmits(['updated'])

const auditLogs = ref([])
const pagination = ref(null)
const loading = ref(false)
const currentPage = ref(1)
const pageLimit = ref(50)
const filters = ref({
  action: '',
  date_from: '',
  date_to: ''
})
const showDetailsModal = ref(false)
const selectedLog = ref(null)

onMounted(() => {
  // Set default date range (last 30 days)
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)
  filters.value.date_from = thirtyDaysAgo.toISOString().split('T')[0]
  filters.value.date_to = today.toISOString().split('T')[0]
  loadAuditLogs()
})

let filterTimeout = null
watch(() => filters.value, () => {
  if (filterTimeout) clearTimeout(filterTimeout)
  filterTimeout = setTimeout(() => {
    currentPage.value = 1
    loadAuditLogs()
  }, 500)
}, { deep: true })

async function loadAuditLogs() {
  loading.value = true
  
  try {
    const result = await getAuditLogs(currentPage.value, pageLimit.value, filters.value)
    if (result.success) {
      auditLogs.value = result.logs || []
      pagination.value = result.pagination || null
    }
  } catch (error) {
    console.error('Error loading audit logs:', error)
  } finally {
    loading.value = false
  }
}

function handleFilterChange() {
  currentPage.value = 1
  loadAuditLogs()
}

function goToPage(page) {
  if (page < 1 || (pagination.value && page > pagination.value.totalPages)) return
  currentPage.value = page
  loadAuditLogs()
}

function openDetailsModal(log) {
  selectedLog.value = log
  showDetailsModal.value = true
}

function closeDetailsModal() {
  showDetailsModal.value = false
  selectedLog.value = null
}

function formatAction(action) {
  return action
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}

function formatDateTime(dateString) {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateString
  }
}

function getActionClass(action) {
  if (action.includes('CREATED')) return 'action-success'
  if (action.includes('TERMINATED') || action.includes('DELETED')) return 'action-danger'
  if (action.includes('UPDATED')) return 'action-warning'
  return 'action-default'
}

function formatUserName(user) {
  if (!user) return 'N/A'
  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim()
  return fullName || user.email || 'N/A'
}

function getChangedFields(oldData, newData) {
  if (!oldData || !newData) return 'N/A'
  
  const changes = []
  for (const key in newData) {
    if (oldData[key] !== newData[key] && key !== 'target_user_id') {
      changes.push(`${key}: ${oldData[key]} → ${newData[key]}`)
    }
  }
  
  return changes.length > 0 ? changes.join(', ') : 'No changes'
}
</script>

<style scoped>
.audit-log-view {
  width: 100%;
}

.section-header {
  margin-bottom: var(--spacing-lg);
}

.section-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text-dark);
  margin: 0 0 var(--spacing-sm) 0;
}

.audit-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
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
}

.filter-input,
.filter-select {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  background: var(--color-background);
  transition: all var(--transition-base);
}

.filter-input:focus,
.filter-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(42, 99, 62, 0.1);
}

.audit-logs-table {
  overflow-x: auto;
}

.audit-logs-table table {
  width: 100%;
  border-collapse: collapse;
}

.audit-logs-table th,
.audit-logs-table td {
  padding: var(--spacing-md);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.audit-logs-table th {
  font-weight: 600;
  color: var(--color-text-medium);
  background: var(--color-surface);
}

.action-badge {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.action-success {
  background: var(--color-success-light);
  color: var(--color-text-on-primary);
}

.action-danger {
  background: var(--color-danger-light);
  color: var(--color-text-on-primary);
}

.action-warning {
  background: var(--color-warning);
  color: var(--color-text-on-primary);
}

.action-default {
  background: var(--color-surface);
  color: var(--color-text-dark);
}

.changes-summary {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  font-size: var(--font-size-xs);
}

.change-item {
  color: var(--color-text-medium);
}

.change-item.created {
  color: var(--color-success);
}

.change-item.deleted {
  color: var(--color-danger);
}

.view-details-button {
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

.view-details-button:hover {
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

.audit-details {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.detail-item {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}

.detail-item label {
  font-weight: 600;
  color: var(--color-text-medium);
  min-width: 150px;
}

.detail-section {
  margin-top: var(--spacing-md);
}

.detail-section h4 {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text-dark);
  margin-bottom: var(--spacing-sm);
}

.json-view {
  background: var(--color-surface);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-xs);
  font-family: 'Courier New', monospace;
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
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
  max-width: 800px;
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

.cancel-button:hover {
  background: var(--color-border-light);
}

.loading-state,
.empty-state {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-medium);
}

@media (max-width: 768px) {
  .filters-group {
    flex-direction: column;
  }
}
</style>

