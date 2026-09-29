import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Fingerprint, OSType, Profile, ProxyConfig } from '@/types/profile'
import { createProfile, generateFingerprint, OS_LABELS } from '@/lib/fingerprint'
import { useStore } from '@/lib/store'
import { Fingerprint as FpIcon, Globe2, Sparkles } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Profile | null
}

const TIMEZONES = [
  'auto (match proxy IP)',
  'America/New_York',
  'America/Chicago',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
]
const SCREENS = ['1920x1080', '1536x864', '1366x768', '2560x1440', '1440x900', '1280x720']
const LANGUAGES = ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ja-JP']

export default function ProfileDialog({ open, onOpenChange, editing }: Props) {
  const { addProfile, updateProfile } = useStore()
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState('')
  const [startUrl, setStartUrl] = useState('https://whoer.net')
  const [os, setOs] = useState<OSType>('windows')
  const [fp, setFp] = useState<Fingerprint>(() => generateFingerprint('windows', 'stealth'))
  const [proxy, setProxy] = useState<ProxyConfig>(() => ({
    mode: 'github',
    githubUrl:
      'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.txt',
    protocol: 'http',
    host: '',
    port: 0,
    rotateOnLaunch: true,
  }))

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name)
        setNotes(editing.notes)
        setTags(editing.tags.join(', '))
        setStartUrl(editing.startUrl)
        setOs(editing.fingerprint.os)
        setFp({ ...editing.fingerprint })
        setProxy({ ...editing.proxy })
      } else {
        setName('')
        setNotes('')
        setTags('')
        setStartUrl('https://whoer.net')
        setOs('windows')
        setFp(generateFingerprint('windows', 'stealth'))
        setProxy({
          mode: 'github',
          githubUrl:
            'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.txt',
          protocol: 'http',
          host: '',
          port: 0,
          rotateOnLaunch: true,
        })
      }
    }
  }, [open, editing])

  const applyPreset = (preset: Fingerprint['preset']) => {
    setFp(generateFingerprint(os, preset))
  }

  const changeOs = (next: OSType) => {
    setOs(next)
    setFp((prev) => ({ ...generateFingerprint(next, prev.preset), preset: prev.preset }))
  }

  const handleSave = () => {
    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (editing) {
      updateProfile(editing.id, {
        name: name || editing.name,
        notes,
        tags: tagList,
        startUrl,
        fingerprint: fp,
        proxy,
      })
    } else {
      const p = createProfile(name || 'Untitled profile', os, tagList)
      addProfile({ ...p, notes, startUrl, fingerprint: fp, proxy })
    }
    onOpenChange(false)
  }

  const patchFp = (patch: Partial<Fingerprint>) => setFp((prev) => ({ ...prev, ...patch }))
  const patchProxy = (patch: Partial<ProxyConfig>) => setProxy((prev) => ({ ...prev, ...patch }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-base">
            {editing ? `Edit — ${editing.name}` : 'New browser profile'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-2">
          <TabsList className="grid w-full grid-cols-3 bg-zinc-900">
            <TabsTrigger value="general" className="gap-1.5 text-xs">
              <Globe2 className="h-3.5 w-3.5" /> General
            </TabsTrigger>
            <TabsTrigger value="fingerprint" className="gap-1.5 text-xs">
              <FpIcon className="h-3.5 w-3.5" /> Fingerprint
            </TabsTrigger>
            <TabsTrigger value="proxy" className="gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5" /> Proxy
            </TabsTrigger>
          </TabsList>

          {/* ── General ── */}
          <TabsContent value="general" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Profile name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ecom — US Store 02"
                  className="border-zinc-800 bg-zinc-900 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Start URL</Label>
                <Input
                  value={startUrl}
                  onChange={(e) => setStartUrl(e.target.value)}
                  className="border-zinc-800 bg-zinc-900 font-mono text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Tags (comma separated)</Label>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="ecommerce, amazon, warmed"
                  className="border-zinc-800 bg-zinc-900 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Operating system</Label>
                <Select value={os} onValueChange={(v) => changeOs(v as OSType)}>
                  <SelectTrigger className="border-zinc-800 bg-zinc-900 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-zinc-900">
                    {(Object.keys(OS_LABELS) as OSType[]).map((k) => (
                      <SelectItem key={k} value={k} className="text-sm">
                        {OS_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Cookies state, payment profile, warm-up notes…"
                className="border-zinc-800 bg-zinc-900 text-sm"
              />
            </div>
          </TabsContent>

          {/* ── Fingerprint ── */}
          <TabsContent value="fingerprint" className="space-y-4 pt-4">
            <div className="flex gap-2">
              {(['stealth', 'balanced', 'realistic'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => applyPreset(preset)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    fp.preset === preset
                      ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/40'
                      : 'bg-zinc-900 text-zinc-400 ring-1 ring-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">User-Agent</Label>
              <Input
                value={fp.userAgent}
                onChange={(e) => patchFp({ userAgent: e.target.value })}
                className="border-zinc-800 bg-zinc-900 font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Screen resolution</Label>
                <Select value={fp.screen} onValueChange={(v) => patchFp({ screen: v })}>
                  <SelectTrigger className="border-zinc-800 bg-zinc-900 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-zinc-900">
                    {SCREENS.map((s) => (
                      <SelectItem key={s} value={s} className="font-mono text-sm">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Language</Label>
                <Select value={fp.language} onValueChange={(v) => patchFp({ language: v })}>
                  <SelectTrigger className="border-zinc-800 bg-zinc-900 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-zinc-900">
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l} className="font-mono text-sm">
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Timezone</Label>
              <Select value={fp.timezone} onValueChange={(v) => patchFp({ timezone: v })}>
                <SelectTrigger className="border-zinc-800 bg-zinc-900 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-900">
                  {TIMEZONES.map((t) => (
                    <SelectItem key={t} value={t} className="font-mono text-xs">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-5 pt-1">
              {(
                [
                  ['webgl', 'WebGL', ['noise', 'block', 'real']],
                  ['canvas', 'Canvas', ['noise', 'block', 'real']],
                  ['audio', 'AudioContext', ['noise', 'real']],
                  ['webrtc', 'WebRTC', ['mask', 'block', 'real']],
                  ['fonts', 'Font list', ['randomize', 'real']],
                ] as const
              ).map(([key, label, options]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">{label}</Label>
                  <Select
                    value={fp[key]}
                    onValueChange={(v) => patchFp({ [key]: v } as Partial<Fingerprint>)}
                  >
                    <SelectTrigger className="border-zinc-800 bg-zinc-900 text-sm capitalize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-800 bg-zinc-900">
                      {options.map((o) => (
                        <SelectItem key={o} value={o} className="text-sm capitalize">
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="space-y-4 border-t border-zinc-800 pt-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs text-zinc-400">CPU cores</Label>
                  <span className="font-mono text-xs text-emerald-400">{fp.hardwareConcurrency}</span>
                </div>
                <Slider
                  value={[fp.hardwareConcurrency]}
                  onValueChange={([v]) => patchFp({ hardwareConcurrency: v })}
                  min={2}
                  max={16}
                  step={2}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs text-zinc-400">Device memory (GB)</Label>
                  <span className="font-mono text-xs text-emerald-400">{fp.deviceMemory}</span>
                </div>
                <Slider
                  value={[fp.deviceMemory]}
                  onValueChange={([v]) => patchFp({ deviceMemory: v })}
                  min={2}
                  max={32}
                  step={2}
                />
              </div>
            </div>
          </TabsContent>

          {/* ── Proxy ── */}
          <TabsContent value="proxy" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Proxy source</Label>
              <Select
                value={proxy.mode}
                onValueChange={(v) => patchProxy({ mode: v as ProxyConfig['mode'] })}
              >
                <SelectTrigger className="border-zinc-800 bg-zinc-900 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-900">
                  <SelectItem value="github" className="text-sm">
                    GitHub proxy list (auto-rotate)
                  </SelectItem>
                  <SelectItem value="manual" className="text-sm">
                    Manual single proxy
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {proxy.mode === 'github' ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">GitHub raw URL</Label>
                  <Input
                    value={proxy.githubUrl ?? ''}
                    onChange={(e) => patchProxy({ githubUrl: e.target.value })}
                    placeholder="https://raw.githubusercontent.com/user/repo/main/proxies.txt"
                    className="border-zinc-800 bg-zinc-900 font-mono text-xs"
                  />
                  <p className="text-[11px] leading-relaxed text-zinc-500">
                    Points to a raw text file on GitHub — one proxy per line. On every launch,
                    GhostShell pulls the list and assigns a live endpoint to this profile.
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-md bg-zinc-900 p-3 ring-1 ring-zinc-800">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Rotate proxy on launch</div>
                    <div className="text-[11px] text-zinc-500">
                      Always start with a fresh endpoint from the GitHub list
                    </div>
                  </div>
                  <Switch
                    checked={proxy.rotateOnLaunch}
                    onCheckedChange={(v) => patchProxy({ rotateOnLaunch: v })}
                  />
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Protocol</Label>
                  <Select
                    value={proxy.protocol}
                    onValueChange={(v) => patchProxy({ protocol: v as ProxyConfig['protocol'] })}
                  >
                    <SelectTrigger className="border-zinc-800 bg-zinc-900 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-800 bg-zinc-900">
                      {['http', 'https', 'socks5', 'socks4'].map((p) => (
                        <SelectItem key={p} value={p} className="font-mono text-sm">
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Host</Label>
                  <Input
                    value={proxy.host}
                    onChange={(e) => patchProxy({ host: e.target.value })}
                    placeholder="1.2.3.4"
                    className="border-zinc-800 bg-zinc-900 font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Port</Label>
                  <Input
                    type="number"
                    value={proxy.port || ''}
                    onChange={(e) => patchProxy({ port: parseInt(e.target.value, 10) || 0 })}
                    placeholder="8080"
                    className="border-zinc-800 bg-zinc-900 font-mono text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">User</Label>
                    <Input
                      value={proxy.username ?? ''}
                      onChange={(e) => patchProxy({ username: e.target.value })}
                      className="border-zinc-800 bg-zinc-900 font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">Pass</Label>
                    <Input
                      type="password"
                      value={proxy.password ?? ''}
                      onChange={(e) => patchProxy({ password: e.target.value })}
                      className="border-zinc-800 bg-zinc-900 font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-emerald-600 text-white hover:bg-emerald-500">
            {editing ? 'Save changes' : 'Create profile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
