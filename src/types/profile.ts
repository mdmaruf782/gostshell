export type OSType = 'windows' | 'macos' | 'linux' | 'android'

export type ProxyProtocol = 'http' | 'https' | 'socks5' | 'socks4'

export interface ProxyConfig {
  mode: 'github' | 'manual'
  /** raw.githubusercontent.com URL of a proxy list (one per line, ip:port or protocol://ip:port) */
  githubUrl?: string
  protocol: ProxyProtocol
  host: string
  port: number
  username?: string
  password?: string
  rotateOnLaunch: boolean
}

export type FingerprintPreset = 'stealth' | 'balanced' | 'realistic'

export interface Fingerprint {
  os: OSType
  browserVersion: string
  userAgent: string
  screen: string
  timezone: string
  language: string
  webgl: 'noise' | 'block' | 'real'
  canvas: 'noise' | 'block' | 'real'
  audio: 'noise' | 'real'
  webrtc: 'mask' | 'block' | 'real'
  fonts: 'randomize' | 'real'
  hardwareConcurrency: number
  deviceMemory: number
  preset: FingerprintPreset
}

export interface Profile {
  id: string
  name: string
  notes: string
  tags: string[]
  color: string
  startUrl: string
  status: 'running' | 'stopped'
  proxy: ProxyConfig
  fingerprint: Fingerprint
  createdAt: number
  lastUsedAt: number | null
}

export interface GithubProxyEntry {
  protocol: ProxyProtocol
  host: string
  port: number
  username?: string
  password?: string
  sourceLine: string
}

export interface ProxySource {
  id: string
  name: string
  url: string
  entries: number
  lastSync: number | null
  status: 'ok' | 'error' | 'idle'
}
