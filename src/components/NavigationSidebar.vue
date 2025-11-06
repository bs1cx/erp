<template>
  <div class="navigation-sidebar" :class="{ collapsed: isCollapsed }">
    <div class="sidebar-header">
      <h2 class="sidebar-logo">ERP</h2>
      <button @click="toggleSidebar" class="collapse-button" :aria-label="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'">
        <span v-if="!isCollapsed">←</span>
        <span v-else>→</span>
      </button>
    </div>

    <nav class="sidebar-nav">
      <div class="nav-section">
        <h3 v-if="!isCollapsed" class="nav-section-title">Main</h3>
        <router-link
          v-for="item in mainNavItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: $route.path === item.path }"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span v-if="!isCollapsed" class="nav-label">{{ item.label }}</span>
        </router-link>
      </div>

      <div v-if="isITAdmin" class="nav-section">
        <h3 v-if="!isCollapsed" class="nav-section-title">IT Management</h3>
        <router-link
          v-for="item in itNavItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: $route.path === item.path }"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span v-if="!isCollapsed" class="nav-label">{{ item.label }}</span>
        </router-link>
      </div>
    </nav>

    <div class="sidebar-footer">
      <div v-if="!isCollapsed" class="user-profile">
        <div class="user-avatar">{{ userInitials }}</div>
        <div class="user-details">
          <div class="user-name">{{ userEmail }}</div>
          <div class="user-role">{{ userRole }}</div>
        </div>
      </div>
      <button @click="handleLogout" class="logout-button" :title="isCollapsed ? 'Logout' : ''">
        <span class="nav-icon">🚪</span>
        <span v-if="!isCollapsed">Logout</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { logout } from '../services/authService'

const router = useRouter()
const isCollapsed = ref(false)
const userEmail = ref('')
const userRole = ref('')

const isITAdmin = computed(() => userRole.value === 'IT_ADMIN')

const mainNavItems = [
  { path: '/hr', label: 'HR Dashboard', icon: '👥' },
  { path: '/finance', label: 'Finance Dashboard', icon: '💰' },
]

const itNavItems = [
  { path: '/it', label: 'IT Dashboard', icon: '🖥️' },
]

const userInitials = computed(() => {
  if (!userEmail.value) return 'U'
  const parts = userEmail.value.split('@')[0].split('.')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return userEmail.value[0].toUpperCase()
})

onMounted(() => {
  const userData = localStorage.getItem('user_data')
  if (userData) {
    try {
      const user = JSON.parse(userData)
      userEmail.value = user.email || ''
      userRole.value = user.role || ''
    } catch (error) {
      console.error('Error parsing user data:', error)
    }
  }
})

function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value
}

async function handleLogout() {
  await logout()
  router.push('/login')
}
</script>

<style scoped>
.navigation-sidebar {
  position: fixed;
  left: 0;
  top: 0;
  width: 260px;
  height: 100vh;
  background-color: var(--color-primary);
  color: var(--color-text-on-primary);
  display: flex;
  flex-direction: column;
  transition: width var(--transition-base);
  z-index: 1000;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
}

.navigation-sidebar.collapsed {
  width: 64px;
}

.sidebar-header {
  padding: var(--spacing-lg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-logo {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-text-on-primary);
  margin: 0;
}

.collapse-button {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: var(--color-text-on-primary);
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition-base);
}

.collapse-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md) 0;
}

.nav-section {
  margin-bottom: var(--spacing-lg);
}

.nav-section-title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 0 var(--spacing-lg) var(--spacing-sm);
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: var(--spacing-sm);
}

.nav-item {
  display: flex;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  color: rgba(255, 255, 255, 0.9);
  text-decoration: none;
  transition: all var(--transition-base);
  gap: var(--spacing-md);
}

.nav-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--color-text-on-primary);
}

.nav-item.active {
  background-color: rgba(255, 255, 255, 0.15);
  border-left: 3px solid var(--color-text-on-primary);
  color: var(--color-text-on-primary);
  font-weight: 600;
}

.nav-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
  flex-shrink: 0;
}

.nav-label {
  font-size: var(--font-size-base);
}

.navigation-sidebar.collapsed .nav-label,
.navigation-sidebar.collapsed .nav-section-title {
  display: none;
}

.sidebar-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: var(--spacing-md);
}

.user-profile {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-md);
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: var(--font-size-sm);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  font-size: var(--font-size-xs);
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logout-button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-on-primary);
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: background var(--transition-base);
}

.logout-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.navigation-sidebar.collapsed .user-profile,
.navigation-sidebar.collapsed .user-details {
  display: none;
}

.navigation-sidebar.collapsed .logout-button {
  justify-content: center;
  padding: var(--spacing-md);
}
</style>


