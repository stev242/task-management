/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  auth: {
    register: typeof routes['auth.register']
    login: typeof routes['auth.login']
  }
  projects: {
    store: typeof routes['projects.store']
    update: typeof routes['projects.update']
    destroy: typeof routes['projects.destroy']
    index: typeof routes['projects.index']
    show: typeof routes['projects.show']
  }
  tasks: {
    index: typeof routes['tasks.index']
  }
  aiCommands: typeof routes['ai_commands']
}
