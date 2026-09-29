import { Activity, Globe, Server, ShieldCheck, ArrowRight, CircleDot } from 'lucide-react'
import { Link } from 'react-router'
import { useStore } from '@/lib/store'
import { OS_LABELS } from '@/lib/fingerprint'

export default function Dashboard() {
  const { profiles, sources } = useStore()
  const running = profiles.filter((p) => p.status === 'running')
  const totalSources = sources.length
  const okSources = sources.filter((s) => s.status === 'ok').length

  const stats = [
    {
      label: 'Total profiles',
      value: profiles.length,
      sub: 'unlimited capacity',
      icon: Globe,
      tone: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/30',
    },
    {
      label: 'Running now',
      value: running.length,
      sub: running.length ? `${running.length} Chromium instance${running.length > 1 ? 's' : ''} alive` : 'all idle',
      icon: Activity,
      tone: 'text-sky-400 bg-sky-500/10 ring-sky-500/30',
    },
    {
      label: 'Proxy sources',
      value: `${okSources}/${totalSources}`,
      sub: 'GitHub lists synced',
      icon: Server,
      tone: 'text-violet-400 bg-violet-500/10 ring-violet-500/30',
    },
    {
      label: 'Stealth score',
      value: '98%',
      sub: 'avg. across profiles',
      icon: ShieldCheck,
      tone: 'text-amber-400 bg-amber-500/10 ring-amber-500/30',
    },
  ]

  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-zinc-100">Dashboard</h1>
      <p className="mt-0.5 text-sm text-zinc-500">
        Overview of your isolated browser fleet — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map(({ label, value, sub, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">{label}</span>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${tone}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">{value}</div>
            <div className="mt-1 text-[11px] text-zinc-600">{sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Live instances */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
            <span className="text-sm font-medium text-zinc-200">Live instances</span>
            <Link
              to="/profiles"
              className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
            >
              All profiles <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {running.length === 0 && (
              <div className="px-5 py-8 text-center text-xs text-zinc-600">
                No browsers running. Launch a profile to start an isolated session.
              </div>
            )}
            {running.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-zinc-200">{p.name}</div>
                  <div className="text-[11px] text-zinc-600">
                    {OS_LABELS[p.fingerprint.os]} · {p.fingerprint.screen}
                  </div>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 ring-1 ring-emerald-500/25">
                  <CircleDot className="h-2.5 w-2.5 animate-pulse" /> live
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent profiles */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
            <span className="text-sm font-medium text-zinc-200">Recently used</span>
            <Link
              to="/profiles"
              className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
            >
              Open <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {[...profiles]
              .sort((a, b) => (b.lastUsedAt ?? b.createdAt) - (a.lastUsedAt ?? a.createdAt))
              .slice(0, 5)
              .map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-zinc-200">{p.name}</div>
                    <div className="flex gap-1.5 pt-0.5">
                      {p.tags.slice(0, 3).map((t) => (
                        <span key={t} className="rounded-full bg-zinc-800 px-1.5 py-px text-[9px] text-zinc-500">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-[11px] text-zinc-600">
                    {p.lastUsedAt ? new Date(p.lastUsedAt).toLocaleDateString() : 'new'}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
