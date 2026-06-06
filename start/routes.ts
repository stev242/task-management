import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

// Public Routes
router.post('/register', '#controllers/auth_controller.register')
router.post('/login', '#controllers/auth_controller.login')

// Admin Only Routes
router.group(() => {
  router.post('/projects', '#controllers/projects_controller.store')
  router.put('/projects/:id', '#controllers/projects_controller.update')
  router.delete('/projects/:id', '#controllers/projects_controller.destroy')
})
  .use(middleware.auth())
  .use(middleware.role(['admin'])) // ✅ CARA BENAR V6

// User & Admin Routes
router.group(() => {
  router.get('/projects', '#controllers/projects_controller.index')
  router.get('/projects/:id', '#controllers/projects_controller.show')
  router.get('/projects/:id/tasks', '#controllers/tasks_controller.index')
  router.post('/ai/command', '#controllers/ai_commands_controller.handle')
})
  .use(middleware.auth())