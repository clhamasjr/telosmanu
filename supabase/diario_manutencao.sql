-- Tabela do Diário de Manutenção (resumos dos relatórios manuscritos escaneados)
-- Rodar no Supabase: SQL Editor → colar → Run

create table if not exists public.diario_manutencao (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  tecnico text not null,
  mecanico_id uuid references public.mecanicos(id),
  turno text,
  arquivo text,
  resumo text,
  atividades jsonb default '[]'::jsonb,
  observacao text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (data, tecnico)
);

alter table public.diario_manutencao enable row level security;

drop policy if exists "diario_all" on public.diario_manutencao;
create policy "diario_all" on public.diario_manutencao
  for all using (true) with check (true);
