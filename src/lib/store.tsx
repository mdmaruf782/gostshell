import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { Profile, ProxySource } from '@/types/profile'
import { seedProfiles } from './fingerprint'
import { isNative } from './bridge'

interface StoreState {
  profiles: Profile[]
  sources: ProxySource[]
  addProfile: (p: Profile) => void
  updateProfile: (id: string, patch: Partial<Profile>) => void
  deleteProfile: (id: string) => void
  duplicateProfile: (id: string) => void
  launchProfile: (id: string) => void
  stopProfile: (id: string) => void
  upsertSource: (s: ProxySource) => void
  deleteSource: (id: string) => void
}

const StoreContext = createContext<StoreState | null>(null)

const LS_PROFILES = 'ghostshell.profiles.v1'
const LS_SOURCES = 'ghostshell.sources.v1'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>(() => load(LS_PROFILES, seedProfiles()))
  const [sources, setSources] = useState<ProxySource[]>(() =>
    load(LS_SOURCES, [
      {
        id: 'src-default',
        name: 'proxifly/free-proxy-list',
        url: 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.txt',
        entries: 0,
        lastSync: null,
        status: 'idle',
      },
    ]),
  )

  useEffect(() => {
    localStorage.setItem(LS_PROFILES, JSON.stringify(profiles))
  }, [profiles])
  useEffect(() => {
    localStorage.setItem(LS_SOURCES, JSON.stringify(sources))
  }, [sources])

  // Keep UI state in sync when a spawned Chromium window is closed manually.
  useEffect(() => {
    if (!isNative() || !window.ghost) return
    return window.ghost.onEngineEvent((event, payload) => {
      if (event === 'closed' && typeof payload.profileId === 'string') {
        setProfiles((prev) =>
          prev.map((p) => (p.id === payload.profileId ? { ...p, status: 'stopped' } : p)),
        )
      }
      if (event === 'log' && typeof payload.message === 'string') {
        toast.info(payload.message, { description: 'GhostShell engine' })
      }
    })
  }, [])

  const value = useMemo<StoreState>(
    () => ({
      profiles,
      sources,
      addProfile: (p) => setProfiles((prev) => [p, ...prev]),
      updateProfile: (id, patch) =>
        setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p))),
      deleteProfile: (id) => setProfiles((prev) => prev.filter((p) => p.id !== id)),
      duplicateProfile: (id) =>
        setProfiles((prev) => {
          const src = prev.find((p) => p.id === id)
          if (!src) return prev
          const copy: Profile = {
            ...src,
            id: crypto.randomUUID(),
            name: `${src.name} (copy)`,
            status: 'stopped',
            createdAt: Date.now(),
            lastUsedAt: null,
          }
          const idx = prev.findIndex((p) => p.id === id)
          return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]
        }),
      launchProfile: (id) =>
        setProfiles((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: 'running', lastUsedAt: Date.now() } : p)),
        ),
      stopProfile: (id) =>
        setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'stopped' } : p))),
      upsertSource: (s) =>
        setSources((prev) => {
          const idx = prev.findIndex((x) => x.id === s.id)
          if (idx === -1) return [...prev, s]
          return [...prev.slice(0, idx), s, ...prev.slice(idx + 1)]
        }),
      deleteSource: (id) => setSources((prev) => prev.filter((s) => s.id !== id)),
    }),
    [profiles, sources],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreState {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
