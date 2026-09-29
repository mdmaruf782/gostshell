import { useState } from 'react'
import { RotateCcw, Trash2, AlertTriangle } from 'lucide-react'
import { useStore } from '@/lib/store'
import { seedProfiles } from '@/lib/fingerprint'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export default function Settings() {
  const { profiles, sources } = useStore()
  const [confirmReset, setConfirmReset] = useState(false)

  const reset = () => {
    localStorage.removeItem('ghostshell.profiles.v1')
    localStorage.removeItem('ghostshell.sources.v1')
    window.location.reload()
  }

  return (
    <div className="max-w-2xl p-8">
      <h1 className="text-lg font-semibold text-zinc-100">Settings</h1>
      <p className="mt-0.5 text-sm text-zinc-500">Engine and workspace configuration.</p>

      <div className="mt-6 space-y-4">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-sm font-medium text-zinc-200">Chromium engine</h2>
          <div className="mt-4 space-y-1 text-xs">
            {[
              ['Binary', 'chromium-130.0.6723.91 (bundled)'],
              ['Automation driver', 'Playwright / CDP'],
              ['Profile data dir', '~/.ghostshell/profiles/'],
              ['Cookie storage', 'AES-256 encrypted per profile'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-zinc-800/60 py-2 last:border-0">
                <span className="text-zinc-500">{k}</span>
                <span className="font-mono text-zinc-300">{v}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-sm font-medium text-zinc-200">Anti-detect defaults</h2>
          <div className="mt-4 space-y-4">
            {[
              ['Mask WebRTC local IPs', true],
              ['Auto-match timezone to proxy geolocation', true],
              ['Block leaked local IP via WebRTC', false],
              ['Noise-inject Canvas reads', true],
            ].map(([label, on]) => (
              <div key={label as string} className="flex items-center justify-between">
                <Label className="text-xs text-zinc-400">{label}</Label>
                <Switch defaultChecked={on as boolean} />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-sm font-medium text-zinc-200">Workspace</h2>
          <div className="mt-4 space-y-1 text-xs">
            <div className="flex justify-between border-b border-zinc-800/60 py-2">
              <span className="text-zinc-500">Profiles stored</span>
              <span className="font-mono text-zinc-300">{profiles.length}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-800/60 py-2">
              <span className="text-zinc-500">Proxy sources</span>
              <span className="font-mono text-zinc-300">{sources.length}</span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                localStorage.setItem('ghostshell.profiles.v1', JSON.stringify(seedProfiles()))
                window.location.reload()
              }}
              className="border-zinc-700 text-xs hover:bg-zinc-800"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reseed demo data
            </Button>
            {!confirmReset ? (
              <Button
                variant="outline"
                onClick={() => setConfirmReset(true)}
                className="border-red-900/50 text-xs text-red-400 hover:bg-red-950/40"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Reset workspace
              </Button>
            ) : (
              <Button
                onClick={reset}
                className="bg-red-600 text-xs text-white hover:bg-red-500"
              >
                <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Confirm — erase everything
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
