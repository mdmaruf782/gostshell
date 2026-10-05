import { useState } from 'react'
import { Plus, RefreshCw, Trash2, Github, Zap, Loader2 } from 'lucide-react'
import type { GithubProxyEntry, ProxySource } from '@/types/profile'
import { useStore } from '@/lib/store'
import { fetchGithubProxyList, checkProxyLatency } from '@/lib/githubProxy'
import { testProxyRelayNative } from '@/lib/bridge'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface ParsedPreview {
  sourceId: string
  entries: GithubProxyEntry[]
  checked: Record<string, number | 'fail'>
}

export default function Proxies() {
  const { sources, upsertSource, deleteSource } = useStore()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [syncing, setSyncing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<string, ParsedPreview>>({})

  const addSource = () => {
    if (!url.trim()) return
    upsertSource({
      id: crypto.randomUUID(),
      name: name.trim() || url.split('/').slice(-2).join('/'),
      url: url.trim(),
      entries: 0,
      lastSync: null,
      status: 'idle',
    })
    setName('')
    setUrl('')
    setError(null)
  }

  const syncSource = async (src: ProxySource) => {
    setSyncing(src.id)
    setError(null)
    try {
      const entries = await fetchGithubProxyList(src.url)
      upsertSource({ ...src, entries: entries.length, lastSync: Date.now(), status: 'ok' })
      setPreviews((prev) => ({
        ...prev,
        [src.id]: { sourceId: src.id, entries: entries.slice(0, 12), checked: {} },
      }))
    } catch (e) {
      upsertSource({ ...src, status: 'error' })
      setError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(null)
    }
  }

  const probe = async (srcId: string, entry: GithubProxyEntry) => {
    const key = `${entry.host}:${entry.port}`
    setPreviews((prev) => {
      const p = prev[srcId]
      if (!p) return prev
      return { ...prev, [srcId]: { ...p, checked: { ...p.checked, [key]: -1 } } }
    })
    // Native desktop build: real end-to-end relay test — actually fetches a page THROUGH the proxy.
    const native = await testProxyRelayNative(entry)
    if (native) {
      setPreviews((prev) => {
        const p = prev[srcId]
        if (!p) return prev
        const checked: Record<string, number | 'fail'> = {
          ...p.checked,
          [key]: native.ok && typeof native.ms === 'number' ? native.ms : 'fail',
        }
        return { ...prev, [srcId]: { ...p, checked } }
      })
      if (native.ok && native.ip) {
        toast.success(`Proxy relays traffic`, { description: `${entry.host}:${entry.port} — exit IP ${native.ip}` })
      }
      return
    }
    try {
      const ms = await checkProxyLatency(entry)
      setPreviews((prev) => {
        const p = prev[srcId]
        if (!p) return prev
        return { ...prev, [srcId]: { ...p, checked: { ...p.checked, [key]: ms } } }
      })
    } catch {
      setPreviews((prev) => {
        const p = prev[srcId]
        if (!p) return prev
        return { ...prev, [srcId]: { ...p, checked: { ...p.checked, [key]: 'fail' } } }
      })
    }
  }

  const isGithubUrl = (u: string) =>
    /^https:\/\/(raw\.)?githubusercontent\.com\//.test(u) || /^https:\/\/github\.com\//.test(u)

  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-zinc-100">GitHub Proxy Manager</h1>
      <p className="mt-0.5 text-sm text-zinc-500">
        Point GhostShell at raw proxy lists hosted on GitHub. Profiles pull a live endpoint from
        these lists on launch.
      </p>

      {/* Add source */}
      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr_auto]">
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">Source name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="proxifly/http"
              className="border-zinc-800 bg-zinc-950 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">GitHub raw URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://raw.githubusercontent.com/user/repo/main/proxies.txt"
              className="border-zinc-800 bg-zinc-950 font-mono text-xs"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={addSource}
              disabled={!isGithubUrl(url.trim())}
              className="bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add source
            </Button>
          </div>
        </div>
        {url && !isGithubUrl(url.trim()) && (
          <p className="mt-2 text-[11px] text-amber-500/80">
            URL should be a raw.githubusercontent.com or github.com link.
          </p>
        )}
        {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}
      </div>

      {/* Sources */}
      <div className="mt-5 space-y-4">
        {sources.map((src) => {
          const preview = previews[src.id]
          return (
            <div key={src.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60">
              <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-3.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 ring-1 ring-zinc-700">
                  <Github className="h-4 w-4 text-zinc-300" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-zinc-200">{src.name}</div>
                  <div className="truncate font-mono text-[11px] text-zinc-600">{src.url}</div>
                </div>
                {src.status === 'ok' && (
                  <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                    {src.entries} proxies
                  </Badge>
                )}
                {src.status === 'error' && (
                  <Badge className="border-red-500/30 bg-red-500/10 text-red-400">error</Badge>
                )}
                {src.lastSync && (
                  <span className="hidden text-[11px] text-zinc-600 sm:block">
                    synced {new Date(src.lastSync).toLocaleTimeString()}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={syncing === src.id}
                  onClick={() => syncSource(src)}
                  className="h-7 border-zinc-700 text-xs hover:bg-zinc-800"
                >
                  {syncing === src.id ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-3 w-3" />
                  )}
                  Sync
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteSource(src.id)}
                  className="h-7 w-7 text-zinc-600 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {preview && (
                <div className="divide-y divide-zinc-800/60">
                  <div className="px-5 py-2 text-[10px] uppercase tracking-wide text-zinc-600">
                    Sample of {preview.entries.length} parsed endpoints — probe to test liveness
                  </div>
                  {preview.entries.map((e) => {
                    const key = `${e.host}:${e.port}`
                    const result = preview.checked[key]
                    return (
                      <div key={key} className="flex items-center gap-3 px-5 py-2">
                        <Badge
                          variant="outline"
                          className="w-16 justify-center border-zinc-700 font-mono text-[10px] text-zinc-400"
                        >
                          {e.protocol}
                        </Badge>
                        <span className="font-mono text-xs text-zinc-300">
                          {e.host}:{e.port}
                        </span>
                        {e.username && (
                          <span className="text-[11px] text-zinc-600">auth: {e.username}</span>
                        )}
                        <span className="ml-auto">
                          {result === undefined && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => probe(src.id, e)}
                              className="h-6 gap-1 px-2 text-[11px] text-emerald-400 hover:text-emerald-300"
                            >
                              <Zap className="h-3 w-3" /> Probe
                            </Button>
                          )}
                          {result === -1 && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
                          )}
                          {typeof result === 'number' && result >= 0 && (
                            <span
                              className={`font-mono text-[11px] ${
                                result < 300 ? 'text-emerald-400' : 'text-amber-400'
                              }`}
                            >
                              {result} ms
                            </span>
                          )}
                          {result === 'fail' && (
                            <span className="text-[11px] text-red-400">dead</span>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {sources.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-600">
            No proxy sources yet. Add a GitHub raw URL above.
          </div>
        )}
      </div>
    </div>
  )
}
