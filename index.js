/**
 * Host half of the Session Storage bundle.
 *
 * It exposes one read model (per-conversation memory, persisted-log size, and
 * tracked generated files) and three user-only deletion operations over the
 * local Harness home. The Web Client half renders the panel and calls these
 * routes with same-origin fetches.
 *
 * Nothing here writes to a session log. Deleting a conversation archives it
 * through the Workspace service, removes its durable log directory out of band
 * (the persistence seam has no deletion API), and removes the generated files
 * that the conversation itself declared or wrote.
 *
 * @module @local/conversation-manager
 */
import { promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serialize } from 'node:v8'

export const name = 'conversation-manager'

/** Services this bundle reads; a profile without one leaves it inactive. */
export const inject = [
  'sessionController',
  'sessionQuery',
  'workspaceController',
  'workspaceChanges',
  'workspaceRegistry',
  'sessions',
  'agents',
  'webServer',
]

const ROUTE_PREFIX = '/.dsh-conversation-manager'
const ROUTE_OVERVIEW = `${ROUTE_PREFIX}/overview`
const ROUTE_OPEN_FILE = `${ROUTE_PREFIX}/open-file`
const ROUTE_OPEN_WORKSPACE = `${ROUTE_PREFIX}/open-workspace`
const ROUTE_DELETE_FILE = `${ROUTE_PREFIX}/delete-file`
const ROUTE_DELETE_FILES = `${ROUTE_PREFIX}/delete-files`
const ROUTE_DELETE_SESSION = `${ROUTE_PREFIX}/delete-session`
const MAX_BODY_BYTES = 64 * 1024
const MAX_SESSIONS = 200
/** A conversation must never delete the plugin that is serving its panel. */
const OWN_PACKAGE_DIR = dirname(fileURLToPath(import.meta.url))
/** Ids observed as deleted in this process, so the panel stops listing them. */
const tombstones = new Set()

/** @param {unknown} error */
function errorText(error) {
  if (error instanceof Error) return error.message
  return String(error)
}

/** @param {number} status @param {string} message @param {Record<string, unknown>} [extra] */
function httpError(status, message, extra = {}) {
  const error = new Error(message)
  error.status = status
  error.extra = extra
  return error
}

/** @param {import('node:http').ServerResponse} res @param {number} status @param {unknown} value */
function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

/** Refuse a browser request that did not originate from this same Web origin. */
function assertSameOrigin(req) {
  const origin = req.headers.origin
  if (origin !== undefined) {
    let parsed
    try {
      parsed = new URL(origin)
    } catch {
      throw httpError(403, 'Cross-origin request rejected.')
    }
    if (parsed.host !== req.headers.host) throw httpError(403, 'Cross-origin request rejected.')
  }
  const site = req.headers['sec-fetch-site']
  if (site !== undefined && site !== 'same-origin' && site !== 'none') {
    throw httpError(403, 'Cross-origin request rejected.')
  }
}

/** @param {import('node:http').IncomingMessage} req */
async function readJson(req) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw httpError(413, 'Request body is too large.')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    throw httpError(400, 'Request body must be JSON.')
  }
}

/** Resolve a host path the way the filesystem tools do, including a leading `~`. */
function hostPath(value, cwd) {
  let path = value.trim()
  if (path === '~') path = homedir()
  else if (path.startsWith('~/')) path = join(homedir(), path.slice(2))
  return isAbsolute(path) ? resolve(path) : resolve(cwd, path)
}

/** Whether `child` is strictly inside `parent` after verification. */
function isInside(parent, child) {
  const rel = relative(parent, child)
  return rel.length > 0 && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

/** Limit concurrent session-log reads so a large store does not spike the Host. */
async function mapLimit(items, limit, callback) {
  const output = new Array(items.length)
  let next = 0
  async function worker() {
    for (;;) {
      const index = next
      next += 1
      if (index >= items.length) return
      output[index] = await callback(items[index], index)
    }
  }
  const workers = Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, worker)
  await Promise.all(workers)
  return output
}

/** The configured Harness home, or the default `~/.dsh`. */
function dshHome() {
  const configured = process.env.DSH_HOME
  return configured && configured.length > 0 ? resolve(configured) : join(homedir(), '.dsh')
}

/** Index every persisted session directory under `root` by its session id. */
async function sessionDirectoryIndex(root) {
  const index = new Map()
  let projects
  try {
    projects = await fs.readdir(root, { withFileTypes: true })
  } catch {
    return index
  }
  for (const project of projects) {
    if (!project.isDirectory() || !project.name.startsWith('--')) continue
    const projectDir = join(root, project.name)
    let sessions
    try {
      sessions = await fs.readdir(projectDir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const session of sessions) {
      if (session.isDirectory()) index.set(session.name, join(projectDir, session.name))
    }
  }
  return index
}

/** A safe, exact session id for path lookup. */
function validSessionId(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 200 &&
    basename(value) === value &&
    !value.includes('/') &&
    !value.includes('\\') &&
    value !== '.' &&
    value !== '..'
  )
}

