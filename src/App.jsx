import React, { useState } from 'react'
import { useViewport } from './hooks/useData'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import OrdensServico from './pages/OrdensServico'
import { Equipamentos, Mecanicos, Pecas, Areas } from './pages/CadastroPages'
import { Preventiva, Relatorios, Usuarios } from './pages/ExtraPages'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const vp = useViewport()

  return (
    <Layout page={page} setPage={setPage} vp={vp}>
      {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
      {page === 'ordens' && <OrdensServico />}
      {page === 'equipamentos' && <Equipamentos />}
      {page === 'mecanicos' && <Mecanicos />}
      {page === 'pecas' && <Pecas />}
      {page === 'areas' && <Areas />}
      {page === 'preventiva' && <Preventiva />}
      {page === 'relatorios' && <Relatorios />}
      {page === 'usuarios' && <Usuarios />}
    </Layout>
  )
}
