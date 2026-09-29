import { useMemo, useState } from 'react'
import { Plus, Search, Globe } from 'lucide-react'
import { toast } from 'sonner'
import type { Profile } from '@/types/profile'
import { useStore } from '@/lib/store'
import { isNative, launchProfileNative } from '@/lib/bridge'
import ProfileCard from '@/components/ProfileCard'
import ProfileDialog from '@/components/ProfileDialog'
import BrowserWindow from '@/components/BrowserWindow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function Profiles() {
  const { profiles, stopProfile } = useStore()
  const [query, setQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [active, setActive] = useState<Profile | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.notes.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [profiles, query])

  const openEdit = (p: Profile) => {
    setEditing(p)
    setDialogOpen(true)
  }

  const handleLaunch = async (p: Profile) => {
    if (!isNative()) {
      // Web fallback: simulated sub-browser window
      setActive(p)
      return
    }
    const res = await launchProfileNative(p)
    if (res.ok) {
      toast.success(`${p.name} launched`, {
        description: `Chromium instance started (pid ${res.pid ?? 'n/a'}) — routing via ${res.proxy}`,
      })
    } else {
      stopProfile(p.id)
      toast.error(`Failed to launch ${p.name}`, { description: res.error })
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Browser Profiles</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Each profile is an isolated Chromium instance with its own fingerprint, proxy and
            cookie jar.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
          className="bg-emerald-600 text-white hover:bg-emerald-500"
        >
          <Plus className="mr-1.5 h-4 w-4" /> New profile
        </Button>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, tag, notes…"
            className="border-zinc-800 bg-zinc-900 pl-9 text-sm"
          />
        </div>
        <span className="text-xs text-zinc-600">
          {filtered.length} of {profiles.length} profiles
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center text-center">
          <Globe className="h-10 w-10 text-zinc-700" />
          <p className="mt-4 text-sm font-medium text-zinc-400">No profiles found</p>
          <p className="mt-1 text-xs text-zinc-600">
            {query ? 'Try a different search.' : 'Create your first isolated browser profile.'}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((p) => (
            <ProfileCard key={p.id} profile={p} onEdit={openEdit} onLaunch={handleLaunch} />
          ))}
        </div>
      )}

      <ProfileDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      {active && (
        <BrowserWindow
          profile={profiles.find((p) => p.id === active.id) ?? active}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  )
}
