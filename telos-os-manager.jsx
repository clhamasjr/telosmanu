import { useState, useEffect, useCallback, useMemo, useRef } from "react";

const APP_VERSION = "1.1.0";

// ─── Storage helpers ───
const STORAGE_KEYS = {
  ordens: "telos:ordens",
  equipamentos: "telos:equipamentos",
  mecanicos: "telos:mecanicos",
  areas: "telos:areas",
  pecas: "telos:pecas",
};

async function loadData(key) {
  try {
    const r = await window.storage.get(key);
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
}
async function saveData(key, data) {
  try { await window.storage.set(key, JSON.stringify(data)); }
  catch (e) { console.error("Storage error:", e); }
}

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("pt-BR") : "—";

// ─── Status & Config ───
const STATUS_CONFIG = {
  ABERTA: { label: "Aberta", color: "#F59E0B", bg: "#422006", icon: "⏳" },
  EM_ANDAMENTO: { label: "Em Andamento", color: "#3B82F6", bg: "#1E3A5F", icon: "🔧" },
  AGUARDANDO_PECA: { label: "Aguard. Peça", color: "#A855F7", bg: "#3B1F5E", icon: "📦" },
  AGUARDANDO_APROVACAO: { label: "Aguard. Aprovação", color: "#EC4899", bg: "#5E1F3B", icon: "✋" },
  CONCLUIDA: { label: "Concluída", color: "#22C55E", bg: "#14532D", icon: "✅" },
  CANCELADA: { label: "Cancelada", color: "#EF4444", bg: "#5E1F1F", icon: "❌" },
};

const PRIORIDADES = {
  BAIXA: { label: "Baixa", color: "#22C55E" },
  MEDIA: { label: "Média", color: "#F59E0B" },
  ALTA: { label: "Alta", color: "#EF4444" },
  URGENTE: { label: "Urgente", color: "#DC2626" },
};

const TIPOS_OS = ["Corretiva", "Preventiva", "Preditiva", "Melhoria", "Emergencial"];

const DEFAULT_AREAS = [
  { id: genId(), nome: "Desmontagem", descricao: "Abertura e desmontagem dos fardos" },
  { id: genId(), nome: "Cardagem", descricao: "Cardas e equipamentos de cardagem" },
  { id: genId(), nome: "Fiação", descricao: "Filatórios e equipamentos de fiação" },
  { id: genId(), nome: "Tecelagem", descricao: "Teares e equipamentos de tecelagem" },
  { id: genId(), nome: "Acabamento", descricao: "Tingimento, estamparia e acabamento" },
  { id: genId(), nome: "Utilidades", descricao: "Compressores, caldeiras, subestação" },
  { id: genId(), nome: "Expedição", descricao: "Embalagem e despacho" },
];

const FONT = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";
const FONT_DISPLAY = "'Bebas Neue', 'Impact', sans-serif";
const ACCENT = "#D4A017";

// ─── Responsive hook ───
function useViewport() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return { width: w, isMobile: w < 640, isTablet: w >= 640 && w < 1024, isDesktop: w >= 1024 };
}

// ─── Base Styles ───
const S = {
  input: {
    background: "#1A1A1E", border: "1px solid #2A2A30", borderRadius: 8, color: "#E5E5E5",
    padding: "10px 14px", fontSize: 14, fontFamily: FONT, width: "100%", outline: "none",
    transition: "border-color 0.2s", WebkitAppearance: "none",
  },
  select: {
    background: "#1A1A1E", border: "1px solid #2A2A30", borderRadius: 8, color: "#E5E5E5",
    padding: "10px 14px", fontSize: 14, fontFamily: FONT, width: "100%", outline: "none",
    appearance: "none", WebkitAppearance: "none",
  },
  btnPrimary: {
    background: ACCENT, color: "#0A0A0B", border: "none", borderRadius: 8,
    padding: "12px 20px", fontSize: 14, fontWeight: 700, fontFamily: FONT,
    cursor: "pointer", transition: "all 0.2s", letterSpacing: "0.5px",
    minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  },
  btnSecondary: {
    background: "transparent", color: "#999", border: "1px solid #2A2A30", borderRadius: 8,
    padding: "10px 16px", fontSize: 13, fontFamily: FONT, cursor: "pointer",
    transition: "all 0.2s", minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center",
  },
  btnDanger: {
    background: "#5E1F1F", color: "#EF4444", border: "1px solid #7F2020", borderRadius: 8,
    padding: "10px 16px", fontSize: 13, fontFamily: FONT, cursor: "pointer", minHeight: 44,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  },
  badge: (color, bg) => ({
    display: "inline-flex", alignItems: "center", gap: 4,
    background: bg || (color + "18"), color, borderRadius: 6,
    padding: "4px 10px", fontSize: 11, fontWeight: 600, letterSpacing: "0.3px", whiteSpace: "nowrap",
  }),
  card: {
    background: "#141416", border: "1px solid #1F1F23", borderRadius: 10, padding: 20, marginBottom: 16,
  },
  th: {
    textAlign: "left", padding: "12px 14px", fontSize: 11, fontWeight: 600, color: "#666",
    textTransform: "uppercase", letterSpacing: "0.8px", borderBottom: "1px solid #1F1F23", whiteSpace: "nowrap",
  },
  td: {
    padding: "12px 14px", borderBottom: "1px solid #1A1A1E", fontSize: 13, verticalAlign: "middle",
  },
};

// ─── Shared Components ───
function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || { label: status, color: "#666", bg: "#222", icon: "?" };
  return <span style={S.badge(c.color, c.bg)}>{c.icon} {c.label}</span>;
}
function PrioridadeBadge({ prioridade }) {
  const c = PRIORIDADES[prioridade] || { label: prioridade, color: "#666" };
  return <span style={S.badge(c.color)}>{c.label}</span>;
}

function KPICard({ label, value, accent, sub, isMobile }) {
  return (
    <div style={{
      background: "#141416", border: "1px solid #1F1F23", borderRadius: 10,
      padding: isMobile ? "16px 18px" : "20px 24px", flex: isMobile ? "1 1 45%" : "1 1 170px",
      borderTop: "3px solid " + accent, minWidth: 0,
    }}>
      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: isMobile ? 28 : 36, color: accent, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Modal({ open, onClose, title, children, vp }) {
  if (!open) return null;
  const mobile = vp && vp.isMobile;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "relative", background: "#141416", border: "1px solid #2A2A30",
        borderRadius: mobile ? "16px 16px 0 0" : 12,
        width: mobile ? "100%" : "92%", maxWidth: mobile ? "100%" : 650,
        maxHeight: mobile ? "92vh" : "85vh", overflow: "auto",
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 20px", borderBottom: "1px solid #1F1F23", position: "sticky", top: 0,
          background: "#141416", zIndex: 2,
        }}>
          {mobile && <div style={{ width: 36, height: 4, background: "#333", borderRadius: 2, position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)" }} />}
          <h3 style={{ margin: 0, fontSize: 15, fontFamily: FONT_DISPLAY, letterSpacing: 1, color: ACCENT }}>{title}</h3>
          <button onClick={onClose} style={{ ...S.btnSecondary, padding: "6px 12px", minHeight: 36 }}>✕</button>
        </div>
        <div style={{ padding: mobile ? "16px" : "20px 24px" }}>{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, children, required }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, fontWeight: 600 }}>
        {label} {required && <span style={{ color: ACCENT }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function EmptyState({ icon, message, action, onAction }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 20px", color: "#555" }}>
      <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.5 }}>{icon}</div>
      <div style={{ fontSize: 14, marginBottom: 20 }}>{message}</div>
      {action && <button style={S.btnPrimary} onClick={onAction}>{action}</button>}
    </div>
  );
}

