/**
 * GhostShell engine — spawns one isolated Chromium instance per profile
 * using Playwright's persistent contexts (real cookie/storage isolation).
 */
const path = require('node:path')
const fs = require('node:fs')
const net = require('node:net')
const https = require('node:https')
const { chromium } = require('playwright')

const PROTOCOLS = ['http', 'https', 'socks5', 'socks4']

/** Parse a GitHub-hosted proxy list (one proxy per line). */
function parseProxyList(text) {
  const entries = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    let protocol = 'http'
    let rest = line
    const protoMatch = line.match(/^([a-zA-Z0-9]+):\/\//)
    if (protoMatch) {
      const p = protoMatch[1].toLowerCase()
      if (PROTOCOLS.includes(p)) protocol = p
      rest = line.slice(protoMatch[0].length)
    }
    if (rest.includes(';')) {
      const parts = rest.split(';')
      if (parts.length >= 2 && /^\d+$/.test(parts[1].trim())) {
        const p = parts[2]?.trim().toLowerCase()
        if (p && PROTOCOLS.includes(p)) protocol = p
        entries.push({ protocol, host: parts[0].trim(), port: parseInt(parts[1], 10) })
        continue
      }
    }
    let username, password
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
    entries.push({ protocol, host, port, username, password })
  }
  return entries
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 10_000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        return fetchText(res.headers.location).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve(data))
    })
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
  })
}

/** Build the fingerprint init script injected into every page of the profile. */
function buildInitScript(fp) {
  const seed = Math.abs([...JSON.stringify(fp)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7))
  return `(() => {
    const SEED = ${seed};
    let s = SEED;
    const rand = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const noise = (v, amt) => v + Math.floor((rand() - 0.5) * 2 * amt);

    // --- navigator basics ---
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => ${fp.hardwareConcurrency} });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => ${fp.deviceMemory} });
    Object.defineProperty(navigator, 'userAgent', { get: () => ${JSON.stringify(fp.userAgent)} });
    Object.defineProperty(navigator, 'platform', { get: () => ${JSON.stringify(
      { windows: 'Win32', macos: 'MacIntel', linux: 'Linux x86_64', android: 'Linux armv81' }[fp.os],
    )} });
    Object.defineProperty(navigator, 'languages', { get: () => ${JSON.stringify([fp.language, 'en'])} });
    Object.defineProperty(navigator, 'language', { get: () => ${JSON.stringify(fp.language)} });

    // --- screen ---
    const [W, H] = ${JSON.stringify(fp.screen.split('x').map(Number))};
    try {
      Object.defineProperty(screen, 'width', { get: () => W });
      Object.defineProperty(screen, 'height', { get: () => H });
      Object.defineProperty(screen, 'availWidth', { get: () => W });
      Object.defineProperty(screen, 'availHeight', { get: () => H - 40 });
      Object.defineProperty(window, 'outerWidth', { get: () => W });
      Object.defineProperty(window, 'outerHeight', { get: () => H });
    } catch (e) {}

    ${fp.webrtc !== 'real' ? `
    // --- WebRTC mask ---
    const FakeRTC = function () { return { createDataChannel(){}, createOffer(){ return Promise.resolve({}) }, setLocalDescription(){}, close(){}, addEventListener(){}, removeEventListener(){} } };
    window.RTCPeerConnection = FakeRTC;
    window.RTCPeerConnection.prototype = {};
    window.webkitRTCPeerConnection = FakeRTC;` : ''}

    ${fp.canvas !== 'real' ? `
    // --- Canvas noise ---
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    const origToBlob = HTMLCanvasElement.prototype.toBlob;
    const perturb = (ctx) => {
      try {
        const img = origGetImageData.call(ctx, 0, 0, 1, 1);
        img.data[0] = noise(img.data[0], 2); img.data[3] = noise(img.data[3], 2);
        ctx.putImageData(img, 0, 0);
      } catch (e) {}
    };
    HTMLCanvasElement.prototype.toDataURL = function (...a) {
      const ctx = this.getContext('2d'); if (ctx) perturb(ctx);
      return origToDataURL.apply(this, a);
    };
    HTMLCanvasElement.prototype.toBlob = function (...a) {
      const ctx = this.getContext('2d'); if (ctx) perturb(ctx);
      return origToBlob.apply(this, a);
    };` : ''}

    ${fp.webgl !== 'real' ? `
    // --- WebGL parameter noise ---
    const origGetParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (p) {
      const v = origGetParameter.call(this, p);
      if (typeof v === 'string' && (p === 37445 || p === 37446)) return v.replace(/[0-9.]+/g, (m) => noise(parseInt(m), 1));
      return v;
    };` : ''}
  })();`
}

class Engine {
  constructor(userDataDir, emit) {
    this.profilesDir = path.join(userDataDir, 'browser-profiles')
    this.emit = emit
    this.sessions = new Map() // profileId -> { context, proxyUsed }
    fs.mkdirSync(this.profilesDir, { recursive: true })
  }

