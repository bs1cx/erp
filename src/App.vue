<template>
  <div id="app">
    <NavigationSidebar v-if="showSidebar" />
    <main class="main-content" :class="{ 'with-sidebar': showSidebar }">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavigationSidebar from './components/NavigationSidebar.vue'

const route = useRoute()

// Show sidebar on authenticated routes
const showSidebar = computed(() => {
  return route.meta.requiresAuth !== false && route.path !== '/login'
})
</script>

<style>
@import './style.css';

#app {
  font-family: var(--font-family);
  min-height: 100vh;
  display: flex;
}

.main-content {
  flex: 1;
  margin-left: 0;
  transition: margin-left var(--transition-base);
}

.main-content.with-sidebar {
  margin-left: 260px;
}

@media (max-width: 768px) {
  .main-content.with-sidebar {
    margin-left: 64px;
  }
}
</style>

