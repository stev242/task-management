import { HttpContext } from '@adonisjs/core/http'
import Project from '#models/project'
import User from '#models/user'

export default class ProjectsController {
  async index({ response }: HttpContext) {
    try {
      const projects = await Project.query()
        .preload('creator')
        .orderBy('createdAt', 'desc')
      
      return response.send({
        message: 'Projects retrieved successfully',
        data: projects,
        total: projects.length
      })
    } catch (error: any) {
      return response.status(500).send({ 
        error: 'Failed to retrieve projects',
        details: error.message 
      })
    }
  }

  async store({ request, auth, response }: HttpContext) {
    const data = request.only(['name', 'description'])
    const user = auth.user as User
    
    if (!data.name) {
      return response.status(400).send({ 
        error: 'Project name is required' 
      })
    }

    try {
      const project = await Project.create({
        name: data.name,
        description: data.description || null,
        createdBy: user.id
      })

      await project.load('creator')

      return response.status(201).send({ 
        message: 'Project created successfully',
        data: project
      })
    } catch (error: any) {
      return response.status(500).send({ 
        error: 'Failed to create project',
        details: error.message 
      })
    }
  }

  async show({ params, response }: HttpContext) {
    try {
      const project = await Project.findOrFail(params.id)
      await project.load('creator')
      await project.load('tasks')

      return response.send({
        message: 'Project retrieved successfully',
        data: project
      })
    } catch (error: any) {
      return response.status(404).send({ 
        error: 'Project not found',
        details: error.message 
      })
    }
  }

  async update({ params, request, response }: HttpContext) {
    const data = request.only(['name', 'description'])

    try {
      const project = await Project.findOrFail(params.id)
      
      project.merge({
        name: data.name || project.name,
        description: data.description !== undefined ? data.description : project.description
      })
      
      await project.save()
      await project.load('creator')

      return response.send({ 
        message: 'Project updated successfully',
        data: project
      })
    } catch (error: any) {
      return response.status(404).send({ 
        error: 'Project not found',
        details: error.message 
      })
    }
  }

  async destroy({ params, response }: HttpContext) {
    try {
      const project = await Project.findOrFail(params.id)
      await project.delete()

      return response.send({ 
        message: 'Project deleted successfully'
      })
    } catch (error: any) {
      return response.status(404).send({ 
        error: 'Project not found',
        details: error.message 
      })
    }
  }
}