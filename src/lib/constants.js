export const ACCENT = '#D4A017'
export const FONT = "'JetBrains Mono', monospace"
export const FONT_DISPLAY = "'Bebas Neue', sans-serif"
export const PRIORIDADES = { Baixa:'#22C55E', Media:'#F59E0B', Alta:'#EF4444', Urgente:'#DC2626' }
export const PRIO_LABEL = { Baixa:'Baixa', Media:'Média', Alta:'Alta', Urgente:'Urgente' }
export const EQUIP_STATUS = ['Operando','Parado','Em Manutenção','Desativado']
export const TURNOS = [{v:'A',l:'Turno A (06h-14h)'},{v:'B',l:'Turno B (14h-22h)'},{v:'C',l:'Turno C (22h-06h)'},{v:'ADM',l:'Administrativo'}]
export const UNIDADES = ['UN','PC','MT','KG','LT','CX','JG','RL','PR']
export const PERIODICIDADES = ['Diária','Semanal','Quinzenal','Mensal','Bimestral','Trimestral','Semestral','Anual']

// ══════════════════════════════════════
// HIERARQUIA DE PERFIS
// ══════════════════════════════════════
export const PERFIS_CONFIG = {
  admin: {
    label: 'Administrador',
    icon: '👑',
    cor: '#EF4444',
    nivel: 1,
    descricao: 'Acesso total ao sistema. Gerencia usuários, perfis e todas as configurações.',
    paginas: ['dashboard','ordens','equipamentos','mecanicos','pecas','areas','preventiva','relatorios','descricoes','usuarios'],
    permissoes: {
      os_criar: true, os_editar: true, os_excluir: true, os_atender: true, os_aprovar: true,
      equip_criar: true, equip_editar: true, equip_excluir: true,
      pecas_criar: true, pecas_editar: true, pecas_importar: true, pecas_exportar: true, pecas_movimentar: true,
      areas_criar: true, areas_editar: true,
      mecanicos_criar: true, mecanicos_editar: true,
      preventiva_criar: true, preventiva_editar: true,
      relatorios_ver: true, relatorios_exportar: true,
      usuarios_criar: true, usuarios_editar: true, usuarios_excluir: true,
    },
  },
  gestor: {
    label: 'Gestor de Manutenção',
    icon: '👔',
    cor: '#F59E0B',
    nivel: 2,
    descricao: 'Gestão completa da manutenção. Aprova OS, gera relatórios, gerencia equipes e preventivas.',
    paginas: ['dashboard','ordens','equipamentos','mecanicos','pecas','areas','preventiva','relatorios','descricoes'],
    permissoes: {
      os_criar: true, os_editar: true, os_excluir: true, os_atender: false, os_aprovar: true,
      equip_criar: true, equip_editar: true, equip_excluir: false,
      pecas_criar: true, pecas_editar: true, pecas_importar: true, pecas_exportar: true, pecas_movimentar: true,
      areas_criar: true, areas_editar: true,
      mecanicos_criar: true, mecanicos_editar: true,
      preventiva_criar: true, preventiva_editar: true,
      relatorios_ver: true, relatorios_exportar: true,
      usuarios_criar: false, usuarios_editar: false, usuarios_excluir: false,
    },
  },
  supervisor: {
    label: 'Supervisor',
    icon: '🎯',
    cor: '#A855F7',
    nivel: 3,
    descricao: 'Supervisiona a equipe de manutenção. Distribui OS, aprova serviços e acompanha indicadores.',
    paginas: ['dashboard','ordens','equipamentos','mecanicos','pecas','areas','relatorios'],
    permissoes: {
      os_criar: true, os_editar: true, os_excluir: false, os_atender: false, os_aprovar: true,
      equip_criar: false, equip_editar: true, equip_excluir: false,
      pecas_criar: false, pecas_editar: false, pecas_importar: false, pecas_exportar: true, pecas_movimentar: true,
      areas_criar: false, areas_editar: false,
      mecanicos_criar: false, mecanicos_editar: true,
      preventiva_criar: false, preventiva_editar: false,
      relatorios_ver: true, relatorios_exportar: false,
      usuarios_criar: false, usuarios_editar: false, usuarios_excluir: false,
    },
  },
  mecanico: {
    label: 'Mecânico / Manutencista',
    icon: '🔧',
    cor: '#3B82F6',
    nivel: 4,
    descricao: 'Executa manutenções. Atende OS, registra serviço realizado e materiais utilizados.',
    paginas: ['dashboard','ordens','equipamentos','pecas'],
    permissoes: {
      os_criar: false, os_editar: false, os_excluir: false, os_atender: true, os_aprovar: false,
      equip_criar: false, equip_editar: false, equip_excluir: false,
      pecas_criar: false, pecas_editar: false, pecas_importar: false, pecas_exportar: false, pecas_movimentar: false,
      areas_criar: false, areas_editar: false,
      mecanicos_criar: false, mecanicos_editar: false,
      preventiva_criar: false, preventiva_editar: false,
      relatorios_ver: false, relatorios_exportar: false,
      usuarios_criar: false, usuarios_editar: false, usuarios_excluir: false,
    },
  },
  solicitante: {
    label: 'Solicitante',
    icon: '📝',
    cor: '#22C55E',
    nivel: 5,
    descricao: 'Abre solicitações de serviço. Acompanha status e aprova conclusão das suas OS.',
    paginas: ['dashboard','ordens'],
    permissoes: {
      os_criar: true, os_editar: false, os_excluir: false, os_atender: false, os_aprovar: true,
      equip_criar: false, equip_editar: false, equip_excluir: false,
      pecas_criar: false, pecas_editar: false, pecas_importar: false, pecas_exportar: false, pecas_movimentar: false,
      areas_criar: false, areas_editar: false,
      mecanicos_criar: false, mecanicos_editar: false,
      preventiva_criar: false, preventiva_editar: false,
      relatorios_ver: false, relatorios_exportar: false,
      usuarios_criar: false, usuarios_editar: false, usuarios_excluir: false,
    },
  },
  visualizador: {
    label: 'Visualizador',
    icon: '👁',
    cor: '#888888',
    nivel: 6,
    descricao: 'Acesso somente leitura. Visualiza dashboard, OS e equipamentos sem poder alterar.',
    paginas: ['dashboard','ordens','equipamentos'],
    permissoes: {
      os_criar: false, os_editar: false, os_excluir: false, os_atender: false, os_aprovar: false,
      equip_criar: false, equip_editar: false, equip_excluir: false,
      pecas_criar: false, pecas_editar: false, pecas_importar: false, pecas_exportar: false, pecas_movimentar: false,
      areas_criar: false, areas_editar: false,
      mecanicos_criar: false, mecanicos_editar: false,
      preventiva_criar: false, preventiva_editar: false,
      relatorios_ver: false, relatorios_exportar: false,
      usuarios_criar: false, usuarios_editar: false, usuarios_excluir: false,
    },
  },
}

