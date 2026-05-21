import React, { useState, useEffect, createContext, useContext } from 'react'
import { useViewport } from './hooks/useData'
import Layout from './components/Layout'
import Login from './components/Login'
import StatusBanner from './components/StatusBanner'
import Dashboard from './pages/Dashboard'
import OrdensServico from './pages/OrdensServico'
import { Equipamentos, Mecanicos, Pecas, Areas } from './pages/CadastroPages'
import { Preventiva, Relatorios, Usuarios, Descricoes } from './pages/ExtraPages'
import MapaFabrica from './pages/MapaFabrica'
import { getPaginas, getPermissao } from './lib/constants'

// User context
export const UserContext = createContext(null)
export const useUser = () => useContext(UserContext)

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('manutelos_user')) } catch { return null }
  })
  const [page, setPage] = useState('dashboard')
  const [osStatusFilter, setOsStatusFilter] = useState(null)
  const [qrEquipCode, setQrEquipCode] = useState(null)
  const vp = useViewport()

  // Detectar QR code escaneado (?nova_os=1&equipamento=CODIGO)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const novaOS = params.get('nova_os')
    const equip = params.get('equipamento')
    if (novaOS === '1' && equip && user) {
      setQrEquipCode(equip)
      setPage('ordens')
      // Limpar URL pra não ficar repetindo
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [user])

  const handleLogin = (u) => setUser(u)
  const handleLogout = () => {
    localStorage.removeItem('manutelos_user')
    setUser(null)
    setPage('dashboard')
  }

  // If not logged in, show login
  if (!user) return <><StatusBanner /><Login onLogin={handleLogin} /></>

  const perfil = user.perfil || 'visualizador'
  const allowed = getPaginas(perfil)

  const navigateOS = (statusFilter) => {
    setOsStatusFilter(statusFilter)
    setPage('ordens')
  }

  return (
    <UserContext.Provider value={{ user, perfil, logout: handleLogout }}>
      <StatusBanner />
      <Layout page={page} setPage={(p) => { if (allowed.includes(p)) { setPage(p); if (p !== 'ordens') setOsStatusFilter(null) } }} vp={vp} user={user} onLogout={handleLogout} allowedPages={allowed}>
        {page === 'dashboard' && <Dashboard onNavigate={setPage} onFilterOS={navigateOS} />}
        {page === 'ordens' && <OrdensServico initialStatusFilter={osStatusFilter} onClearFilter={() => setOsStatusFilter(null)} qrEquipCode={qrEquipCode} onQrConsumed={() => setQrEquipCode(null)} />}
        {page === 'equipamentos' && allowed.includes('equipamentos') && <Equipamentos />}
        {page === 'mecanicos' && allowed.includes('mecanicos') && <Mecanicos />}
        {page === 'pecas' && allowed.includes('pecas') && <Pecas />}
        {page === 'areas' && allowed.includes('areas') && <Areas />}
        {page === 'mapa' && allowed.includes('mapa') && <MapaFabrica />}
        {page === 'preventiva' && allowed.includes('preventiva') && <Preventiva />}
        {page === 'relatorios' && allowed.includes('relatorios') && <Relatorios />}
        {page === 'descricoes' && allowed.includes('descricoes') && <Descricoes />}
        {page === 'usuarios' && allowed.includes('usuarios') && <Usuarios />}
      </Layout>
    </UserContext.Provider>
  )
}
