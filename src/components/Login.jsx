import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ACCENT, FONT } from '../lib/constants'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login') // login | reset
  const [novaSenha, setNovaSenha] = useState('')
  const [masterCode, setMasterCode] = useState('')
  const [info, setInfo] = useState('')

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
      if (!res.ok || result.error) {
        // Detectar quando é erro de servidor (Cloudflare 521 etc) vs credencial
        if (res.status >= 500 || result.error?.includes?.('521') || result.error?.includes?.('DOCTYPE')) {
          setErro('Servidor do banco temporariamente indisponível. Tente novamente em alguns minutos.')
        } else {
          setErro(result.error || 'Email ou senha incorretos')
        }
        setLoading(false); return
      }
      localStorage.setItem('manutelos_user', JSON.stringify(result.user))
      onLogin(result.user); setLoading(false)
    } catch {
      setErro('Erro de conexão. Verifique sua internet e tente novamente.'); setLoading(false)
    }
  }

  const resetar = async (e) => {
    e.preventDefault()
    if (!email.trim() || !novaSenha.trim() || !masterCode.trim()) { setErro('Preencha todos os campos'); return }
    if (novaSenha.length < 6) { setErro('Nova senha precisa ter pelo menos 6 caracteres'); return }
    setLoading(true); setErro(''); setInfo('')
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: 'emergency_reset', email: email.trim().toLowerCase(), nova_senha: novaSenha.trim(), master_code: masterCode.trim() })
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        if (res.status >= 500 || (typeof result.error === 'string' && (result.error.includes('521') || result.error.includes('DOCTYPE')))) {
          setErro('Servidor do banco indisponível. Tente novamente em alguns minutos.')
        } else {
          setErro(result.error || 'Falha no reset')
        }
        setLoading(false); return
      }
      setInfo(`Senha resetada com sucesso para ${result.user?.nome || email}. Faça login com a nova senha.`)
      setMode('login'); setSenha(novaSenha); setNovaSenha(''); setMasterCode(''); setLoading(false)
    } catch {
      setErro('Erro de conexão. Tente novamente.'); setLoading(false)
    }
  }

  return <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 50%, #F8FAFC 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 20 }}>
    <div style={{ background: '#FFF', borderRadius: 20, padding: '48px 40px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.08)', border: '1px solid #E2E8F0' }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: 48, fontWeight: 900, color: ACCENT, letterSpacing: 4 }}>MANUTELOS</div>
        <div style={{ fontSize: 11, color: '#94A3B8', letterSpacing: 3, marginTop: 4 }}>GESTÃO DE MANUTENÇÃO</div>
      </div>
      {info && <div style={{ background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: '#15803D', textAlign: 'center' }}>{info}</div>}

      {mode === 'login' ? <form onSubmit={entrar}>
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
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button type="button" onClick={() => { setMode('reset'); setErro(''); setInfo('') }} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>Esqueci minha senha</button>
        </div>
      </form> : <form onSubmit={resetar}>
        <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 11, color: '#92400E' }}>
          🔐 <b>Reset de Senha</b> — solicite o código de emergência ao administrador do sistema.
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 6, letterSpacing: .5 }}>EMAIL DO USUÁRIO</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com"
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, color: '#0F172A', padding: '12px 14px', fontSize: 14, fontFamily: FONT, width: '100%', outline: 'none' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 6, letterSpacing: .5 }}>NOVA SENHA</label>
          <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="••••••••"
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, color: '#0F172A', padding: '12px 14px', fontSize: 14, fontFamily: FONT, width: '100%', outline: 'none' }} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 6, letterSpacing: .5 }}>CÓDIGO DE EMERGÊNCIA</label>
          <input type="password" value={masterCode} onChange={e => setMasterCode(e.target.value)} placeholder="código fornecido pelo admin"
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, color: '#0F172A', padding: '12px 14px', fontSize: 14, fontFamily: FONT, width: '100%', outline: 'none' }} />
        </div>
        {erro && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: '#DC2626', textAlign: 'center' }}>{erro}</div>}
        <button type="submit" disabled={loading} style={{ background: '#F59E0B', color: '#FFF', border: 'none', borderRadius: 10, padding: '14px 20px', fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: loading ? 'wait' : 'pointer', width: '100%', opacity: loading ? .6 : 1 }}>
          {loading ? 'Resetando...' : '🔐 RESETAR SENHA'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button type="button" onClick={() => { setMode('login'); setErro(''); setInfo('') }} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>← Voltar para login</button>
        </div>
      </form>}
      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 10, color: '#CBD5E1' }}>Fábrica de Algodão Telos · ManuTelos v3.1</div>
    </div>
  </div>
}
