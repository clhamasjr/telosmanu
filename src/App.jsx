import React, { useState, useEffect, createContext, useContext } from 'react'
import { useViewport } from './hooks/useData'
import Layout from './components/Layout'
import Login from './components/Login'
import Dashboard from './pages/Dashboard'
import OrdensServico from './pages/OrdensServico'
import { Equipamentos, Mecanicos, Pecas, Areas } from './pages/CadastroPages'
import { Preventiva, Relatorios, Usuarios, Descricoes } from './pages/ExtraPages'
import { getPaginas, getPermissao } from './lib/constants'

// User context
export const UserContext = createContext(null)
export const useUser = () => useContext(UserContext)

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('telos_user')) } catch { return null }
  })
  const [page, setPage] = useState('dashboard')
  const [osStatusFilter, setOsStatusFilter] = useState(null)
  const vp = useViewport()

  const handleLogin = (u) => setUser(u)
  const handleLogout = () => {
    localStorage.removeItem('telos_user')
    setUser(null)
    setPage('dashboard')
  }

  // If not logged in, show login
  if (!user) return <Login onLogin={handleLogin} />

  const perfil = user.perfil || 'visualizador'
  const allowed = getPaginas(perfil)

  const navigateOS = (statusFilter) => {
    setOsStatusFilter(statusFilter)
    setPage('ordens')
  }

  return (
    <UserContext.Provider value={{ user, perfil, logout: handleLogout }}>
      <Layout page={page} setPage={(p) => { if (allowed.includes(p)) { setPage(p); if (p !== 'ordens') setOsStatusFilter(null) } }} vp={vp} user={user} onLogout={handleLogout} allowedPages={allowed}>
        {page === 'dashboard' && <Dashboard onNavigate={setPage} onFilterOS={navigateOS} />}
        {page === 'ordens' && <OrdensServico initialStatusFilter={osStatusFilter} onClearFilter={() => setOsStatusFilter(null)} />}
        {page === 'equipamentos' && allowed.includes('equipamentos') && <Equipamentos />}
        {page === 'mecanicos' && allowed.includes('mecanicos') && <Mecanicos />}
        {page === 'pecas' && allowed.includes('pecas') && <Pecas />}
        {page === 'areas' && allowed.includes('areas') && <Areas />}
        {page === 'preventiva' && allowed.includes('preventiva') && <Preventiva />}
        {page === 'relatorios' && allowed.includes('relatorios') && <Relatorios />}
        {page === 'descricoes' && allowed.includes('descricoes') && <Descricoes />}
        {page === 'usuarios' && allowed.includes('usuarios') && <Usuarios />}
      </Layout>
    </UserContext.Provider>
  )
}
