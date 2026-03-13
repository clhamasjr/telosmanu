import React from 'react'
import { ACCENT, FONT, FONT_DISPLAY } from '../lib/constants'

// ─── Styles ───
export const S = {
  input: {
    background: '#1A1A1E', border: '1px solid #2A2A30', borderRadius: 8, color: '#E5E5E5',
    padding: '10px 14px', fontSize: 14, fontFamily: FONT, width: '100%', outline: 'none',
    transition: 'border-color 0.2s', WebkitAppearance: 'none',
  },
  select: {
    background: '#1A1A1E', border: '1px solid #2A2A30', borderRadius: 8, color: '#E5E5E5',
    padding: '10px 14px', fontSize: 14, fontFamily: FONT, width: '100%', outline: 'none',
    appearance: 'none',
  },
  btnPrimary: {
    background: ACCENT, color: '#0A0A0B', border: 'none', borderRadius: 8,
    padding: '12px 20px', fontSize: 14, fontWeight: 700, fontFamily: FONT,
    cursor: 'pointer', transition: 'all 0.2s', minHeight: 44,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  btnSecondary: {
    background: 'transparent', color: '#999', border: '1px solid #2A2A30', borderRadius: 8,
    padding: '10px 16px', fontSize: 13, fontFamily: FONT, cursor: 'pointer',
    minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  btnDanger: {
    background: '#5E1F1F', color: '#EF4444', border: '1px solid #7F2020', borderRadius: 8,
    padding: '10px 16px', fontSize: 13, fontFamily: FONT, cursor: 'pointer', minHeight: 44,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  card: { background: '#141416', border: '1px solid #1F1F23', borderRadius: 10, padding: 20, marginBottom: 16 },
  th: {
    textAlign: 'left', padding: '12px 14px', fontSize: 11, fontWeight: 600, color: '#666',
    textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid #1F1F23', whiteSpace: 'nowrap',
  },
  td: { padding: '12px 14px', borderBottom: '1px solid #1A1A1E', fontSize: 13, verticalAlign: 'middle' },
}

export function badge(color, bg) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: bg || (color + '18'), color, borderRadius: 6,
    padding: '4px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
  }
}

// ─── Components ───
export function StatusBadge({ status }) {
  if (!status) return <span style={badge('#666')}>—</span>
  return <span style={badge(status.cor, status.cor_bg)}>{status.icone} {status.nome}</span>
}

export function PrioridadeBadge({ prioridade }) {
  const colors = { Baixa: '#22C55E', Media: '#F59E0B', Alta: '#EF4444', Urgente: '#DC2626' }
  const labels = { Baixa: 'Baixa', Media: 'Média', Alta: 'Alta', Urgente: 'Urgente' }
  return <span style={badge(colors[prioridade] || '#666')}>{labels[prioridade] || prioridade}</span>
}

export function KPICard({ label, value, accent, sub, small }) {
  return (
    <div style={{
      background: '#141416', border: '1px solid #1F1F23', borderRadius: 10,
      padding: small ? '16px 18px' : '20px 24px', flex: small ? '1 1 45%' : '1 1 170px',
      borderTop: `3px solid ${accent}`, minWidth: 0,
    }}>
      <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: small ? 28 : 36, color: accent, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, isMobile }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'relative', background: '#141416', border: '1px solid #2A2A30',
        borderRadius: isMobile ? '16px 16px 0 0' : 12,
        width: isMobile ? '100%' : '92%', maxWidth: isMobile ? '100%' : 650,
        maxHeight: isMobile ? '92vh' : '85vh', overflow: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', borderBottom: '1px solid #1F1F23', position: 'sticky', top: 0,
          background: '#141416', zIndex: 2,
        }}>
          {isMobile && <div style={{ width: 36, height: 4, background: '#333', borderRadius: 2, position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)' }} />}
          <h3 style={{ margin: 0, fontSize: 15, fontFamily: FONT_DISPLAY, letterSpacing: 1, color: ACCENT }}>{title}</h3>
          <button onClick={onClose} style={{ ...S.btnSecondary, padding: '6px 12px', minHeight: 36 }}>✕</button>
        </div>
        <div style={{ padding: isMobile ? '16px' : '20px 24px' }}>{children}</div>
      </div>
    </div>
  )
}

export function FormField({ label, children, required }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, fontWeight: 600 }}>
        {label} {required && <span style={{ color: ACCENT }}>*</span>}
      </label>
      {children}
    </div>
  )
}

export function EmptyState({ icon, message, action, onAction }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: '#555' }}>
      <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.5 }}>{icon}</div>
      <div style={{ fontSize: 14, marginBottom: 20 }}>{message}</div>
      {action && <button style={S.btnPrimary} onClick={onAction}>{action}</button>}
    </div>
  )
}

export function SearchBar({ value, onChange, placeholder }) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 400 }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#555', fontSize: 14 }}>🔍</span>
      <input style={{ ...S.input, paddingLeft: 36 }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || 'Buscar...'} />
    </div>
  )
}

export function ConfirmDialog({ open, message, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)' }} onClick={onCancel} />
      <div style={{ position: 'relative', background: '#1A1A1E', border: '1px solid #2A2A30', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%' }}>
        <div style={{ fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button style={S.btnSecondary} onClick={onCancel}>Cancelar</button>
          <button style={S.btnDanger} onClick={onConfirm}>Confirmar</button>
        </div>
      </div>
    </div>
  )
}

export function PageHeader({ title, action, actionLabel, isMobile }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
      <h1 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: isMobile ? 22 : 32, letterSpacing: 2, color: ACCENT }}>{title}</h1>
      {action && <button style={S.btnPrimary} onClick={action}>{actionLabel}</button>}
    </div>
  )
}

export function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 48, color: ACCENT, letterSpacing: 4, marginBottom: 16 }}>TELOS</div>
        <div style={{ color: '#666', fontSize: 13 }}>Carregando...</div>
      </div>
    </div>
  )
}

export function fmtDate(d) { return d ? new Date(d).toLocaleDateString('pt-BR') : '—' }
export function fmtDateTime(d) { return d ? new Date(d).toLocaleString('pt-BR') : '—' }
