import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const dataDir = mkdtempSync(path.join(tmpdir(), 'trace-e2e-'))
const env = {
  ...process.env,
  TRACE_BIND: '127.0.0.1:18080',
  TRACE_DATA_DIR: dataDir,
}

const child = spawn('cargo', ['run', '-p', 'trace-server', '--'], {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

function stop() {
  child.kill()
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
child.on('exit', (code) => process.exit(code ?? 0))
