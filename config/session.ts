import { defineConfig, stores } from '@adonisjs/session'

const sessionConfig = defineConfig({
  enabled: true,
  store: 'cookie',
  clearWithBrowser: false,
  cookie: {
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
  },
  stores: {
    cookie: stores.cookie(), // <-- Perhatikan: TIDAK ADA {} di dalam kurung
  },
})

export default sessionConfig