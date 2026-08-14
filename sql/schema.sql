-- Sistema de Carteira Digital ACAC
-- Rode este script inteiro no SQL Editor do seu projeto Supabase (Project > SQL Editor > New query).
-- Pode rodar de uma vez só, de cima a baixo.

create extension if not exists pgcrypto;

-- =========================================================
-- TABELAS
-- =========================================================

create table if not exists public.filiados (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text not null,
  empresa text not null,
  foto_url text,
  situacao text not null default 'pendente' check (situacao in ('ativo', 'inativo', 'pendente')),
  token_qr uuid not null unique default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  criado_em timestamptz not null default now()
);

create table if not exists public.validacoes (
  id uuid primary key default gen_random_uuid(),
  filiado_id uuid not null references public.filiados (id) on delete cascade,
  validado_em timestamptz not null default now(),
  origem text
);

create table if not exists public.historico_alteracoes (
  id uuid primary key default gen_random_uuid(),
  filiado_id uuid not null references public.filiados (id) on delete cascade,
  admin_id uuid references auth.users (id),
  campo text not null,
  valor_anterior text,
  valor_novo text,
  alterado_em timestamptz not null default now()
);

create index if not exists idx_filiados_token_qr on public.filiados (token_qr);
create index if not exists idx_filiados_situacao on public.filiados (situacao);
create index if not exists idx_historico_filiado on public.historico_alteracoes (filiado_id);

-- =========================================================
-- FUNÇÃO AUXILIAR: sou admin?
-- =========================================================

create or replace function public.eh_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- =========================================================
-- TRIGGERS: atualizado_em + auditoria automática
-- =========================================================

create or replace function public.set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_filiados_atualizado_em on public.filiados;
create trigger trg_filiados_atualizado_em
  before update on public.filiados
  for each row execute function public.set_atualizado_em();

create or replace function public.registrar_historico_filiado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.situacao is distinct from old.situacao then
    insert into public.historico_alteracoes (filiado_id, admin_id, campo, valor_anterior, valor_novo)
    values (new.id, auth.uid(), 'situacao', old.situacao, new.situacao);
  end if;
  if new.nome is distinct from old.nome then
    insert into public.historico_alteracoes (filiado_id, admin_id, campo, valor_anterior, valor_novo)
    values (new.id, auth.uid(), 'nome', old.nome, new.nome);
  end if;
  if new.empresa is distinct from old.empresa then
    insert into public.historico_alteracoes (filiado_id, admin_id, campo, valor_anterior, valor_novo)
    values (new.id, auth.uid(), 'empresa', old.empresa, new.empresa);
  end if;
  if new.cnpj is distinct from old.cnpj then
    insert into public.historico_alteracoes (filiado_id, admin_id, campo, valor_anterior, valor_novo)
    values (new.id, auth.uid(), 'cnpj', old.cnpj, new.cnpj);
  end if;
  if new.foto_url is distinct from old.foto_url then
    insert into public.historico_alteracoes (filiado_id, admin_id, campo, valor_anterior, valor_novo)
    values (new.id, auth.uid(), 'foto_url', old.foto_url, new.foto_url);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_filiados_historico on public.filiados;
create trigger trg_filiados_historico
  after update on public.filiados
  for each row execute function public.registrar_historico_filiado();

-- =========================================================
-- FUNÇÃO PÚBLICA: consulta por token (retorna no máximo 1 linha)
-- Usada pela carteirinha do filiado e pela validação da empresa parceira.
-- Nunca expõe listagem completa nem CNPJ na validação pública.
-- =========================================================

create or replace function public.consultar_por_token(p_token uuid)
returns table (
  nome text,
  empresa text,
  foto_url text,
  situacao text
)
language sql
security definer
stable
set search_path = public
as $$
  select f.nome, f.empresa, f.foto_url, f.situacao
  from public.filiados f
  where f.token_qr = p_token
  limit 1;
$$;

grant execute on function public.consultar_por_token(uuid) to anon, authenticated;