export const PERFIS = Object.keys(PERFIS_CONFIG)

// Helper
export const getPerfil = (key) => PERFIS_CONFIG[key] || PERFIS_CONFIG.visualizador
export const getPermissao = (perfilKey, permissao) => PERFIS_CONFIG[perfilKey]?.permissoes?.[permissao] || false
export const getPaginas = (perfilKey) => PERFIS_CONFIG[perfilKey]?.paginas || ['dashboard']

export const NAV = [
  {key:'dashboard',label:'Dashboard',icon:'📊',short:'Dash'},
  {key:'ordens',label:'Ordens de Serviço',icon:'📋',short:'OS'},
  {key:'equipamentos',label:'Equipamentos',icon:'⚙️',short:'Equip'},
  {key:'mecanicos',label:'Mecânicos',icon:'👨‍🔧',short:'Mec'},
  {key:'pecas',label:'Estoque',icon:'📦',short:'Peças'},
  {key:'areas',label:'Áreas & Equip.',icon:'🏭',short:'Áreas'},
  {key:'preventiva',label:'Preventiva',icon:'📅',short:'Prev'},
  {key:'relatorios',label:'Relatórios',icon:'📈',short:'Relat'},
  {key:'descricoes',label:'Descrições Padrão',icon:'📝',short:'Desc'},
  {key:'usuarios',label:'Usuários & Perfis',icon:'👥',short:'Users'},
]
