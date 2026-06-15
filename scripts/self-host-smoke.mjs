const baseUrl = process.env.TRACE_SMOKE_BASE_URL ?? 'http://127.0.0.1:18080'
const email = process.env.TRACE_SMOKE_EMAIL ?? 'smoke-admin@example.com'
const password = process.env.TRACE_SMOKE_PASSWORD ?? 'smoke-password-123'

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage:')
  console.log('  TRACE_SMOKE_BASE_URL=http://127.0.0.1:18080 node scripts/self-host-smoke.mjs')
  console.log('')
  console.log('Runs setup/login, notes, suggestions, relation connect, backup, restore preview, restore and audit-log checks.')
  process.exit(0)
}

async function main() {
  console.log(`Trace self-host smoke: ${baseUrl}`)
  await expectOk('health', request('GET', '/health'))

  const token = await authenticate()
  const sourceToken = uniqueToken()
  const relatedToken = uniqueToken()
  const unrelatedToken = uniqueToken()
  const source = await createNote(token, {
    title: `Trace server ${sourceToken}`,
    content: 'Docker self host sqlite backup restore deployment trace server',
  })
  const related = await createNote(token, {
    title: `Self host backups ${relatedToken}`,
    content: 'Docker compose backup restore sqlite vault server deployment',
  })
  const unrelated = await createNote(token, {
    title: `Cooking recipe ${unrelatedToken}`,
    content: 'Pasta tomato basil dinner recipe kitchen',
  })

  const suggestions = await requestJson('GET', `/api/notes/${encodeURIComponent(source.id)}/suggestions?limit=5`, {
    token,
  })
  assert(Array.isArray(suggestions), 'suggestions response is not an array')
  assert(suggestions.length > 0, 'expected at least one suggestion')
  assert(
    suggestions[0]?.title.startsWith('Self host backups'),
    `expected first suggestion to be a self-host backup note, got ${suggestions[0]?.title ?? 'none'}`,
  )
  assert(
    !suggestions.some((suggestion) => suggestion.targetId === unrelated.id),
    'unrelated note should not be suggested',
  )

  await requestJson('POST', '/api/relations/connect', {
    token,
    data: {
      sourceId: source.id,
      targetIds: [related.id],
    },
  })

  const afterConnect = await requestJson('GET', `/api/notes/${encodeURIComponent(source.id)}/suggestions?limit=5`, {
    token,
  })
  assert(
    !afterConnect.some((suggestion) => suggestion.targetId === related.id),
    'connected note should disappear from suggestions',
  )

  const backup = await requestBuffer('POST', '/api/backup', { token })
  assert(backup.byteLength > 0, 'backup should not be empty')

  const preview = await requestJson('POST', '/api/restore/preview', {
    token,
    body: backup,
    contentType: 'application/zip',
  })
  assert(typeof preview.notes === 'number', 'restore preview should include notes count')
  assert(preview.sizeBytes === backup.byteLength, 'restore preview should report uploaded backup size')

  const restore = await requestJson('POST', '/api/restore', {
    token,
    body: backup,
    contentType: 'application/zip',
  })
  assert(restore.restored === true, 'restore should return restored=true')

  const auditLog = await requestJson('GET', '/api/admin/audit-log?limit=20', { token })
  assert(Array.isArray(auditLog), 'audit log response is not an array')
  assert(
    auditLog.some((event) => event.event === 'restore.completed'),
    'audit log should include restore.completed',
  )

  const nodes = await requestJson('GET', '/api/nodes', { token })
  assert(
    nodes.some((node) => node.id === source.id),
    'restored node should still exist after restore',
  )

  console.log('Trace self-host smoke passed')
}

async function authenticate() {
  const setupStatus = await requestJson('GET', '/api/setup/status')
  const response = setupStatus.setup_required === true
    ? await request('POST', '/setup', {
      data: {
        workspace_name: 'Trace Smoke',
        email,
        password,
      },
    })
    : await request('POST', '/api/auth/login', {
      data: {
        email,
        password,
      },
    })

  await expectOk('auth', response)
  const body = await response.json()
  assert(typeof body.token === 'string', 'auth did not return a token')
  return body.token
}

async function createNote(token, { title, content }) {
  const note = await requestJson('POST', '/api/notes', {
    token,
    data: {
      title,
      content: JSON.stringify([{ type: 'paragraph', content }]),
      tags: [],
    },
  })
  assert(typeof note.id === 'string', `note ${title} did not return id`)
  return note
}

async function requestJson(method, path, options = {}) {
  const response = await request(method, path, options)
  await expectOk(`${method} ${path}`, response)
  return response.json()
}

async function requestBuffer(method, path, options = {}) {
  const response = await request(method, path, options)
  await expectOk(`${method} ${path}`, response)
  return Buffer.from(await response.arrayBuffer())
}

async function request(method, path, options = {}) {
  const headers = {
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
  }
  let body
  if (options.body) {
    body = options.body
    headers['Content-Type'] = options.contentType ?? 'application/octet-stream'
  } else if (options.data !== undefined) {
    body = JSON.stringify(options.data)
    headers['Content-Type'] = 'application/json'
  }

  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body,
  })
}

async function expectOk(label, responsePromise) {
  const response = await responsePromise
  if (response.ok) {
    return response
  }

  const body = await response.text().catch(() => '')
  throw new Error(`${label} failed: ${response.status} ${response.statusText}\n${body}`)
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function uniqueToken() {
  return Math.random().toString(36).slice(2, 10)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