/** Sum the regular files in one session-owned directory, excluding lock files. */
async function sessionLogInfo(directory) {
  if (!directory) return { bytes: 0, found: false }
  let bytes = 0
  let entries
  try {
    entries = await fs.readdir(directory, { withFileTypes: true })
  } catch {
    return { bytes: 0, found: false }
  }
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.endsWith('.lock')) continue
    try {
      bytes += (await fs.stat(join(directory, entry.name))).size
    } catch {
      // A concurrent log rotation can remove one file; the total is best effort.
    }
  }
  return { bytes, found: true }
}

/** Read the first text line of the first user message as a title fallback. */
function fallbackTitle(events) {
  for (const event of events) {
    if (event?.type !== 'user/message') continue
    const content = event?.data?.message?.content
    if (!Array.isArray(content)) continue
    const text = content
      .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (text.length > 0) return text.slice(0, 80)
  }
  return undefined
}

/** Estimate the conversation's resident event graph, not the whole process heap. */
function estimateMemory(events, liveSession) {
  let eventBytes = 0
  let messageBytes = 0
  try {
    eventBytes = serialize(events).byteLength
  } catch {
    try {
      eventBytes = Buffer.byteLength(JSON.stringify(events), 'utf8')
    } catch {
      eventBytes = 0
    }
  }
  if (liveSession && typeof liveSession.deriveMessages === 'function') {
    try {
      messageBytes = serialize(liveSession.deriveMessages()).byteLength
    } catch {
      messageBytes = 0
    }
  }
  return {
    bytes: eventBytes + messageBytes + 4096,
    eventBytes,
    messageBytes,
    estimated: true,
  }
}

/** Merge one generated-file candidate into a path-keyed map. */
function addCandidate(map, rawPath, kind, description) {
  if (typeof rawPath !== 'string' || rawPath.trim().length === 0) return
  const key = rawPath.trim()
  const existing = map.get(key)
  if (existing === undefined) {
    map.set(key, { rawPath: key, kinds: new Set([kind]), description })
    return
  }
  existing.kinds.add(kind)
  if (existing.description === undefined && description !== undefined) existing.description = description
}

/** Pull every file a conversation wrote, edited, presented, or changed in a live turn. */
function collectCandidates(ctx, sessionId, events) {
  const map = new Map()
  for (const event of events) {
    if (event?.type === 'tool/call') {
      const call = event.data
      if (!call || typeof call.name !== 'string' || typeof call.arguments !== 'string') continue
      let args
      try {
        args = JSON.parse(call.arguments)
      } catch {
        continue
      }
      if (call.name === 'write') addCandidate(map, args?.file_path, 'created')
      else if (call.name === 'edit') addCandidate(map, args?.file_path, 'changed')
      else if (call.name === 'read_image') addCandidate(map, args?.file_path ?? args?.path, 'workspace')
      else if (call.name === 'present' && Array.isArray(args?.files)) {
        for (const file of args.files) addCandidate(map, file?.path, 'delivered', file?.description)
      }
    } else if (event?.type === 'deliverables/presented') {
      const files = event?.data?.files
      if (!Array.isArray(files)) continue
      for (const file of files) addCandidate(map, file?.path, 'delivered', file?.description)
    } else if (event?.type === 'workspace/changes') {
      let summary
      try {
        summary = ctx.workspaceChanges.summary(sessionId, event.seq)
      } catch {
        summary = undefined
      }
      if (!Array.isArray(summary?.files)) continue
      for (const file of summary.files) addCandidate(map, file?.path, 'changed')
    }
  }
  return map
}

const SCAN_SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '.cache',
  '__pycache__',
  '.venv',
  'venv',
])
const SCAN_SKIP_FILES = new Set(['.DS_Store'])
const MAX_SCAN_ENTRIES = 12000
const MAX_SCAN_FILES = 4000
const MAX_SCAN_DEPTH = 6

/**
 * Find sibling outputs next to one explicitly written/edited/presented file.
 *
 * A script can create files that never appear in a tool call (a Python script
 * writing a DOCX, a build command, `tee`, ...). Scanning the whole workspace
 * would also attribute another conversation's files to this Session, so the
 * scan is limited to the directories named by the log. Directories inside the
 * workspace are walked a few levels; the workspace root and outside locations
 * are only listed directly, which keeps unrelated trees and `node_modules`
 * out of the result.
 */