  async resolveProxy(profile) {
    const p = profile.proxy
    if (p.mode === 'manual' && p.host) {
      const check = await this.testProxy({ protocol: p.protocol, host: p.host, port: p.port, timeout: 6000 })
      if (!check.ok) throw new Error(`Manual proxy ${p.host}:${p.port} is not responding (TCP probe failed)`)
      return { server: `${p.protocol}://${p.host}:${p.port}`, username: p.username, password: p.password }
    }
    if (p.mode === 'github' && p.githubUrl) {
      const text = await fetchText(p.githubUrl)
      const entries = parseProxyList(text)
      if (!entries.length) throw new Error('GitHub list parsed but no valid proxies found')

      // Shuffle, then TCP-probe candidates until one actually answers.
      // Public GitHub lists are mostly dead — never hand a corpse to Chromium.
      const candidates = entries
        .map((e) => [Math.random(), e])
        .sort((a, b) => a[0] - b[0])
        .map(([, e]) => e)
        .slice(0, 12)
      this.emit('log', { profileId: profile.id, message: `Probing ${candidates.length} candidates from GitHub list (${entries.length} total)…` })
      for (const entry of candidates) {
        const check = await this.testProxy({ ...entry, timeout: 4000 })
        if (check.ok) {
          this.emit('log', { profileId: profile.id, message: `Assigned ${entry.protocol}://${entry.host}:${entry.port} (alive, ${check.ms}ms)` })
          return {
            server: `${entry.protocol}://${entry.host}:${entry.port}`,
            username: entry.username,
            password: entry.password,
          }
        }
      }
      throw new Error(`No live proxy found — probed ${candidates.length} of ${entries.length} entries. Sync the source or add a better list.`)
    }
    return undefined
  }

  async launch(profile) {
    if (this.sessions.has(profile.id)) throw new Error('Profile already running')
    const dir = path.join(this.profilesDir, profile.id)
    fs.mkdirSync(dir, { recursive: true })

    const proxy = await this.resolveProxy(profile)
    const [w, h] = profile.fingerprint.screen.split('x').map(Number)
    const env = { ...process.env }
    if (profile.fingerprint.timezone && !profile.fingerprint.timezone.startsWith('auto')) {
      env.TZ = profile.fingerprint.timezone
    }

    this.emit('log', { profileId: profile.id, message: 'Spawning Chromium persistent context…' })
    const context = await chromium.launchPersistentContext(dir, {
      headless: false,
      viewport: { width: w, height: h - 80 },
      userAgent: profile.fingerprint.userAgent,
      proxy,
      env,
      args: [
        '--disable-blink-features=AutomationControlled',
        `--window-size=${w},${h}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    })

    await context.addInitScript(buildInitScript(profile.fingerprint))
    const page = await context.newPage()
    const startUrl = profile.startUrl || 'https://whoer.net'
    try {
      await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      this.emit('log', { profileId: profile.id, message: `Loaded ${startUrl}` })
    } catch (err) {
      // Navigation failed (proxy is alive but can't relay, or site is slow) — surface it.
      this.emit('log', { profileId: profile.id, message: `Navigation to ${startUrl} failed: ${err.message.split('\n')[0]}` })
      page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {})
    }

    context.on('close', () => {
      this.sessions.delete(profile.id)
      this.emit('closed', { profileId: profile.id })
    })

    const proc = context.browser()?.process?.()
    this.sessions.set(profile.id, { context, proxyUsed: proxy?.server ?? 'direct' })
    this.emit('launched', { profileId: profile.id, pid: proc?.pid ?? null, proxy: proxy?.server ?? 'direct' })
    return { pid: proc?.pid ?? null, proxy: proxy?.server ?? 'direct' }
  }

  async stop(profileId) {
    const session = this.sessions.get(profileId)
    if (!session) return
    this.sessions.delete(profileId)
    await session.context.close().catch(() => {})
    this.emit('closed', { profileId })
  }

  async stopAll() {
    for (const id of [...this.sessions.keys()]) await this.stop(id)
  }

  isRunning(profileId) {
    return this.sessions.has(profileId)
  }

  /** Real TCP probe through the proxy endpoint (dials host:port). */
  testProxy({ protocol, host, port, timeout = 6000 }) {
    return new Promise((resolve) => {
      const socket = new net.Socket()
      const started = Date.now()
      const done = (ok, ms) => { socket.destroy(); resolve({ ok, ms }) }
      socket.connect({ host, port }, () => {
        if (protocol === 'http' || protocol === 'https') {
          socket.write(`CONNECT example.com:443 HTTP/1.1\r\nHost: example.com:443\r\n\r\n`)
          socket.once('data', () => done(true, Date.now() - started))
          setTimeout(() => done(true, Date.now() - started), timeout)
        } else {
          // SOCKS greeting
          socket.write(Buffer.from([0x05, 0x01, 0x00]))
          socket.once('data', (d) => done(d[0] === 0x05, Date.now() - started))
        }
      })
      socket.setTimeout(timeout, () => done(false, Date.now() - started))
      socket.on('error', () => done(false, Date.now() - started))
    })
  }
}

module.exports = { Engine, parseProxyList }
