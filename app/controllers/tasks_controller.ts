import { HttpContext } from '@adonisjs/core/http'
import Task from '#models/task'
import Project from '#models/project'

export default class TasksController {
  /**
   * GET /projects/:id/tasks
   * Menampilkan semua tasks dalam project tertentu
   */
  async index({ params, response }: HttpContext) {
    try {
      // Pastikan project ada
      const project = await Project.findOrFail(params.id)

      // Ambil semua tasks dalam project ini
      const tasks = await Task.query()
        .where('projectId', params.id)
        .preload('assignee') // Load relasi ke User (assignee)
        .preload('project') // Load relasi ke Project
        .orderBy('createdAt', 'desc')

      return response.send({
        message: 'Tasks retrieved successfully',
        project: {
          id: project.id,
          name: project.name
        },
        data: tasks,
        total: tasks.length
      })
    } catch (error: any) {
      return response.status(404).send({ 
        error: 'Project not found or failed to retrieve tasks',
        details: error.message 
      })
    }
  }
}