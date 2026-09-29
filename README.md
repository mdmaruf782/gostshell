# GhostShell — Anti-Detect Browser

Run **unlimited isolated Chromium browsers** from one desktop app. Every profile is a
separate Chromium instance with its own fingerprint, proxy, cookies, and storage —
websites see each profile as a different computer on a different network.

Built with Electron + React + Playwright (real Chromium, not an embedded webview).

---

## Why you need it

Regular browsers tie everything to one identity. If you run multiple accounts —
e-commerce stores, ad platforms, social accounts, web automation — sites link them
together through your **browser fingerprint** and your **IP address**, and one flagged
account gets the rest banned.

GhostShell separates identities at the browser level:

| Problem | How GhostShell solves it |
| --- | --- |
| Sites link accounts via fingerprint | Each profile spoofs OS, screen, timezone, language, CPU/RAM, Canvas/WebGL/Audio/WebRTC |
| Shared IP exposes all accounts | Each profile routes through its own proxy — auto-assigned from GitHub-hosted proxy lists |
| Cookie/cache cross-contamination | Each profile gets its own Chromium data directory — zero leakage between profiles |
| Detection via `navigator.webdriver` | Automation flag removed, Chromium launched with anti-detection flags |

Typical uses: managing multiple store/ad accounts, affiliate marketing, web scraping
at scale, QA testing geo-targeted content, privacy-sensitive research.

## How it works

```
┌─────────────────────────────────────────────┐
│  GhostShell (Electron control panel)        │
│                                             │
│  Profile A ──► Chromium #1 ──► Proxy IP #1  │
│  Profile B ──► Chromium #2 ──► Proxy IP #2  │
│  Profile C ──► Chromium #3 ──► Proxy IP #3  │
│     … unlimited, fully isolated             │
└─────────────────────────────────────────────┘
```

Clicking **Launch** on a profile:
1. Fetches your GitHub proxy list and **TCP-probes candidates** until it finds a live endpoint
2. Spawns a real Chromium window (`launchPersistentContext`) with its own data directory
3. Injects your fingerprint into every page (navigator, screen, Canvas/WebGL noise, WebRTC mask)
4. Applies the profile timezone via a per-process `TZ` env var

## Install

### From source (this folder)

```bash
cd /Volumes/my-works/software/ghost-shell
npm install                       # install dependencies
npx playwright install chromium   # one-time: download the Chromium binary (~150 MB)
```

### Prebuilt

See `release/` — `GhostShell-x.y.z.dmg` for macOS, `GhostShell-Setup-x.y.z.exe` for Windows.
macOS: open the DMG and drag GhostShell to Applications. If Gatekeeper blocks it
(unsigned local build), right-click → **Open**, or allow it under
System Settings → Privacy & Security.
Windows: run the installer; SmartScreen may warn — click **More info → Run anyway**.

## Run

```bash
npm run dev     # development: Vite hot-reload + Electron
npm start       # production: Electron loads the built app
npm run dist    # build installers into release/
```

## How to use

1. **Profiles** — your fleet. Click **New profile**, name it, set tags and a start URL.
   In the profile editor choose the OS, fingerprint preset (stealth/balanced/realistic)
   or fine-tune each field, and set the proxy.
2. **Proxy per profile** — two modes:
   - *GitHub list*: paste a `raw.githubusercontent.com` URL of a proxy list (one per line:
     `ip:port`, `socks5://user:pass@ip:port`, or `ip;port;proto`). On every launch the
     engine probes the list and assigns a **live** endpoint automatically.
   - *Manual*: fixed `host:port` with optional credentials.
3. **GitHub Proxies** page — add sources, **Sync** to fetch and parse a list,
   **Probe** to test endpoints with a real TCP handshake (HTTP CONNECT / SOCKS5 greeting).
4. **Launch** — a real Chromium window opens, routed through the assigned proxy with
   the profile's fingerprint. Close the window and the profile flips back to stopped.
5. **Cookies & sessions** — each profile keeps its own cookie jar in
   `~/Library/Application Support/ghost-shell/browser-profiles/<id>` (macOS) or
   `%APPDATA%/ghost-shell/browser-profiles/<id>` (Windows). Re-launching a profile
   resumes its session exactly where it left off.

## Notes & honest limits

- Fingerprint spoofing covers the major vectors (navigator, screen, timezone, Canvas,
  WebGL strings, WebRTC) — no tool is 100% undetectable; use responsibly and in
  compliance with the sites' terms and applicable law.
- Free public proxy lists have high mortality; the prober skips dead endpoints, but
  for production work use a paid residential proxy in Manual mode.
- `npm run dev`/`npm start` spawn windows on your desktop; quit with Cmd+Q / Alt+F4.

## Project layout

```
electron/main.cjs      Electron main process: window, IPC, lifecycle
electron/preload.cjs   contextBridge → window.ghost.* API
electron/engine.cjs    Playwright engine: proxy probing, Chromium spawn, fingerprint injection
src/                   React control panel (profiles, fingerprints, GitHub proxy manager)
release/               Built installers (dmg / exe)
```
