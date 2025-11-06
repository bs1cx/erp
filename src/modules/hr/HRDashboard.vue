<template>
  <div class="hr-dashboard">
    <!-- Dashboard Header -->
    <div class="dashboard-header">
      <div class="header-content">
        <h1 class="dashboard-title">Human Resources</h1>
        <div class="header-actions">
          <span class="user-badge">{{ userData?.email }}</span>
        </div>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="kpi-section">
      <div class="kpi-card">
        <div class="kpi-content">
          <div class="kpi-value">{{ kpis.totalEmployees }}</div>
          <div class="kpi-label">Total Employees</div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-content">
          <div class="kpi-value">{{ kpis.totalDepartments }}</div>
          <div class="kpi-label">Departments</div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-content">
          <div class="kpi-value">{{ kpis.pendingLeaveRequests }}</div>
          <div class="kpi-label">Pending Leave Requests</div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-content">
          <div class="kpi-value">{{ kpis.openJobPostings }}</div>
          <div class="kpi-label">Open Positions</div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-content">
          <div class="kpi-value">{{ kpis.averageLeaveBalance }}</div>
          <div class="kpi-label">Avg Leave Balance</div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-content">
          <div class="kpi-value">{{ kpis.averageRating }}</div>
          <div class="kpi-label">Avg Performance</div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions-section">
      <h2 class="section-title">Quick Actions</h2>
      <div class="quick-actions-grid">
        <button @click="activeSection = 'employees'" class="action-button">
          <span class="action-label">Add Employee</span>
        </button>
        <button @click="activeSection = 'leave'" class="action-button">
          <span class="action-label">Manage Leave</span>
        </button>
        <button @click="activeSection = 'recruitment'" class="action-button">
          <span class="action-label">Recruitment</span>
        </button>
        <button @click="activeSection = 'performance'" class="action-button">
          <span class="action-label">Performance</span>
        </button>
        <button @click="activeSection = 'audit'" class="action-button">
          <span class="action-label">System Audit</span>
        </button>
        <button @click="activeSection = 'payroll'" class="action-button">
          <span class="action-label">Payroll & Benefits</span>
        </button>
        <button @click="activeSection = 'planner'" class="action-button">
          <span class="action-label">Planner</span>
        </button>
      </div>
    </div>

    <!-- Content Sections -->
    <div class="content-sections">
      <!-- Employee Management Section -->
      <div v-if="activeSection === 'employees' || activeSection === null" class="content-section">
        <EmployeeManagement @updated="loadKPIs" />
      </div>

      <!-- Leave Management Section -->
      <div v-if="activeSection === 'leave'" class="content-section">
        <LeaveManagement @updated="loadKPIs" />
      </div>

      <!-- Recruitment Section -->
      <div v-if="activeSection === 'recruitment'" class="content-section">
        <RecruitmentOverview @updated="loadKPIs" />
      </div>

      <!-- Performance Section -->
      <div v-if="activeSection === 'performance'" class="content-section">
        <PerformanceManagement @updated="loadKPIs" />
      </div>

      <!-- Audit Log Section -->
      <div v-if="activeSection === 'audit'" class="content-section">
        <AuditLogView @updated="loadKPIs" />
      </div>

      <!-- Payroll & Benefits Section -->
      <div v-if="activeSection === 'payroll'" class="content-section">
        <PayrollManagement @updated="loadKPIs" />
      </div>

      <!-- Planner Section -->
      <div v-if="activeSection === 'planner'" class="content-section">
        <HRPlanner @updated="loadKPIs" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getAllCompanyEmployees, getPendingLeaveRequests, getJobPostings } from '../../services/hrService'
import EmployeeManagement from './EmployeeManagement.vue'
import LeaveManagement from './LeaveManagement.vue'
import RecruitmentOverview from './RecruitmentOverview.vue'
import PerformanceManagement from './PerformanceManagement.vue'
import AuditLogView from './AuditLogView.vue'
import PayrollManagement from './PayrollManagement.vue'
import HRPlanner from './HRPlanner.vue'

