import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'

export default class RoleMiddleware {
  async handle(ctx: HttpContext, next: () => Promise<void>, options: string[]) {
    // Ambil data user yang sedang login
    const user = ctx.auth.user
    
    // Jika tidak ada user yang login, tolak akses (401 Unauthorized)
    if (!user) {
      throw new Exception('Unauthorized: User not authenticated', { status: 401 })
    }
    
    // Jika role user tidak ada dalam daftar yang diizinkan, tolak akses (403 Forbidden)
    if (!options.includes(user.role)) {
      throw new Exception('Forbidden: Insufficient role permissions', { status: 403 })
    }
    
    // Jika lolos semua pengecekan, lanjutkan ke controller
    await next()
  }
}