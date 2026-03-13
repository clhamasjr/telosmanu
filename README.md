# TELOS - Sistema de Gestão de Manutenção Industrial

Sistema completo de gestão de ordens de serviço, manutenção de equipamentos e controle de estoque para a fábrica de algodão Telos.

## Stack

- **Frontend:** React 18 + Vite
- **Backend/DB:** Supabase (PostgreSQL)
- **Responsivo:** Mobile, Tablet e Desktop

## Módulos

- 📊 **Dashboard** — KPIs, OS por área, alertas de estoque
- 📋 **Ordens de Serviço** — CRUD completo com workflow de status e histórico
- ⚙️ **Equipamentos** — Cadastro com código, TAG, área e status operacional
- 👨‍🔧 **Mecânicos** — Matrícula, especialidade, turno
- 📦 **Estoque de Peças** — Controle com alertas e movimentação entrada/saída
- 🏭 **Áreas & Setores** — Gestão por departamento

## Deploy Rápido (Vercel)

### 1. Subir no GitHub

```bash
git init
git add .
git commit -m "TELOS v2.0"
git remote add origin https://github.com/SEU-USUARIO/telos-manutencao.git
git push -u origin main
```

### 2. Deploy na Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Clique **"Add New Project"**
3. Selecione o repositório **telos-manutencao**
4. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` = `https://pbwozmqlzvqpjyhwtfji.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `sua-anon-key`
5. Clique **Deploy**
6. Pronto! Acesse pelo link gerado

### Alternativa: Rodar Local

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`

## Estrutura do Projeto

```
telos-app/
├── index.html
├── package.json
├── vite.config.js
├── .env                          # Credenciais Supabase
├── .gitignore
├── src/
│   ├── main.jsx                  # Entry point
│   ├── App.jsx                   # Router principal
│   ├── index.css                 # Estilos globais
│   ├── lib/
│   │   ├── supabase.js           # Cliente Supabase
│   │   └── constants.js          # Status, prioridades, nav
│   ├── hooks/
│   │   └── useData.js            # Hooks de dados (useOrdens, useTable, useDashboard)
│   ├── components/
│   │   ├── Layout.jsx            # Sidebar responsiva + bottom nav
│   │   └── UI.jsx                # Componentes compartilhados
│   └── pages/
│       ├── Dashboard.jsx         # Dashboard com KPIs
│       ├── OrdensServico.jsx     # OS completa
│       └── CadastroPages.jsx     # Equipamentos, Mecânicos, Peças, Áreas
```

## Banco de Dados (Supabase)

Tabelas principais: `ordens_servico`, `equipamentos`, `mecanicos`, `materiais`, `areas`, `status_os`, `tipos_manutencao`, `tipos_falha`, `os_historico`, `apontamento_hh`, `movimentacao_estoque`

---

Desenvolvido para **Telos · Fábrica de Algodão**
