<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="login-title">ERP Login</h1>
      <p class="login-subtitle">Enter your credentials to access your account</p>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="companyCode" class="form-label">Company Code</label>
          <input
            id="companyCode"
            v-model="companyCode"
            type="text"
            class="form-input"
            placeholder="Enter your company code"
            required
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label for="email" class="form-label">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            class="form-input"
            placeholder="Enter your email"
            required
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label for="password" class="form-label">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            class="form-input"
            placeholder="Enter your password"
            required
            :disabled="loading"
          />
        </div>

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <button
          type="submit"
          class="login-button"
          :disabled="loading"
        >
          <span v-if="loading">Logging in...</span>
          <span v-else>Login</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login, setAuthToken } from '../services/authService'

const router = useRouter()

/**
 * Get user's default route based on role and permissions (same logic as router guard)
 */
function getUserDefaultRoute() {
  const userData = localStorage.getItem('user_data')
  if (!userData) return null
  
  try {
    const user = JSON.parse(userData)
    const userRole = user.role
    
    // Check permissions if available (from job title roles)
    const permissions = localStorage.getItem('user_permissions')
    if (permissions) {
      try {
        const perms = JSON.parse(permissions)
        
        // Check module access based on permissions
        if (perms.module_hr_read || perms.access_hr) return '/hr'
      } catch (error) {
        console.error('Error parsing permissions:', error)
      }
    }
    
    // Fallback to role-based routing
    const roleRoutes = {
      'HR_USER': '/hr',
      'HR_MANAGER': '/hr',
      'EMPLOYEE': '/hr'
    }
    
    return roleRoutes[userRole] || null
  } catch (error) {
    console.error('Error parsing user data:', error)
    return null
  }
}

const companyCode = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

/**
 * Get default route based on user role
 */
function getDefaultRoute(role) {
  const roleRoutes = {
    'HR_USER': '/hr',
    'HR_MANAGER': '/hr',
    'EMPLOYEE': '/hr'
  }
  
  // Default route if role doesn't match
  return roleRoutes[role] || '/hr'
}

/**
 * Handle login form submission
 */
async function handleLogin() {
  errorMessage.value = ''
  loading.value = true

  try {
    // Validate inputs
    if (!companyCode.value.trim() || !email.value.trim() || !password.value) {
      errorMessage.value = 'Please fill in all fields'
      loading.value = false
      return
    }

    // Call auth service
    const result = await login(companyCode.value.trim(), email.value.trim(), password.value)

    if (result.success) {
      // CRITICAL: Store all data synchronously before navigation
      // Store authentication token
      if (result.token) {
        setAuthToken(result.token)
      }

      // Store user data in localStorage (including permissions)
      if (result.user) {
        localStorage.setItem('user_data', JSON.stringify(result.user))
        
        // Store permissions separately for easy access
        if (result.user.permissions) {
          localStorage.setItem('user_permissions', JSON.stringify(result.user.permissions))
        }
      }

      // CRITICAL: Store all data synchronously (localStorage is synchronous)
      // All localStorage operations are blocking, so data is immediately available
      
      // Get default route BEFORE storing data (using result data directly)
      let defaultRoute = null
      
      // Check permissions from result first
      if (result.user?.permissions) {
        const perms = result.user.permissions
        if (perms.module_hr_read || perms.access_hr) {
          defaultRoute = '/hr'
        }
      }
      
      // Fallback to role-based routing
      if (!defaultRoute) {
        defaultRoute = getDefaultRoute(result.user?.role)
      }
      
      // Navigate immediately - router.push is synchronous
      // The router guard will check localStorage which is already set above
      router.push(defaultRoute)
    } else {
      errorMessage.value = result.error || 'Login failed. Please check your credentials.'
    }
  } catch (error) {
    console.error('Login error:', error)
    errorMessage.value = 'An unexpected error occurred. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  padding: var(--spacing-lg);
}

.login-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  padding: 40px;
  width: 100%;
  max-width: 420px;
}

.login-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 8px;
  text-align: center;
}

.login-subtitle {
  font-size: 14px;
  color: #718096;
  margin-bottom: 32px;
  text-align: center;
}

.login-form {
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

.form-input {
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  transition: all 0.2s;
  background: white;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input:disabled {
  background: #f7fafc;
  cursor: not-allowed;
  opacity: 0.6;
}

.login-button {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
  margin-top: var(--spacing-sm);
  width: 100%;
}

.login-button:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(42, 99, 62, 0.3);
}

.login-button:active:not(:disabled) {
  transform: translateY(0);
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  padding: 12px 16px;
  background: #fed7d7;
  border: 1px solid #fc8181;
  border-radius: 8px;
  color: #c53030;
  font-size: 14px;
  text-align: center;
}
</style>

