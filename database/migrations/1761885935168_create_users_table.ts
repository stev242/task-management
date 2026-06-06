import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
  this.schema.createTable(this.tableName, (table) => {
    table.increments('id').primary()
    table.string('name').notNullable()              // ✅ TAMBAHAN
    table.string('email', 254).notNullable().unique()
    table.string('password').notNullable()
    table.enum('role', ['admin', 'user']).defaultTo('user').notNullable() // ✅ TAMBAHAN
    table.timestamp('created_at', { useTz: true }).nullable()
    table.timestamp('updated_at', { useTz: true }).nullable()
  })
}

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
