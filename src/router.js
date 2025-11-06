import { createRouter, createWebHistory } from 'vue-router'
import { getAuthToken, isAuthenticated } from './services/authService'

// Import your page components
const LoginPage = () => import('./pages/LoginPage.vue')
const HRDashboard = () => import('./modules/hr/HRDashboard.vue')
const FinanceDashboard = () => import('./modules/finance/FinanceDashboard.vue')
const ITDashboard = () => import('./modules/it/ITDashboard.vue')

const SelfServicePortal = () => import('./modules/self/SelfServicePortal.vue')

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: LoginPage,
    meta: { requiresAuth: false }
  },
  {
    path: '/hr',
    name: 'HR',
    component: HRDashboard,
    meta: { requiresAuth: true, role: 'HR_USER' }
  },
  {
    path: '/finance',
    name: 'Finance',
    component: FinanceDashboard,
    meta: { requiresAuth: true, role: 'FINANCE_MANAGER' }
  },
  {
    path: '/it',
    name: 'IT',
    component: ITDashboard,
    meta: { requiresAuth: true, role: 'IT_ADMIN' }
  },
  {
    path: '/self',
    name: 'SelfService',
    component: SelfServicePortal,
    meta: { requiresAuth: true } // Accessible to all authenticated users
  },
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/login'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

/**
 * Get user's default route based on role and permissions
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
        if (perms.module_it_read || perms.access_it) return '/it'
        if (perms.module_hr_read || perms.access_hr) return '/hr'
        if (perms.module_finance_read || perms.access_finance) return '/finance'
      } catch (error) {
        console.error('Error parsing permissions:', error)
      }
    }
    
    // Fallback to role-based routing
    const roleRoutes = {
      'IT_ADMIN': '/it',
      'HR_USER': '/hr',
      'HR_MANAGER': '/hr',
      'FINANCE_MANAGER': '/finance',
      'FINANCE_USER': '/finance',
      'EMPLOYEE': '/hr' // Default for employees
    }
    
    return roleRoutes[userRole] || null
  } catch (error) {
    console.error('Error parsing user data:', error)
    return null
  }
}

/**
 * Check if user has access to a route based on role and permissions
 */
function hasRouteAccess(requiredRole) {
  const userData = localStorage.getItem('user_data')
  if (!userData) return false
  
  try {
    const user = JSON.parse(userData)
    
    // Direct role match
    if (user.role === requiredRole) return true
    
    // Check permissions (from job title roles)
    const permissions = localStorage.getItem('user_permissions')
    if (permissions) {
      try {
        const perms = JSON.parse(permissions)
        
        // Map role requirements to permission checks
        if (requiredRole === 'IT_ADMIN') {
          return perms.module_it_read || perms.access_it
        }
        if (requiredRole === 'HR_USER' || requiredRole === 'HR_MANAGER') {
          return perms.module_hr_read || perms.access_hr
        }
        if (requiredRole === 'FINANCE_MANAGER') {
          return perms.module_finance_read || perms.access_finance
        }
      } catch (error) {
        console.error('Error parsing permissions:', error)
      }
    }
    
    return false
  } catch (error) {
    console.error('Error checking route access:', error)
    return false
  }
}

/**
 * Global navigation guard to check authentication
 */
router.beforeEach((to, from, next) => {
  // Check if route requires authentication
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth !== false)
  
  if (requiresAuth) {
    // Check if user is authenticated
    if (!isAuthenticated()) {
      // No auth token found, redirect to login
      next({
        path: '/login',
        query: { redirect: to.fullPath } // Save the intended destination
      })
      return
    }

    // Verify token is still valid
    const token = getAuthToken()
    if (!token) {
      next({
        path: '/login',
        query: { redirect: to.fullPath }
      })
      return
    }

    // Check role-based access if route has a specific role requirement
    if (to.meta.role) {
      if (!hasRouteAccess(to.meta.role)) {
        // User doesn't have required access, redirect to their default route
        const defaultRoute = getUserDefaultRoute()
        if (defaultRoute && defaultRoute !== to.path) {
          // Only redirect if we have a valid default route and it's different from current
          next(defaultRoute)
          return
        } else {
          // No valid default route or already on it, redirect to login
          next('/login')
          return
        }
      }
    }
  } else {
    // Route doesn't require auth (like login page)
    // If user is already logged in, redirect to dashboard
    if (isAuthenticated() && to.path === '/login') {
      const defaultRoute = getUserDefaultRoute()
      if (defaultRoute) {
        next(defaultRoute)
        return
      }
      // If no default route, allow access to login
    }
  }

  // Allow navigation
  next()
})

export default router

