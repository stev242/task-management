import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
import Project from '#models/project'
import Task from '#models/task'
import Hash from '@adonisjs/core/services/hash'

export default class extends BaseSeeder {
  async run() {
    // 1. Buat Users DULU (agar ID-nya pasti 1 dan 2)
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: await Hash.make('password123'),
      role: 'admin'
    })

    const user = await User.create({
      name: 'Regular User',
      email: 'user@test.com',
      password: await Hash.make('password123'),
      role: 'user'
    })

    // 2. Buat Projects (menggunakan ID admin yang baru dibuat)
    const project1 = await Project.create({
      name: 'Project Alpha',
      description: 'Proyek pengembangan aplikasi web',
      createdBy: admin.id
    })

    const project2 = await Project.create({
      name: 'Project Beta',
      description: 'Proyek mobile app',
      createdBy: admin.id
    })

    // 3. Buat Tasks (menggunakan ID project dan user yang baru dibuat)
    await Task.createMany([
      {
        projectId: project1.id,
        title: 'Setup Database',
        description: 'Install MySQL dan buat schema',
        status: 'done',
        priority: 'high',
        assigneeId: user.id
      },
      {
        projectId: project1.id,
        title: 'Fix Login Bug',
        description: 'Token JWT tidak tersimpan',
        status: 'in_progress',
        priority: 'medium',
        assigneeId: user.id
      },
      {
        projectId: project2.id,
        title: 'Design UI',
        description: 'Buat mockup di Figma',
        status: 'todo',
        priority: 'low',
        assigneeId: user.id
      }
    ])
  }
}