import type { Fingerprint, OSType, ProxyConfig, Profile } from '@/types/profile'

export const OS_LABELS: Record<OSType, string> = {
  windows: 'Windows 11',
  macos: 'macOS Sonoma',
  linux: 'Ubuntu 24.04',
  android: 'Android 14',
}

const OS_UA: Record<OSType, string> = {
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  macos:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  linux:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
}

const SCREENS = [
  '1920x1080',
  '1536x864',
  '1366x768',
  '2560x1440',
  '1440x900',
  '1280x720',
]

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
]

const LANGUAGES = ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ja-JP']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function generateFingerprint(os: OSType, preset: Fingerprint['preset']): Fingerprint {
  const stealth = preset === 'stealth'
  return {
    preset,
    os,
    browserVersion: '130.0.6723.91',
    userAgent: OS_UA[os],
    screen: pick(SCREENS),
    timezone: stealth ? 'auto (match proxy IP)' : pick(TIMEZONES),
    language: pick(LANGUAGES),
    webgl: stealth ? 'noise' : 'real',
    canvas: stealth ? 'noise' : 'real',
    audio: stealth ? 'noise' : 'real',
    webrtc: stealth ? 'mask' : 'real',
    fonts: stealth ? 'randomize' : 'real',
    hardwareConcurrency: pick([4, 8, 12, 16]),
    deviceMemory: pick([4, 8, 16]),
  }
}

export function generateProxy(): ProxyConfig {
  return {
    mode: 'github',
    githubUrl: 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.txt',
    protocol: 'http',
    host: '',
    port: 0,
    rotateOnLaunch: true,
  }
}

export function createProfile(name: string, os: OSType, tags: string[]): Profile {
  return {
    id: crypto.randomUUID(),
    name,
    notes: '',
    tags,
    color: pick(['#34d399', '#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#fb7185']),
    startUrl: 'https://whoer.net',
    status: 'stopped',
    proxy: generateProxy(),
    fingerprint: generateFingerprint(os, 'stealth'),
    createdAt: Date.now(),
    lastUsedAt: null,
  }
}

export function seedProfiles(): Profile[] {
  const now = Date.now()
  const seeds: Array<[string, OSType, string[], string]> = [
    ['Ecom — US Store 01', 'windows', ['ecommerce', 'amazon'], 'Main buying profile. Warmed up 3 weeks.'],
    ['Ads — Meta Manager', 'macos', ['ads', 'meta'], 'BM #12. Payment profile attached.'],
    ['Sneaker Bot A', 'windows', ['sneakers'], 'Resi rotating proxies from GitHub list.'],
    ['Research — EU News', 'linux', ['research'], 'Clean cookie jar.'],
    ['Crypto — Wallet Ops', 'macos', ['crypto'], 'Hardware wallet workflow. Never reuse.'],
  ]
  return seeds.map(([name, os, tags, notes], i) => ({
    ...createProfile(name, os, tags),
    notes,
    createdAt: now - (i + 1) * 86400_000 * 3,
    lastUsedAt: i % 2 === 0 ? now - 3600_000 * (i + 2) : null,
    status: i === 0 ? 'running' : 'stopped',
  }))
}
