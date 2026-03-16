import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ACCENT, FONT, FONT_DISPLAY } from '../lib/constants'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  const entrar = async (e) => {
    e.preventDefault()
    if (!email.trim() || !senha.trim()) { setErro('Preencha email e senha'); return }
    setLoading(true); setErro('')

    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .eq('senha', senha.trim())
      .eq('ativo', true)
      .single()

    if (error || !data) {
      setErro('Email ou senha incorretos')
      setLoading(false)
      return
    }

    // Salvar sessão
    localStorage.setItem('telos_user', JSON.stringify(data))
    onLogin(data)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0A0A0B', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 20,
    }}>
      <div style={{
        background: '#141416', border: '1px solid #1F1F23', borderRadius: 16,
        padding: '40px 36px', width: '100%', maxWidth: 400,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontFamily: FONT_DISPLAY, fontSize: 52, color: ACCENT,
            letterSpacing: 6, lineHeight: 1,
          }}>TELOS</div>
          <div style={{
            fontSize: 10, color: '#555', letterSpacing: 3,
            textTransform: 'uppercase', marginTop: 6,
          }}>Gestão de Manutenção Industrial</div>
        </div>

        <form onSubmit={entrar}>
          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: 'block', fontSize: 10, color: '#888',
              textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontWeight: 600,
            }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              style={{
                background: '#1A1A1E', border: '1px solid #2A2A30', borderRadius: 8,
                color: '#E5E5E5', padding: '12px 14px', fontSize: 14, fontFamily: FONT,
                width: '100%', outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = ACCENT}
              onBlur={e => e.target.style.borderColor = '#2A2A30'}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block', fontSize: 10, color: '#888',
              textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontWeight: 600,
            }}>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••"
              autoComplete="current-password"
              style={{
                background: '#1A1A1E', border: '1px solid #2A2A30', borderRadius: 8,
                color: '#E5E5E5', padding: '12px 14px', fontSize: 14, fontFamily: FONT,
                width: '100%', outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = ACCENT}
              onBlur={e => e.target.style.borderColor = '#2A2A30'}
            />
          </div>

          {erro && (
            <div style={{
              background: '#5E1F1F', border: '1px solid #7F2020', borderRadius: 8,
              padding: '10px 14px', marginBottom: 18, fontSize: 12, color: '#EF4444',
              textAlign: 'center',
            }}>{erro}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: ACCENT, color: '#0A0A0B', border: 'none', borderRadius: 8,
              padding: '14px 20px', fontSize: 15, fontWeight: 700, fontFamily: FONT,
              cursor: loading ? 'wait' : 'pointer', width: '100%',
              opacity: loading ? 0.5 : 1, transition: 'all 0.2s',
            }}
          >
            {loading ? 'Entrando...' : 'ENTRAR'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 10, color: '#444' }}>
          Fábrica de Algodão Telos · v3.0
        </div>
      </div>
    </div>
  )
}
