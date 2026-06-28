import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/items' },
    {
      path: '/items',
      name: 'items',
      component: () => import('../views/ItemsPage.vue'),
    },
    {
      path: '/materials',
      name: 'materials',
      component: () => import('../views/MaterialsPage.vue'),
    },
    {
      path: '/sales',
      name: 'sales',
      component: () => import('../views/SalesPage.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsPage.vue'),
    },
  ],
})

export default router
