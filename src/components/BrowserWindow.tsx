import { useEffect, useMemo, useState } from 'react'
import {
  X,
  Minus,
  Square,
  Plus,
  RotateCw,
  ArrowLeft,
  ArrowRight,
  Lock,
  ShieldCheck,
  Fingerprint,
  Monitor,
  Languages,
  Clock,
  Cpu,
} from 'lucide-react'
import type { Profile } from '@/types/profile'
import { OS_LABELS } from '@/lib/fingerprint'
import { useStore } from '@/lib/store'

interface Props {
  profile: Profile
  onClose: () => void
}

function seededIp(id: string): string {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return `${(h % 223) + 1}.${(h >> 8) % 255}.${(h >> 16) % 255}.${(h >> 24) % 255}`
}

export default function BrowserWindow({ profile, onClose }: Props) {
  const { stopProfile } = useStore()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'page' | 'fp'>('page')

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1400)
    return () => clearTimeout(t)
  }, [])

  const ip = useMemo(() => seededIp(profile.id), [profile.id])
  const fp = profile.fingerprint

  const close = () => {
    stopProfile(profile.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="flex h-[560px] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/60">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-3 py-2">
          <div className="flex gap-1.5">
            <button
              onClick={close}
              className="flex h-3 w-3 items-center justify-center rounded-full bg-red-500/80 text-[8px] text-red-950 hover:bg-red-400"
            >
              <X className="h-2 w-2" />
            </button>
            <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
            <span className="h-3 w-3 rounded-full bg-green-500/80" />
          </div>
          <div className="ml-2 flex min-w-0 items-center gap-2 rounded-md bg-zinc-900 px-3 py-1 ring-1 ring-zinc-800">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: profile.color }} />
            <span className="truncate text-[11px] font-medium text-zinc-300">{profile.name}</span>
            <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
              ISOLATED
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1 text-zinc-600">
            <Minus className="h-3.5 w-3.5" />
            <Square className="h-3 w-3" />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-3 py-1.5">
          <ArrowLeft className="h-3.5 w-3.5 text-zinc-600" />
          <ArrowRight className="h-3.5 w-3.5 text-zinc-600" />
          <RotateCw
            className="h-3.5 w-3.5 cursor-pointer text-zinc-500 hover:text-zinc-300"
            onClick={() => {
              setLoading(true)
              setTab('page')
              setTimeout(() => setLoading(false), 900)
            }}
          />
          <div className="flex flex-1 items-center gap-2 rounded-full bg-zinc-900 px-3 py-1 ring-1 ring-zinc-800">
            <Lock className="h-3 w-3 text-emerald-500" />
            <span className="truncate font-mono text-[11px] text-zinc-400">
              {profile.startUrl.replace('https://', '')}
            </span>
            <span className="ml-auto shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] text-zinc-500">
              via {profile.proxy.mode === 'github' ? 'github list' : profile.proxy.protocol} · {ip}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setTab('page')}
              className={`rounded px-2 py-1 text-[10px] font-medium ${
                tab === 'page' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Page
            </button>
            <button
              onClick={() => setTab('fp')}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium ${
                tab === 'fp' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Fingerprint className="h-3 w-3" /> Fingerprint
            </button>
          </div>
          <Plus className="h-3.5 w-3.5 text-zinc-500" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-zinc-950 p-5">
          {tab === 'page' ? (
            loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
                <span className="font-mono text-xs text-zinc-500">
                  Routing through proxy {ip}…
                </span>
              </div>
            ) : (
              <div className="mx-auto max-w-lg space-y-4">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                    <span className="text-sm font-semibold text-zinc-100">Ghost Check passed</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                    This isolated Chromium instance is presenting the fingerprint configured for{' '}
                    <span className="text-zinc-300">{profile.name}</span>. Cookies, storage and
                    cache are sandboxed in a dedicated data directory — nothing leaks between
                    profiles.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['IP address', ip],
                    ['Proxy', profile.proxy.mode === 'github' ? 'GitHub rotating list' : `${profile.proxy.protocol}://${profile.proxy.host}`],
                    ['Platform', OS_LABELS[fp.os]],
                    ['Screen', fp.screen],
                    ['Timezone', fp.timezone],
                    ['Language', fp.language],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-md bg-zinc-900 p-3 ring-1 ring-zinc-800">
                      <div className="text-[10px] uppercase tracking-wide text-zinc-600">{k}</div>
                      <div className="mt-1 truncate font-mono text-xs text-zinc-200">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="mx-auto max-w-lg space-y-2">
              <div className="pb-2 text-[11px] uppercase tracking-wide text-zinc-600">
                What this browser reports to the web
              </div>
              {[
                { icon: Fingerprint, k: 'User-Agent', v: fp.userAgent },
                { icon: Monitor, k: 'Screen', v: `${fp.screen} @1x (window.outer matches)` },
                { icon: Languages, k: 'navigator.language', v: fp.language },
                { icon: Clock, k: 'Timezone', v: fp.timezone },
                { icon: Cpu, k: 'Hardware', v: `${fp.hardwareConcurrency} cores · ${fp.deviceMemory} GB RAM` },
              ].map(({ icon: Icon, k, v }) => (
                <div
                  key={k}
                  className="flex items-start gap-3 rounded-md bg-zinc-900 p-3 ring-1 ring-zinc-800"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-zinc-600">{k}</div>
                    <div className="break-all font-mono text-[11px] text-zinc-300">{v}</div>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-1.5 pt-2">
                {(
                  [
                    ['WebGL', fp.webgl],
                    ['Canvas', fp.canvas],
                    ['Audio', fp.audio],
                    ['WebRTC', fp.webrtc],
                    ['Fonts', fp.fonts],
                  ] as const
                ).map(([k, v]) => (
                  <span
                    key={k}
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                      v === 'real'
                        ? 'bg-zinc-800 text-zinc-400'
                        : 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30'
                    }`}
                  >
                    {k}: {v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-4 border-t border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[10px] text-zinc-600">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Connected
          </span>
          <span className="font-mono">pid {4200 + (profile.id.charCodeAt(0) % 500)}</span>
          <span className="ml-auto font-mono">Chromium 130.0.6723.91</span>
        </div>
      </div>
    </div>
  )
}
