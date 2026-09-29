import { NavLink, Outlet } from 'react-router'
import {
  LayoutDashboard,
  Globe,
  Server,
  Settings as SettingsIcon,
  ShieldCheck,
  CircleDot,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { isNative } from '@/lib/bridge'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/profiles', label: 'Profiles', icon: Globe },
  { to: '/proxies', label: 'GitHub Proxies', icon: Server },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export default function AppLayout() {
  const { profiles } = useStore()
  const running = profiles.filter((p) => p.status === 'running').length
  const native = isNative()

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/40">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide">GhostShell</div>
            <div className="text-[11px] text-zinc-500">Anti-Detect Chromium</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors ${
                  isActive
                    ? 'bg-emerald-500/10 font-medium text-emerald-400 ring-1 ring-emerald-500/25'
                    : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
              {to === '/profiles' && running > 0 && (
                <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  <CircleDot className="h-2.5 w-2.5 animate-pulse" />
                  {running}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-zinc-800 p-4">
          <div className="rounded-md bg-zinc-900 p-3 ring-1 ring-zinc-800">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">Engine</span>
              <span className="font-mono text-zinc-300">
                {native ? 'Chromium (native)' : 'Chromium 130 (sim)'}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">Profiles</span>
              <span className="font-mono text-zinc-300">{profiles.length} / ∞</span>
            </div>
            {native && (
              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Runtime</span>
                <span className="flex items-center gap-1 font-mono text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Electron
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
