import React, { useState } from 'react'
import { NAV, ACCENT, FONT, FONT_DISPLAY } from '../lib/constants'

const perfilLabel = { admin: '⚙️ Admin', gestor: '👔 Gestor', mecanico: '🔧 Mecânico', solicitante: '📝 Solicitante', visualizador: '👁 Visualizador' }
const perfilColor = { admin: '#EF4444', gestor: '#F59E0B', mecanico: '#3B82F6', solicitante: '#22C55E', visualizador: '#888' }

export default function Layout({ page, setPage, children, vp, user, onLogout, allowedPages }) {
  const [open, setOpen] = useState(false)
  const go = k => { setPage(k); setOpen(false) }
  const W = vp.isDesktop ? 230 : 260
  const navItems = NAV.filter(n => allowedPages?.includes(n.key))

  return <div style={{ fontFamily: FONT, background: '#0A0A0B', color: '#E5E5E5', minHeight: '100vh', fontSize: 13 }}>
    {/* Mobile top bar */}
    {!vp.isDesktop && <header style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 56, background: '#111113', borderBottom: '1px solid #1F1F23', display: 'flex', alignItems: 'center', padding: '0 16px', zIndex: 200, gap: 12 }}>
      <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', color: '#E5E5E5', fontSize: 22, cursor: 'pointer', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>☰</button>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: ACCENT, letterSpacing: 3, flex: 1 }}>TELOS</div>
      {user && <div style={{ fontSize: 10, color: '#888', textAlign: 'right' }}>
        <div style={{ color: '#CCC', fontWeight: 600 }}>{user.nome}</div>
        <div style={{ color: perfilColor[user.perfil] }}>{perfilLabel[user.perfil]}</div>
      </div>}
    </header>}

    {/* Overlay */}
    {!vp.isDesktop && open && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 290 }} onClick={() => setOpen(false)} />}

    {/* Sidebar */}
    <aside style={{
      width: W, background: '#111113', borderRight: '1px solid #1F1F23',
      display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 300,
      transform: vp.isDesktop ? 'none' : open ? 'translateX(0)' : `translateX(-${W + 10}px)`,
      transition: 'transform .3s cubic-bezier(.4,0,.2,1)',
      boxShadow: !vp.isDesktop && open ? '4px 0 24px rgba(0,0,0,.5)' : 'none',
    }}>
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid #1F1F23' }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 32, color: ACCENT, letterSpacing: 4, lineHeight: 1 }}>TELOS</div>
        <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginTop: 4 }}>GESTÃO DE MANUTENÇÃO</div>
      </div>

      {/* User info */}
      {user && <div style={{ padding: '12px 18px', borderBottom: '1px solid #1F1F23', background: '#0D0D0F' }}>
        <div style={{ fontSize: 13, color: '#E5E5E5', fontWeight: 600 }}>{user.nome}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <span style={{
            display: 'inline-block', fontSize: 10, padding: '2px 8px', borderRadius: 4,
            background: (perfilColor[user.perfil] || '#888') + '20', color: perfilColor[user.perfil] || '#888',
            fontWeight: 600,
          }}>{perfilLabel[user.perfil] || user.perfil}</span>
          <button onClick={onLogout} style={{
            background: 'none', border: '1px solid #2A2A30', borderRadius: 4,
            color: '#888', fontSize: 9, padding: '3px 8px', cursor: 'pointer', fontFamily: FONT,
          }}>Sair</button>
        </div>
      </div>}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {navItems.map(n => <button key={n.key} onClick={() => go(n.key)} style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 18px',
          background: page === n.key ? '#1A1A1E' : 'transparent', border: 'none',
          borderLeft: page === n.key ? `3px solid ${ACCENT}` : '3px solid transparent',
          color: page === n.key ? ACCENT : '#888', fontSize: 12, fontFamily: FONT,
          cursor: 'pointer', textAlign: 'left', minHeight: 42,
        }}><span style={{ fontSize: 16 }}>{n.icon}</span>{n.label}</button>)}
      </nav>

      <div style={{ padding: '14px 18px', borderTop: '1px solid #1F1F23', fontSize: 10, color: '#444' }}>v3.0 · Telos</div>
    </aside>

    {/* Mobile bottom nav */}
    {vp.isMobile && <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: 60, background: '#111113',
      borderTop: '1px solid #1F1F23', display: 'flex', zIndex: 200,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)', overflowX: 'auto',
    }}>
      {navItems.slice(0, 6).map(n => <button key={n.key} onClick={() => go(n.key)} style={{
        flex: '1 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 2, background: 'none', border: 'none', cursor: 'pointer',
        color: page === n.key ? ACCENT : '#666', fontSize: 9, fontFamily: FONT, minWidth: 50, padding: '0 4px',
      }}><span style={{ fontSize: 18 }}>{n.icon}</span><span>{n.short}</span></button>)}
    </nav>}

    {/* Main */}
    <main style={{
      marginLeft: vp.isDesktop ? W : 0,
      padding: vp.isMobile ? '68px 16px 76px' : vp.isTablet ? '68px 24px 24px' : '24px 32px',
      minHeight: '100vh',
    }}>{children}</main>
  </div>
}
