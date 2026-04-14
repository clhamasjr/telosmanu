import React, { useState } from 'react'
import { NAV, ACCENT, FONT, PERFIS_CONFIG } from '../lib/constants'

const pL = k => PERFIS_CONFIG[k]?.label || k
const pI = k => PERFIS_CONFIG[k]?.icon || '👤'
const pC = k => PERFIS_CONFIG[k]?.cor || '#888'

export default function Layout({ page, setPage, children, vp, user, onLogout, allowedPages }) {
  const [open, setOpen] = useState(false)
  const go = k => { setPage(k); setOpen(false) }
  const W = vp.isDesktop ? 240 : 270
  const navItems = NAV.filter(n => allowedPages?.includes(n.key))

  return <div style={{ fontFamily: FONT, background: '#F1F5F9', color: '#0F172A', minHeight: '100vh', fontSize: 13 }}>
    {!vp.isDesktop && <header style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 56, background: '#FFF', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', padding: '0 16px', zIndex: 200, gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', color: '#334155', fontSize: 22, cursor: 'pointer', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>☰</button>
      <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT, flex: 1 }}>MANUTELOS</div>
      {user && <div style={{ fontSize: 10, color: '#64748B', textAlign: 'right' }}>
        <div style={{ color: '#334155', fontWeight: 600 }}>{user.nome}</div>
        <div style={{ color: pC(user.perfil), fontSize: 9 }}>{pI(user.perfil)} {pL(user.perfil)}</div>
      </div>}
    </header>}
    {!vp.isDesktop && open && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.15)', zIndex: 290 }} onClick={() => setOpen(false)} />}
    <aside style={{
      width: W, background: '#FFF', borderRight: '1px solid #E2E8F0',
      display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 300,
      transform: vp.isDesktop ? 'none' : open ? 'translateX(0)' : `translateX(-${W + 10}px)`,
      transition: 'transform .3s', boxShadow: !vp.isDesktop && open ? '4px 0 20px rgba(0,0,0,.06)' : 'none',
    }}>
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: ACCENT, letterSpacing: 2 }}>MANUTELOS</div>
        <div style={{ fontSize: 9, color: '#94A3B8', letterSpacing: 2, marginTop: 2 }}>GESTÃO DE MANUTENÇÃO</div>
      </div>
      {user && <div style={{ padding: '12px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
        <div style={{ fontSize: 13, color: '#0F172A', fontWeight: 600 }}>{user.nome}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '2px 8px', borderRadius: 20, background: pC(user.perfil) + '15', color: pC(user.perfil), fontWeight: 600 }}>{pI(user.perfil)} {pL(user.perfil)}</span>
          <button onClick={onLogout} style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, color: '#DC2626', fontSize: 10, padding: '3px 8px', cursor: 'pointer', fontFamily: FONT }}>Sair</button>
        </div>
      </div>}
      <nav style={{ flex: 1, padding: '6px 0', overflowY: 'auto' }}>
        {navItems.map(n => <button key={n.key} onClick={() => go(n.key)} style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 20px',
          background: page === n.key ? ACCENT + '10' : 'transparent', border: 'none',
          borderLeft: page === n.key ? `3px solid ${ACCENT}` : '3px solid transparent',
          color: page === n.key ? ACCENT : '#64748B', fontSize: 13, fontFamily: FONT, fontWeight: page === n.key ? 600 : 400,
          cursor: 'pointer', textAlign: 'left', minHeight: 42,
        }}><span style={{ fontSize: 16 }}>{n.icon}</span>{n.label}</button>)}
      </nav>
      <div style={{ padding: '12px 20px', borderTop: '1px solid #E2E8F0', fontSize: 10, color: '#CBD5E1' }}>v3.0 · ManuTelos</div>
    </aside>
    {vp.isMobile && <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 60, background: '#FFF', borderTop: '1px solid #E2E8F0', display: 'flex', zIndex: 200, boxShadow: '0 -1px 4px rgba(0,0,0,0.04)' }}>
      {navItems.slice(0, 6).map(n => <button key={n.key} onClick={() => go(n.key)} style={{
        flex: '1 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 2, background: 'none', border: 'none', cursor: 'pointer',
        color: page === n.key ? ACCENT : '#94A3B8', fontSize: 9, fontFamily: FONT, fontWeight: page === n.key ? 600 : 400, minWidth: 50,
      }}><span style={{ fontSize: 18 }}>{n.icon}</span><span>{n.short}</span></button>)}
    </nav>}
    <main style={{ marginLeft: vp.isDesktop ? W : 0, padding: vp.isMobile ? '68px 16px 76px' : vp.isTablet ? '68px 24px 24px' : '28px 36px', minHeight: '100vh' }}>{children}</main>
  </div>
}
