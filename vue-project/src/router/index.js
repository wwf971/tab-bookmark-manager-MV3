import { createRouter, createWebHistory } from 'vue-router'
import UploadTab from '../components/UploadTab.vue'
import Main from '../components/main.vue'
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Main,
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../components/main.vue'),
    },
  ],
})

export default router