const userData = ref(null)
const companyId = ref(null)
const activeSection = ref(null)
const kpis = ref({
  totalEmployees: 0,
  totalDepartments: 0,
  pendingLeaveRequests: 0,
  openJobPostings: 0,
  averageLeaveBalance: 0,
  averageRating: 0
})

onMounted(() => {
  const storedUserData = localStorage.getItem('user_data')
  if (storedUserData) {
    try {
      userData.value = JSON.parse(storedUserData)
      companyId.value = userData.value?.company_id
    } catch (error) {
      console.error('Error parsing user data:', error)
    }
  }
  
  loadKPIs()
})

/**
 * Load KPI data
 */
async function loadKPIs() {
  try {
    // Load employees (first page with high limit for KPI calculation)
    const employeesResult = await getAllCompanyEmployees(1, 1000, {})
    if (employeesResult.success) {
      // Use total count from pagination if available, otherwise use array length
      kpis.value.totalEmployees = employeesResult.pagination?.total || employeesResult.employees?.length || 0
      
      const employees = employeesResult.employees || []
      
      // Count unique departments
      const departments = new Set(employees.filter(e => e.department).map(e => e.department))
      kpis.value.totalDepartments = departments.size
      
      // Calculate average leave balance
      const totalBalance = employees.reduce((sum, emp) => {
        const balance = (emp.annual_leave_days || 20) - (emp.used_leave_days || 0)
        return sum + balance
      }, 0)
      kpis.value.averageLeaveBalance = employees.length > 0 
        ? Math.round(totalBalance / employees.length) 
        : 0
    }

    // Load pending leave requests
    const leaveResult = await getPendingLeaveRequests()
    if (leaveResult.success) {
      kpis.value.pendingLeaveRequests = leaveResult.requests?.length || 0
    }

    // Load job postings
    const jobsResult = await getJobPostings()
    if (jobsResult.success) {
      const openJobs = (jobsResult.postings || []).filter(j => j.status === 'Open')
      kpis.value.openJobPostings = openJobs.length
    }

    // TODO: Load average rating from performance reviews
    // For now, set to 0
    kpis.value.averageRating = 0
  } catch (error) {
    console.error('Error loading KPIs:', error)
  }
}
</script>

<style scoped>
.hr-dashboard {
  min-height: 100vh;
  background: var(--color-surface);
  padding: var(--spacing-lg);
}

.dashboard-header {
  background: var(--color-background);
  border-bottom: 1px solid var(--color-border);
  padding: var(--spacing-lg) var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
  box-shadow: 0 1px 3px var(--color-shadow);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
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
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
  font-weight: 500;
}

.kpi-section {
  max-width: 1400px;
  margin: 0 auto var(--spacing-xl);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-lg);
}

.kpi-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  box-shadow: 0 1px 3px var(--color-shadow);
  transition: transform var(--transition-base), box-shadow var(--transition-base);
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--color-shadow-hover);
}

.kpi-icon {
  font-size: 48px;
  line-height: 1;
}

.kpi-content {
  flex: 1;
}

.kpi-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: var(--spacing-xs);
}

.kpi-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
  font-weight: 500;
}

.quick-actions-section {
  max-width: 1400px;
  margin: 0 auto var(--spacing-xl);
}

.section-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text-dark);
  margin-bottom: var(--spacing-lg);
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.action-button {
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: pointer;
  transition: all var(--transition-base);
}

.action-button:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  color: var(--color-text-on-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(42, 99, 62, 0.2);
}

.action-icon {
  font-size: 32px;
  line-height: 1;
}

.action-label {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: inherit;
}

.content-sections {
  max-width: 1400px;
  margin: 0 auto;
}

.content-section {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  box-shadow: 0 1px 3px var(--color-shadow);
}

@media (max-width: 768px) {
  .kpi-section {
    grid-template-columns: 1fr;
  }

  .quick-actions-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