async function scanDirectory(directory, recursive, startedAt, endedAt) {
  const started = Number(startedAt) || 0
  const ended = Number(endedAt) || 0
  if (started <= 0 || ended <= 0) return []
  const files = []
  const queue = [{ directory, depth: 0 }]
  let entries = 0
  while (queue.length > 0 && entries < MAX_SCAN_ENTRIES && files.length < MAX_SCAN_FILES) {
    const current = queue.shift()
    let children
    try {
      children = await fs.readdir(current.directory, { withFileTypes: true })
    } catch {
      continue
    }
    for (const child of children) {
      entries += 1
      if (entries >= MAX_SCAN_ENTRIES || files.length >= MAX_SCAN_FILES) break
      const absolute = join(current.directory, child.name)
      if (child.isDirectory()) {
        if (recursive && current.depth < MAX_SCAN_DEPTH && !SCAN_SKIP_DIRS.has(child.name)) {
          queue.push({ directory: absolute, depth: current.depth + 1 })
        }
        continue
      }
      if (!child.isFile() || SCAN_SKIP_FILES.has(child.name)) continue
      let info
      try {
        info = await fs.lstat(absolute)
      } catch {
        continue
      }
      if (!info.isFile()) continue
      const stamp = Math.max(Number(info.birthtimeMs) || 0, Number(info.mtimeMs) || 0)
      if (stamp >= started - 1000 && stamp <= ended + 5000) files.push(absolute)
    }
  }
  return files
}

