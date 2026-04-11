import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ACCENT, FONT } from '../lib/constants'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  const entrar = async (e) => {
    e.preventDefault()
    if (!email.trim() || !senha.trim()) { setErro('Preencha email e senha'); return }
    setLoading(true); setErro('')
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: 'login', email: email.trim().toLowerCase(), senha: senha.trim() })
      })
      const result = await res.json()
      if (!res.ok || result.error) { setErro(result.error || 'Email ou senha incorretos'); setLoading(false); return }
      localStorage.setItem('telos_user', JSON.stringify(result.user))
      onLogin(result.user); setLoading(false)
    } catch {
      setErro('Erro de conexão. Tente novamente.'); setLoading(false)
    }
  }

  return <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 50%, #F8FAFC 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 20 }}>
    <div style={{ background: '#FFF', borderRadius: 20, padding: '48px 40px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.08)', border: '1px solid #E2E8F0' }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: 48, fontWeight: 900, color: ACCENT, letterSpacing: 4 }}>TELOS</div>
        <div style={{ fontSize: 11, color: '#94A3B8', letterSpacing: 3, marginTop: 4 }}>GESTÃO DE MANUTENÇÃO</div>
      </div>
      <form onSubmit={entrar}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 6, letterSpacing: .5 }}>EMAIL</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email"
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, color: '#0F172A', padding: '14px 16px', fontSize: 14, fontFamily: FONT, width: '100%', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = ACCENT} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 6, letterSpacing: .5 }}>SENHA</label>
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••" autoComplete="current-password"
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, color: '#0F172A', padding: '14px 16px', fontSize: 14, fontFamily: FONT, width: '100%', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = ACCENT} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
        </div>
        {erro && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: '#DC2626', textAlign: 'center' }}>{erro}</div>}
        <button type="submit" disabled={loading} style={{ background: ACCENT, color: '#FFF', border: 'none', borderRadius: 10, padding: '14px 20px', fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: loading ? 'wait' : 'pointer', width: '100%', opacity: loading ? .6 : 1 }}>
          {loading ? 'Entrando...' : 'ENTRAR'}
        </button>
      </form>
      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 10, color: '#CBD5E1' }}>Fábrica de Algodão Telos · v3.0</div>
    </div>
  </div>
}