function SearchBar({ value, onChange, placeholder, style: sx }) {
  return (
    <div style={{ position: "relative", flex: 1, minWidth: 180, maxWidth: 400, ...sx }}>
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#555", fontSize: 14 }}>🔍</span>
      <input style={{ ...S.input, paddingLeft: 36 }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || "Buscar..."} />
    </div>
  );
}

function ConfirmDialog({ open, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)" }} onClick={onCancel} />
      <div style={{ position: "relative", background: "#1A1A1E", border: "1px solid #2A2A30", borderRadius: 12, padding: 24, maxWidth: 400, width: "90%" }}>
        <div style={{ fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button style={S.btnSecondary} onClick={onCancel}>Cancelar</button>
          <button style={S.btnDanger} onClick={onConfirm}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}

function ResponsiveTable({ columns, data, renderRow, renderCard, vp }) {
  if (vp.isMobile && renderCard) {
    return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{data.map(renderCard)}</div>;
  }
  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: vp.isTablet ? 600 : "auto" }}>
        <thead><tr>{columns.map((c, i) => <th key={i} style={S.th}>{c}</th>)}</tr></thead>
        <tbody>{data.map(renderRow)}</tbody>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════
function Dashboard({ ordens, equipamentos, mecanicos, pecas, areas, vp }) {
  const abertas = ordens.filter(o => o.status === "ABERTA").length;
  const emAndamento = ordens.filter(o => o.status === "EM_ANDAMENTO").length;
  const aguardPeca = ordens.filter(o => o.status === "AGUARDANDO_PECA").length;
  const concluidas = ordens.filter(o => o.status === "CONCLUIDA").length;
  const urgentes = ordens.filter(o => o.prioridade === "URGENTE" && !["CONCLUIDA", "CANCELADA"].includes(o.status)).length;
  const pecasBaixo = pecas.filter(p => p.quantidade <= p.estoqueMinimo);
  const last7 = ordens.filter(o => (new Date() - new Date(o.dataCriacao)) / 86400000 <= 7);

  const osPorArea = useMemo(() => {
    const map = {};
    ordens.filter(o => !["CONCLUIDA", "CANCELADA"].includes(o.status)).forEach(o => { map[o.area] = (map[o.area] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [ordens]);

  return (
    <div>
      <h1 style={{ margin: "0 0 20px", fontFamily: FONT_DISPLAY, fontSize: vp.isMobile ? 24 : 32, letterSpacing: 2, color: ACCENT }}>DASHBOARD</h1>
      <div style={{ display: "flex", gap: vp.isMobile ? 10 : 14, flexWrap: "wrap", marginBottom: 24 }}>
        <KPICard label="Abertas" value={abertas} accent="#F59E0B" sub="Aguardando" isMobile={vp.isMobile} />
        <KPICard label="Andamento" value={emAndamento} accent="#3B82F6" sub="Execução" isMobile={vp.isMobile} />
        <KPICard label="Ag. Peça" value={aguardPeca} accent="#A855F7" sub="Bloqueadas" isMobile={vp.isMobile} />
        <KPICard label="Urgentes" value={urgentes} accent="#EF4444" sub="Prioridade" isMobile={vp.isMobile} />
        <KPICard label="Concluídas" value={concluidas} accent="#22C55E" sub={(last7.filter(o => o.status === "CONCLUIDA").length) + " (7d)"} isMobile={vp.isMobile} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: vp.isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <div style={S.card}>
          <h3 style={{ margin: "0 0 14px", fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>OS Recentes</h3>
          {ordens.length === 0
            ? <div style={{ color: "#555", fontSize: 12, padding: 16, textAlign: "center" }}>Nenhuma OS</div>
            : <div style={{ maxHeight: 280, overflow: "auto" }}>{ordens.slice(0, 8).map(o => (
                <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #1A1A1E", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: ACCENT, fontWeight: 700, minWidth: 60 }}>#{o.numero}</span>
                  <span style={{ flex: 1, fontSize: 12, color: "#CCC", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 80 }}>{o.titulo}</span>
                  <StatusBadge status={o.status} />
                </div>
              ))}</div>}
        </div>
        <div style={S.card}>
          <h3 style={{ margin: "0 0 14px", fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>OS por Área</h3>
          {osPorArea.length === 0
            ? <div style={{ color: "#555", fontSize: 12, padding: 16, textAlign: "center" }}>Sem dados</div>
            : osPorArea.map(([area, count]) => {
                const max = Math.max(...osPorArea.map(x => x[1]));
                return (<div key={area} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "#CCC" }}>{area}</span><span style={{ color: ACCENT, fontWeight: 700 }}>{count}</span>
                  </div>
                  <div style={{ background: "#1A1A1E", borderRadius: 3, height: 6 }}>
                    <div style={{ background: "linear-gradient(90deg, " + ACCENT + ", #F59E0B)", height: "100%", borderRadius: 3, width: ((count / max) * 100) + "%" }} />
                  </div>
                </div>);
              })}
        </div>
        <div style={S.card}>
          <h3 style={{ margin: "0 0 14px", fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>⚠️ Peças Baixo ({pecasBaixo.length})</h3>
          {pecasBaixo.length === 0
            ? <div style={{ color: "#22C55E", fontSize: 12, padding: 16, textAlign: "center" }}>Estoque OK</div>
            : pecasBaixo.slice(0, 6).map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1A1A1E", fontSize: 12 }}>
                  <span style={{ color: "#CCC" }}>{p.nome}</span>
                  <span style={{ color: p.quantidade === 0 ? "#EF4444" : "#F59E0B", fontWeight: 700 }}>{p.quantidade}/{p.estoqueMinimo}</span>
                </div>))}
        </div>
        <div style={S.card}>
          <h3 style={{ margin: "0 0 14px", fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>Resumo</h3>
          {[["⚙️ Equipamentos", equipamentos.length], ["👨‍🔧 Mecânicos", mecanicos.filter(m => m.ativo).length], ["🏭 Áreas", areas.length], ["📦 Peças", pecas.reduce((s, p) => s + p.quantidade, 0)], ["📋 Total OS", ordens.length]].map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1A1A1E", fontSize: 13 }}>
              <span style={{ color: "#999" }}>{l}</span><span style={{ color: "#E5E5E5", fontWeight: 700 }}>{v}</span>
            </div>))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
//  ORDENS DE SERVIÇO
// ══════════════════════════════════════════
function OrdensPage({ ordens, setOrdens, equipamentos, mecanicos, areas, pecas, setPecas, vp }) {
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroArea, setFiltroArea] = useState("TODOS");
  const [filtroPrio, setFiltroPrio] = useState("TODOS");
  const [modal, setModal] = useState(null);
  const [osAtual, setOsAtual] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const proximoNumero = useMemo(() => {
    const nums = ordens.map(o => parseInt(o.numero)).filter(n => !isNaN(n));
    return String(nums.length > 0 ? Math.max(...nums) + 1 : 1).padStart(5, "0");
  }, [ordens]);

  const filtered = useMemo(() => ordens.filter(o => {
    if (filtroStatus !== "TODOS" && o.status !== filtroStatus) return false;
    if (filtroArea !== "TODOS" && o.area !== filtroArea) return false;
    if (filtroPrio !== "TODOS" && o.prioridade !== filtroPrio) return false;
    if (search) { const s = search.toLowerCase(); return o.numero.includes(s) || o.titulo.toLowerCase().includes(s) || (o.descricao || "").toLowerCase().includes(s); }
    return true;
  }), [ordens, search, filtroStatus, filtroArea, filtroPrio]);

  const novaOS = () => {
    setOsAtual({ id: genId(), numero: proximoNumero, titulo: "", descricao: "", tipo: "Corretiva", prioridade: "MEDIA", status: "ABERTA", area: areas[0]?.nome || "", equipamentoId: "", mecanicoId: "", solicitante: "", dataCriacao: new Date().toISOString(), observacoes: "", historico: [{ data: new Date().toISOString(), acao: "OS criada", usuario: "Sistema" }] });
    setModal("nova");
  };

  const salvarOS = (os) => {
    const exists = ordens.find(o => o.id === os.id);
    let updated;
    if (exists) {
      if (exists.status !== os.status) { os.historico = [...(os.historico || []), { data: new Date().toISOString(), acao: "Status: " + (STATUS_CONFIG[exists.status]?.label || exists.status) + " → " + (STATUS_CONFIG[os.status]?.label || os.status), usuario: "Operador" }]; }
      updated = ordens.map(o => o.id === os.id ? os : o);
    } else { updated = [os, ...ordens]; }
    setOrdens(updated); setModal(null);
  };

  const excluirOS = (id) => { setConfirm({ message: "Excluir esta OS?", onConfirm: () => { setOrdens(ordens.filter(o => o.id !== id)); setConfirm(null); setModal(null); } }); };
  const activeFilters = [filtroStatus, filtroArea, filtroPrio].filter(f => f !== "TODOS").length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: vp.isMobile ? 22 : 32, letterSpacing: 2, color: ACCENT }}>ORDENS DE SERVIÇO</h1>
        <button style={S.btnPrimary} onClick={novaOS}>+ {vp.isMobile ? "NOVA" : "NOVA OS"}</button>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar nº, título..." />
        {vp.isMobile ? (
          <button style={{ ...S.btnSecondary, position: "relative" }} onClick={() => setShowFilters(!showFilters)}>
            🔽 Filtros {activeFilters > 0 && <span style={{ background: ACCENT, color: "#000", borderRadius: "50%", width: 18, height: 18, fontSize: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", marginLeft: 4 }}>{activeFilters}</span>}
          </button>
        ) : (<>
          <select style={{ ...S.select, width: 160 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}><option value="TODOS">Todos Status</option>{Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</select>
          <select style={{ ...S.select, width: 160 }} value={filtroArea} onChange={e => setFiltroArea(e.target.value)}><option value="TODOS">Todas Áreas</option>{areas.map(a => <option key={a.id} value={a.nome}>{a.nome}</option>)}</select>
          <select style={{ ...S.select, width: 140 }} value={filtroPrio} onChange={e => setFiltroPrio(e.target.value)}><option value="TODOS">Prioridades</option>{Object.entries(PRIORIDADES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        </>)}
        <span style={{ fontSize: 11, color: "#555" }}>{filtered.length} resultado(s)</span>
      </div>
      {vp.isMobile && showFilters && (
        <div style={{ ...S.card, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <select style={S.select} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}><option value="TODOS">Todos Status</option>{Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</select>
          <select style={S.select} value={filtroArea} onChange={e => setFiltroArea(e.target.value)}><option value="TODOS">Todas Áreas</option>{areas.map(a => <option key={a.id} value={a.nome}>{a.nome}</option>)}</select>
          <select style={S.select} value={filtroPrio} onChange={e => setFiltroPrio(e.target.value)}><option value="TODOS">Prioridades</option>{Object.entries(PRIORIDADES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          {activeFilters > 0 && <button style={{ ...S.btnSecondary, fontSize: 12 }} onClick={() => { setFiltroStatus("TODOS"); setFiltroArea("TODOS"); setFiltroPrio("TODOS"); }}>Limpar filtros</button>}
        </div>
      )}
      {filtered.length === 0 ? <EmptyState icon="📋" message="Nenhuma OS encontrada" action="Criar Nova OS" onAction={novaOS} /> : (
        <ResponsiveTable vp={vp} columns={["Nº", "Título", "Tipo", "Área", "Status", "Prioridade", "Data", "Ações"]} data={filtered}
          renderCard={(o) => {
            const equip = equipamentos.find(e => e.id === o.equipamentoId);
            return (<div key={o.id} style={{ ...S.card, padding: 16 }} onClick={() => { setOsAtual(o); setModal("ver"); }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div><span style={{ color: ACCENT, fontWeight: 700, fontSize: 12 }}>#{o.numero}</span><span style={{ ...S.badge("#888"), marginLeft: 8 }}>{o.tipo}</span></div>
                <PrioridadeBadge prioridade={o.prioridade} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#E5E5E5", marginBottom: 8, lineHeight: 1.3 }}>{o.titulo}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8 }}><StatusBadge status={o.status} /><span style={{ fontSize: 12, color: "#888" }}>{o.area}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }}><span>{equip ? equip.nome : "—"}</span><span>{fmtDate(o.dataCriacao)}</span></div>
            </div>);
          }}
          renderRow={(o) => {
            const equip = equipamentos.find(e => e.id === o.equipamentoId);
            return (<tr key={o.id} style={{ cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = "#1A1A1E"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <td style={{ ...S.td, color: ACCENT, fontWeight: 700 }}>#{o.numero}</td>
              <td style={{ ...S.td, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.titulo}</td>
              <td style={S.td}><span style={S.badge("#888")}>{o.tipo}</span></td>
              <td style={S.td}>{o.area}</td>
              <td style={S.td}><StatusBadge status={o.status} /></td>
              <td style={S.td}><PrioridadeBadge prioridade={o.prioridade} /></td>
              <td style={{ ...S.td, fontSize: 12, color: "#999" }}>{fmtDate(o.dataCriacao)}</td>
              <td style={S.td}><div style={{ display: "flex", gap: 6 }}>
                <button style={{ ...S.btnSecondary, padding: "6px 10px", minHeight: 36 }} onClick={(e) => { e.stopPropagation(); setOsAtual(o); setModal("ver"); }}>👁</button>
                <button style={{ ...S.btnSecondary, padding: "6px 10px", minHeight: 36 }} onClick={(e) => { e.stopPropagation(); setOsAtual({ ...o }); setModal("editar"); }}>✏️</button>
              </div></td>
            </tr>);
          }}
        />
      )}
      <Modal open={modal === "nova" || modal === "editar"} onClose={() => setModal(null)} title={modal === "nova" ? "NOVA OS" : "EDITAR OS #" + (osAtual?.numero || "")} vp={vp}>
        {osAtual && <OSForm os={osAtual} setOs={setOsAtual} onSave={() => salvarOS(osAtual)} onCancel={() => setModal(null)} onDelete={modal === "editar" ? () => excluirOS(osAtual.id) : null} equipamentos={equipamentos} mecanicos={mecanicos} areas={areas} isEdit={modal === "editar"} vp={vp} />}
      </Modal>
      <Modal open={modal === "ver"} onClose={() => setModal(null)} title={"OS #" + (osAtual?.numero || "")} vp={vp}>
        {osAtual && <OSDetail os={osAtual} equipamentos={equipamentos} mecanicos={mecanicos} onEdit={() => { setOsAtual({ ...osAtual }); setModal("editar"); }} vp={vp} />}
      </Modal>
      <ConfirmDialog open={!!confirm} message={confirm?.message} onConfirm={confirm?.onConfirm} onCancel={() => setConfirm(null)} />
    </div>
  );
}

function OSForm({ os, setOs, onSave, onCancel, onDelete, equipamentos, mecanicos, areas, isEdit, vp }) {
  const upd = (f, v) => setOs({ ...os, [f]: v });
  const canSave = os.titulo.trim() && os.area;
  const grid = vp.isMobile ? "1fr" : "1fr 1fr";
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: grid, gap: "0 16px" }}>
        <FormField label="Número" required><input style={{ ...S.input, background: "#111", color: ACCENT }} value={os.numero} readOnly /></FormField>
        <FormField label="Tipo"><select style={S.select} value={os.tipo} onChange={e => upd("tipo", e.target.value)}>{TIPOS_OS.map(t => <option key={t}>{t}</option>)}</select></FormField>
        <div style={{ gridColumn: vp.isMobile ? "auto" : "span 2" }}><FormField label="Título" required><input style={S.input} value={os.titulo} onChange={e => upd("titulo", e.target.value)} placeholder="Descreva o problema" /></FormField></div>
        <FormField label="Área" required><select style={S.select} value={os.area} onChange={e => upd("area", e.target.value)}><option value="">Selecione...</option>{areas.map(a => <option key={a.id} value={a.nome}>{a.nome}</option>)}</select></FormField>
        <FormField label="Equipamento"><select style={S.select} value={os.equipamentoId} onChange={e => upd("equipamentoId", e.target.value)}><option value="">Nenhum</option>{equipamentos.filter(eq => !os.area || eq.area === os.area).map(e => <option key={e.id} value={e.id}>{e.nome} ({e.tag})</option>)}</select></FormField>
        <FormField label="Prioridade"><select style={S.select} value={os.prioridade} onChange={e => upd("prioridade", e.target.value)}>{Object.entries(PRIORIDADES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></FormField>
        {isEdit && <FormField label="Status"><select style={S.select} value={os.status} onChange={e => upd("status", e.target.value)}>{Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</select></FormField>}
        <FormField label="Mecânico"><select style={S.select} value={os.mecanicoId} onChange={e => upd("mecanicoId", e.target.value)}><option value="">Não atribuído</option>{mecanicos.filter(m => m.ativo).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></FormField>
        <FormField label="Solicitante"><input style={S.input} value={os.solicitante} onChange={e => upd("solicitante", e.target.value)} placeholder="Nome" /></FormField>
      </div>
      <FormField label="Descrição"><textarea style={{ ...S.input, minHeight: 80, resize: "vertical" }} value={os.descricao} onChange={e => upd("descricao", e.target.value)} placeholder="Detalhe o problema..." /></FormField>
      <FormField label="Observações"><textarea style={{ ...S.input, minHeight: 60, resize: "vertical" }} value={os.observacoes} onChange={e => upd("observacoes", e.target.value)} /></FormField>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, paddingTop: 16, borderTop: "1px solid #1F1F23", gap: 10, flexWrap: "wrap" }}>
        <div>{onDelete && <button style={S.btnDanger} onClick={onDelete}>Excluir</button>}</div>
        <div style={{ display: "flex", gap: 10 }}><button style={S.btnSecondary} onClick={onCancel}>Cancelar</button><button style={{ ...S.btnPrimary, opacity: canSave ? 1 : 0.4 }} onClick={canSave ? onSave : undefined}>{isEdit ? "Salvar" : "Criar OS"}</button></div>
      </div>
    </div>
  );
}

function OSDetail({ os, equipamentos, mecanicos, onEdit, vp }) {
  const equip = equipamentos.find(e => e.id === os.equipamentoId);
  const mec = mecanicos.find(m => m.id === os.mecanicoId);
  const grid = vp.isMobile ? "1fr" : "1fr 1fr";
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}><StatusBadge status={os.status} /><PrioridadeBadge prioridade={os.prioridade} /><span style={S.badge("#888")}>{os.tipo}</span></div>
      <h2 style={{ margin: "0 0 16px", fontSize: 16, color: "#E5E5E5", lineHeight: 1.4 }}>{os.titulo}</h2>
      <div style={{ display: "grid", gridTemplateColumns: grid, gap: "10px 20px", marginBottom: 16 }}>
        {[["Área", os.area], ["Equipamento", equip ? equip.nome + " (" + equip.tag + ")" : "—"], ["Mecânico", mec?.nome || "Não atribuído"], ["Solicitante", os.solicitante || "—"], ["Criação", fmtDateTime(os.dataCriacao)], ["Últ. Atualiz.", fmtDateTime(os.historico?.[os.historico.length - 1]?.data)]].map(([l, v]) => (
          <div key={l}><div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>{l}</div><div style={{ fontSize: 13, color: "#CCC" }}>{v}</div></div>
        ))}
      </div>
      {os.descricao && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Descrição</div><div style={{ fontSize: 13, color: "#CCC", lineHeight: 1.6, background: "#1A1A1E", padding: 12, borderRadius: 8 }}>{os.descricao}</div></div>}
      {os.historico?.length > 0 && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Histórico</div>
        <div style={{ borderLeft: "2px solid #2A2A30", marginLeft: 8, paddingLeft: 16 }}>{os.historico.slice().reverse().map((h, i) => (
          <div key={i} style={{ marginBottom: 12, position: "relative" }}><div style={{ position: "absolute", left: -22, top: 4, width: 8, height: 8, borderRadius: "50%", background: i === 0 ? ACCENT : "#2A2A30" }} /><div style={{ fontSize: 11, color: "#666" }}>{fmtDateTime(h.data)}</div><div style={{ fontSize: 12, color: "#CCC" }}>{h.acao}</div></div>
        ))}</div></div>}
      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 16, borderTop: "1px solid #1F1F23" }}><button style={S.btnPrimary} onClick={onEdit}>✏️ Editar</button></div>
    </div>
  );
}

// ══════════════════════════════════════════
//  EQUIPAMENTOS
// ══════════════════════════════════════════
function EquipamentosPage({ equipamentos, setEquipamentos, areas, ordens, vp }) {
  const [search, setSearch] = useState(""); const [filtroArea, setFiltroArea] = useState("TODOS");
  const [modal, setModal] = useState(null); const [item, setItem] = useState(null); const [confirm, setConfirm] = useState(null);
  const filtered = useMemo(() => equipamentos.filter(e => { if (filtroArea !== "TODOS" && e.area !== filtroArea) return false; if (search) { const s = search.toLowerCase(); return e.nome.toLowerCase().includes(s) || e.tag.toLowerCase().includes(s); } return true; }), [equipamentos, search, filtroArea]);
  const novo = () => { setItem({ id: genId(), nome: "", tag: "", area: areas[0]?.nome || "", fabricante: "", modelo: "", anoFabricacao: "", numeroSerie: "", localizacao: "", status: "Operando", observacoes: "" }); setModal("novo"); };
  const salvar = () => { if (!item.nome.trim() || !item.tag.trim()) return; const ex = equipamentos.find(e => e.id === item.id); setEquipamentos(ex ? equipamentos.map(e => e.id === item.id ? item : e) : [...equipamentos, item]); setModal(null); };
  const excluir = (id) => { setConfirm({ message: "Excluir equipamento?", onConfirm: () => { setEquipamentos(equipamentos.filter(e => e.id !== id)); setConfirm(null); setModal(null); } }); };
  const EQUIP_STATUS = ["Operando", "Parado", "Em Manutenção", "Desativado"];
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: vp.isMobile ? 22 : 32, letterSpacing: 2, color: ACCENT }}>EQUIPAMENTOS</h1>
        <button style={S.btnPrimary} onClick={novo}>+ NOVO</button>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Nome, TAG..." />
        <select style={{ ...S.select, width: 160 }} value={filtroArea} onChange={e => setFiltroArea(e.target.value)}><option value="TODOS">Todas Áreas</option>{areas.map(a => <option key={a.id} value={a.nome}>{a.nome}</option>)}</select>
      </div>
      {filtered.length === 0 ? <EmptyState icon="⚙️" message="Nenhum equipamento" action="Cadastrar" onAction={novo} /> : (
        <div style={{ display: "grid", gridTemplateColumns: vp.isMobile ? "1fr" : vp.isTablet ? "1fr 1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {filtered.map(e => { const osC = ordens.filter(o => o.equipamentoId === e.id && !["CONCLUIDA", "CANCELADA"].includes(o.status)).length; const sc = e.status === "Operando" ? "#22C55E" : e.status === "Parado" ? "#EF4444" : e.status === "Em Manutenção" ? "#F59E0B" : "#666";
            return (<div key={e.id} style={{ ...S.card, cursor: "pointer", borderLeft: "3px solid " + sc }} onClick={() => { setItem({ ...e }); setModal("editar"); }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontWeight: 700, color: "#E5E5E5", fontSize: 14 }}>{e.nome}</span><span style={S.badge(sc)}>{e.status}</span></div>
              <div style={{ fontSize: 12, color: ACCENT, marginBottom: 6 }}>TAG: {e.tag}</div>
              <div style={{ fontSize: 12, color: "#888" }}>{e.area}{e.fabricante && (" · " + e.fabricante)}</div>
              {osC > 0 && <div style={{ marginTop: 8, fontSize: 11, color: "#F59E0B" }}>🔧 {osC} OS ativa(s)</div>}
            </div>);
          })}
        </div>
      )}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "novo" ? "NOVO EQUIPAMENTO" : "EDITAR EQUIPAMENTO"} vp={vp}>
        {item && (<div>
          <div style={{ display: "grid", gridTemplateColumns: vp.isMobile ? "1fr" : "1fr 1fr", gap: "0 16px" }}>
            <FormField label="Nome" required><input style={S.input} value={item.nome} onChange={e => setItem({ ...item, nome: e.target.value })} placeholder="Carda C60" /></FormField>
            <FormField label="TAG" required><input style={S.input} value={item.tag} onChange={e => setItem({ ...item, tag: e.target.value })} placeholder="CRD-001" /></FormField>
            <FormField label="Área"><select style={S.select} value={item.area} onChange={e => setItem({ ...item, area: e.target.value })}>{areas.map(a => <option key={a.id} value={a.nome}>{a.nome}</option>)}</select></FormField>
            <FormField label="Status"><select style={S.select} value={item.status} onChange={e => setItem({ ...item, status: e.target.value })}>{EQUIP_STATUS.map(s => <option key={s}>{s}</option>)}</select></FormField>
            <FormField label="Fabricante"><input style={S.input} value={item.fabricante} onChange={e => setItem({ ...item, fabricante: e.target.value })} /></FormField>
            <FormField label="Modelo"><input style={S.input} value={item.modelo} onChange={e => setItem({ ...item, modelo: e.target.value })} /></FormField>
            <FormField label="Ano"><input style={S.input} value={item.anoFabricacao} onChange={e => setItem({ ...item, anoFabricacao: e.target.value })} /></FormField>
            <FormField label="Nº Série"><input style={S.input} value={item.numeroSerie} onChange={e => setItem({ ...item, numeroSerie: e.target.value })} /></FormField>
          </div>
          <FormField label="Localização"><input style={S.input} value={item.localizacao} onChange={e => setItem({ ...item, localizacao: e.target.value })} /></FormField>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, paddingTop: 16, borderTop: "1px solid #1F1F23", gap: 10, flexWrap: "wrap" }}>
            <div>{modal === "editar" && <button style={S.btnDanger} onClick={() => excluir(item.id)}>Excluir</button>}</div>
            <div style={{ display: "flex", gap: 10 }}><button style={S.btnSecondary} onClick={() => setModal(null)}>Cancelar</button><button style={{ ...S.btnPrimary, opacity: item.nome && item.tag ? 1 : 0.4 }} onClick={salvar}>Salvar</button></div>
          </div>
        </div>)}
      </Modal>
      <ConfirmDialog open={!!confirm} message={confirm?.message} onConfirm={confirm?.onConfirm} onCancel={() => setConfirm(null)} />
    </div>
  );
}

// ══════════════════════════════════════════
//  MECÂNICOS
// ══════════════════════════════════════════
function MecanicosPage({ mecanicos, setMecanicos, areas, ordens, vp }) {
  const [search, setSearch] = useState(""); const [modal, setModal] = useState(null); const [item, setItem] = useState(null); const [confirm, setConfirm] = useState(null);
  const filtered = mecanicos.filter(m => { if (!search) return true; const s = search.toLowerCase(); return m.nome.toLowerCase().includes(s) || m.matricula.toLowerCase().includes(s); });
  const novo = () => { setItem({ id: genId(), nome: "", matricula: "", especialidade: "", telefone: "", area: areas[0]?.nome || "", turno: "A", ativo: true, dataCadastro: new Date().toISOString() }); setModal("novo"); };
  const salvar = () => { if (!item.nome.trim() || !item.matricula.trim()) return; const ex = mecanicos.find(m => m.id === item.id); setMecanicos(ex ? mecanicos.map(m => m.id === item.id ? item : m) : [...mecanicos, item]); setModal(null); };
  const excluir = (id) => { setConfirm({ message: "Excluir mecânico?", onConfirm: () => { setMecanicos(mecanicos.filter(m => m.id !== id)); setConfirm(null); setModal(null); } }); };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: vp.isMobile ? 22 : 32, letterSpacing: 2, color: ACCENT }}>MECÂNICOS</h1>
        <button style={S.btnPrimary} onClick={novo}>+ NOVO</button>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Nome, matrícula..." />
        <span style={{ fontSize: 11, color: "#555", whiteSpace: "nowrap" }}>{filtered.filter(m => m.ativo).length} ativo(s)</span>
      </div>
      {filtered.length === 0 ? <EmptyState icon="👨‍🔧" message="Nenhum mecânico" action="Cadastrar" onAction={novo} /> : (
        <ResponsiveTable vp={vp} columns={["Matrícula", "Nome", "Especialidade", "Área", "Turno", "OS", "Status", ""]} data={filtered}
          renderCard={(m) => { const osA = ordens.filter(o => o.mecanicoId === m.id && !["CONCLUIDA", "CANCELADA"].includes(o.status)).length;
            return (<div key={m.id} style={{ ...S.card, padding: 16 }} onClick={() => { setItem({ ...m }); setModal("editar"); }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontWeight: 700, fontSize: 14, color: "#E5E5E5" }}>{m.nome}</span><span style={S.badge(m.ativo ? "#22C55E" : "#EF4444")}>{m.ativo ? "Ativo" : "Inativo"}</span></div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: "#999" }}>
                <span>Mat: <strong style={{ color: ACCENT }}>{m.matricula}</strong></span><span>{m.area}</span><span style={S.badge("#3B82F6")}>Turno {m.turno}</span>
                {osA > 0 && <span style={{ color: "#F59E0B" }}>🔧 {osA} OS</span>}
              </div>
              {m.especialidade && <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{m.especialidade}</div>}
            </div>); }}
          renderRow={(m) => { const osA = ordens.filter(o => o.mecanicoId === m.id && !["CONCLUIDA", "CANCELADA"].includes(o.status)).length;
            return (<tr key={m.id}>
              <td style={{ ...S.td, color: ACCENT, fontWeight: 700 }}>{m.matricula}</td><td style={S.td}>{m.nome}</td>
              <td style={{ ...S.td, color: "#999" }}>{m.especialidade || "—"}</td><td style={S.td}>{m.area}</td>
              <td style={S.td}><span style={S.badge("#3B82F6")}>Turno {m.turno}</span></td>
              <td style={S.td}><span style={{ color: osA > 0 ? "#F59E0B" : "#555", fontWeight: 700 }}>{osA}</span></td>
              <td style={S.td}><span style={S.badge(m.ativo ? "#22C55E" : "#EF4444")}>{m.ativo ? "Ativo" : "Inativo"}</span></td>
              <td style={S.td}><button style={{ ...S.btnSecondary, padding: "6px 10px", minHeight: 36 }} onClick={() => { setItem({ ...m }); setModal("editar"); }}>✏️</button></td>
            </tr>); }}
        />
      )}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "novo" ? "NOVO MECÂNICO" : "EDITAR MECÂNICO"} vp={vp}>
        {item && (<div>
          <div style={{ display: "grid", gridTemplateColumns: vp.isMobile ? "1fr" : "1fr 1fr", gap: "0 16px" }}>
            <FormField label="Nome" required><input style={S.input} value={item.nome} onChange={e => setItem({ ...item, nome: e.target.value })} /></FormField>
            <FormField label="Matrícula" required><input style={S.input} value={item.matricula} onChange={e => setItem({ ...item, matricula: e.target.value })} /></FormField>
            <FormField label="Especialidade"><input style={S.input} value={item.especialidade} onChange={e => setItem({ ...item, especialidade: e.target.value })} placeholder="Elétrica, Mecânica..." /></FormField>
            <FormField label="Telefone"><input style={S.input} type="tel" value={item.telefone} onChange={e => setItem({ ...item, telefone: e.target.value })} /></FormField>
            <FormField label="Área"><select style={S.select} value={item.area} onChange={e => setItem({ ...item, area: e.target.value })}>{areas.map(a => <option key={a.id} value={a.nome}>{a.nome}</option>)}</select></FormField>
            <FormField label="Turno"><select style={S.select} value={item.turno} onChange={e => setItem({ ...item, turno: e.target.value })}><option value="A">Turno A (06h-14h)</option><option value="B">Turno B (14h-22h)</option><option value="C">Turno C (22h-06h)</option><option value="ADM">Administrativo</option></select></FormField>
          </div>
          <FormField label="Status"><label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", minHeight: 44 }}><input type="checkbox" checked={item.ativo} onChange={e => setItem({ ...item, ativo: e.target.checked })} style={{ width: 20, height: 20 }} /><span style={{ fontSize: 14, color: item.ativo ? "#22C55E" : "#EF4444" }}>{item.ativo ? "Ativo" : "Inativo"}</span></label></FormField>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, paddingTop: 16, borderTop: "1px solid #1F1F23", gap: 10, flexWrap: "wrap" }}>
            <div>{modal === "editar" && <button style={S.btnDanger} onClick={() => excluir(item.id)}>Excluir</button>}</div>
            <div style={{ display: "flex", gap: 10 }}><button style={S.btnSecondary} onClick={() => setModal(null)}>Cancelar</button><button style={{ ...S.btnPrimary, opacity: item.nome && item.matricula ? 1 : 0.4 }} onClick={salvar}>Salvar</button></div>
          </div>
        </div>)}
      </Modal>
      <ConfirmDialog open={!!confirm} message={confirm?.message} onConfirm={confirm?.onConfirm} onCancel={() => setConfirm(null)} />
    </div>
  );
}

// ══════════════════════════════════════════
//  ESTOQUE DE PEÇAS
// ══════════════════════════════════════════
function PecasPage({ pecas, setPecas, areas, vp }) {
  const [search, setSearch] = useState(""); const [filtro, setFiltro] = useState("TODOS");
  const [modal, setModal] = useState(null); const [item, setItem] = useState(null); const [confirm, setConfirm] = useState(null);
  const [movModal, setMovModal] = useState(null); const [movQtd, setMovQtd] = useState(1); const [movObs, setMovObs] = useState("");
  const filtered = pecas.filter(p => { if (filtro === "BAIXO" && p.quantidade > p.estoqueMinimo) return false; if (filtro === "ZERADO" && p.quantidade > 0) return false; if (search) { const s = search.toLowerCase(); return p.nome.toLowerCase().includes(s) || p.codigo.toLowerCase().includes(s); } return true; });
  const nova = () => { setItem({ id: genId(), codigo: "", nome: "", descricao: "", categoria: "", unidade: "UN", quantidade: 0, estoqueMinimo: 5, localizacao: "", fornecedor: "", movimentacoes: [] }); setModal("novo"); };
  const salvar = () => { if (!item.nome.trim() || !item.codigo.trim()) return; const ex = pecas.find(p => p.id === item.id); setPecas(ex ? pecas.map(p => p.id === item.id ? item : p) : [...pecas, item]); setModal(null); };
  const registrarMov = (tipo) => { if (movQtd <= 0) return; const p = pecas.find(x => x.id === movModal); if (!p) return; const nq = tipo === "entrada" ? p.quantidade + movQtd : Math.max(0, p.quantidade - movQtd); const mov = { data: new Date().toISOString(), tipo, quantidade: movQtd, obs: movObs, saldoAnterior: p.quantidade, saldoNovo: nq }; setPecas(pecas.map(x => x.id === p.id ? { ...p, quantidade: nq, movimentacoes: [...(p.movimentacoes || []), mov] } : x)); setMovModal(null); setMovQtd(1); setMovObs(""); };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: vp.isMobile ? 22 : 32, letterSpacing: 2, color: ACCENT }}>ESTOQUE DE PEÇAS</h1>
        <button style={S.btnPrimary} onClick={nova}>+ NOVA</button>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Nome, código..." />
        <select style={{ ...S.select, width: 180 }} value={filtro} onChange={e => setFiltro(e.target.value)}><option value="TODOS">Todos</option><option value="BAIXO">⚠️ Estoque Baixo</option><option value="ZERADO">🔴 Zerado</option></select>
      </div>
      {filtered.length === 0 ? <EmptyState icon="📦" message="Nenhuma peça" action="Cadastrar" onAction={nova} /> : (
        <ResponsiveTable vp={vp} columns={["Código", "Nome", "Categ.", "Qtd", "Mín", "Status", "Ações"]} data={filtered}
          renderCard={(p) => { const low = p.quantidade <= p.estoqueMinimo; const zero = p.quantidade === 0;
            return (<div key={p.id} style={{ ...S.card, padding: 16, borderLeft: "3px solid " + (zero ? "#EF4444" : low ? "#F59E0B" : "#22C55E") }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: "#E5E5E5", fontSize: 14 }}>{p.nome}</span>
                {zero ? <span style={S.badge("#EF4444")}>ZERADO</span> : low ? <span style={S.badge("#F59E0B")}>BAIXO</span> : <span style={S.badge("#22C55E")}>OK</span>}
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#999", marginBottom: 8 }}>
                <span>Cód: <strong style={{ color: ACCENT }}>{p.codigo}</strong></span><span>Qtd: <strong style={{ color: zero ? "#EF4444" : low ? "#F59E0B" : "#22C55E" }}>{p.quantidade}</strong>/{p.estoqueMinimo}</span><span>{p.unidade}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}><button style={{ ...S.btnSecondary, flex: 1, fontSize: 12 }} onClick={() => { setMovModal(p.id); setMovQtd(1); setMovObs(""); }}>📦 Movimentar</button><button style={{ ...S.btnSecondary, fontSize: 12 }} onClick={() => { setItem({ ...p }); setModal("editar"); }}>✏️</button></div>
            </div>); }}
          renderRow={(p) => { const low = p.quantidade <= p.estoqueMinimo; const zero = p.quantidade === 0;
            return (<tr key={p.id}>
              <td style={{ ...S.td, color: ACCENT, fontWeight: 700 }}>{p.codigo}</td><td style={S.td}>{p.nome}</td>
              <td style={{ ...S.td, color: "#999" }}>{p.categoria || "—"}</td>
              <td style={{ ...S.td, fontWeight: 700, color: zero ? "#EF4444" : low ? "#F59E0B" : "#22C55E" }}>{p.quantidade}</td>
              <td style={{ ...S.td, color: "#666" }}>{p.estoqueMinimo}</td>
              <td style={S.td}>{zero ? <span style={S.badge("#EF4444")}>ZERADO</span> : low ? <span style={S.badge("#F59E0B")}>BAIXO</span> : <span style={S.badge("#22C55E")}>OK</span>}</td>
              <td style={S.td}><div style={{ display: "flex", gap: 4 }}>
                <button style={{ ...S.btnSecondary, padding: "6px 8px", minHeight: 36, fontSize: 12 }} onClick={() => { setMovModal(p.id); setMovQtd(1); setMovObs(""); }}>📦</button>
                <button style={{ ...S.btnSecondary, padding: "6px 8px", minHeight: 36, fontSize: 12 }} onClick={() => { setItem({ ...p }); setModal("editar"); }}>✏️</button>
              </div></td>
            </tr>); }}
        />
      )}
      <Modal open={modal === "novo" || modal === "editar"} onClose={() => setModal(null)} title={modal === "novo" ? "NOVA PEÇA" : "EDITAR PEÇA"} vp={vp}>
        {item && (<div>
          <div style={{ display: "grid", gridTemplateColumns: vp.isMobile ? "1fr" : "1fr 1fr", gap: "0 16px" }}>
            <FormField label="Código" required><input style={S.input} value={item.codigo} onChange={e => setItem({ ...item, codigo: e.target.value })} placeholder="PEC-001" /></FormField>
            <FormField label="Nome" required><input style={S.input} value={item.nome} onChange={e => setItem({ ...item, nome: e.target.value })} /></FormField>
            <FormField label="Categoria"><input style={S.input} value={item.categoria} onChange={e => setItem({ ...item, categoria: e.target.value })} placeholder="Rolamentos, Correias..." /></FormField>
            <FormField label="Unidade"><select style={S.select} value={item.unidade} onChange={e => setItem({ ...item, unidade: e.target.value })}>{["UN", "PC", "MT", "KG", "LT", "CX", "JG", "RL", "PR"].map(u => <option key={u}>{u}</option>)}</select></FormField>
            <FormField label="Qtd Atual"><input style={S.input} type="number" min="0" value={item.quantidade} onChange={e => setItem({ ...item, quantidade: parseInt(e.target.value) || 0 })} /></FormField>
            <FormField label="Estoque Mín"><input style={S.input} type="number" min="0" value={item.estoqueMinimo} onChange={e => setItem({ ...item, estoqueMinimo: parseInt(e.target.value) || 0 })} /></FormField>
            <FormField label="Localização"><input style={S.input} value={item.localizacao} onChange={e => setItem({ ...item, localizacao: e.target.value })} /></FormField>
            <FormField label="Fornecedor"><input style={S.input} value={item.fornecedor} onChange={e => setItem({ ...item, fornecedor: e.target.value })} /></FormField>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, paddingTop: 16, borderTop: "1px solid #1F1F23", gap: 10, flexWrap: "wrap" }}>
            <div>{modal === "editar" && <button style={S.btnDanger} onClick={() => { setConfirm({ message: "Excluir peça?", onConfirm: () => { setPecas(pecas.filter(p => p.id !== item.id)); setConfirm(null); setModal(null); } }); }}>Excluir</button>}</div>
            <div style={{ display: "flex", gap: 10 }}><button style={S.btnSecondary} onClick={() => setModal(null)}>Cancelar</button><button style={{ ...S.btnPrimary, opacity: item.nome && item.codigo ? 1 : 0.4 }} onClick={salvar}>Salvar</button></div>
          </div>
        </div>)}
      </Modal>
      <Modal open={!!movModal} onClose={() => setMovModal(null)} title="MOVIMENTAÇÃO" vp={vp}>
        {movModal && (() => { const p = pecas.find(x => x.id === movModal); if (!p) return null;
          return (<div>
            <div style={{ background: "#1A1A1E", padding: 14, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#E5E5E5" }}>{p.nome}</div>
              <div style={{ fontSize: 13, color: "#888" }}>Cód: {p.codigo} · Estoque: <strong style={{ color: ACCENT }}>{p.quantidade} {p.unidade}</strong></div>
            </div>
            <FormField label="Quantidade"><input style={S.input} type="number" min="1" value={movQtd} onChange={e => setMovQtd(parseInt(e.target.value) || 0)} /></FormField>
            <FormField label="Observação"><input style={S.input} value={movObs} onChange={e => setMovObs(e.target.value)} placeholder="OS vinculada, motivo..." /></FormField>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button style={{ ...S.btnPrimary, flex: 1, background: "#22C55E" }} onClick={() => registrarMov("entrada")}>↓ ENTRADA</button>
              <button style={{ ...S.btnPrimary, flex: 1, background: "#EF4444" }} onClick={() => registrarMov("saida")}>↑ SAÍDA</button>
            </div>
          </div>);
        })()}
      </Modal>
      <ConfirmDialog open={!!confirm} message={confirm?.message} onConfirm={confirm?.onConfirm} onCancel={() => setConfirm(null)} />
    </div>
  );
}