const SHELL_CD = /\bcd\s+(?:--\s+)?(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/g
const SHELL_MKDIR = /\bmkdir\s+(?:-[a-zA-Z]+\s+)*(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/g
const SHELL_REDIRECT = /(?:^|\s)(?:>>?|tee\s+)(?:"([^"]+)"|'([^']+)'|([^\s;&|<]+))/g
const SHELL_OUTPUT =
  /\b(?:curl|wget|qlmanage|sips)\b[^\n;&|]*?(?:\s-o\s+|\s-O\s+|\s--out\s+|\s--output(?:=|\s+))(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/g
const SHELL_MENTION =
  /["']([^"'\n]+\.(?:png|jpe?g|webp|gif|bmp|tiff?|pdf|docx?|xlsx?|pptx?|csv|tsv|jsonl?|md|txt|py|js|mjs|cjs|tsx?|jsx?|html?|css|svg|xml|ya?ml|toml|zip|tar|gz|mp4|mov|wav|mp3))["']/gi

/** Collect matching path arguments from one shell command. */
function shellMatches(command, regex) {
  const values = []
  regex.lastIndex = 0
  for (;;) {
    const match = regex.exec(command)
    if (match === null) break
    const value = match[1] ?? match[2] ?? match[3]
    if (typeof value !== 'string') continue
    const path = value.trim()
    if (path.length === 0 || path.startsWith('-') || /[$`*?{}()]/.test(path)) continue
    if (path === '/dev/null' || path === '/dev/stdout' || path === '/dev/stderr') continue
    values.push(path)
  }
  return values
}

/** Collect shell directory hints and file mentions from the Session's tool calls. */
function collectShellEvidence(events) {
  const directories = new Set()
  const files = new Set()
  for (const event of events) {
    if (event?.type !== 'tool/call') continue
    const call = event.data
    if (!call || (call.name !== 'bash' && call.name !== 'pwsh') || typeof call.arguments !== 'string') continue
    let args
    try {
      args = JSON.parse(call.arguments)
    } catch {
      continue
    }
    const command = args?.command
    if (typeof command !== 'string' || command.length === 0) continue
    for (const path of shellMatches(command, SHELL_CD)) directories.add(path)
    for (const path of shellMatches(command, SHELL_MKDIR)) directories.add(path)
    for (const path of shellMatches(command, SHELL_REDIRECT)) files.add(path)
    for (const path of shellMatches(command, SHELL_OUTPUT)) files.add(path)
    for (const path of shellMatches(command, SHELL_MENTION)) {
      if (/^https?:/i.test(path)) continue
      files.add(path)
    }
  }
  return { directories, files }
}

/**
 * Add same-family siblings of a known output (`repaint_31.png` → the other
 * `repaint_*.png` files) without scanning a shared directory wholesale. This
 * catches loop-generated names that never appear literally in a command.
 */
async function addSiblingFamily(candidates, listings, absolute, startedAt, endedAt) {
  const started = Number(startedAt) || 0
  const ended = Number(endedAt) || 0
  if (started <= 0 || ended <= 0) return
  const extension = extname(absolute)
  if (extension.length === 0) return
  const directory = dirname(absolute)
  const name = basename(absolute)
  const stem = name.slice(0, -extension.length)
  const separator = stem.lastIndexOf('_')
  const prefix = separator > 0 ? stem.slice(0, separator + 1) : stem
  if (prefix.length < 3) return
  let children = listings.get(directory)
  if (children === undefined) {
    try {
      children = await fs.readdir(directory, { withFileTypes: true })
    } catch {
      children = []
    }
    listings.set(directory, children)
  }
  for (const child of children) {
    if (!child.isFile() || child.name === name) continue
    if (!child.name.startsWith(prefix) || !child.name.endsWith(extension)) continue
    const sibling = join(directory, child.name)
    let info
    try {
      info = await fs.lstat(sibling)
    } catch {
      continue
    }
    if (!info.isFile()) continue
    const stamp = Math.max(Number(info.birthtimeMs) || 0, Number(info.mtimeMs) || 0)
    if (stamp < started - 1000 || stamp > ended + 5000) continue
    addCandidate(candidates, sibling, 'workspace')
  }
}

/** Merge directory-window findings into the explicit tool-call candidates. */
async function candidateFiles(ctx, sessionId, events, cwd, sessionStartedAt, sessionEndedAt) {
  const candidates = collectCandidates(ctx, sessionId, events)
  const root = resolve(cwd)
  const directories = new Map()
  const listings = new Map()
  const familySeen = new Set()
  const addFamily = async (absolute) => {
    if (!isInside(root, absolute) || familySeen.has(absolute)) return
    familySeen.add(absolute)
    await addSiblingFamily(candidates, listings, absolute, sessionStartedAt, sessionEndedAt)
  }
  const addDirectory = (directory) => {
    const recursive = directory !== root && isInside(root, directory)
    directories.set(directory, (directories.get(directory) ?? false) || recursive)
  }
  for (const candidate of [...candidates.values()]) {
    const absolute = hostPath(candidate.rawPath, root)
    const parent = dirname(absolute)
    // The workspace root is intentionally not scanned: it is shared by every
    // conversation and would attribute unrelated files to this Session.
    if (parent !== root && isInside(root, parent)) addDirectory(parent)
    await addFamily(absolute)
  }
  const shell = collectShellEvidence(events)
  for (const rawPath of shell.directories) {
    const absolute = hostPath(rawPath, root)
    if (absolute === root || !isInside(root, absolute)) continue
    let info
    try {
      info = await fs.stat(absolute)
    } catch {
      continue
    }
    if (info.isDirectory()) addDirectory(absolute)
  }
  for (const rawPath of shell.files) {
    const absolute = hostPath(rawPath, root)
    if (!isInside(root, absolute)) continue
    let info
    try {
      info = await fs.stat(absolute)
    } catch {
      continue
    }
    if (info.isDirectory()) {
      if (absolute !== root) addDirectory(absolute)
    } else {
      addCandidate(candidates, absolute, 'shell')
      await addFamily(absolute)
    }
  }
  for (const [directory, recursive] of directories) {
    for (const filePath of await scanDirectory(directory, recursive, sessionStartedAt, sessionEndedAt)) {
      addCandidate(candidates, filePath, 'workspace')
    }
  }
  return resolveCandidates(cwd, candidates, sessionStartedAt)
}

/** Resolve candidates to existing regular files and decide whether deletion is in scope. */
async function resolveCandidates(cwd, candidates, sessionStartedAt) {
  const root = resolve(cwd)
  let rootReal = root
  try {
    rootReal = await fs.realpath(root)
  } catch {
    // A missing workspace root makes every candidate protected.
  }
  const started = Number(sessionStartedAt) || 0
  const byRealPath = new Map()
  for (const candidate of candidates.values()) {
    const absolute = hostPath(candidate.rawPath, root)
    let info
    try {
      info = await fs.lstat(absolute)
    } catch {
      continue
    }
    if (!info.isFile()) continue
    let real = absolute
    try {
      real = await fs.realpath(absolute)
    } catch {
      // Keep the lexical path; the lstat already established a regular file.
    }
    const pluginFile = isInside(OWN_PACKAGE_DIR, real)
    // The running plugin is not a conversation artifact; never list its source
    // in the file manager or include it in a delete sweep.
    if (pluginFile) continue
    const outside = info.isSymbolicLink() || !isInside(rootReal, real)
    const protectedReason = outside ? 'outside' : pluginFile ? 'plugin' : undefined
    const existing = byRealPath.get(real)
    if (existing !== undefined) {
      for (const kind of candidate.kinds) existing.kinds.add(kind)
      if (existing.description === undefined && candidate.description !== undefined) {
        existing.description = candidate.description
      }
      existing.birth = Math.max(existing.birth, Number(info.birthtimeMs) || 0)
      existing.mtimeMs = Math.max(existing.mtimeMs, Number(info.mtimeMs) || 0)
      // Prefer the lexical path that may actually be deleted.
      if (!existing.deletable && protectedReason === undefined) {
        existing.path = absolute
        existing.protectedReason = undefined
        existing.deletable = true
      }
      continue
    }
    byRealPath.set(real, {
      path: absolute,
      size: info.size,
      mtimeMs: Number(info.mtimeMs) || 0,
      birth: Number(info.birthtimeMs) || 0,
      kinds: new Set(candidate.kinds),
      description: candidate.description,
      protectedReason,
      deletable: protectedReason === undefined,
    })
  }
  const files = []
  for (const entry of byRealPath.values()) {
    const birth = entry.birth
    const generated =
      entry.kinds.has('delivered') ||
      (birth > 0 && started > 0 ? birth >= started - 5000 : entry.kinds.has('created'))
    const rel = relative(root, entry.path)
    files.push({
      path: entry.path,
      display: rel.length > 0 && !rel.startsWith(`..${sep}`) && rel !== '..' ? rel : entry.path,
      size: entry.size,
      mtimeMs: entry.mtimeMs,
      kinds: [...entry.kinds],
      description: entry.description,
      generated,
      protectedReason: entry.protectedReason,
      deletable: entry.deletable,
    })
  }
  files.sort((a, b) => a.display.localeCompare(b.display))
  return files
}

/** Build one conversation row from the live-preferred session corpus. */
async function describeSession(ctx, summary, directory, options) {
  const sessionId = String(summary.sessionId)
  let snapshot
  let error
  try {
    snapshot = await ctx.sessionQuery.readSession(sessionId)
  } catch (cause) {
    error = errorText(cause)
  }
  const events = Array.isArray(snapshot?.events) ? snapshot.events : []
  let title
  try {
    title = (await ctx.sessionQuery.readTitle(sessionId))?.title
  } catch {
    title = undefined
  }
  if (typeof title !== 'string' || title.trim().length === 0) title = fallbackTitle(events)
  if (typeof title !== 'string' || title.trim().length === 0) title = sessionId
  const cwd =
    (typeof summary.cwd === 'string' && summary.cwd.length > 0 ? summary.cwd : undefined) ??
    (typeof snapshot?.session?.cwd === 'string' && snapshot.session.cwd.length > 0
      ? snapshot.session.cwd
      : undefined) ??
    options.defaultDirectory ??
    process.cwd()
  const sessionEndedAt = Math.max(Number(summary.updatedAt) || 0, Number(events.at(-1)?.time) || 0)
  const files = await candidateFiles(ctx, sessionId, events, cwd, snapshot?.session?.createdAt, sessionEndedAt)
  const liveSession = ctx.sessions.get(sessionId)
  const liveAgent = ctx.agents.get(sessionId)
  const log = options.logInfo.get(directory) ?? (await sessionLogInfo(directory))
  const memory = estimateMemory(events, liveSession)
  const fileBytes = files.reduce((sum, file) => sum + (Number(file.size) || 0), 0)
  return {
    id: sessionId,
    title: title.trim(),
    cwd,
    updatedAt: Number(summary.updatedAt ?? 0),
    createdAt: Number(snapshot?.session?.createdAt || 0),
    running: summary.running === true || liveAgent?.status === 'running',
    agentAvailable: summary.agentAvailable === true || liveAgent !== undefined,
    blank: summary.blank === true,
    memory,
    log: { bytes: log.bytes, found: log.found },
    totalBytes: memory.bytes + log.bytes + fileBytes,
    files,
    error,
  }
}

/** Build the whole overview in one request. */
async function overview(ctx, root, options) {
  const summaries = await ctx.sessionController.list({}, options.signal)
  const visible = (summaries.items ?? [])
    .filter((item) => item && item.origin !== 'subagent' && !tombstones.has(String(item.sessionId)))
    .slice(0, MAX_SESSIONS)
  const directories = await sessionDirectoryIndex(root)
  const logInfo = new Map()
  await mapLimit([...directories.values()], 4, async (directory) => {
    logInfo.set(directory, await sessionLogInfo(directory))
  })
  const defaultDirectory = options.defaultDirectory
  const sessions = await mapLimit(visible, 2, (summary) =>
    describeSession(ctx, summary, directories.get(String(summary.sessionId)), {
      defaultDirectory,
      logInfo,
    }),
  )
  const totals = sessions.reduce(
    (total, session) => {
      total.memoryBytes += session.memory.bytes
      total.logBytes += session.log.bytes
      total.fileBytes += session.files.reduce((sum, file) => sum + file.size, 0)
      total.files += session.files.length
      const generated = session.files.filter((file) => file.generated)
      total.generatedFiles += generated.length
      total.generatedFileBytes += generated.reduce((sum, file) => sum + file.size, 0)
      if (session.running) total.running += 1
      return total
    },
    {
      sessions: sessions.length,
      memoryBytes: 0,
      logBytes: 0,
      fileBytes: 0,
      generatedFileBytes: 0,
      files: 0,
      generatedFiles: 0,
      running: 0,
    },
  )
  const usage = process.memoryUsage()
  return {
    generatedAt: Date.now(),
    sessions,
    totals,
    process: {
      rss: usage.rss,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
    },
    limits: { maxSessions: MAX_SESSIONS },
  }
}

/** Find one visible session summary or fail with 404. */
async function findSummary(ctx, sessionId) {
  if (!validSessionId(sessionId) || tombstones.has(sessionId)) {
    throw httpError(404, 'Conversation not found.')
  }
  const list = await ctx.sessionController.list({}, AbortSignal.timeout(15000))
  const summary = (list.items ?? []).find((item) => String(item.sessionId) === sessionId)
  if (summary === undefined) throw httpError(404, 'Conversation not found.')
  const liveAgent = ctx.agents.get(sessionId)
  return { ...summary, running: summary.running === true || liveAgent?.status === 'running' }
}

/** Prefer the listed summary cwd, then the stored header, then the Host default. */
async function sessionCwd(ctx, summary, snapshot) {
  if (typeof summary.cwd === 'string' && summary.cwd.length > 0) return summary.cwd
  if (typeof snapshot?.session?.cwd === 'string' && snapshot.session.cwd.length > 0) {
    return snapshot.session.cwd
  }
  let read = snapshot
  if (read === undefined) {
    try {
      read = await ctx.sessionQuery.readSession(String(summary.sessionId))
    } catch {
      read = undefined
    }
  }
  if (typeof read?.session?.cwd === 'string' && read.session.cwd.length > 0) return read.session.cwd
  return ctx.workingDirectory?.defaultDirectory ?? process.cwd()
}

/** Re-read one conversation's tracked files for a deletion request. */
async function trackedFiles(ctx, summary) {
  const sessionId = String(summary.sessionId)
  let snapshot
  try {
    snapshot = await ctx.sessionQuery.readSession(sessionId)
  } catch (cause) {
    throw httpError(409, `Cannot read this conversation: ${errorText(cause)}`)
  }
  const cwd = await sessionCwd(ctx, summary, snapshot)
  const sessionEndedAt = Math.max(Number(summary.updatedAt) || 0, Number(snapshot.events?.at(-1)?.time) || 0)
  return candidateFiles(ctx, sessionId, snapshot.events ?? [], cwd, snapshot.session?.createdAt, sessionEndedAt)
}

/** Unlink one tracked file after re-validating its scope. */
async function unlinkTracked(file) {
  if (!file.deletable) {
    return {
      path: file.path,
      deleted: false,
      error:
        file.protectedReason === 'plugin'
          ? 'This file belongs to the running Session Storage plugin.'
          : 'File is outside the conversation workspace.',
    }
  }
  try {
    await fs.unlink(file.path)
    return { path: file.path, deleted: true }
  } catch (cause) {
    if (cause?.code === 'ENOENT') return { path: file.path, deleted: false, missing: true }
    return { path: file.path, deleted: false, error: errorText(cause) }
  }
}

/**
 * Remove a session from every Workspace account and from the pin/archive sets.
 * Workspace membership is what makes an archived row restorable, so a real
 * deletion must not leave either of those edges behind.
 */
async function detachFromWorkspaces(ctx, sessionId) {
  const warnings = []
  let workspaces = []
  try {
    workspaces = ctx.workspaceRegistry.list()
  } catch (cause) {
    warnings.push(`workspace list: ${errorText(cause)}`)
  }
  for (const workspace of workspaces) {
    try {
      // Call detach unconditionally: the public getter filters out ids whose
      // Session is already gone, while the durable record can still hold one.
      await workspace.detachSession(sessionId)
    } catch (cause) {
      warnings.push(`workspace ${String(workspace.id)}: ${errorText(cause)}`)
    }
  }
  for (const [name, call] of [
    ['unpin', () => ctx.workspaceController.unpinSession({ sessionId })],
    ['unarchive', () => ctx.workspaceController.unarchiveSession({ sessionId })],
  ]) {
    try {
      await call()
    } catch (cause) {
      // An unknown id is the expected case when the row was never pinned or archived.
      const message = errorText(cause)
      if (!/unknown|not found/i.test(message)) warnings.push(`${name}: ${message}`)
    }
  }
  return warnings
}

/**
 * Tear down a resident Agent and detach its registry entries.
 *
 * The public Session API has no delete operation, and the AgentHandle that owns
 * the ordered teardown is deliberately private. The two registries do expose
 * their entries and detach methods, so this mirrors the handle's last two
 * steps after cancelling and disposing the agent scope. The persistence
 * backend closes its write handle from the `session/disposed` listener.
 */
async function disposeResidentSession(ctx, sessionId) {
  const failures = []
  const agent = ctx.agents.get(sessionId)
  if (agent !== undefined) {
    try {
      agent.cancel({ kind: 'disposed' }, { keepInbox: true })
    } catch (cause) {
      failures.push(`cancel: ${errorText(cause)}`)
    }
    try {
      if (typeof agent.whenIdle === 'function') {
        await Promise.race([
          agent.whenIdle(),
          new Promise((resolve) => setTimeout(resolve, 4000)),
        ])
      }
    } catch (cause) {
      failures.push(`idle: ${errorText(cause)}`)
    }
    try {
      if (agent.scope && typeof agent.scope.dispose === 'function') await agent.scope.dispose()
    } catch (cause) {
      failures.push(`scope: ${errorText(cause)}`)
    }
    try {
      const entry = ctx.agents.store?.get?.(sessionId)
      if (entry !== undefined && typeof ctx.agents.detachEntered === 'function') {
        ctx.agents.detachEntered(entry)
      }
    } catch (cause) {
      failures.push(`agent detach: ${errorText(cause)}`)
    }
  }
  try {
    const entry = ctx.sessions.store?.get?.(sessionId)
    if (entry !== undefined && typeof ctx.sessions.detachEntered === 'function') {
      ctx.sessions.detachEntered(entry)
    }
  } catch (cause) {
    failures.push(`session detach: ${errorText(cause)}`)
  }
  return {
    agentWasLive: agent !== undefined,
    agentDetached: ctx.agents.get(sessionId) === undefined,
    sessionDetached: ctx.sessions.get(sessionId) === undefined,
    failures,
  }
}

/** Remove the persisted log directory and the projection checkpoint, if present. */
async function removePersistedState(root, sessionId) {
  const directory = (await sessionDirectoryIndex(root)).get(sessionId)
  if (directory !== undefined) {
    await fs.rm(directory, { recursive: true, force: true })
    try {
      const parent = dirname(directory)
      if (isInside(root, parent)) await fs.rmdir(parent)
    } catch {
      // The project directory still holds other conversations.
    }
  }
  const checkpoint = join(dshHome(), 'storages', 'session_projcache', 'sessions', `${sessionId}.json`)
  try {
    await fs.rm(checkpoint, { force: true })
    // `session/disposed` checkpoints fire-and-forget; remove the row once more
    // after that write has had a turn to settle.
    await new Promise((resolve) => setTimeout(resolve, 350))
    await fs.rm(checkpoint, { force: true })
    const timer = setTimeout(() => {
      void fs.rm(checkpoint, { force: true }).catch(() => {})
    }, 2000)
    timer.unref?.()
  } catch {
    // The projection cache is an optimization, not part of the session contract.
  }
  return directory !== undefined
}

/** @param {import('@deepseek-ai/cordis').Context} ctx */
export function apply(ctx, config = {}) {
  const root = resolve(
    typeof config.sessionsRoot === 'string' && config.sessionsRoot.length > 0
      ? config.sessionsRoot
      : join(dshHome(), 'sessions'),
  )
  const defaultDirectory =
    typeof config.defaultWorkspace === 'string' && config.defaultWorkspace.length > 0
      ? resolve(config.defaultWorkspace)
      : undefined

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: ROUTE_PREFIX,
      handler: async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const route = url.pathname
        try {
          assertSameOrigin(req)
          if (route === ROUTE_OVERVIEW && req.method === 'GET') {
            return sendJson(
              res,
              200,
              await overview(ctx, root, { signal: AbortSignal.timeout(30000), defaultDirectory }),
            )
          }
          if (route === ROUTE_OPEN_FILE && req.method === 'POST') {
            const body = await readJson(req)
            const summary = await findSummary(ctx, String(body.sessionId ?? ''))
            const files = await trackedFiles(ctx, summary)
            const target = files.find((file) => file.path === body.path)
            if (target === undefined) throw httpError(404, 'That file is not a tracked result of this conversation.')
            if (!ctx.sessionController.workspaceDesktop().available) {
              throw httpError(409, 'Opening files on the Host desktop is unavailable.')
            }
            const action = body.action === 'reveal' ? 'reveal' : 'open'
            try {
              await ctx.sessionController.openWorkspacePath(
                { path: target.path, ...(action === 'reveal' ? { action } : {}) },
                AbortSignal.timeout(20000),
              )
            } catch (cause) {
              throw httpError(500, `Could not ${action === 'reveal' ? 'reveal' : 'open'} this file: ${errorText(cause)}`)
            }
            return sendJson(res, 200, { opened: true, action, path: target.path })
          }
          if (route === ROUTE_OPEN_WORKSPACE && req.method === 'POST') {
            const body = await readJson(req)
            const summary = await findSummary(ctx, String(body.sessionId ?? ''))
            const cwd = resolve(await sessionCwd(ctx, summary))
            let info
            try {
              info = await fs.stat(cwd)
            } catch {
              info = undefined
            }
            if (info === undefined || !info.isDirectory()) {
              throw httpError(404, 'The workspace folder no longer exists.')
            }
            if (!ctx.sessionController.workspaceDesktop().available) {
              throw httpError(409, 'Opening folders on the Host desktop is unavailable.')
            }
            try {
              await ctx.sessionController.openWorkspacePath({ path: cwd }, AbortSignal.timeout(20000))
            } catch (cause) {
              throw httpError(500, `Could not open the workspace folder: ${errorText(cause)}`)
            }
            return sendJson(res, 200, { opened: true, path: cwd })
          }
          if (route === ROUTE_DELETE_FILE && req.method === 'POST') {
            const body = await readJson(req)
            const summary = await findSummary(ctx, String(body.sessionId ?? ''))
            if (summary.running) throw httpError(409, 'Stop this conversation before deleting its files.')
            const files = await trackedFiles(ctx, summary)
            const target = files.find((file) => file.path === body.path)
            if (target === undefined) throw httpError(404, 'That file is not a tracked result of this conversation.')
            const result = await unlinkTracked(target)
            if (result.error !== undefined) throw httpError(result.missing ? 404 : 403, result.error)
            return sendJson(res, 200, { ...result, missing: result.missing === true })
          }
          if (route === ROUTE_DELETE_FILES && req.method === 'POST') {
            const body = await readJson(req)
            const summary = await findSummary(ctx, String(body.sessionId ?? ''))
            if (summary.running) throw httpError(409, 'Stop this conversation before deleting its files.')
            const files = (await trackedFiles(ctx, summary)).filter((file) => file.generated && file.deletable)
            const results = []
            for (const file of files) results.push(await unlinkTracked(file))
            return sendJson(res, 200, {
              results,
              deleted: results.filter((result) => result.deleted).length,
              failures: results.filter((result) => result.error !== undefined).length,
            })
          }
          if (route === ROUTE_DELETE_SESSION && req.method === 'POST') {
            const body = await readJson(req)
            const sessionId = String(body.sessionId ?? '')
            const summary = await findSummary(ctx, sessionId)
            if (summary.running) throw httpError(409, 'Stop this conversation before deleting it.')
            const files = await trackedFiles(ctx, summary)
            const live = await disposeResidentSession(ctx, sessionId)
            if (!live.agentDetached || !live.sessionDetached) {
              throw httpError(
                409,
                `Could not remove the resident conversation: ${live.failures.join('; ') || 'registry detach failed'}`,
                { live },
              )
            }
            const workspaceWarnings = await detachFromWorkspaces(ctx, sessionId)
            const fileResults = []
            if (body.deleteFiles !== false) {
              for (const file of files) {
                if (file.generated && file.deletable) fileResults.push(await unlinkTracked(file))
              }
            }
            const logDeleted = await removePersistedState(root, sessionId)
            tombstones.add(sessionId)
            return sendJson(res, 200, {
              deleted: true,
              sessionId,
              logDeleted,
              agentDetached: live.agentDetached,
              sessionDetached: live.sessionDetached,
              filesDeleted: fileResults.filter((result) => result.deleted).length,
              fileFailures: fileResults.filter((result) => result.error !== undefined).length,
              warnings: [...live.failures, ...workspaceWarnings],
            })
          }
          return sendJson(res, 404, { error: 'Not found.' })
        } catch (cause) {
          const status = Number.isInteger(cause?.status) ? cause.status : 500
          return sendJson(res, status, { error: errorText(cause), ...(cause?.extra ?? {}) })
        }
      },
    }),
  )
}
