import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#controllers/auth_controller')
const ProjectsController = () => import('#controllers/projects_controller')
const TasksController = () => import('#controllers/tasks_controller')
const AiCommandsController = () => import('#controllers/ai_commands_controller')

// Public routes
router.post('/register', [AuthController, 'register'])
router.post('/login', [AuthController, 'login'])

// Protected routes
router.group(() => {
  
  // Admin ONLY routes
  router.group(() => {
    router.post('/projects', [ProjectsController, 'store'])
    router.put('/projects/:id', [ProjectsController, 'update'])
    router.delete('/projects/:id', [ProjectsController, 'destroy'])
  }).use(middleware.role(['admin']))  // <-- PERBAIKAN: ['admin'] bukan 'admin'
  
  // User & Admin routes
  router.get('/projects', [ProjectsController, 'index'])
  router.get('/projects/:id/tasks', [TasksController, 'index'])
  
  // AI Command routes
  router.post('/ai/command', [AiCommandsController, 'command'])
  router.post('/ai/command/stream', [AiCommandsController, 'commandStream'])
  
}).use(middleware.auth())