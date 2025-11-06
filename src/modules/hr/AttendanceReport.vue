<template>
  <div class="attendance-report">
    <div class="report-header">
      <h2 class="report-title">Devam/Yoklama Takibi</h2>
      <div class="report-filters">
        <div class="filter-group">
          <label class="filter-label">Month</label>
          <select v-model="selectedMonth" class="filter-select" @change="loadReport">
            <option v-for="m in 12" :key="m" :value="m">{{ getMonthName(m) }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label">Year</label>
          <input
            v-model.number="selectedYear"
            type="number"
            class="filter-input"
            min="2020"
            :max="currentYear"
            @change="loadReport"
          />
        </div>
        <div class="filter-group">
          <label class="filter-label">Department</label>
          <select v-model="selectedDepartment" class="filter-select" @change="loadReport">
            <option value="">All Departments</option>
            <option v-for="dept in departments" :key="dept" :value="dept">{{ dept }}</option>
          </select>
        </div>
        <button @click="loadReport" class="refresh-button" :disabled="loading">
          <span v-if="loading">Loading...</span>
          <span v-else>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div v-if="reportSummary" class="summary-cards">
      <div class="summary-card">
        <div class="summary-value">{{ reportSummary.totalEmployees }}</div>
        <div class="summary-label">Total Employees</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">{{ reportSummary.totalDays }}</div>
        <div class="summary-label">Total Days</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">{{ formatHours(reportSummary.totalHours) }}</div>
        <div class="summary-label">Total Hours</div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <p>Loading attendance report...</p>
    </div>

    <!-- Error State -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- Report Table -->
    <div v-if="!loading && attendanceReport.length > 0" class="report-table-container">
      <table class="attendance-table">
        <thead>
          <tr>
            <th>Employee Name</th>
            <th>Department</th>
            <th>Job Title</th>
            <th>Date</th>
            <th>Segmented Times</th>
            <th>Total Time</th>
            <th>Sessions</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(record, index) in attendanceReport" :key="`${record.userId}_${record.date}_${index}`">
            <td class="employee-name">
              <div class="name-primary">{{ record.userName }}</div>
              <div class="name-secondary">{{ record.userEmail }}</div>
            </td>
            <td>{{ record.department }}</td>
            <td>{{ record.jobTitle }}</td>
            <td class="date-cell">{{ formatDate(record.date) }}</td>
            <td class="segments-cell">
              <div v-if="record.segmentedTimes.length > 0" class="segments-list">
                <span
                  v-for="(segment, segIndex) in record.segmentedTimes"
                  :key="segIndex"
                  class="segment-badge"
                >
                  {{ segment }}
                </span>
              </div>
              <span v-else class="no-data">No sessions</span>
            </td>
            <td class="time-cell">
              <span class="time-value">{{ record.totalTimeFormatted }}</span>
              <span class="time-label">({{ record.totalMinutes }} min)</span>
            </td>
            <td class="session-count">{{ record.sessionCount }}</td>
            <td>
              <span
                v-if="record.hasActiveSession"
                class="status-badge status-active"
              >
                Active
              </span>
              <span v-else class="status-badge status-completed">
                Completed
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && attendanceReport.length === 0" class="empty-state">
      <p>No attendance records found for the selected period.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { getMonthlyAttendanceReport } from '../../services/hrService'
import { getAllCompanyEmployees } from '../../services/hrService'

const loading = ref(false)
const errorMessage = ref('')
const attendanceReport = ref([])
const reportSummary = ref(null)
const departments = ref([])

const currentDate = new Date()
const selectedMonth = ref(currentDate.getMonth() + 1)
const selectedYear = ref(currentDate.getFullYear())
const selectedDepartment = ref('')
const currentYear = computed(() => currentDate.getFullYear())

onMounted(() => {
  loadDepartments()
  loadReport()
})

async function loadDepartments() {
  try {
    // Get all employees to extract unique departments
    const result = await getAllCompanyEmployees(1, 1000, {})
    if (result.success && result.employees) {
      const uniqueDepartments = [...new Set(
        result.employees
          .map(emp => emp.department)
          .filter(dept => dept && dept.trim() !== '')
      )].sort()
      departments.value = uniqueDepartments
    }
  } catch (error) {
    console.error('Error loading departments:', error)
  }
}

async function loadReport() {
  loading.value = true
  errorMessage.value = ''
  attendanceReport.value = []
  reportSummary.value = null

  try {
    const result = await getMonthlyAttendanceReport(
      null, // companyId - will be retrieved from session
      selectedYear.value,
      selectedMonth.value,
      selectedDepartment.value || null
    )

    if (result.success) {
      attendanceReport.value = result.report || []
      reportSummary.value = result.summary || null
    } else {
      errorMessage.value = result.error || 'Failed to load attendance report'
    }
  } catch (error) {
    console.error('Error loading attendance report:', error)
    errorMessage.value = 'An unexpected error occurred while loading the report'
  } finally {
    loading.value = false
  }
}

function getMonthName(monthNumber) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return months[monthNumber - 1]
}

