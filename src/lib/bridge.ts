import type { Profile } from '@/types/profile'

export interface LaunchResult {
  ok: boolean
  pid?: number | null
  proxy?: string
  directFallback?: boolean
  exitIp?: string
  channel?: string
  error?: string
}

export interface ProxyTestResult {
  ok: boolean
  alive?: boolean
  ms?: number
  error?: string
}

interface GhostBridge {
  launch: (profile: Profile) => Promise<LaunchResult>
  stop: (profileId: string) => Promise<{ ok: boolean }>
  testProxy: (cfg: { protocol: string; host: string; port: number }) => Promise<ProxyTestResult>
  testProxyRelay: (cfg: {
    protocol: string
    host: string
    port: number
  }) => Promise<ProxyTestResult & { ip?: string }>
  state: () => Promise<{ platform: string }>
  onEngineEvent: (
    cb: (event: 'launched' | 'closed' | 'log', payload: Record<string, unknown>) => void,
  ) => () => void
}

declare global {
  interface Window {
    ghost?: GhostBridge
  }
}

/** True when running inside the Electron shell with the native bridge. */
export const isNative = () => typeof window !== 'undefined' && !!window.ghost

export async function launchProfileNative(profile: Profile): Promise<LaunchResult> {
  if (!window.ghost) return { ok: false, error: 'Native bridge unavailable' }
  return window.ghost.launch(profile)
}

export async function stopProfileNative(profileId: string) {
  if (!window.ghost) return
  await window.ghost.stop(profileId)
}

export async function testProxyNative(cfg: {
  protocol: string
  host: string
  port: number
}): Promise<ProxyTestResult | null> {
  if (!window.ghost) return null
  return window.ghost.testProxy(cfg)
}

export async function testProxyRelayNative(cfg: {
  protocol: string
  host: string
  port: number
}): Promise<(ProxyTestResult & { ip?: string }) | null> {
  if (!window.ghost) return null
  return window.ghost.testProxyRelay(cfg)
}
