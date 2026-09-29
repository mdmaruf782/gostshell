import type { GithubProxyEntry, ProxyProtocol } from '@/types/profile'

const PROTOCOLS: ProxyProtocol[] = ['http', 'https', 'socks5', 'socks4']

/**
 * Parse a proxy list fetched from a GitHub raw URL.
 * Supported line formats:
 *   1.2.3.4:8080
 *   http://1.2.3.4:8080
 *   socks5://user:pass@1.2.3.4:1080
 *   1.2.3.4;8080;socks5  (semicolon lists)
 */
export function parseProxyList(text: string): GithubProxyEntry[] {
  const entries: GithubProxyEntry[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    try {
      let protocol: ProxyProtocol = 'http'
      let rest = line
      const protoMatch = line.match(/^([a-zA-Z0-9]+):\/\//)
      if (protoMatch) {
        const p = protoMatch[1].toLowerCase()
        if (PROTOCOLS.includes(p as ProxyProtocol)) protocol = p as ProxyProtocol
        rest = line.slice(protoMatch[0].length)
      }
      // semicolon format: ip;port;proto
      if (rest.includes(';')) {
        const parts = rest.split(';')
        if (parts.length >= 2 && /^\d+$/.test(parts[1].trim())) {
          const p = parts[2]?.trim().toLowerCase()
          if (p && PROTOCOLS.includes(p as ProxyProtocol)) protocol = p as ProxyProtocol
          entries.push({ protocol, host: parts[0].trim(), port: parseInt(parts[1], 10), sourceLine: line })
          continue
        }
      }
      // userinfo@host:port
      let username: string | undefined
      let password: string | undefined
      if (rest.includes('@')) {
        const [auth, hp] = rest.split('@')
        const [u, pw] = auth.split(':')
        username = u || undefined
        password = pw || undefined
        rest = hp
      }
      const lastColon = rest.lastIndexOf(':')
      if (lastColon === -1) continue
      const host = rest.slice(0, lastColon).trim()
      const port = parseInt(rest.slice(lastColon + 1), 10)
      if (!host || !Number.isFinite(port) || port <= 0 || port > 65535) continue
      entries.push({ protocol, host, port, username, password, sourceLine: line })
    } catch {
      // skip unparseable lines
    }
  }
  return entries
}

/** Fetch and parse a proxy list hosted on GitHub (raw URL). */
export async function fetchGithubProxyList(url: string): Promise<GithubProxyEntry[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`GitHub fetch failed: HTTP ${res.status}`)
  const text = await res.text()
  const entries = parseProxyList(text)
  if (entries.length === 0) throw new Error('No valid proxies found in the list')
  return entries
}

/** Probe a proxy endpoint to check liveness (simulated latency measurement). */
export async function checkProxyLatency(_entry: { host: string; port: number }): Promise<number> {
  const started = performance.now()
  // In the real Electron build this does a TCP dial through the proxy.
  // Here we simulate a probe round-trip.
  await new Promise((r) => setTimeout(r, 120 + Math.random() * 480))
  return Math.round(performance.now() - started)
}
