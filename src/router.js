import { createRouter, createWebHistory } from 'vue-router'
import { getAuthToken, isAuthenticated } from './services/authService'

// Import your page components
// Adjust these imports based on your actual component structure
const LoginPage = () => import('./pages/LoginPage.vue')
// const DashboardPage = () => import('./pages/DashboardPage.vue')
// const HRPage = () => import('./pages/HRPage.vue')
// const FinancePage = () => import('./pages/FinancePage.vue')
// const ITPage = () => import('./pages/ITPage.vue')

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: LoginPage,
    meta: { requiresAuth: false }
  },
  // Uncomment and configure these routes as you create the pages
  // {
  //   path: '/dashboard',
  //   name: 'Dashboard',
  //   component: DashboardPage,
  //   meta: { requiresAuth: true }
  // },
  // {
  //   path: '/hr',
  //   name: 'HR',
  //   component: HRPage,
  //   meta: { requiresAuth: true, role: 'HR_USER' }
  // },
  // {
  //   path: '/finance',
  //   name: 'Finance',
  //   component: FinancePage,
  //   meta: { requiresAuth: true, role: 'FINANCE_MANAGER' }
  // },
  // {
  //   path: '/it',
  //   name: 'IT',
  //   component: ITPage,
  //   meta: { requiresAuth: true, role: 'IT_ADMIN' }
  // },
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

    // Verify token is still valid (optional - you can add token validation here)
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
      const userData = localStorage.getItem('user_data')
      if (userData) {
        try {
          const user = JSON.parse(userData)
          const userRole = user.role

          // Check if user has the required role
          if (userRole !== to.meta.role) {
            // User doesn't have required role, redirect to default route for their role
            const roleRoutes = {
              'IT_ADMIN': '/it',
              'HR_USER': '/hr',
              'FINANCE_MANAGER': '/finance'
            }
            const defaultRoute = roleRoutes[userRole] || '/dashboard'
            next(defaultRoute)
            return
          }
        } catch (error) {
          console.error('Error parsing user data:', error)
          next('/login')
          return
        }
      } else {
        // No user data found, redirect to login
        next('/login')
        return
      }
    }
  } else {
    // Route doesn't require auth (like login page)
    // If user is already logged in, redirect to dashboard
    if (isAuthenticated() && to.path === '/login') {
      const userData = localStorage.getItem('user_data')
      if (userData) {
        try {
          const user = JSON.parse(userData)
          const roleRoutes = {
            'IT_ADMIN': '/it',
            'HR_USER': '/hr',
            'FINANCE_MANAGER': '/finance'
          }
          const defaultRoute = roleRoutes[user.role] || '/dashboard'
          next(defaultRoute)
          return
        } catch (error) {
          // If error parsing, allow access to login
        }
      }
    }
  }

  // Allow navigation
  next()
})

export default router

