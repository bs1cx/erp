<template>
  <div class="dashboard-container">
    <!-- Dashboard Header -->
    <div class="dashboard-header">
      <div class="header-content">
        <h1 class="dashboard-title">IT Service Management</h1>
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
        Overview/SLA
      </button>
      <button
        @click="activeTab = 'users'"
        :class="['tab-button', { active: activeTab === 'users' }]"
      >
        User Management
      </button>
      <button
        @click="activeTab = 'tickets'"
        :class="['tab-button', { active: activeTab === 'tickets' }]"
      >
        Ticket Management
      </button>
      <button
        @click="activeTab = 'assets'"
        :class="['tab-button', { active: activeTab === 'assets' }]"
      >
        Asset Inventory
      </button>
      <button
        @click="activeTab = 'knowledge'"
        :class="['tab-button', { active: activeTab === 'knowledge' }]"
      >
        Knowledge Base
      </button>
      <button
        @click="activeTab = 'automation'"
        :class="['tab-button', { active: activeTab === 'automation' }]"
      >
        Automation & Rules
      </button>
      <button
        @click="activeTab = 'job-titles'"
        :class="['tab-button', { active: activeTab === 'job-titles' }]"
      >
        Job Titles
      </button>
    </div>

    <!-- Overview Tab -->
    <div v-if="activeTab === 'overview'" class="dashboard-content">
      <div class="info-card">
        <h2>Multi-Tenant Information</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Company ID:</span>
            <span class="info-value">{{ companyId || 'Not available' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">User ID:</span>
            <span class="info-value">{{ userData?.id || 'Not available' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Role:</span>
            <span class="info-value">{{ userData?.role || 'Not available' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Email:</span>
            <span class="info-value">{{ userData?.email || 'Not available' }}</span>
          </div>
        </div>
      </div>

      <div class="module-card">
        <h2>IT Module Features</h2>
        <p class="module-description">
          This is the IT Dashboard. All system data displayed here is isolated to your company (Company ID: {{ companyId }}).
        </p>
        <div class="feature-list">
          <div class="feature-item">System Configuration</div>
          <div class="feature-item">User Management</div>
          <div class="feature-item">Security Settings</div>
          <div class="feature-item">System Monitoring</div>
        </div>
      </div>
    </div>

    <!-- User Management Tab -->
    <div v-if="activeTab === 'users'" class="tab-content-wrapper">
      <UserManagement />
    </div>

    <!-- Ticket Management Tab -->
    <div v-if="activeTab === 'tickets'" class="tab-content-wrapper">
      <TicketManagement />
    </div>

    <!-- Asset Inventory Tab -->
    <div v-if="activeTab === 'assets'" class="tab-content-wrapper">
      <AssetManagement />
    </div>

    <!-- Knowledge Base Tab -->
    <div v-if="activeTab === 'knowledge'" class="tab-content-wrapper">
      <KnowledgeEditor />
    </div>

    <!-- Automation & Rules Tab -->
    <div v-if="activeTab === 'automation'" class="tab-content-wrapper">
      <AutomationRules />
    </div>

    <!-- Job Titles Tab -->
    <div v-if="activeTab === 'job-titles'" class="tab-content-wrapper">
      <JobTitleManagement />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { logout, removeAuthToken } from '../../services/authService'
import UserManagement from './UserManagement.vue'
import TicketManagement from './TicketManagement.vue'
import AssetManagement from './AssetManagement.vue'
import KnowledgeEditor from './KnowledgeEditor.vue'
import AutomationRules from './AutomationRules.vue'
import JobTitleManagement from './JobTitleManagement.vue'

const router = useRouter()
const userData = ref(null)
const companyId = ref(null)
const activeTab = ref('overview')

onMounted(() => {
  // Retrieve user data from localStorage
  const storedUserData = localStorage.getItem('user_data')
  if (storedUserData) {
    try {
      userData.value = JSON.parse(storedUserData)
      companyId.value = userData.value?.company_id
    } catch (error) {
      console.error('Error parsing user data:', error)
      router.push('/login')
    }
  } else {
    router.push('/login')
  }
})

async function handleLogout() {
  await logout()
  router.push('/login')
}
</script>

<style scoped>
.dashboard-container {
  min-height: 100vh;
  background: var(--color-surface);
  padding: var(--spacing-lg);
}

.dashboard-header {
  background: var(--color-background);
  border-bottom: 1px solid var(--color-border);
  padding: var(--spacing-lg) var(--spacing-xl);
  margin-bottom: var(--spacing-lg);
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

.tabs-container {
  max-width: 1400px;
  margin: 0 auto var(--spacing-xl);
  display: flex;
  gap: var(--spacing-xs);
  background: var(--color-background);
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  flex-wrap: wrap;
}

.tab-button {
  flex: 1;
  min-width: 120px;
  padding: var(--spacing-md) var(--spacing-lg);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text-medium);
  cursor: pointer;
  transition: all var(--transition-base);
}

.tab-button:hover {
  background: var(--color-surface);
  color: var(--color-primary);
}

.tab-button.active {
  background: var(--color-primary);
  color: var(--color-text-on-primary);
}

.dashboard-content {
  max-width: 1400px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-lg);
}

.tab-content-wrapper {
  max-width: 1400px;
  margin: 0 auto;
}

.info-card,
.module-card {
  background: var(--color-background);
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  box-shadow: 0 1px 3px var(--color-shadow);
}

.info-card h2,
.module-card h2 {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text-dark);
  margin-bottom: var(--spacing-lg);
}

.info-grid {
  display: grid;
  gap: var(--spacing-md);
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}

.info-label {
  font-weight: 600;
  color: var(--color-text-medium);
  font-size: var(--font-size-sm);
}

.info-value {
  color: var(--color-text-dark);
  font-family: monospace;
  font-size: var(--font-size-sm);
}

.module-description {
  color: var(--color-text-medium);
  margin-bottom: var(--spacing-lg);
  line-height: 1.6;
}

.feature-list {
  display: grid;
  gap: var(--spacing-sm);
}

.feature-item {
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  color: var(--color-text-dark);
  font-weight: 500;
  border-left: 3px solid var(--color-primary);
}

@media (max-width: 768px) {
  .dashboard-content {
    grid-template-columns: 1fr;
  }

  .header-content {
    flex-direction: column;
    gap: var(--spacing-md);
    align-items: flex-start;
  }
}
</style>

