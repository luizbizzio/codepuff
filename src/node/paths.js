import { homedir } from 'node:os'
import { join } from 'node:path'

/** Where CodePuff keeps its data. One folder per user; `CODEPUFF_HOME` overrides it (tests, portable installs). */
export const dataDir = () => (process.env.CODEPUFF_HOME && process.env.CODEPUFF_HOME.trim()) || join(homedir(), '.codepuff')

export const layout = (dir = dataDir()) => ({
  dir,
  pet: join(dir, 'pet.json'),
  sessions: join(dir, 'sessions'),
  locks: join(dir, 'locks'),
  exports: join(dir, 'exports'),
  errors: join(dir, 'errors.log'),
})
