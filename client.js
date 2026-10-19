window.__ModuleLoader__.load({
  id: 'dsh-conversation-cleaner',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'conversation-cleaner'
    const PREFIX = '/.dsh-conversation-cleaner'

    const DICT = {
      en: {
        'menu.files': 'Manage files',
        'menu.meta': '({count} | {total})',
        'menu.metaUnknown': '(… | …)',
        'menu.delete': 'Delete conversation',
        'dialog.filesTitle': 'Manage files',
        'dialog.filesSubtitle': 'Local files in this conversation.',
        'dialog.deleteTitle': 'Delete conversation',
        'dialog.deleteSubtitle': 'This cannot be undone.',
        'dialog.close': 'Close',
        'dialog.cancel': 'Cancel',
        'dialog.deleteFiles': 'Delete generated files',
        'dialog.deleteConversation': 'Delete conversation',
        'dialog.confirmDelete': 'Delete permanently',
        'dialog.running': 'This conversation is running. Stop it before deleting files or the conversation.',
        'dialog.emptyFiles': 'No generated files were found in this conversation.',
        'dialog.loading': 'Reading this conversation…',
        'dialog.notFound': 'This conversation is no longer available.',
        'dialog.total': 'Total memory',
        'dialog.log': 'Session log',
        'dialog.generated': 'Generated files',
        'dialog.tracked': 'Tracked files',
        'dialog.workspace': 'Workspace',
        'dialog.openWorkspace': 'Open workspace folder',
        'dialog.notice.workspaceOpened': 'Opened the workspace folder.',
        'dialog.kept': '{count} file(s) will be kept, including pre-existing files and the plugin source.',
        'dialog.deleteWarning':
          'The conversation will be removed from the sidebar, its session log will be deleted, and {count} generated file(s) will be deleted.',
        'dialog.deleteNoFiles': 'No generated files will be deleted; only the session log is removed.',
        'dialog.fileDelete': 'Delete this file?',
        'dialog.fileDeleteBody': 'This removes the file from disk. The conversation stays.',
        'dialog.openFile': 'Open file',
        'dialog.revealFile': 'Show in folder',
        'dialog.deleteFile': 'Delete',
        'dialog.fileBusy': 'Working…',
        'dialog.notice.opened': 'Opened.',
        'dialog.notice.revealed': 'Opened containing folder.',
        'dialog.notice.fileDeleted': 'File deleted.',
        'dialog.notice.filesDeleted': '{count} generated file(s) deleted.',
        'dialog.error': 'The operation failed.',
        'file.protected': 'outside workspace',
        'file.plugin': 'plugin source',
        'file.deletable': 'Delete file',
      },
      zh: {
        'menu.files': '文件管理',
        'menu.meta': '（{count} | {total}）',
        'menu.metaUnknown': '（… | …）',
        'menu.delete': '删除对话',
        'dialog.filesTitle': '文件管理',
        'dialog.filesSubtitle': '这个对话的本地文件。',
        'dialog.deleteTitle': '删除对话',
        'dialog.deleteSubtitle': '删除后无法恢复。',
        'dialog.close': '关闭',
        'dialog.cancel': '取消',
        'dialog.deleteFiles': '删除生成文件',
        'dialog.deleteConversation': '删除对话',
        'dialog.confirmDelete': '永久删除',
        'dialog.running': '这个对话正在运行。请先停止，再删除文件或对话。',
        'dialog.emptyFiles': '这个对话里没有找到生成的文件。',
        'dialog.loading': '正在读取这个对话…',
        'dialog.notFound': '这个对话已不存在。',
        'dialog.total': '总内存',
        'dialog.log': '会话日志',
        'dialog.generated': '生成文件',
        'dialog.tracked': '已跟踪文件',
        'dialog.workspace': '工作目录',
        'dialog.openWorkspace': '打开工作目录',
        'dialog.notice.workspaceOpened': '已打开工作目录。',
        'dialog.kept': '另有 {count} 个文件会保留，包括会话前已存在的文件和插件源码。',
        'dialog.deleteWarning': '对话会从侧栏移除，会话日志会删除，并删除 {count} 个生成文件。',
        'dialog.deleteNoFiles': '不会删除生成文件，只会删除会话日志。',
        'dialog.fileDelete': '删除这个文件？',
        'dialog.fileDeleteBody': '文件会从磁盘移除，对话本身保留。',
        'dialog.openFile': '打开文件',
        'dialog.revealFile': '打开所在目录',
        'dialog.deleteFile': '删除',
        'dialog.fileBusy': '处理中…',
        'dialog.notice.opened': '已打开。',
        'dialog.notice.revealed': '已打开所在目录。',
        'dialog.notice.fileDeleted': '文件已删除。',
        'dialog.notice.filesDeleted': '已删除 {count} 个生成文件。',
        'dialog.error': '操作失败。',
        'file.protected': '工作目录外',
        'file.plugin': '插件源码',
        'file.deletable': '删除文件',
      },
    }

    const styles = `
.dss-menu-item {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 30px;
  padding: 5px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
}
.dss-menu-item:hover { background: var(--dsw-alias-bg-layer-2); }
.dss-menu-item:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.dss-menu-item-danger { color: var(--dsw-alias-state-error-primary); }
.dss-menu-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.dss-menu-count { margin-left: 2px; color: var(--dsw-alias-label-tertiary); font-size: 11px; font-variant-numeric: tabular-nums; }
.dss-menu-separator { border-top: 1px solid var(--dsw-alias-border-l1); margin-top: 4px; padding-top: 5px; }

.dss-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  pointer-events: auto;
  overscroll-behavior: contain;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 30%, transparent);
}
.dss-dialog {
  box-sizing: border-box;
  width: min(720px, 100%);
  max-height: min(82vh, 760px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 14px;
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 20px 60px color-mix(in srgb, var(--dsw-alias-label-primary) 24%, transparent);
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 13px;
  line-height: 1.5;
}
.dss-dialog:focus { outline: none; }
.dss-dialog-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 20px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.dss-dialog-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.dss-dialog-copy h2 { margin: 0; font-size: 16px; line-height: 1.35; font-weight: 650; }
.dss-dialog-copy p { margin: 0; font-size: 12px; line-height: 1.55; color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
.dss-icon-btn { appearance: none; flex: none; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 7px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; padding: 0; }
.dss-icon-btn:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dss-icon-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dss-dialog-body { min-height: 0; overflow: auto; padding: 16px 20px 18px; display: flex; flex-direction: column; gap: 14px; }
.dss-dialog-foot { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 13px 20px; border-top: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); }
.dss-footer-spacer { flex: 1 1 auto; }
.dss-btn { appearance: none; font: inherit; color: var(--dsw-alias-label-primary); background: transparent; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; padding: 5px 11px; height: 30px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; white-space: nowrap; }
.dss-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); }
.dss-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.dss-btn:disabled { opacity: 0.42; cursor: not-allowed; }
.dss-btn-danger { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }
.dss-btn-danger:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); }
.dss-btn-ghost { border-color: transparent; color: var(--dsw-alias-label-secondary); }
.dss-btn-ghost:hover:not(:disabled) { color: var(--dsw-alias-label-primary); }
.dss-btn-icon { width: 26px; height: 26px; padding: 0; }
.dss-banner { border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; padding: 9px 11px; font-size: 12px; line-height: 1.55; background: var(--dsw-alias-bg-layer-1); }
.dss-banner-error { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.dss-banner-ok { border-color: var(--dsw-alias-state-success-primary); color: var(--dsw-alias-state-success-primary); }
.dss-banner-warn { border-color: var(--dsw-alias-state-warn-primary); color: var(--dsw-alias-state-warn-primary); }
.dss-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.dss-stat { min-width: 0; display: flex; flex-direction: column; gap: 1px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; padding: 7px 10px; background: var(--dsw-alias-bg-layer-1); }
.dss-stat-label { font-size: 10.5px; color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dss-stat-value { font-size: 13.5px; font-weight: 600; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dss-cwd { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.dss-cwd-label { flex: none; }
.dss-cwd-value { appearance: none; display: inline-flex; align-items: center; gap: 5px; min-width: 0; max-width: 100%; margin: -2px -5px; padding: 2px 5px; border: 0; border-radius: 5px; background: transparent; color: inherit; font: inherit; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; text-align: left; cursor: pointer; }
.dss-cwd-value:hover:not(:disabled) { color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-bg-layer-2); }
.dss-cwd-value:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dss-cwd-value:disabled { cursor: default; opacity: 0.6; }
.dss-cwd-value svg { flex: none; }
.dss-cwd-path { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dss-files { display: flex; flex-direction: column; gap: 2px; }
.dss-file { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; align-items: center; gap: 9px; padding: 6px 7px; border-radius: 8px; }
.dss-file:hover { background: var(--dsw-alias-bg-layer-2); }
.dss-file-name { appearance: none; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: inherit; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11.5px; color: var(--dsw-alias-label-primary); background: transparent; border: 0; padding: 0; text-align: left; cursor: pointer; }
.dss-file-name:hover:not(:disabled) { color: var(--dsw-alias-brand-primary); text-decoration: underline; text-underline-offset: 2px; }
.dss-file-name:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; border-radius: 3px; }
.dss-file-name:disabled { cursor: default; opacity: 0.6; }
.dss-file-size { font-size: 11px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; white-space: nowrap; }
.dss-empty-files { border: 1px dashed var(--dsw-alias-border-l2); border-radius: 9px; padding: 24px 18px; text-align: center; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dss-inline-confirm { display: flex; align-items: center; justify-content: space-between; gap: 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 9px; padding: 8px 10px; background: var(--dsw-alias-bg-layer-1); }
.dss-inline-confirm-copy { display: flex; flex-direction: column; gap: 1px; min-width: 0; font-size: 12px; }
.dss-inline-confirm-copy strong { font-weight: 600; }
.dss-inline-confirm-copy span { color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dss-inline-confirm-actions { display: flex; align-items: center; gap: 7px; flex: none; }
.dss-dialog-foot .dss-btn { min-width: 0; }
@media (max-width: 680px) {
  .dss-backdrop { padding: 12px; }
  .dss-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dss-file { grid-template-columns: minmax(0, 1fr) auto auto auto; }
  .dss-dialog-head { padding: 16px 16px 12px; }
  .dss-dialog-body { padding: 14px 16px; }
  .dss-dialog-foot { padding: 12px 16px; flex-wrap: wrap; }
  .dss-footer-spacer { display: none; }
  .dss-inline-confirm { flex-direction: column; align-items: stretch; }
  .dss-inline-confirm-actions { justify-content: flex-end; }
}
`

    const store = (() => {
      let snapshot = {
        loading: true,
        data: null,
        error: null,
        dialog: null,
      }
      const listeners = new Set()
      return {
        getSnapshot() {
          return snapshot
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        set(patch) {
          snapshot = { ...snapshot, ...patch }
          for (const listener of [...listeners]) listener()
        },
      }
    })()

    let refreshPromise = null
    function refresh() {
      if (refreshPromise !== null) return refreshPromise
      refreshPromise = request('/overview')
        .then((data) => {
          store.set({ data, loading: false, error: null })
          return data
        })
        .catch((cause) => {
          store.set({
            loading: false,
            error: cause instanceof Error ? cause.message : String(cause),
          })
          return undefined
        })
        .finally(() => {
          refreshPromise = null
        })
      return refreshPromise
    }

    function useStore(selector) {
      return React.useSyncExternalStore(
        store.subscribe,
        () => selector(store.getSnapshot()),
        () => selector(store.getSnapshot()),
      )
    }

    function sessionFrom(snapshot, sessionId) {
      return snapshot.data?.sessions?.find((session) => session.id === sessionId)
    }

    function openDialog(sessionId, mode) {
      store.set({ dialog: { sessionId, mode } })
      void refresh()
    }

    function closeDialog() {
      store.set({ dialog: null })
    }

    function formatBytes(value) {
      const bytes = Number(value) || 0
      if (bytes < 1024) return `${bytes} B`
      const units = ['KB', 'MB', 'GB', 'TB']
      let amount = bytes / 1024
      let index = 0
      while (amount >= 1024 && index < units.length - 1) {
        amount /= 1024
        index += 1
      }
      return `${amount >= 100 ? amount.toFixed(0) : amount >= 10 ? amount.toFixed(1) : amount.toFixed(2)} ${units[index]}`
    }

    function replace(template, values) {
      return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''))
    }

    function generatedFiles(session) {
      return (session?.files ?? []).filter((file) => file.generated && file.deletable)
    }

    /** Conversation footprint: resident event graph + session log + tracked files. */
    function totalMemory(session) {
      const total = Number(session?.totalBytes)
      if (Number.isFinite(total)) return total
      const files = (session?.files ?? []).reduce((sum, file) => sum + (Number(file.size) || 0), 0)
      return (Number(session?.memory?.bytes) || 0) + (Number(session?.log?.bytes) || 0) + files
    }

    async function request(path, options = {}) {
      // A hung Host request must not pin the dialog into a busy state forever.
      const { timeoutMs = 45000, ...init } = options
      const timeout =
        init.signal ?? (typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined)
      const response = await fetch(`${PREFIX}${path}`, {
        cache: 'no-store',
        ...init,
        ...(timeout === undefined ? {} : { signal: timeout }),
        headers: {
          accept: 'application/json',
          ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(init.headers ?? {}),
        },
      })
      const raw = await response.text()
      let body = {}
      try {
        body = raw.length > 0 ? JSON.parse(raw) : {}
      } catch {
        body = { error: raw.slice(0, 240) || `HTTP ${response.status}` }
      }
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`)
      return body
    }

    /** The shipped `IconFolderOpenRegular` geometry, so menu rows match the host. */
    function GlyphFolderOpen({ size = 14 }) {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: size, height: size, 'aria-hidden': true, fill: 'none' },
        h('path', {
          d: 'M2.55912 7.93683C2.67584 7.49906 3.0723 7.19446 3.52536 7.19446H13.6491C14.3061 7.19446 14.7846 7.81725 14.6153 8.45209L13.4411 12.856C13.3244 13.2938 12.9279 13.5984 12.4748 13.5984H2.35113C1.69411 13.5984 1.21562 12.9756 1.38489 12.3407L2.55912 7.93683Z',
          fill: 'currentColor',
          opacity: '0.16',
        }),
        h('path', {
          d: 'M13.6491 6.69446C14.6346 6.69453 15.3522 7.62895 15.0983 8.58118L13.9245 12.9845C13.7494 13.6412 13.1539 14.0988 12.4743 14.0988H2.35126C1.36574 14.0988 0.648153 13.1643 0.902044 12.212L2.07587 7.80774C2.25102 7.15128 2.84567 6.69455 3.52509 6.69446H13.6491ZM3.52509 7.69446C3.29865 7.69455 3.10004 7.84674 3.04169 8.06555L1.86786 12.4698C1.78345 12.7872 2.02285 13.0988 2.35126 13.0988H12.4743C12.7007 13.0988 12.8992 12.9463 12.9577 12.7277L14.1325 8.32336C14.2171 8.00598 13.9776 7.69453 13.6491 7.69446H3.52509Z',
          fill: 'currentColor',
        }),
        h('path', {
          d: 'M4.7666 1.90137C5.13227 1.90144 5.48571 2.03525 5.75977 2.27734L7.27246 3.61328C7.36379 3.69382 7.48174 3.73828 7.60352 3.73828H12.3994C13.2276 3.73841 13.8993 4.41005 13.8994 5.23828V6.7168C13.8183 6.70327 13.735 6.69436 13.6494 6.69434H12.8994V5.23828C12.8993 4.96233 12.6754 4.73841 12.3994 4.73828H7.60352C7.23781 4.73828 6.88446 4.60438 6.61035 4.3623L5.09766 3.02637C5.00636 2.94576 4.88838 2.90144 4.7666 2.90137H2.0498C1.77366 2.90137 1.5498 3.12523 1.5498 3.40137V9.78223L0.902344 12.2119C0.648452 13.1642 1.36604 14.0986 2.35156 14.0986H2.0498C1.2214 14.0986 0.549838 13.427 0.549805 12.5986V3.40137C0.549805 2.57294 1.22138 1.90137 2.0498 1.90137H4.7666Z',
          fill: 'currentColor',
        }),
      )
    }

    /** The shipped `IconFolderOpenOutlineRegular` geometry for the per-file action. */
    function GlyphFolderOpenOutline({ size = 13 }) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          'aria-hidden': true,
          fill: 'none',
          strokeWidth: 1,
        },
        h('path', {
          d: 'M12.3994 13.5986H2.04956C1.49728 13.5986 1.04956 13.1509 1.04956 12.5986V3.40137C1.04956 2.84908 1.49728 2.40137 2.04956 2.40137H4.76632C5.01016 2.40137 5.24561 2.49046 5.42836 2.6519L6.94088 3.98799C7.12364 4.14943 7.35908 4.23852 7.60293 4.23852H12.3994C12.9517 4.23852 13.3994 4.68624 13.3994 5.23852V7.16991',
          stroke: 'currentColor',
        }),
        h('path', {
          d: 'M2.55911 7.93683C2.67584 7.49906 3.07229 7.19446 3.52536 7.19446H13.6491C14.3061 7.19446 14.7846 7.81725 14.6153 8.45209L13.4411 12.856C13.3244 13.2938 12.9279 13.5984 12.4748 13.5984H2.35113C1.69411 13.5984 1.21562 12.9756 1.38489 12.3407L2.55911 7.93683Z',
          stroke: 'currentColor',
        }),
      )
    }

    /** The shipped `IconTrashOutlineRegular` geometry. */
    function GlyphTrash({ size = 13 }) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          'aria-hidden': true,
          fill: 'none',
          strokeWidth: 1,
        },
        h('path', { d: 'M1.28149 3.88831H14.7187', stroke: 'currentColor' }),
        h('path', {
          d: 'M5.41602 3.88833V2.47962C5.41602 2.29282 5.52492 2.11366 5.71876 1.98157C5.9126 1.84948 6.17551 1.77527 6.44964 1.77527H9.55053C9.82466 1.77527 10.0876 1.84948 10.2814 1.98157C10.4753 2.11366 10.5842 2.29282 10.5842 2.47962V3.88833',
          stroke: 'currentColor',
        }),
        h('path', {
          d: 'M2.57349 3.88831L3.19366 13.2943C3.21937 13.5502 3.33952 13.7872 3.53065 13.9593C3.72178 14.1313 3.97016 14.2259 4.22729 14.2246H11.7728C12.0299 14.2259 12.2783 14.1313 12.4694 13.9593C12.6605 13.7872 12.7807 13.5502 12.8064 13.2943L13.4266 3.88831',
          stroke: 'currentColor',
        }),
        h('path', { d: 'M6.44946 6.98926V11.1238', stroke: 'currentColor' }),
        h('path', { d: 'M9.55054 6.98926V11.1238', stroke: 'currentColor' }),
      )
    }

    function GlyphClose() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': true, fill: 'none' },
        h('path', {
          d: 'M4 4l8 8M12 4l-8 8',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
        }),
      )
    }

    function FilesMenuItem({ sessionId, useMenuOpenState, t }) {
      const [menuOpen, setMenuOpen] = useMenuOpenState()
      const session = useStore((snapshot) => sessionFrom(snapshot, sessionId))
      React.useEffect(() => {
        if (menuOpen) void refresh()
      }, [menuOpen])
      const meta =
        session === undefined
          ? t('menu.metaUnknown')
          : replace(t('menu.meta'), {
              count: session.files.length,
              total: formatBytes(totalMemory(session)),
            })
      return h(
        'button',
        {
          type: 'button',
          role: 'menuitem',
          className: 'dss-menu-item',
          onClick: () => {
            setMenuOpen(false)
            openDialog(sessionId, 'files')
          },
        },
        h(GlyphFolderOpen),
        h('span', { className: 'dss-menu-label' }, t('menu.files')),
        h('span', { className: 'dss-menu-count' }, meta),
      )
    }

    function DeleteMenuItem({ sessionId, useMenuOpenState, t }) {
      const [menuOpen, setMenuOpen] = useMenuOpenState()
      React.useEffect(() => {
        if (menuOpen) void refresh()
      }, [menuOpen])
      return h(
        'button',
        {
          type: 'button',
          role: 'menuitem',
          className: 'dss-menu-item dss-menu-item-danger dss-menu-separator',
          onClick: () => {
            setMenuOpen(false)
            openDialog(sessionId, 'delete')
          },
        },
        h(GlyphTrash, { size: 14 }),
        h('span', { className: 'dss-menu-label' }, t('menu.delete')),
      )
    }

    function StorageDialog({ t }) {
      const snapshot = useStore((state) => state)
      const dialog = snapshot.dialog
      const session = dialog === null ? undefined : sessionFrom(snapshot, dialog.sessionId)
      const [confirmFile, setConfirmFile] = React.useState(null)
      const [busy, setBusy] = React.useState(null)
      const [error, setError] = React.useState(null)
      const [notice, setNotice] = React.useState(null)
      const dialogRef = React.useRef(null)

      React.useEffect(() => {
        // Every fresh dialog starts idle: a previous run must never leave the
        // controls (including the close key) disabled.
        setConfirmFile(null)
        setBusy(null)
        setError(null)
        setNotice(null)
      }, [dialog?.sessionId, dialog?.mode])

      React.useEffect(() => {
        if (dialog === null) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') closeDialog()
        }
        document.addEventListener('keydown', onKey)
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0)
        return () => {
          document.removeEventListener('keydown', onKey)
          document.body.style.overflow = previous
          window.clearTimeout(focusTimer)
        }
      }, [dialog])

      if (dialog === null) return null

      const files = session?.files ?? []
      const generated = generatedFiles(session)
      const generatedBytes = generated.reduce((sum, file) => sum + (Number(file.size) || 0), 0)
      const kept = files.length - generated.length
      const title = session?.title || dialog.sessionId
      const running = session?.running === true
      const titleText = dialog.mode === 'delete' ? t('dialog.deleteTitle') : t('dialog.filesTitle')

      const openFile = async (file, action = 'open') => {
        setBusy(`open:${action}:${file.path}`)
        setError(null)
        setNotice(null)
        try {
          await request('/open-file', {
            method: 'POST',
            body: JSON.stringify({ sessionId: dialog.sessionId, path: file.path, action }),
          })
          setNotice(action === 'reveal' ? t('dialog.notice.revealed') : t('dialog.notice.opened'))
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : t('dialog.error'))
        } finally {
          setBusy(null)
        }
      }

      const openWorkspace = async () => {
        setBusy('workspace')
        setError(null)
        setNotice(null)
        try {
          await request('/open-workspace', {
            method: 'POST',
            body: JSON.stringify({ sessionId: dialog.sessionId }),
          })
          setNotice(t('dialog.notice.workspaceOpened'))
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : t('dialog.error'))
        } finally {
          setBusy(null)
        }
      }

      const deleteFile = async (file) => {
        setBusy(`file:${file.path}`)
        setError(null)
        setNotice(null)
        try {
          await request('/delete-file', {
            method: 'POST',
            body: JSON.stringify({ sessionId: dialog.sessionId, path: file.path }),
          })
          setNotice(t('dialog.notice.fileDeleted'))
          setConfirmFile(null)
          await refresh()
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : t('dialog.error'))
        } finally {
          setBusy(null)
        }
      }

      const deleteAllFiles = async () => {
        setBusy('files')
        setError(null)
        setNotice(null)
        try {
          const result = await request('/delete-files', {
            method: 'POST',
            body: JSON.stringify({ sessionId: dialog.sessionId }),
          })
          setNotice(replace(t('dialog.notice.filesDeleted'), { count: Number(result.deleted ?? 0) }))
          await refresh()
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : t('dialog.error'))
        } finally {
          setBusy(null)
        }
      }

      const deleteSession = async () => {
        setBusy('session')
        setError(null)
        setNotice(null)
        try {
          const result = await request('/delete-session', {
            method: 'POST',
            body: JSON.stringify({ sessionId: dialog.sessionId, deleteFiles: true }),
          })
          await refresh()
          closeDialog()
          if (Array.isArray(result.warnings) && result.warnings.length > 0) {
            console.warn('session storage: deleted with warnings', result.warnings)
          }
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : t('dialog.error'))
        } finally {
          setBusy(null)
        }
      }

      return h(
        'div',
        {
          className: 'dss-backdrop',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) closeDialog()
          },
        },
        h(
          'div',
          {
            className: 'dss-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': titleText,
            tabIndex: -1,
            ref: dialogRef,
          },
          h(
            'div',
            { className: 'dss-dialog-head' },
            h(
              'div',
              { className: 'dss-dialog-copy' },
              h('h2', null, titleText),
              h(
                'p',
                null,
                dialog.mode === 'delete'
                  ? `${title} · ${t('dialog.deleteSubtitle')}`
                  : `${title} · ${t('dialog.filesSubtitle')}`,
              ),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dss-icon-btn',
                'aria-label': t('dialog.close'),
                title: t('dialog.close'),
                onClick: closeDialog,
              },
              h(GlyphClose),
            ),
          ),
          h(
            'div',
            { className: 'dss-dialog-body' },
            snapshot.error ? h('div', { className: 'dss-banner dss-banner-error', role: 'alert' }, snapshot.error) : null,
            error ? h('div', { className: 'dss-banner dss-banner-error', role: 'alert' }, error) : null,
            notice ? h('div', { className: 'dss-banner dss-banner-ok', role: 'status' }, notice) : null,
            running ? h('div', { className: 'dss-banner dss-banner-warn' }, t('dialog.running')) : null,
            session === undefined
              ? h(
                  'div',
                  { className: 'dss-empty-files' },
                  snapshot.loading ? t('dialog.loading') : t('dialog.notFound'),
                )
              : dialog.mode === 'delete'
                ? h(
                    'div',
                    { className: 'dss-banner dss-banner-warn' },
                    generated.length > 0
                      ? `${replace(t('dialog.deleteWarning'), { count: generated.length })}${
                          kept > 0 ? ` ${replace(t('dialog.kept'), { count: kept })}` : ''
                        }`
                      : `${t('dialog.deleteNoFiles')}${kept > 0 ? ` ${replace(t('dialog.kept'), { count: kept })}` : ''}`,
                  )
                : h(
                    React.Fragment,
                    null,
                    h(
                      'div',
                      { className: 'dss-stats' },
                      h(
                        'div',
                        { className: 'dss-stat' },
                        h('span', { className: 'dss-stat-label' }, t('dialog.total')),
                        h('span', { className: 'dss-stat-value' }, formatBytes(totalMemory(session))),
                      ),
                      h(
                        'div',
                        { className: 'dss-stat' },
                        h('span', { className: 'dss-stat-label' }, t('dialog.log')),
                        h('span', { className: 'dss-stat-value' }, formatBytes(session.log?.bytes)),
                      ),
                      h(
                        'div',
                        { className: 'dss-stat' },
                        h('span', { className: 'dss-stat-label' }, t('dialog.generated')),
                        h('span', { className: 'dss-stat-value' }, `${generated.length} · ${formatBytes(generatedBytes)}`),
                      ),
                      h(
                        'div',
                        { className: 'dss-stat' },
                        h('span', { className: 'dss-stat-label' }, t('dialog.tracked')),
                        h('span', { className: 'dss-stat-value' }, `${files.length}`),
                      ),
                    ),
                    h(
                      'div',
                      { className: 'dss-cwd' },
                      h('span', { className: 'dss-cwd-label' }, t('dialog.workspace')),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'dss-cwd-value',
                          title: `${t('dialog.openWorkspace')}: ${session.cwd}`,
                          disabled: busy !== null,
                          onClick: () => void openWorkspace(),
                        },
                        h(GlyphFolderOpenOutline, { size: 12 }),
                        h('span', { className: 'dss-cwd-path' }, session.cwd),
                      ),
                    ),
                    files.length === 0
                      ? h('div', { className: 'dss-empty-files' }, t('dialog.emptyFiles'))
                      : h(
                          'div',
                          { className: 'dss-files' },
                          ...files.map((file) =>
                            h(
                              'div',
                              { key: file.path },
                              h(
                                'div',
                                { className: 'dss-file' },
                                h(
                                  'button',
                                  {
                                    type: 'button',
                                    className: 'dss-file-name',
                                    title: `${t('dialog.openFile')}: ${file.path}`,
                                    disabled: busy !== null,
                                    onClick: () => void openFile(file, 'open'),
                                  },
                                  file.display,
                                ),
                                h('span', { className: 'dss-file-size' }, formatBytes(file.size)),
                                h(
                                  'button',
                                  {
                                    type: 'button',
                                    className: 'dss-btn dss-btn-ghost dss-btn-icon',
                                    title: t('dialog.revealFile'),
                                    'aria-label': t('dialog.revealFile'),
                                    disabled: busy !== null,
                                    onClick: () => void openFile(file, 'reveal'),
                                  },
                                  h(GlyphFolderOpenOutline),
                                ),
                                h(
                                  'button',
                                  {
                                    type: 'button',
                                    className: 'dss-btn dss-btn-ghost dss-btn-icon',
                                    title: file.deletable
                                      ? t('file.deletable')
                                      : t(file.protectedReason === 'plugin' ? 'file.plugin' : 'file.protected'),
                                    'aria-label': t('file.deletable'),
                                    disabled: running || !file.deletable || busy !== null,
                                    onClick: () => setConfirmFile(file),
                                  },
                                  h(GlyphTrash),
                                ),
                              ),
                              confirmFile?.path === file.path
                                ? h(
                                    'div',
                                    { className: 'dss-inline-confirm' },
                                    h(
                                      'div',
                                      { className: 'dss-inline-confirm-copy' },
                                      h('strong', null, t('dialog.fileDelete')),
                                      h('span', { title: file.display }, t('dialog.fileDeleteBody')),
                                    ),
                                    h(
                                      'div',
                                      { className: 'dss-inline-confirm-actions' },
                                      h(
                                        'button',
                                        {
                                          type: 'button',
                                          className: 'dss-btn dss-btn-ghost',
                                          onClick: () => setConfirmFile(null),
                                          disabled: busy !== null,
                                        },
                                        t('dialog.cancel'),
                                      ),
                                      h(
                                        'button',
                                        {
                                          type: 'button',
                                          className: 'dss-btn dss-btn-danger',
                                          onClick: () => void deleteFile(file),
                                          disabled: busy !== null,
                                        },
                                        busy === `file:${file.path}` ? t('dialog.fileBusy') : t('dialog.deleteFile'),
                                      ),
                                    ),
                                  )
                                : null,
                            ),
                          ),
                        ),
                  ),
          ),
          h(
            'div',
            { className: 'dss-dialog-foot' },
            h('span', { className: 'dss-footer-spacer' }),
            dialog.mode === 'delete'
              ? h(
                  React.Fragment,
                  null,
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dss-btn dss-btn-danger',
                      onClick: () => void deleteSession(),
                      disabled: running || busy !== null || session === undefined,
                    },
                    busy === 'session' ? t('dialog.fileBusy') : t('dialog.confirmDelete'),
                  ),
                )
              : h(
                  React.Fragment,
                  null,
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dss-btn dss-btn-danger',
                      onClick: () => void deleteAllFiles(),
                      disabled: running || busy !== null || generated.length === 0,
                    },
                    busy === 'files'
                      ? t('dialog.fileBusy')
                      : `${t('dialog.deleteFiles')} (${generated.length})`,
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dss-btn dss-btn-danger',
                      onClick: () => openDialog(dialog.sessionId, 'delete'),
                      disabled: running || busy !== null || session === undefined,
                    },
                    t('dialog.deleteConversation'),
                  ),
                ),
          ),
        ),
      )
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, DICT), 'conversation-cleaner: dictionaries')

      ctx.effect(() => {
        void refresh()
        const onFocus = () => {
          if (document.visibilityState === 'visible') void refresh()
        }
        window.addEventListener('focus', onFocus)
        return () => window.removeEventListener('focus', onFocus)
      }, 'conversation-cleaner: summaries')

      ctx.slots.inject('sidebar.workspaces.session.menu.item', () =>
        ctx.slots.register(
          {
            name: 'sidebar.workspaces.session.menu.item',
            id: 'conversation-cleaner-files',
            order: 350,
            locale: NS,
          },
          FilesMenuItem,
        ),
      )

      ctx.slots.inject('sidebar.workspaces.session.menu.item', () =>
        ctx.slots.register(
          {
            name: 'sidebar.workspaces.session.menu.item',
            id: 'conversation-cleaner-delete',
            order: 500,
            locale: NS,
          },
          DeleteMenuItem,
        ),
      )

      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'conversation-cleaner-dialog',
            locale: NS,
          },
          StorageDialog,
        ),
      )

      ctx.effect(() => {
        const element = document.createElement('style')
        element.dataset.dshPlugin = NS
        element.textContent = styles
        document.head.appendChild(element)
        return () => element.remove()
      }, 'conversation-cleaner: styles')
    }

    return {
      inject: ['slots', 'locale'],
      apply,
    }
  },
})
