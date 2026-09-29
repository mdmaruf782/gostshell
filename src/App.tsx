import { Routes, Route } from 'react-router'
import { Toaster } from 'sonner'
import { StoreProvider } from '@/lib/store'
import AppLayout from '@/components/AppLayout'
import Dashboard from '@/pages/Dashboard'
import Profiles from '@/pages/Profiles'
import Proxies from '@/pages/Proxies'
import Settings from '@/pages/Settings'

export default function App() {
  return (
    <StoreProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/profiles" element={<Profiles />} />
          <Route path="/proxies" element={<Proxies />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
      <Toaster theme="dark" position="bottom-right" richColors />
    </StoreProvider>
  )
}
