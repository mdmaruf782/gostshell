const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ghost', {
  /** Launch an isolated Chromium instance for a profile. Returns {ok, pid, proxy} or {ok:false, error}. */
  launch: (profile) => ipcRenderer.invoke('gh:launch', profile),
  stop: (profileId) => ipcRenderer.invoke('gh:stop', profileId),
  testProxy: (cfg) => ipcRenderer.invoke('gh:test-proxy', cfg),
  testProxyRelay: (cfg) => ipcRenderer.invoke('gh:test-proxy-relay', cfg),
  state: () => ipcRenderer.invoke('gh:state'),
  /** Subscribe to engine events: launched | closed | log. Returns unsubscribe fn. */
  onEngineEvent: (cb) => {
    const channels = ['gh:engine:launched', 'gh:engine:closed', 'gh:engine:log']
    const listeners = channels.map((ch) => {
      const fn = (_e, payload) => cb(ch.replace('gh:engine:', ''), payload)
      ipcRenderer.on(ch, fn)
      return [ch, fn]
    })
    return () => listeners.forEach(([ch, fn]) => ipcRenderer.removeListener(ch, fn))
  },
})
