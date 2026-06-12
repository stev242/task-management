import type { HttpContext } from '@adonisjs/core/http'
import AIService from '#services/ai_service'
import AuditLog from '#models/audit_log'
import Task from '#models/task'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'

export default class AiCommandsController {
  private aiService = new AIService()

  private async generateCleanReply(prompt: string, results: any[]): Promise<string> {
    const parts: string[] = []
    for (const result of results) {
      if (result.action === 'create_task') {
        const d = result.details
        const assignee = d.assigneeId ? await User.find(d.assigneeId) : null
        parts.push(
          `Task "${d.title}" berhasil dibuat di Project ID ${d.projectId} dengan prioritas ${d.priority}.` +
          (assignee ? ` Ditugaskan ke ${assignee.name}.` : '')
        )
      }
      else if (result.action === 'update_task') {
        const d = result.details
        const changes: string[] = []
        if (d.status) changes.push(`status menjadi ${d.status}`)
        if (d.priority) changes.push(`prioritas menjadi ${d.priority}`)
        if (d.description) changes.push(`deskripsi menjadi "${d.description}"`)
        if (d.title) changes.push(`judul menjadi "${d.title}"`)
        parts.push(`Task "${d.title}" berhasil diupdate: ${changes.join(', ')}.`)
      }
      else if (result.action === 'delete_task') {
        parts.push(`Task ID ${result.details.deleted_id} berhasil dihapus dari sistem.`)
      }
      else if (result.action === 'query_projects') {
        const projects = result.details
        if (projects.length === 0) {
          parts.push('Tidak ada project yang sesuai dengan kriteria pencarian.')
        } else {
          const names = projects.map((p: any) => p.project_name).join(', ')
          parts.push(`Ditemukan ${projects.length} project: ${names}.`)
        }
      }
      else if (result.action === 'query_users') {
        const users = result.details
        if (users.length === 0) {
          parts.push('Tidak ada user yang sesuai dengan kriteria pencarian.')
        } else {
          const names = users.map((u: any) => u.name).join(', ')
          parts.push(`Ditemukan ${users.length} user: ${names}.`)
        }
      }
    }
    return parts.join(' ')
  }

  private generateSummary(results: any[]): string {
    const summaries: string[] = []
    results.forEach(r => {
      if (r.action === 'create_task') summaries.push(`1 task dibuat`)
      if (r.action === 'update_task') summaries.push(`1 task diupdate`)
      if (r.action === 'delete_task') summaries.push(`1 task dihapus`)
      if (r.action === 'query_projects') {
        const count = Array.isArray(r.details) ? r.details.length : 0
        summaries.push(`${count} project ditemukan`)
      }
      if (r.action === 'query_users') {
        const count = Array.isArray(r.details) ? r.details.length : 0
        summaries.push(`${count} user ditemukan`)
      }
    })
    return summaries.join(', ') || 'Tidak ada aksi yang dieksekusi'
  }

