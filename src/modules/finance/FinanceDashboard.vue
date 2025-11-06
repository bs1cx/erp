<template>
  <div class="dashboard-container">
    <div class="dashboard-header">
      <h1 class="dashboard-title">Finance Dashboard</h1>
      <div class="user-info">
        <span class="user-email">{{ userData?.email }}</span>
        <button @click="handleLogout" class="logout-button">Logout</button>
      </div>
    </div>

    <div class="dashboard-content">
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
        <h2>Finance Module Features</h2>
        <p class="module-description">
          This is the Finance Dashboard. All financial data displayed here is isolated to your company (Company ID: {{ companyId }}).
        </p>
        <div class="feature-list">
          <div class="feature-item">Accounting & Ledger</div>
          <div class="feature-item">Invoice Management</div>
          <div class="feature-item">Expense Tracking</div>
          <div class="feature-item">Financial Reports</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { logout, removeAuthToken } from '../../services/authService'

const router = useRouter()
const userData = ref(null)
const companyId = ref(null)

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
  background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
  padding: 20px;
}

.dashboard-header {
  max-width: 1200px;
  margin: 0 auto 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 20px 30px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.dashboard-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a202c;
  margin: 0;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 20px;
}

.user-email {
  font-size: 14px;
  color: #718096;
}

.logout-button {
  padding: 8px 16px;
  background: #f56565;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.2s;
}

.logout-button:hover {
  background: #e53e3e;
}

.dashboard-content {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.info-card,
.module-card {
  background: white;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.info-card h2,
.module-card h2 {
  font-size: 20px;
  font-weight: 600;
  color: #1a202c;
  margin-bottom: 20px;
}

.info-grid {
  display: grid;
  gap: 15px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: #f7fafc;
  border-radius: 8px;
}

.info-label {
  font-weight: 600;
  color: #4a5568;
}

.info-value {
  color: #2d3748;
  font-family: monospace;
  font-size: 14px;
}

.module-description {
  color: #718096;
  margin-bottom: 20px;
  line-height: 1.6;
}

.feature-list {
  display: grid;
  gap: 10px;
}

.feature-item {
  padding: 12px 16px;
  background: #edf2f7;
  border-radius: 8px;
  color: #2d3748;
  font-weight: 500;
}

@media (max-width: 768px) {
  .dashboard-content {
    grid-template-columns: 1fr;
  }

  .dashboard-header {
    flex-direction: column;
    gap: 15px;
    align-items: flex-start;
  }
}
</style>


