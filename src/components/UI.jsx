import React from 'react'
import { ACCENT } from '../lib/constants'

// ── LIGHT THEME STYLES ──
const C = {
  bg:'#F8FAFC', bg2:'#FFFFFF', bg3:'#F1F5F9', border:'#E2E8F0', border2:'#CBD5E1',
  text:'#0F172A', text2:'#475569', text3:'#94A3B8',
  accent:ACCENT, green:'#16A34A', red:'#DC2626', yellow:'#D97706', purple:'#7C3AED',
}

export const S = {
  card: { background:C.bg2, border:`1px solid ${C.border}`, borderRadius:12, padding:18, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' },
  input: { background:C.bg2, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:'10px 14px', fontSize:14, fontFamily:'inherit', width:'100%', outline:'none', marginBottom:8, transition:'border .2s' },
  select: { background:C.bg2, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:'10px 14px', fontSize:14, fontFamily:'inherit', width:'100%', outline:'none', marginBottom:8, cursor:'pointer', appearance:'auto' },
  btnP: { background:C.accent, color:'#FFF', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer', minHeight:40, transition:'all .2s' },
  btnS: { background:'transparent', color:C.text2, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:500, fontFamily:'inherit', cursor:'pointer', minHeight:38, transition:'all .15s' },
  btnD: { background:'#FEF2F2', color:C.red, border:`1px solid #FECACA`, borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:500, fontFamily:'inherit', cursor:'pointer', minHeight:38 },
  th: { textAlign:'left', padding:'10px 12px', borderBottom:`2px solid ${C.border}`, fontSize:11, fontWeight:600, color:C.text3, textTransform:'uppercase', letterSpacing:.5 },
  td: { padding:'10px 12px', borderBottom:`1px solid ${C.bg3}`, fontSize:13, color:C.text },
}

export const badge = (color) => ({
  display:'inline-block', fontSize:11, padding:'2px 10px', borderRadius:20, fontWeight:600,
  background:color+'15', color, border:`1px solid ${color}30`,
})

export const StatusBadge = ({status}) => {
  if (!status) return <span style={badge('#94A3B8')}>—</span>
  const colors = {'Aberta':'#D97706','Em Andamento':'#2563EB','Concluída':'#16A34A','Cancelada':'#DC2626','Aguardando Peça':'#7C3AED','Aguardando Aprovação':'#EC4899'}
  return <span style={badge(colors[status.nome]||'#94A3B8')}>{status.icone} {status.nome}</span>
}

export const PrioBadge = ({p}) => {
  const c = {Critica:'#DC2626',Alta:'#EA580C',Media:'#D97706',Baixa:'#16A34A'}
  return <span style={{...badge(c[p]||'#94A3B8'),fontSize:10}}>{p==='Media'?'Média':p||'—'}</span>
}

export const KPI = ({label,value,accent,sub,small}) => (
  <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:12,padding:small?'12px 14px':'16px 20px',flex:small?'1 1 100px':'1 1 150px',boxShadow:'0 1px 3px rgba(0,0,0,0.04)',borderTop:`3px solid ${accent||C.accent}`}}>
    <div style={{fontSize:small?22:32,fontWeight:800,color:accent||C.accent,lineHeight:1}}>{value}</div>
    <div style={{fontSize:10,color:C.text3,marginTop:4,textTransform:'uppercase',fontWeight:600,letterSpacing:.5}}>{label}</div>
    {sub&&<div style={{fontSize:10,color:C.text3,marginTop:2}}>{sub}</div>}
  </div>
)

export const Modal = ({open,onClose,title,children,mobile}) => {
  if (!open) return null
  return <div style={{position:'fixed',inset:0,zIndex:500,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',backdropFilter:'blur(4px)'}}/>
    <div style={{position:'relative',background:C.bg2,borderRadius:16,padding:mobile?20:28,width:'100%',maxWidth:mobile?'95%':640,maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.15)',border:`1px solid ${C.border}`}} onClick={e=>e.stopPropagation()}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <h2 style={{fontSize:16,fontWeight:700,color:C.text,margin:0}}>{title}</h2>
        <button onClick={onClose} style={{background:C.bg3,border:'none',width:32,height:32,borderRadius:8,fontSize:16,cursor:'pointer',color:C.text2,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
      </div>
      {children}
    </div>
  </div>
}

export const Field = ({label,children,req}) => (
  <div style={{marginBottom:12}}>
    <label style={{display:'block',fontSize:11,color:C.text3,fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:.5}}>
      {label}{req&&<span style={{color:C.red,marginLeft:2}}>*</span>}
    </label>
    {children}
  </div>
)

export const Empty = ({icon,msg,action,onAction}) => (
  <div style={{textAlign:'center',padding:60,color:C.text3}}>
    <div style={{fontSize:48,marginBottom:12}}>{icon}</div>
    <div style={{fontSize:14,marginBottom:16}}>{msg}</div>
    {action&&onAction&&<button style={S.btnP} onClick={onAction}>{action}</button>}
  </div>
)

export const Search = ({value,onChange,ph}) => (
  <div style={{position:'relative',flex:'1 1 200px',minWidth:160}}>
    <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:14,color:C.text3}}>🔍</span>
    <input style={{...S.input,paddingLeft:36,marginBottom:0}} value={value} onChange={e=>onChange(e.target.value)} placeholder={ph||'Buscar...'}/>
  </div>
)

export const Confirm = ({open,msg,onOk,onNo}) => {
  if (!open) return null
  return <Modal open={open} onClose={onNo} title="Confirmar">
    <p style={{fontSize:14,color:C.text2,marginBottom:20}}>{msg}</p>
    <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
      <button style={S.btnS} onClick={onNo}>Cancelar</button>
      <button style={S.btnD} onClick={onOk}>Confirmar</button>
    </div>
  </Modal>
}

export const Header = ({title,action,label,mobile}) => (
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
    <h1 style={{margin:0,fontSize:mobile?22:28,fontWeight:800,color:C.text,letterSpacing:-.5}}>{title}</h1>
    {action&&<button style={S.btnP} onClick={action}>{label}</button>}
  </div>
)

export const Loading = () => <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:300}}>
  <div style={{width:36,height:36,border:`3px solid ${C.border}`,borderTop:`3px solid ${C.accent}`,borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
</div>

export const fmtDate = d => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('pt-BR') } catch { return '—' } }
export const fmtDT = d => { if (!d) return null; try { return new Date(d).toLocaleString('pt-BR') } catch { return '—' } }
export const fmtHrs = m => { if (!m) return '—'; const h=Math.floor(m/60); return h>0?`${h}h${m%60>0?` ${m%60}min`:''}`:m+'min' }
