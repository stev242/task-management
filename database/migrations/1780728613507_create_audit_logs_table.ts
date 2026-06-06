import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audit_logs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('request_payload').alter()
      table.text('response_payload').alter()
      table.text('failed_reason').alter() // Pastikan ini juga text untuk error panjang
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('request_payload').alter()
      table.string('response_payload').alter()
      table.string('failed_reason').alter()
    })
  }
}