  async command({ request, response, auth }: HttpContext) {
    const { prompt } = request.body()
    if (!prompt) return response.status(400).json({ success: false, error: 'Prompt is required' })

    try {
      const aiActions = await this.aiService.generateContent(prompt)
      const results: any[] = []
      const trx = await db.transaction()

      try {
        for (const action of aiActions) {
          let res: any = { action: action.action }
          
          if (action.action === 'create_task') {
            const task = await Task.create({ 
              projectId: action.project_id, 
              title: action.title, 
              description: action.description || null, 
              assigneeId: action.assignee_id || null, 
              priority: action.priority || 'medium', 
              status: 'todo' 
            }, { client: trx })
            res = { action: 'create_task', details: task.serialize() }
          } 
          else if (action.action === 'update_task') {
            const task = await Task.findOrFail(action.task_id, { client: trx })
            const updateData: any = {}
            if (action.title) updateData.title = action.title
            if (action.description !== undefined) updateData.description = action.description // ✅ FIXED!
            if (action.status) updateData.status = action.status
            if (action.priority) updateData.priority = action.priority
            if (action.assignee_id) updateData.assigneeId = action.assignee_id
            task.merge(updateData)
            await task.save()
            res = { action: 'update_task', details: task.serialize() }
          }
          else if (action.action === 'delete_task') {
            const task = await Task.findOrFail(action.task_id, { client: trx })
            await task.delete()
            res = { action: 'delete_task', details: { deleted_id: action.task_id } }
          }
          else if (action.action === 'query_projects') {
            const data = await this.aiService.executeProjectQuery(action.filters)
            res = { action: 'query_projects', details: data }
          }
          else if (action.action === 'query_users') {
            const data = await this.aiService.executeUserQuery(action.filters)
            res = { action: 'query_users', details: data }
          }
          results.push(res)
        }
        await trx.commit()
      } catch (e) { 
        await trx.rollback()
        throw e 
      }

      const assistantReply = await this.generateCleanReply(prompt, results)
      const summary = this.generateSummary(results)

      let totalItemsFound = 0
      results.forEach(r => {
        if (r.action === 'query_projects' || r.action === 'query_users') {
          totalItemsFound += Array.isArray(r.details) ? r.details.length : 0
        } else {
          totalItemsFound += 1
        }
      })

      await AuditLog.create({ 
        userId: auth.user!.id, 
        action: 'AI_JSON', 
        requestPayload: JSON.stringify({ prompt }), 
        responsePayload: JSON.stringify({ assistantReply, results }), 
        status: 'success', 
        failedReason: null 
      })
      
      return response.json({ 
        success: true,
        summary: summary,
        assistant_reply: assistantReply,
        total_items_found: totalItemsFound,
        total_actions: results.length,
        results: results
      })

    } catch (error: any) {
      return response.status(400).json({ 
        success: false, 
        error: 'Gagal eksekusi AI', 
        details: error.message 
      })
    }
  }

  async commandStream({ request, response, auth }: HttpContext) {
    const { prompt } = request.body()
    if (!prompt) return response.status(400).json({ error: 'Prompt is required' })

    response.response.setHeader('Content-Type', 'text/event-stream')
    response.response.setHeader('Cache-Control', 'no-cache')
    response.response.setHeader('Connection', 'keep-alive')

    const send = (data: any) => response.response.write(`data: ${JSON.stringify(data)}\n\n`)

    try {
      send({ type: 'status', message: 'Memproses permintaan...' })
      
      let fullText = ''
      for await (const chunk of this.aiService.generateStream(prompt)) {
        fullText += chunk
      }

      send({ type: 'status', message: 'Mengeksekusi ke database...' })

      const jsonMatch = fullText.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('Invalid AI JSON')
      const aiActions = JSON.parse(jsonMatch[0])

      const results: any[] = []
      for (const action of aiActions) {
        if (action.action === 'query_projects') {
          const data = await this.aiService.executeProjectQuery(action.filters)
          results.push({ action: 'query_projects', details: data })
        } 
        else if (action.action === 'query_users') {
          const data = await this.aiService.executeUserQuery(action.filters)
          results.push({ action: 'query_users', details: data })
        }
        else if (action.action === 'create_task') {
          const task = await Task.create({ 
            projectId: action.project_id, 
            title: action.title, 
            priority: action.priority || 'medium', 
            status: 'todo' 
          })
          results.push({ action: 'create_task', details: task.serialize() })
        }
        else if (action.action === 'update_task') {
          const task = await Task.findOrFail(action.task_id)
          const updateData: any = {}
          if (action.title) updateData.title = action.title
          if (action.description !== undefined) updateData.description = action.description // ✅ FIXED!
          if (action.status) updateData.status = action.status
          if (action.priority) updateData.priority = action.priority
          task.merge(updateData)
          await task.save()
          results.push({ action: 'update_task', details: task.serialize() })
        }
      }

      const assistantReply = await this.generateCleanReply(prompt, results)
      const summary = this.generateSummary(results)

      let totalItemsFound = 0
      results.forEach(r => {
        if (r.action === 'query_projects' || r.action === 'query_users') {
          totalItemsFound += Array.isArray(r.details) ? r.details.length : 0
        } else {
          totalItemsFound += 1
        }
      })

      send({ 
        type: 'final_result', 
        success: true,
        summary: summary,
        assistant_reply: assistantReply,
        total_items_found: totalItemsFound,
        total_actions: results.length,
        results: results
      })
      send({ type: 'done', message: 'Selesai!' })
      response.response.end()

    } catch (error: any) {
      send({ type: 'error', message: error.message })
      response.response.end()
    }
  }
}