// ══════════════════════════════════════════
//  ÁREAS
// ══════════════════════════════════════════
function AreasPage({ areas, setAreas, ordens, equipamentos, vp }) {
  const [modal, setModal] = useState(null); const [item, setItem] = useState(null); const [confirm, setConfirm] = useState(null);
  const nova = () => { setItem({ id: genId(), nome: "", descricao: "", responsavel: "" }); setModal("novo"); };
  const salvar = () => { if (!item.nome.trim()) return; const ex = areas.find(a => a.id === item.id); setAreas(ex ? areas.map(a => a.id === item.id ? item : a) : [...areas, item]); setModal(null); };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: vp.isMobile ? 22 : 32, letterSpacing: 2, color: ACCENT }}>ÁREAS & SETORES</h1>
        <button style={S.btnPrimary} onClick={nova}>+ NOVA</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: vp.isMobile ? "1fr" : vp.isTablet ? "1fr 1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {areas.map(a => { const osA = ordens.filter(o => o.area === a.nome && !["CONCLUIDA", "CANCELADA"].includes(o.status)).length; const eq = equipamentos.filter(e => e.area === a.nome).length;
          return (<div key={a.id} style={{ ...S.card, cursor: "pointer" }} onClick={() => { setItem({ ...a }); setModal("editar"); }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, letterSpacing: 1, color: ACCENT, marginBottom: 4 }}>{a.nome}</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>{a.descricao || "Sem descrição"}</div>
            <div style={{ display: "flex", gap: 14, fontSize: 12 }}><span style={{ color: "#3B82F6" }}>⚙️ {eq} equip.</span><span style={{ color: osA > 0 ? "#F59E0B" : "#555" }}>📋 {osA} OS</span></div>
            {a.responsavel && <div style={{ fontSize: 11, color: "#666", marginTop: 8 }}>Resp.: {a.responsavel}</div>}
          </div>);
        })}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "novo" ? "NOVA ÁREA" : "EDITAR ÁREA"} vp={vp}>
        {item && (<div>
          <FormField label="Nome" required><input style={S.input} value={item.nome} onChange={e => setItem({ ...item, nome: e.target.value })} placeholder="Fiação" /></FormField>
          <FormField label="Descrição"><textarea style={{ ...S.input, minHeight: 60, resize: "vertical" }} value={item.descricao} onChange={e => setItem({ ...item, descricao: e.target.value })} /></FormField>
          <FormField label="Responsável"><input style={S.input} value={item.responsavel} onChange={e => setItem({ ...item, responsavel: e.target.value })} /></FormField>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, paddingTop: 16, borderTop: "1px solid #1F1F23", gap: 10, flexWrap: "wrap" }}>
            <div>{modal === "editar" && <button style={S.btnDanger} onClick={() => { setConfirm({ message: "Excluir área?", onConfirm: () => { setAreas(areas.filter(a => a.id !== item.id)); setConfirm(null); setModal(null); } }); }}>Excluir</button>}</div>
            <div style={{ display: "flex", gap: 10 }}><button style={S.btnSecondary} onClick={() => setModal(null)}>Cancelar</button><button style={{ ...S.btnPrimary, opacity: item.nome ? 1 : 0.4 }} onClick={salvar}>Salvar</button></div>
          </div>
        </div>)}
      </Modal>
      <ConfirmDialog open={!!confirm} message={confirm?.message} onConfirm={confirm?.onConfirm} onCancel={() => setConfirm(null)} />
    </div>
  );
}

