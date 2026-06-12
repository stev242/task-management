import { GoogleGenerativeAI } from '@google/generative-ai'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'

export default class AIService {
  private genAI: GoogleGenerativeAI
  private model: any
  private maxRetries = 3

  constructor() {
    this.genAI = new GoogleGenerativeAI(env.get('GEMINI_API_KEY'))
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  }

  private getSystemPrompt(): string {
    return `
Kamu adalah asisten AI untuk sistem manajemen tugas.
ATURAN WAJIB:
1. HANYA boleh CRUD tabel 'tasks'.
2. BOLEH READ tabel 'projects' dan 'users' untuk query informasi.
3. DILARANG manipulasi 'users' atau 'projects'.
4. Output HARUS berupa JSON array MURNI.
5. JANGAN keluarkan teks obrolan, JANGAN gunakan markdown code block (\`\`\`json).
6. HANYA keluarkan raw JSON array, contoh: [{"action": "create_task", "project_id": 1}]

TABEL TASKS: id, project_id, title, description, status, priority, assignee_id
TABEL PROJECTS: id, name, description, created_by
TABEL USERS: id, name, email, role

JENIS OPERASI:
1. create_task: { "action": "create_task", "project_id": number, "title": string, "description"?: string, "assignee_id"?: number, "priority"?: "low"|"medium"|"high" }
2. update_task: { "action": "update_task", "task_id": number, "title"?: string, "description"?: string, "status"?: "todo"|"in_progress"|"done", "priority"?: "low"|"medium"|"high" }
3. delete_task: { "action": "delete_task", "task_id": number }
4. query_projects: { "action": "query_projects", "filters": { "priority"?: "high"|"medium"|"low", "user_id"?: number } }
5. query_users: { "action": "query_users", "filters": { "name"?: string, "role"?: "admin"|"user" } }
`
  }

  private async retryRequest<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error: any) {
        if (error.message?.includes('503') || error.message?.includes('429')) {
          console.log(`⚠️ AI service sibuk, retry ${attempt}/${this.maxRetries}...`)
          const waitTime = 2000 * attempt
          await new Promise(resolve => setTimeout(resolve, waitTime))
          
          if (attempt === this.maxRetries) {
            throw new Error(`AI service sedang sibuk. Silakan coba lagi dalam beberapa saat.`)
          }
        } else {
          throw error
        }
      }
    }
    throw new Error('AI service tidak tersedia')
  }

  // ==========================================
  // ✅ FIX: Smart JSON Parser (Anti-Gagal)
  // ==========================================
  private parseAIResponse(text: string): any[] {
    // 1. Bersihkan markdown code block jika AI membungkus dengan ```json
    let cleanText = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim()
    
    // 2. Cari index array [ ] pertama dan terakhir
    let startIndex = cleanText.indexOf('[')
    let endIndex = cleanText.lastIndexOf(']')
    
    // 3. Jika tidak ada array, coba cari object { } (fallback jika AI ngaco)
    if (startIndex === -1 || endIndex === -1) {
      const objStart = cleanText.indexOf('{')
      const objEnd = cleanText.lastIndexOf('}')
      
      if (objStart !== -1 && objEnd !== -1) {
        // Bungkus object menjadi array
        const objString = cleanText.substring(objStart, objEnd + 1)
        try {
          const parsed = JSON.parse(objString)
          return Array.isArray(parsed) ? parsed : [parsed]
        } catch (e) {
          throw new Error('AI response is not valid JSON')
        }
      }
      
      console.error('AI Response mentah:', text)
      throw new Error('AI response is not valid JSON array')
    }
    
    // 4. Extract dan parse JSON array
    const jsonString = cleanText.substring(startIndex, endIndex + 1)
    
    try {
      const parsed = JSON.parse(jsonString)
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch (e) {
      console.error('Gagal parse JSON:', jsonString)
      throw new Error('AI response is not valid JSON array')
    }
  }

  async generateContent(prompt: string): Promise<any[]> {
    return this.retryRequest(async () => {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: this.getSystemPrompt()
      })
      const text = result.response.text()
      
      // ✅ Gunakan smart parser, bukan regex biasa
      return this.parseAIResponse(text)
    })
  }

  async *generateStream(prompt: string): AsyncGenerator<string> {
    try {
      const result = await this.model.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: this.getSystemPrompt()
      })
      for await (const chunk of result.stream) {
        if (chunk.text()) yield chunk.text()
      }
    } catch (error: any) {
      if (error.message?.includes('503')) {
        console.log('⚠️ Stream tidak tersedia, menggunakan non-streaming...')
        const content = await this.generateContent(prompt)
        yield JSON.stringify(content)
      } else {
        throw error
      }
    }
  }

  async executeProjectQuery(filters: any): Promise<any[]> {
    const allProjects = await db.from('projects as p')
      .select(
        'p.id as project_id',
        'p.name as project_name',
        'p.description as project_description',
        'p.created_by'
      )

    const creatorIds = [...new Set(allProjects.map((p: any) => p.created_by))]
    const creators = await db.from('users')
      .select('id', 'name')
      .whereIn('id', creatorIds)
    
    const creatorMap = new Map(creators.map((c: any) => [c.id, c.name]))

    const filteredProjects = await Promise.all(
      allProjects.map(async (project: any) => {
        let taskQuery = db.from('tasks')
          .select('id', 'title', 'description', 'status', 'priority', 'assignee_id')
          .where('project_id', project.project_id)

        if (filters.priority) {
          taskQuery = taskQuery.where('priority', filters.priority)
        }
        if (filters.user_id) {
          taskQuery = taskQuery.where('assignee_id', filters.user_id)
        }

        const tasks = await taskQuery

        if ((filters.priority || filters.user_id) && tasks.length === 0) {
          return null
        }

        return {
          project_id: project.project_id,
          project_name: project.project_name,
          description: project.project_description,
          created_by: creatorMap.get(project.created_by) || 'Unknown',
          tasks: tasks
        }
      })
    )

    return filteredProjects.filter(p => p !== null)
  }

  async executeUserQuery(filters: any): Promise<any[]> {
    let query = db.from('users').select('id', 'name', 'email', 'role')
    
    if (filters.name) {
      query = query.where('name', 'like', `%${filters.name}%`)
    }
    if (filters.role) {
      query = query.where('role', filters.role)
    }
    
    return await query
  }
}