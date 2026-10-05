/**
 * GhostShell engine — spawns one isolated Chromium instance per profile
 * using Playwright's persistent contexts (real cookie/storage isolation).
 */
const path = require('node:path')
const fs = require('node:fs')
const net = require('node:net')
const tls = require('node:tls')
const https = require('node:https')
const { chromium } = require('playwright')

const PROTOCOLS = ['http', 'https', 'socks5', 'socks4']
// Lightweight Google endpoint returning HTTP 204 — ideal tunnel test target.
const RELAY_TARGET = { host: 'www.gstatic.com', port: 443, path: '/generate_204' }

/** Locate an installed Google Chrome to use as the engine (looks like a real user browser). */
function detectChromeChannel() {
  const candidates =
    process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : process.platform === 'win32'
        ? [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
          ]
        : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable']
  return candidates.find((p) => fs.existsSync(p)) ? 'chrome' : null
}

/**
 * HTTPS tunnel test — the exact capability the browser needs.
 *
 * Opens a CONNECT tunnel (HTTP proxy / SOCKS5 / SOCKS4a) to a real HTTPS endpoint,
 * verifies the TLS handshake against the REAL certificate (so MITM-hijacking
 * proxies fail this test), and issues a request. Only a genuine 204/200 proves
 * the proxy can relay secure traffic — plain-HTTP responses don't count, since
 * firewalls and captive portals fake those.
 */
