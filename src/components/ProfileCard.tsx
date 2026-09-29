import { Copy, Pencil, Play, Square, Trash2, MoreVertical } from 'lucide-react'
import type { Profile } from '@/types/profile'
import { OS_LABELS } from '@/lib/fingerprint'
import { useStore } from '@/lib/store'
import { isNative, stopProfileNative } from '@/lib/bridge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

interface Props {
  profile: Profile
  onEdit: (p: Profile) => void
  onLaunch: (p: Profile) => void
}

export default function ProfileCard({ profile, onEdit, onLaunch }: Props) {
  const { launchProfile, stopProfile, duplicateProfile, deleteProfile } = useStore()
  const running = profile.status === 'running'

  return (
    <div
      className={`group relative rounded-xl border bg-zinc-900/60 p-4 transition-all hover:border-zinc-600 ${
        running ? 'border-emerald-500/40 ring-1 ring-emerald-500/20' : 'border-zinc-800'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-zinc-950"
            style={{ backgroundColor: profile.color }}
          >
            {profile.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-100">{profile.name}</span>
              {running && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  RUNNING
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">
              {OS_LABELS[profile.fingerprint.os]} · {profile.fingerprint.screen}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onEdit(profile)}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => duplicateProfile(profile.id)}>
              <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-400 focus:text-red-400"
              onClick={() => deleteProfile(profile.id)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {profile.notes && (
        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-zinc-500">{profile.notes}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {profile.tags.map((t) => (
          <span
            key={t}
            className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400"
          >
            {t}
          </span>
        ))}
        <span className="rounded-full bg-zinc-800/60 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
          {profile.proxy.mode === 'github' ? 'github proxy' : `${profile.proxy.protocol} proxy`}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3">
        <span className="text-[11px] text-zinc-600">
          {profile.lastUsedAt
            ? `Last used ${new Date(profile.lastUsedAt).toLocaleDateString()}`
            : 'Never launched'}
        </span>
        {running ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-zinc-700 text-xs hover:bg-zinc-800"
            onClick={async () => {
              if (isNative()) await stopProfileNative(profile.id)
              stopProfile(profile.id)
            }}
          >
            <Square className="mr-1.5 h-3 w-3" /> Stop
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-7 bg-emerald-600 text-xs text-white hover:bg-emerald-500"
            onClick={() => {
              launchProfile(profile.id)
              onLaunch(profile)
            }}
          >
            <Play className="mr-1.5 h-3 w-3" /> Launch
          </Button>
        )}
      </div>
    </div>
  )
}
