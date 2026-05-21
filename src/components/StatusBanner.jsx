import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Banner que detecta automaticamente se o Supabase está fora do ar
export default function StatusBanner() {
  const [status, setStatus] = useState('unknown') // unknown | ok | down
  const [lastCheck, setLastCheck] = useState(null)

  const check = async () => {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 8000)
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/status_os?select=id&limit=1`, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (res.ok) setStatus('ok')
      else if (res.status >= 500) setStatus('down')
      else setStatus('ok') // 401/403 ainda significa que tá online
    } catch {
      setStatus('down')
    }
    setLastCheck(new Date())
  }

  useEffect(() => {
    check()
    const interval = setInterval(check, 60000) // checar a cada 1min
    return () => clearInterval(interval)
  }, [])

  if (status !== 'down') return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: 'linear-gradient(90deg, #DC2626 0%, #EF4444 100%)',
      color: '#FFF', padding: '8px 16px',
      fontSize: 12, fontWeight: 600, textAlign: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap',
    }}>
      <span>⚠️ Servidor do banco temporariamente indisponível. Algumas operações podem falhar.</span>
      <button onClick={check} style={{
        background: 'rgba(255,255,255,0.2)', color: '#FFF', border: '1px solid rgba(255,255,255,0.4)',
        borderRadius: 4, padding: '2px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600,
      }}>🔄 Verificar agora</button>
    </div>
  )
}
