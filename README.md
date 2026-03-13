# TELOS - Sistema de Gestão de Manutenção Industrial v3

Sistema completo para fábrica de algodão Telos.

## Stack
- **Frontend:** React 18 + Vite
- **Backend/DB:** Supabase (PostgreSQL)
- **Responsivo:** Mobile, Tablet, Desktop

## Módulos
- 📊 Dashboard — KPIs, OS abertas/andamento, alertas estoque
- 📋 Ordens de Serviço — CRUD + workflow + histórico
- ⚙️ Equipamentos — Cadastro com nome editável, TAG, área
- 👨‍🔧 Mecânicos — Histórico de OS por período, custo/hora
- 📦 Estoque — Movimentação entrada/saída, alertas
- 🏭 Áreas — Equipamentos por área expandíveis
- 📅 Preventiva — Calendário + planejamento periódico
- 📈 Relatórios — MTTR, MTBF, HH por mecânico, controle de horas
- 👥 Usuários — Perfis (admin/gestor/mecânico/operador) com área

## Deploy (Vercel)
1. Suba no GitHub
2. Conecte na Vercel
3. Configure Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy

## Rodar local
```bash
npm install
npm run dev
```

## Estrutura
```
src/
├── main.jsx, App.jsx, index.css
├── lib/supabase.js, constants.js
├── hooks/useData.js
├── components/Layout.jsx, UI.jsx
└── pages/Dashboard.jsx, OrdensServico.jsx, CadastroPages.jsx, ExtraPages.jsx
```
