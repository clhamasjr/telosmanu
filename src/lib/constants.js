export const PRIORIDADES = {
  Baixa:   { label: 'Baixa',   color: '#22C55E' },
  Media:   { label: 'Média',   color: '#F59E0B' },
  Alta:    { label: 'Alta',    color: '#EF4444' },
  Urgente: { label: 'Urgente', color: '#DC2626' },
}

export const EQUIP_STATUS = ['Operando', 'Parado', 'Em Manutenção', 'Desativado']
export const TURNOS = [
  { value: 'A', label: 'Turno A (06h-14h)' },
  { value: 'B', label: 'Turno B (14h-22h)' },
  { value: 'C', label: 'Turno C (22h-06h)' },
  { value: 'ADM', label: 'Administrativo' },
]
export const UNIDADES = ['UN','PC','MT','KG','LT','CX','JG','RL','PR']

export const NAV = [
  { key: 'dashboard',    label: 'Dashboard',         icon: '📊', short: 'Dash' },
  { key: 'ordens',       label: 'Ordens de Serviço', icon: '📋', short: 'OS' },
  { key: 'equipamentos', label: 'Equipamentos',      icon: '⚙️', short: 'Equip' },
  { key: 'mecanicos',    label: 'Mecânicos',         icon: '👨‍🔧', short: 'Mec' },
  { key: 'pecas',        label: 'Estoque',           icon: '📦', short: 'Peças' },
  { key: 'areas',        label: 'Áreas',             icon: '🏭', short: 'Áreas' },
]

export const ACCENT = '#D4A017'
export const FONT = "'JetBrains Mono', 'SF Mono', monospace"
export const FONT_DISPLAY = "'Bebas Neue', 'Impact', sans-serif"