-- Registra o log de validação (empresa parceira escaneou o QR).
create or replace function public.registrar_validacao(p_token uuid, p_origem text default 'web')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filiado_id uuid;
begin
  select id into v_filiado_id from public.filiados where token_qr = p_token limit 1;
  if v_filiado_id is not null then
    insert into public.validacoes (filiado_id, origem) values (v_filiado_id, p_origem);
  end if;
end;
$$;

grant execute on function public.registrar_validacao(uuid, text) to anon, authenticated;

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.filiados enable row level security;
alter table public.admins enable row level security;
alter table public.validacoes enable row level security;
alter table public.historico_alteracoes enable row level security;

-- filiados: NENHUM select direto público. Leitura pública só via consultar_por_token (acima).
drop policy if exists "admins podem ver todos filiados" on public.filiados;
create policy "admins podem ver todos filiados"
  on public.filiados for select
  to authenticated
  using (public.eh_admin());

drop policy if exists "qualquer um pode se cadastrar como pendente" on public.filiados;
create policy "qualquer um pode se cadastrar como pendente"
  on public.filiados for insert
  to anon, authenticated
  with check (situacao = 'pendente');

drop policy if exists "admins podem editar filiados" on public.filiados;
create policy "admins podem editar filiados"
  on public.filiados for update
  to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

drop policy if exists "admins podem excluir filiados" on public.filiados;
create policy "admins podem excluir filiados"
  on public.filiados for delete
  to authenticated
  using (public.eh_admin());

-- admins: só admins autenticados podem ver a lista de admins.
drop policy if exists "admins podem ver admins" on public.admins;
create policy "admins podem ver admins"
  on public.admins for select
  to authenticated
  using (public.eh_admin());

-- validacoes: insert público (log de leitura de QR), select só admin.
drop policy if exists "qualquer um pode registrar validacao" on public.validacoes;
create policy "qualquer um pode registrar validacao"
  on public.validacoes for insert
  to anon, authenticated
  with check (true);

drop policy if exists "admins podem ver validacoes" on public.validacoes;
create policy "admins podem ver validacoes"
  on public.validacoes for select
  to authenticated
  using (public.eh_admin());

-- historico_alteracoes: só admins veem; inserts vêm só da trigger (security definer).
drop policy if exists "admins podem ver historico" on public.historico_alteracoes;
create policy "admins podem ver historico"
  on public.historico_alteracoes for select
  to authenticated
  using (public.eh_admin());

-- =========================================================
-- STORAGE: bucket público de fotos dos filiados
-- =========================================================

insert into storage.buckets (id, name, public)
values ('fotos-filiados', 'fotos-filiados', true)
on conflict (id) do nothing;

drop policy if exists "leitura publica de fotos" on storage.objects;
create policy "leitura publica de fotos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'fotos-filiados');

drop policy if exists "admins podem gerenciar fotos" on storage.objects;
create policy "admins podem gerenciar fotos"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'fotos-filiados' and public.eh_admin())
  with check (bucket_id = 'fotos-filiados' and public.eh_admin());

-- Formulário público de cadastro precisa subir a foto 3x4 antes de existir um admin logado.
-- Restringe: só pode gravar dentro da pasta "pendentes/", nunca sobrescrever fotos existentes.
drop policy if exists "publico pode enviar foto pendente" on storage.objects;
create policy "publico pode enviar foto pendente"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'fotos-filiados'
    and (storage.foldername(name))[1] = 'pendentes'
  );

-- O script de importação usa a service role key, que ignora RLS —
-- então ele consegue subir as fotos iniciais mesmo antes de você ter um admin cadastrado.

-- =========================================================
-- PRIMEIRO ADMIN
-- =========================================================
-- Depois de criar seu usuário em Authentication > Users (e-mail/senha),
-- rode o comando abaixo substituindo o e-mail:
--
-- insert into public.admins (user_id, nome)
-- select id, 'Seu Nome' from auth.users where email = 'seu-email@exemplo.com';