function formatDate(dateString) {
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

function formatHours(hours) {
  return `${hours.toLocaleString()}h`
}
</script>

<style scoped>
.attendance-report {
  width: 100%;
  padding: var(--spacing-xl);
}

.report-header {
  margin-bottom: var(--spacing-xl);
}

.report-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-text-dark);
  margin: 0 0 var(--spacing-lg) 0;
}

.report-filters {
  display: flex;
  gap: var(--spacing-md);
  align-items: flex-end;
  flex-wrap: wrap;
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 150px;
}

.filter-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-dark);
}

.filter-select,
.filter-input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  background: var(--color-background);
  transition: all var(--transition-base);
  font-family: inherit;
}

.filter-select:focus,
.filter-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(42, 99, 62, 0.1);
}

.refresh-button {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
  height: fit-content;
}

.refresh-button:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.summary-card {
  padding: var(--spacing-lg);
  background: var(--color-background);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  text-align: center;
}

.summary-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: var(--spacing-xs);
}

.summary-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
}

.report-table-container {
  overflow-x: auto;
  margin-top: var(--spacing-lg);
  background: var(--color-background);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.attendance-table {
  width: 100%;
  border-collapse: collapse;
}

.attendance-table th {
  padding: var(--spacing-md);
  text-align: left;
  background: var(--color-surface);
  font-weight: 600;
  color: var(--color-text-dark);
  border-bottom: 2px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.attendance-table td {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-dark);
}

.attendance-table tbody tr:hover {
  background: var(--color-surface);
}

.employee-name {
  min-width: 200px;
}

.name-primary {
  font-weight: 600;
  color: var(--color-text-dark);
  margin-bottom: var(--spacing-xs);
}

.name-secondary {
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
}

.date-cell {
  white-space: nowrap;
  font-family: monospace;
}

.segments-cell {
  min-width: 250px;
  max-width: 400px;
}

.segments-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.segment-badge {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  font-family: monospace;
  white-space: nowrap;
}

.time-cell {
  white-space: nowrap;
}

.time-value {
  font-weight: 600;
  color: var(--color-text-dark);
  font-family: monospace;
  margin-right: var(--spacing-xs);
}

.time-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-medium);
}

.session-count {
  text-align: center;
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

.status-active {
  background: var(--color-warning);
  color: var(--color-text-on-primary);
}

.status-completed {
  background: var(--color-success-light);
  color: var(--color-text-on-primary);
}

.loading-state,
.empty-state {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-medium);
}

.error-message {
  padding: var(--spacing-md);
  background: var(--color-danger-light);
  color: var(--color-text-on-primary);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-lg);
}

.no-data {
  color: var(--color-text-medium);
  font-style: italic;
}

@media (max-width: 768px) {
  .report-filters {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-group {
    min-width: 100%;
  }

  .attendance-table {
    font-size: var(--font-size-sm);
  }

  .attendance-table th,
  .attendance-table td {
    padding: var(--spacing-sm);
  }
}
</style>

