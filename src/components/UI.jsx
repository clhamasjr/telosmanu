import React from 'react'
import { ACCENT, FONT, FONT_DISPLAY, PRIO_LABEL, PRIORIDADES } from '../lib/constants'

export const S = {
  input: { background:'#1A1A1E',border:'1px solid #2A2A30',borderRadius:8,color:'#E5E5E5',padding:'10px 14px',fontSize:14,fontFamily:FONT,width:'100%',outline:'none' },
  select: { background:'#1A1A1E',border:'1px solid #2A2A30',borderRadius:8,color:'#E5E5E5',padding:'10px 14px',fontSize:14,fontFamily:FONT,width:'100%',outline:'none',appearance:'none' },
  btnP: { background:ACCENT,color:'#0A0A0B',border:'none',borderRadius:8,padding:'12px 20px',fontSize:14,fontWeight:700,fontFamily:FONT,cursor:'pointer',minHeight:44,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6 },
  btnS: { background:'transparent',color:'#999',border:'1px solid #2A2A30',borderRadius:8,padding:'10px 16px',fontSize:13,fontFamily:FONT,cursor:'pointer',minHeight:44,display:'inline-flex',alignItems:'center',justifyContent:'center' },
  btnD: { background:'#5E1F1F',color:'#EF4444',border:'1px solid #7F2020',borderRadius:8,padding:'10px 16px',fontSize:13,fontFamily:FONT,cursor:'pointer',minHeight:44,display:'inline-flex',alignItems:'center',justifyContent:'center' },
  card: { background:'#141416',border:'1px solid #1F1F23',borderRadius:10,padding:20,marginBottom:16 },
  th: { textAlign:'left',padding:'12px 14px',fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:'0.8px',borderBottom:'1px solid #1F1F23',whiteSpace:'nowrap' },
  td: { padding:'12px 14px',borderBottom:'1px solid #1A1A1E',fontSize:13,verticalAlign:'middle' },
}

export const badge = (c, bg) => ({ display:'inline-flex',alignItems:'center',gap:4,background:bg||(c+'18'),color:c,borderRadius:6,padding:'4px 10px',fontSize:11,fontWeight:600,whiteSpace:'nowrap' })

export function StatusBadge({ status }) {
  if (!status) return <span style={badge('#666')}>—</span>
  return <span style={badge(status.cor,status.cor_bg)}>{status.icone} {status.nome}</span>
}

export function PrioBadge({ p }) {
  return <span style={badge(PRIORIDADES[p]||'#666')}>{PRIO_LABEL[p]||p}</span>
}

export function KPI({ label,value,accent,sub,small }) {
  return <div style={{ background:'#141416',border:'1px solid #1F1F23',borderRadius:10,padding:small?'14px 16px':'20px 24px',flex:small?'1 1 45%':'1 1 160px',borderTop:`3px solid ${accent}`,minWidth:0 }}>
    <div style={{ fontSize:10,color:'#666',textTransform:'uppercase',letterSpacing:1,marginBottom:6 }}>{label}</div>
    <div style={{ fontFamily:FONT_DISPLAY,fontSize:small?26:34,color:accent,lineHeight:1 }}>{value}</div>
    {sub&&<div style={{ fontSize:10,color:'#555',marginTop:4 }}>{sub}</div>}
  </div>
}

export function Modal({ open,onClose,title,children,mobile }) {
  if (!open) return null
  return <div style={{ position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:mobile?'flex-end':'center',justifyContent:'center' }} onClick={onClose}>
    <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(4px)' }}/>
    <div style={{ position:'relative',background:'#141416',border:'1px solid #2A2A30',borderRadius:mobile?'16px 16px 0 0':12,width:mobile?'100%':'92%',maxWidth:mobile?'100%':650,maxHeight:mobile?'92vh':'85vh',overflow:'auto' }} onClick={e=>e.stopPropagation()}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px',borderBottom:'1px solid #1F1F23',position:'sticky',top:0,background:'#141416',zIndex:2 }}>
        <h3 style={{ margin:0,fontSize:15,fontFamily:FONT_DISPLAY,letterSpacing:1,color:ACCENT }}>{title}</h3>
        <button onClick={onClose} style={{ ...S.btnS,padding:'6px 12px',minHeight:36 }}>✕</button>
      </div>
      <div style={{ padding:mobile?'16px':'20px 24px' }}>{children}</div>
    </div>
  </div>
}

export function Field({ label,children,req }) {
  return <div style={{ marginBottom:16 }}>
    <label style={{ display:'block',fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:.8,marginBottom:6,fontWeight:600 }}>{label}{req&&<span style={{color:ACCENT}}> *</span>}</label>
    {children}
  </div>
}

export function Empty({ icon,msg,action,onAction }) {
  return <div style={{ textAlign:'center',padding:'48px 20px',color:'#555' }}>
    <div style={{ fontSize:44,marginBottom:12,opacity:.5 }}>{icon}</div>
    <div style={{ fontSize:14,marginBottom:20 }}>{msg}</div>
    {action&&<button style={S.btnP} onClick={onAction}>{action}</button>}
  </div>
}

export function Search({ value,onChange,ph }) {
  return <div style={{ position:'relative',flex:1,minWidth:180,maxWidth:400 }}>
    <span style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#555' }}>🔍</span>
    <input style={{ ...S.input,paddingLeft:36 }} value={value} onChange={e=>onChange(e.target.value)} placeholder={ph||'Buscar...'}/>
  </div>
}

export function Confirm({ open,msg,onOk,onNo }) {
  if (!open) return null
  return <div style={{ position:'fixed',inset:0,zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center' }}>
    <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.65)' }} onClick={onNo}/>
    <div style={{ position:'relative',background:'#1A1A1E',border:'1px solid #2A2A30',borderRadius:12,padding:24,maxWidth:400,width:'90%' }}>
      <div style={{ fontSize:14,marginBottom:20,lineHeight:1.6 }}>{msg}</div>
      <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
        <button style={S.btnS} onClick={onNo}>Cancelar</button>
        <button style={S.btnD} onClick={onOk}>Confirmar</button>
      </div>
    </div>
  </div>
}

export function Header({ title,action,label,mobile }) {
  return <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,gap:12,flexWrap:'wrap' }}>
    <h1 style={{ margin:0,fontFamily:FONT_DISPLAY,fontSize:mobile?22:32,letterSpacing:2,color:ACCENT }}>{title}</h1>
    {action&&<button style={S.btnP} onClick={action}>{label}</button>}
  </div>
}

export function Loading() {
  return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:60 }}>
    <div style={{ textAlign:'center' }}>
      <div style={{ fontFamily:FONT_DISPLAY,fontSize:48,color:ACCENT,letterSpacing:4,marginBottom:16 }}>TELOS</div>
      <div style={{ color:'#666',fontSize:13 }}>Carregando...</div>
    </div>
  </div>
}

export const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—'
export const fmtDT = d => d ? new Date(d).toLocaleString('pt-BR') : '—'
export const fmtHrs = min => min > 0 ? `${Math.floor(min/60)}h${String(min%60).padStart(2,'0')}` : '—'
