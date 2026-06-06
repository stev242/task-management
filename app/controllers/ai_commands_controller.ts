import { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Task from '#models/task'
import AuditLog from '#models/audit_log'
import User from '#models/user'
import { AIService } from '#services/ai_service'

export default class AiCommandsController {
  private aiService = new AIService()

  async handle({ request, auth, response }: HttpContext) {
    const { prompt } = request.only(['prompt'])
    const user = auth.user as User

    if (!prompt || prompt.trim() === '') {
      return response.status(400).send({ error: 'Prompt is required' })
    }

    const aiResult = await this.aiService.processCommand(prompt)
    const trx = await db.transaction()
    const executedActions: any[] = []

    try {
      if (!aiResult.success || !aiResult.data || aiResult.data.length === 0) {
        throw new Error(aiResult.error || 'Perintah ditolak. AI hanya boleh mengoperasikan tabel tasks.')
      }

      for (const action of aiResult.data) {
        if (action.action === 'create_task') {
          if (!action.project_id || !action.title) throw new Error('create_task butuh project_id dan title')
          
          await Task.create({
            projectId: action.project_id,
            title: action.title,
            description: action.description || '',
            assigneeId: action.assignee_id || null,
            status: action.status || 'todo',
            priority: action.priority || 'medium'
          }, { client: trx })
          
          executedActions.push(action)
        } 
        else if (action.action === 'update_task') {
          if (!action.task_id) throw new Error('update_task butuh task_id')
          
          const payload: any = {}
          if (action.status) payload.status = action.status
          if (action.priority) payload.priority = action.priority
          if (action.title) payload.title = action.title
          if (action.description !== undefined) payload.description = action.description
          if (action.assignee_id !== undefined) payload.assigneeId = action.assignee_id
          
          const updated = await Task.query()
            .where('id', action.task_id)
            .update(payload)
            .useTransaction(trx)
          
          if (!updated) throw new Error(`Task ID ${action.task_id} tidak ditemukan`)
          executedActions.push(action)
        } 
        else if (action.action === 'delete_task') {
          if (!action.task_id) throw new Error('delete_task butuh task_id')
          
          const deleted = await Task.query()
            .where('id', action.task_id)
            .delete()
            .useTransaction(trx)
          
          if (!deleted) throw new Error(`Task ID ${action.task_id} tidak ditemukan`)
          executedActions.push(action)
        }
      }

      await trx.commit()

      // ✅ Gunakan Model AuditLog dengan JSON.stringify() manual
      await AuditLog.create({
        userId: user.id,
        action: 'AI_COMMAND',
        requestPayload: JSON.stringify({ prompt }),
        responsePayload: JSON.stringify(executedActions),
        status: 'success',
        failedReason: null
      })

      return response.status(200).send({ 
        message: 'Perintah AI berhasil dieksekusi', 
        actions: executedActions,
        total_actions: executedActions.length
      })

    } catch (error: any) {
      await trx.rollback()

      // ✅ Gunakan Model AuditLog dengan JSON.stringify() manual
      await AuditLog.create({
        userId: user.id,
        action: 'AI_COMMAND',
        requestPayload: JSON.stringify({ prompt }),
        responsePayload: JSON.stringify({ error: aiResult.rawResponse || 'No response from AI' }),
        status: 'failed',
        failedReason: error.message
      })

      return response.status(400).send({ 
        error: 'Gagal eksekusi AI', 
        details: error.message 
      })
    }
  }
}