function testProxyRelay({ protocol = 'http', host, port, username, password, timeout = 7000, insecure = false }) {
  return new Promise((resolve) => {
    const started = Date.now()
    let socket
    let settled = false
    const finish = (ok, note) => {
      if (settled) return
      settled = true
      try { socket?.destroy() } catch {}
      resolve({ ok, ms: Date.now() - started, note })
    }

    // 1) raw TCP dial
    socket = new net.Socket()
    socket.setTimeout(timeout)
    socket.on('timeout', () => finish(false, 'timeout'))
    socket.on('error', () => finish(false, 'tcp-error'))

    // 2) once tunneled, upgrade to TLS and request
    const startTls = () => {
      const t = tls.connect(
        { socket, servername: RELAY_TARGET.host, ALPNProtocols: ['http/1.1'], rejectUnauthorized: !insecure },
        () => {
          t.write(
            `GET ${RELAY_TARGET.path} HTTP/1.1\r\nHost: ${RELAY_TARGET.host}\r\nConnection: close\r\n\r\n`,
          )
        },
      )
      t.setTimeout(timeout)
      let buf = ''
      t.on('data', (d) => {
        buf += d.toString('latin1')
        const m = buf.match(/HTTP\/[\d.]+\s+(\d{3})/)
        if (m) finish(m[1] === '204' || m[1] === '200', m[1])
      })
      t.on('timeout', () => finish(false, 'tls-timeout'))
      t.on('error', (e) => finish(false, e.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || e.code === 'CERT_HAS_EXPIRED' || e.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ? 'mitm-or-bad-cert' : 'tls-error'))
    }

    socket.connect({ host, port }, () => {
      if (protocol === 'http' || protocol === 'https') {
        const auth =
          username != null && username !== ''
            ? 'Proxy-Authorization: Basic ' + Buffer.from(`${username}:${password ?? ''}`).toString('base64') + '\r\n'
            : ''
        let head = ''
        const onHead = (chunk) => {
          head += chunk.toString('latin1')
          if (/^HTTP\/[\d.]+\s+200/i.test(head)) {
            socket.removeListener('data', onHead)
            startTls()
          } else if (/^HTTP\/[\d.]+\s+\d{3}/i.test(head)) {
            finish(false, 'connect-refused')
          } else if (head.length > 2048) {
            finish(false, 'connect-garbage')
          }
        }
        socket.on('data', onHead)
        socket.write(
          `CONNECT ${RELAY_TARGET.host}:${RELAY_TARGET.port} HTTP/1.1\r\nHost: ${RELAY_TARGET.host}:${RELAY_TARGET.port}\r\n${auth}Connection: close\r\n\r\n`,
        )
      } else if (protocol === 'socks5') {
        const wantsAuth = username != null && username !== ''
        let stage = 'greet'
        const socks5Connect = () => {
          const d = Buffer.from(RELAY_TARGET.host)
          socket.write(
            Buffer.concat([
              Buffer.from([0x05, 0x01, 0x00, 0x03, d.length]),
              d,
              Buffer.from([(RELAY_TARGET.port >> 8) & 0xff, RELAY_TARGET.port & 0xff]),
            ]),
          )
        }
        socket.on('data', (d) => {
          if (stage === 'greet') {
            if (d.length < 2 || d[0] !== 0x05) return finish(false, 'socks5-greeting')
            if (d[1] === 0x00) {
              stage = 'connect'
              socks5Connect()
            } else if (d[1] === 0x02) {
              stage = 'auth'
              const u = Buffer.from(String(username)), p = Buffer.from(String(password ?? ''))
              socket.write(Buffer.concat([Buffer.from([0x01, u.length]), u, Buffer.from([p.length]), p]))
            } else {
              finish(false, 'socks5-auth-method')
            }
          } else if (stage === 'auth') {
            if (d.length >= 2 && d[1] === 0x00) {
              stage = 'connect'
              socks5Connect()
            } else {
              finish(false, 'socks5-auth-failed')
            }
          } else if (stage === 'connect') {
            if (d.length >= 2 && d[1] === 0x00) {
              socket.removeAllListeners('data')
              startTls()
            } else {
              finish(false, 'socks5-connect-failed')
            }
          }
        })
        socket.write(Buffer.from([0x05, wantsAuth ? 0x02 : 0x01, ...(wantsAuth ? [0x00, 0x02] : [0x00])]))
      } else if (protocol === 'socks4') {
        // SOCKS4a: domain is sent in-band, no local DNS needed
        const u = Buffer.from(String(username ?? ''))
        const d = Buffer.from(RELAY_TARGET.host)
        socket.once('data', (conn) => (conn.length >= 2 && conn[1] === 0x5a ? startTls() : finish(false, 'socks4-connect-failed')))
        socket.write(
          Buffer.concat([
            Buffer.from([0x04, 0x01, (RELAY_TARGET.port >> 8) & 0xff, RELAY_TARGET.port & 0xff, 0, 0, 0, 1]),
            u,
            Buffer.from([0x00]),
            d,
            Buffer.from([0x00]),
          ]),
        )
      } else {
        finish(false, 'unknown-protocol')
      }
    })
  })
}

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
function buildInitScript(fp, profileName) {
  const seed = Math.abs([...JSON.stringify(fp)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7))
  return `(() => {
    const SEED = ${seed};
    let s = SEED;
    const rand = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const noise = (v, amt) => v + Math.floor((rand() - 0.5) * 2 * amt);

    // --- per-profile window identity: title bar always shows which profile this is ---
    const PREFIX = ${JSON.stringify((profileName || 'Profile') + ' — ')};
    const fixTitle = () => {
      if (!document.title.startsWith(PREFIX)) {
        document.title = PREFIX + document.title.replace(new RegExp('^.*— '), '');
      }
    };
    fixTitle();
    const titleEl = document.querySelector('title');
    if (titleEl) new MutationObserver(fixTitle).observe(titleEl, { childList: true, characterData: true, subtree: true });
    setInterval(fixTitle, 1500);

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
      const relay = await testProxyRelay({ protocol: p.protocol, host: p.host, port: p.port, username: p.username, password: p.password })
      if (!relay.ok) {
        this.emit('log', { profileId: profile.id, message: `Manual proxy ${p.host}:${p.port} cannot tunnel HTTPS (${relay.note ?? 'failed'}) — launching DIRECT (no proxy)` })
        return { proxy: undefined, directFallback: true }
      }
      return { proxy: { server: `${p.protocol}://${p.host}:${p.port}`, username: p.username, password: p.password }, directFallback: false, exitIp: undefined }
    }
    if (p.mode === 'github' && p.githubUrl) {
      const text = await fetchText(p.githubUrl)
      const entries = parseProxyList(text)
      if (!entries.length) throw new Error('GitHub list parsed but no valid proxies found')

      // TCP screen first (fast), then real HTTPS tunnel tests.
      const candidates = entries
        .map((e) => [Math.random(), e])
        .sort((a, b) => a[0] - b[0])
        .map(([, e]) => e)
        .slice(0, 8)
      this.emit('log', { profileId: profile.id, message: `Tunnel-testing ${candidates.length} proxies from GitHub list (${entries.length} total)…` })
      let tcpAlive = 0
      for (const entry of candidates) {
        const tcp = await this.testProxy({ ...entry, timeout: 3000 })
        if (!tcp.ok) continue
        tcpAlive++
        const relay = await testProxyRelay({ ...entry, timeout: 7000 })
        if (relay.ok) {
          this.emit('log', {
            profileId: profile.id,
            message: `Proxy OK: ${entry.protocol}://${entry.host}:${entry.port} — HTTPS tunnel works (${relay.ms}ms, ${relay.note})`,
          })
          return {
            proxy: { server: `${entry.protocol}://${entry.host}:${entry.port}`, username: entry.username, password: entry.password },
            directFallback: false,
            exitIp: undefined,
          }
        }
        this.emit('log', { profileId: profile.id, message: `  ✗ ${entry.host}:${entry.port} — ${relay.note ?? 'no tunnel'}` })
      }
      this.emit('log', { profileId: profile.id, message: `No tunnel-capable proxy found (${tcpAlive}/${candidates.length} answered TCP). Launching DIRECT so the browser still works — free lists rarely tunnel HTTPS; add a paid proxy in Manual mode.` })
      return { proxy: undefined, directFallback: true }
    }
    return { proxy: undefined, directFallback: false }
  }

  async launch(profile) {
    if (this.sessions.has(profile.id)) throw new Error('Profile already running')
    const dir = path.join(this.profilesDir, profile.id)
    fs.mkdirSync(dir, { recursive: true })

    const { proxy, directFallback, exitIp } = await this.resolveProxy(profile)
    const [w, h] = profile.fingerprint.screen.split('x').map(Number)
    const env = { ...process.env }
    if (profile.fingerprint.timezone && !profile.fingerprint.timezone.startsWith('auto')) {
      env.TZ = profile.fingerprint.timezone
    }

    // Prefer the user's installed Google Chrome: spawned windows look like real
    // Chrome (not "Chrome for Testing"). Fall back to Playwright's Chromium.
    const channel = detectChromeChannel()
    this.emit('log', {
      profileId: profile.id,
      message: channel
        ? `Engine: installed Google Chrome${proxy ? ` via proxy` : ' (direct)'}…`
        : 'Engine: bundled Chromium (install Google Chrome for a more authentic browser)…',
    })

    this.emit('log', { profileId: profile.id, message: 'Spawning browser window…' })
    const context = await chromium.launchPersistentContext(dir, {
      headless: false,
      channel: channel || undefined,
      viewport: { width: w, height: h - 80 },
      userAgent: profile.fingerprint.userAgent,
      proxy,
      env,
      ignoreDefaultArgs: ['--enable-automation', '--enable-automation-extensions'],
      args: [
        '--disable-blink-features=AutomationControlled',
        `--window-size=${w},${h}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    })

    await context.addInitScript(buildInitScript(profile.fingerprint, profile.name))
    const page = await context.newPage()
    const startUrl = profile.startUrl || 'https://whoer.net'
    try {
      await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      this.emit('log', { profileId: profile.id, message: `Loaded ${startUrl}` })
    } catch (err) {
      // Navigation failed — surface it and retry once in the background.
      this.emit('log', { profileId: profile.id, message: `Navigation to ${startUrl} failed: ${err.message.split('\n')[0]} — retrying…` })
      page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {})
    }

    context.on('close', () => {
      this.sessions.delete(profile.id)
      this.emit('closed', { profileId: profile.id })
    })

    const proc = context.browser()?.process?.()
    const proxyLabel = proxy?.server ?? 'DIRECT'
    this.sessions.set(profile.id, { context, proxyUsed: proxyLabel })
    this.emit('launched', { profileId: profile.id, pid: proc?.pid ?? null, proxy: proxyLabel })
    return { pid: proc?.pid ?? null, proxy: proxyLabel, directFallback: !!directFallback, exitIp, channel: channel ?? 'chromium' }
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

module.exports = { Engine, parseProxyList, testProxyRelay, detectChromeChannel }
