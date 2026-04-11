# TELOS - Sistema de Gestao de Manutencao Industrial v3

Sistema completo para fabrica de algodao Telos.
17.683 OS importadas do SOFMAN CMMS (2020-2025).

## Stack
- Frontend: React 18 + Vite
- Backend: Supabase (PostgreSQL)
- Deploy: Vercel

## Modulos
- Dashboard (KPIs, OS abertas/andamento, alertas estoque)
- Ordens de Servico (CRUD + workflow + historico)
- Equipamentos (cadastro editavel, TAG, area)
- Mecanicos (historico OS por periodo, custo/hora)
- Estoque (movimentacao, alertas)
- Areas (equipamentos vinculados)
- Preventiva (calendario + planejamento)
- Relatorios (MTTR, MTBF, HH, controle horas)
- Usuarios (perfis com area pre-definida)

## Deploy Vercel
1. Suba no GitHub
2. Conecte na Vercel
3. Environment Variables: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
4. Deploy

## Rodar local
npm install && npm run dev
