import React, { useState } from 'react'
import { NAV, ACCENT, FONT, FONT_DISPLAY } from '../lib/constants'

export default function Layout({ page, setPage, children, vp }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = (key) => { setPage(key); setSidebarOpen(false) }
  const sidebarWidth = vp.isDesktop ? 230 : 260

  return (
    <div style={{ fontFamily: FONT, background: '#0A0A0B', color: '#E5E5E5', minHeight: '100vh', fontSize: 13 }}>
      {/* Mobile top bar */}
      {!vp.isDesktop && (
        <header style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 56, background: '#111113',
          borderBottom: '1px solid #1F1F23', display: 'flex', alignItems: 'center',
          padding: '0 16px', zIndex: 200, gap: 12,
        }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            background: 'none', border: 'none', color: '#E5E5E5', fontSize: 22, cursor: 'pointer',
            width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>☰</button>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: ACCENT, letterSpacing: 3 }}>TELOS</div>
        </header>
      )}

      {/* Sidebar overlay */}
      {!vp.isDesktop && sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 290 }}
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside style={{
        width: sidebarWidth, background: '#111113', borderRight: '1px solid #1F1F23',
        display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 300,
        transform: vp.isDesktop ? 'none' : sidebarOpen ? 'translateX(0)' : `translateX(-${sidebarWidth + 10}px)`,
        transition: 'transform 0.3s cubic-bezier(.4,0,.2,1)',
        boxShadow: !vp.isDesktop && sidebarOpen ? '4px 0 24px rgba(0,0,0,0.5)' : 'none',
      }}>
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid #1F1F23' }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 32, color: ACCENT, letterSpacing: 4, lineHeight: 1 }}>TELOS</div>
          <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginTop: 4 }}>GESTÃO DE MANUTENÇÃO</div>
        </div>
        <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => navigate(n.key)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '12px 18px', background: page === n.key ? '#1A1A1E' : 'transparent',
              border: 'none', borderLeft: page === n.key ? `3px solid ${ACCENT}` : '3px solid transparent',
              color: page === n.key ? ACCENT : '#888', fontSize: 13, fontFamily: FONT,
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', minHeight: 44,
            }}>
              <span style={{ fontSize: 18 }}>{n.icon}</span> {n.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: '14px 18px', borderTop: '1px solid #1F1F23', fontSize: 10, color: '#444' }}>
          v2.0 · Fábrica de Algodão
        </div>
      </aside>

      {/* Mobile bottom nav */}
      {vp.isMobile && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, height: 64, background: '#111113',
          borderTop: '1px solid #1F1F23', display: 'flex', zIndex: 200,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => navigate(n.key)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 2, background: 'none', border: 'none', cursor: 'pointer',
              color: page === n.key ? ACCENT : '#666', fontSize: 10, fontFamily: FONT,
            }}>
              <span style={{ fontSize: 20 }}>{n.icon}</span>
              <span>{n.short}</span>
            </button>
          ))}
        </nav>
      )}

      {/* Main content */}
      <main style={{
        marginLeft: vp.isDesktop ? sidebarWidth : 0,
        padding: vp.isMobile ? '72px 16px 80px' : vp.isTablet ? '72px 24px 24px' : '24px 32px',
        minHeight: '100vh',
      }}>
        {children}
      </main>
    </div>
  )
}