// ─── NAV ───
const NAV = [
  { key: "dashboard", label: "Dashboard", icon: "📊", short: "Dash" },
  { key: "ordens", label: "Ordens de Serviço", icon: "📋", short: "OS" },
  { key: "equipamentos", label: "Equipamentos", icon: "⚙️", short: "Equip" },
  { key: "mecanicos", label: "Mecânicos", icon: "👨‍🔧", short: "Mec" },
  { key: "pecas", label: "Estoque", icon: "📦", short: "Peças" },
  { key: "areas", label: "Áreas", icon: "🏭", short: "Áreas" },
];

// ═══════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════
export default function TelosApp() {
  const vp = useViewport();
  const [page, setPage] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ordens, setOrdens] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [mecanicos, setMecanicos] = useState([]);
  const [areas, setAreas] = useState([]);
  const [pecas, setPecas] = useState([]);

  useEffect(() => {
    (async () => {
      const [o, e, m, a, p] = await Promise.all([loadData(STORAGE_KEYS.ordens), loadData(STORAGE_KEYS.equipamentos), loadData(STORAGE_KEYS.mecanicos), loadData(STORAGE_KEYS.areas), loadData(STORAGE_KEYS.pecas)]);
      setOrdens(o || []); setEquipamentos(e || []); setMecanicos(m || []); setAreas(a || DEFAULT_AREAS); setPecas(p || []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => { if (!loading) saveData(STORAGE_KEYS.ordens, ordens); }, [ordens, loading]);
  useEffect(() => { if (!loading) saveData(STORAGE_KEYS.equipamentos, equipamentos); }, [equipamentos, loading]);
  useEffect(() => { if (!loading) saveData(STORAGE_KEYS.mecanicos, mecanicos); }, [mecanicos, loading]);
  useEffect(() => { if (!loading) saveData(STORAGE_KEYS.areas, areas); }, [areas, loading]);
  useEffect(() => { if (!loading) saveData(STORAGE_KEYS.pecas, pecas); }, [pecas, loading]);

  const navigate = (key) => { setPage(key); setSidebarOpen(false); };

  if (loading) return (
    <div style={{ fontFamily: FONT, background: "#0A0A0B", color: "#E5E5E5", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}><div style={{ fontFamily: FONT_DISPLAY, fontSize: 48, color: ACCENT, letterSpacing: 4, marginBottom: 16 }}>TELOS</div><div style={{ color: "#666", fontSize: 13 }}>Carregando...</div></div>
    </div>
  );

  const sidebarWidth = vp.isDesktop ? 230 : 260;

  return (
    <div style={{ fontFamily: FONT, background: "#0A0A0B", color: "#E5E5E5", minHeight: "100vh", fontSize: 13 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2A2A30; border-radius: 3px; }
        input:focus, select:focus, textarea:focus { border-color: ${ACCENT} !important; outline: none; }
        button:active { transform: scale(0.97); }
        @media (hover: hover) { button:hover { filter: brightness(1.12); } }
      `}</style>

      {/* MOBILE TOP BAR */}
      {!vp.isDesktop && (
        <header style={{ position: "fixed", top: 0, left: 0, right: 0, height: 56, background: "#111113", borderBottom: "1px solid #1F1F23", display: "flex", alignItems: "center", padding: "0 16px", zIndex: 200, gap: 12 }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", color: "#E5E5E5", fontSize: 22, cursor: "pointer", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>☰</button>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: ACCENT, letterSpacing: 3 }}>TELOS</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 10, color: "#555" }}>v{APP_VERSION}</div>
        </header>
      )}

      {/* SIDEBAR OVERLAY */}
      {!vp.isDesktop && sidebarOpen && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 290 }} onClick={() => setSidebarOpen(false)} />}

      {/* SIDEBAR */}
      <aside style={{
        width: sidebarWidth, background: "#111113", borderRight: "1px solid #1F1F23",
        display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 300,
        transform: vp.isDesktop ? "none" : sidebarOpen ? "translateX(0)" : "translateX(-" + (sidebarWidth + 10) + "px)",
        transition: "transform 0.3s cubic-bezier(.4,0,.2,1)",
        boxShadow: !vp.isDesktop && sidebarOpen ? "4px 0 24px rgba(0,0,0,0.5)" : "none",
      }}>
        <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid #1F1F23" }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 32, color: ACCENT, letterSpacing: 4, lineHeight: 1 }}>TELOS</div>
          <div style={{ fontSize: 9, color: "#555", letterSpacing: 2, marginTop: 4 }}>GESTÃO DE MANUTENÇÃO</div>
        </div>
        <nav style={{ flex: 1, padding: "10px 0", overflowY: "auto" }}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => navigate(n.key)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "12px 18px", background: page === n.key ? "#1A1A1E" : "transparent",
              border: "none", borderLeft: page === n.key ? ("3px solid " + ACCENT) : "3px solid transparent",
              color: page === n.key ? ACCENT : "#888", fontSize: 13, fontFamily: FONT,
              cursor: "pointer", textAlign: "left", transition: "all 0.15s", minHeight: 44,
            }}>
              <span style={{ fontSize: 18 }}>{n.icon}</span> {n.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "14px 18px", borderTop: "1px solid #1F1F23", fontSize: 10, color: "#444" }}>v{APP_VERSION} · Fábrica de Algodão</div>
      </aside>

      {/* MOBILE BOTTOM NAV */}
      {vp.isMobile && (
        <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 64, background: "#111113", borderTop: "1px solid #1F1F23", display: "flex", zIndex: 200, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => navigate(n.key)} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 2, background: "none", border: "none", cursor: "pointer",
              color: page === n.key ? ACCENT : "#666", fontSize: 10, fontFamily: FONT, transition: "color 0.15s",
            }}>
              <span style={{ fontSize: 20 }}>{n.icon}</span><span>{n.short}</span>
            </button>
          ))}
        </nav>
      )}

      {/* MAIN */}
      <main style={{
        marginLeft: vp.isDesktop ? sidebarWidth : 0,
        padding: vp.isMobile ? "72px 16px 80px" : vp.isTablet ? "72px 24px 24px" : "24px 32px",
        minHeight: "100vh",
      }}>
        {page === "dashboard" && <Dashboard ordens={ordens} equipamentos={equipamentos} mecanicos={mecanicos} pecas={pecas} areas={areas} vp={vp} />}
        {page === "ordens" && <OrdensPage ordens={ordens} setOrdens={setOrdens} equipamentos={equipamentos} mecanicos={mecanicos} areas={areas} pecas={pecas} setPecas={setPecas} vp={vp} />}
        {page === "equipamentos" && <EquipamentosPage equipamentos={equipamentos} setEquipamentos={setEquipamentos} areas={areas} ordens={ordens} vp={vp} />}
        {page === "mecanicos" && <MecanicosPage mecanicos={mecanicos} setMecanicos={setMecanicos} areas={areas} ordens={ordens} vp={vp} />}
        {page === "pecas" && <PecasPage pecas={pecas} setPecas={setPecas} areas={areas} vp={vp} />}
        {page === "areas" && <AreasPage areas={areas} setAreas={setAreas} ordens={ordens} equipamentos={equipamentos} vp={vp} />}
      </main>
    </div>
  );
}
