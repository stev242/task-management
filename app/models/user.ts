import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Project from '#models/project'
import Task from '#models/task'
import AuditLog from '#models/audit_log'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare role: 'admin' | 'user'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

    // Access tokens untuk autentikasi JWT
  static accessTokens = DbAccessTokensProvider.forModel(User, {
    expiresIn: '30 days',
    prefix: 'oat_',
    table: 'auth_access_tokens',
    type: 'auth_token',
    tokenSecretLength: 40,
  })

  @hasMany(() => Project, { foreignKey: 'createdBy' })
  declare projects: HasMany<typeof Project>

  @hasMany(() => Task, { foreignKey: 'assigneeId' })
  declare assignedTasks: HasMany<typeof Task>

  @hasMany(() => AuditLog, { foreignKey: 'userId' })
  declare auditLogs: HasMany<typeof AuditLog>
}