import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'

const aiActionSchema = z.object({
  action: z.enum(['create_task', 'update_task', 'delete_task']),
  project_id: z.number().optional(),
  task_id: z.number().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  assignee_id: z.number().optional(),
})

const aiResponseSchema = z.array(aiActionSchema)

export class AIService {
  private genAI: GoogleGenerativeAI

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY tidak ditemukan di .env')
    this.genAI = new GoogleGenerativeAI(apiKey)
  }

  async processCommand(prompt: string) {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    
    const systemPrompt = `
Anda adalah asisten database untuk sistem Task Management.
Tugas Anda adalah mengubah instruksi bahasa natural menjadi array JSON dari tindakan database.

ATURAN KERAS:
1. HANYA izinkan aksi pada tabel 'tasks'. JANGAN PERNAH membuat, mengubah, atau menghapus data di tabel 'users' atau 'projects'. Jika user meminta itu, kembalikan array kosong [].
2. Output HARUS berupa array JSON valid dengan format persis seperti ini:
   [
     {
       "action": "create_task" | "update_task" | "delete_task",
       "project_id": number (wajib untuk create_task),
       "task_id": number (wajib untuk update_task dan delete_task),
       "title": string (opsional),
       "description": string (opsional),
       "status": "todo" | "in_progress" | "done" (opsional),
       "priority": "low" | "medium" | "high" (opsional),
       "assignee_id": number (opsional)
     }
   ]
3. Jangan berikan penjelasan teks, markdown, atau kode di luar array JSON.
4. Jika instruksi tidak jelas atau tidak bisa dipetakan ke task, kembalikan [].

CONTOH:
User: "Buat task baru di project 1 dengan judul 'Fix Bug', assign ke user 2"
Output: [{"action":"create_task","project_id":1,"title":"Fix Bug","assignee_id":2}]

User: "Ubah status task ID 5 jadi done"
Output: [{"action":"update_task","task_id":5,"status":"done"}]

User: "Hapus user ID 3"
Output: []
`

    try {
      const result = await model.generateContent(`${systemPrompt}\n\nUser: ${prompt}`)
      const cleanJson = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim()
      const parsedData = aiResponseSchema.parse(JSON.parse(cleanJson))
      return { success: true, data: parsedData, rawResponse: cleanJson }
    } catch (error: any) {
      return { success: false, data: null, rawResponse: 'Invalid JSON', error: error.message }
    }
  }
}