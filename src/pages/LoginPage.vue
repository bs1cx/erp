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
    'IT_ADMIN': '/it',
    'HR_USER': '/hr',
    'FINANCE_MANAGER': '/finance',
    // Add more role-based routes as needed
  }
  
  // Default route if role doesn't match
  return roleRoutes[role] || '/dashboard'
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
      // Store authentication token
      if (result.token) {
        setAuthToken(result.token)
      }

      // Store user data in localStorage or Vuex/Pinia store
      if (result.user) {
        localStorage.setItem('user_data', JSON.stringify(result.user))
      }

      // Redirect to role-based default route
      const defaultRoute = getDefaultRoute(result.user?.role)
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
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
  padding: 14px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;
}

.login-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
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

