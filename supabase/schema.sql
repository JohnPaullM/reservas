-- =====================================================================
--  SISTEMA DE RESERVAS — estrutura do banco de dados (Supabase)
--  Como usar: Supabase > SQL Editor > New query > cole TUDO > Run
--  Pode rodar mais de uma vez sem problema.
-- =====================================================================

-- ---------- Tabela de reservas ----------
create table if not exists public.reservas (
  id            bigint generated always as identity primary key,
  data          date    not null,
  hora          time    not null,
  motivo        text    not null,
  pessoas       integer not null check (pessoas > 0),
  cliente       text,
  telefone      text,
  observacoes   text,
  status        text    not null default 'confirmada'
                check (status in ('confirmada', 'cancelada')),
  criado_por    text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists reservas_data_idx on public.reservas (data);

-- Atualiza "atualizado_em" sozinho a cada alteração
create or replace function public.tocar_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists reservas_atualizado_em on public.reservas;
create trigger reservas_atualizado_em
  before update on public.reservas
  for each row execute function public.tocar_atualizado_em();

-- Segurança: só quem fez login (funcionários cadastrados) acessa
alter table public.reservas enable row level security;

drop policy if exists "Equipe pode ver reservas"     on public.reservas;
drop policy if exists "Equipe pode criar reservas"   on public.reservas;
drop policy if exists "Equipe pode editar reservas"  on public.reservas;
drop policy if exists "Equipe pode excluir reservas" on public.reservas;

create policy "Equipe pode ver reservas"     on public.reservas for select to authenticated using (true);
create policy "Equipe pode criar reservas"   on public.reservas for insert to authenticated with check (true);
create policy "Equipe pode editar reservas"  on public.reservas for update to authenticated using (true) with check (true);
create policy "Equipe pode excluir reservas" on public.reservas for delete to authenticated using (true);

-- Atualização ao vivo: quando alguém cria/edita uma reserva,
-- as telas abertas dos colegas se atualizam sozinhas
do $$
begin
  alter publication supabase_realtime add table public.reservas;
exception when duplicate_object then null;
end;
$$;

-- ---------- Aparelhos que recebem o alerta diário ----------
create table if not exists public.inscricoes_push (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  dispositivo text,
  criado_em   timestamptz not null default now()
);

alter table public.inscricoes_push enable row level security;

drop policy if exists "Ver os proprios aparelhos"     on public.inscricoes_push;
drop policy if exists "Excluir os proprios aparelhos" on public.inscricoes_push;

create policy "Ver os proprios aparelhos"     on public.inscricoes_push for select to authenticated using (user_id = auth.uid());
create policy "Excluir os proprios aparelhos" on public.inscricoes_push for delete to authenticated using (user_id = auth.uid());

-- ---------- Pedidos especiais (foto na taça, nome na taça...) ----------
-- Guardado como {"Foto na taça": "", "Nome na taça": "Ana e João"}
alter table public.reservas add column if not exists extras jsonb not null default '{}'::jsonb;

-- ---------- Fotos anexadas às reservas ----------
create table if not exists public.anexos (
  id          bigint generated always as identity primary key,
  reserva_id  bigint not null references public.reservas(id) on delete cascade,
  caminho     text not null unique,
  nome        text,
  tipo        text,
  tamanho     integer,
  criado_por  text,
  criado_em   timestamptz not null default now()
);
create index if not exists anexos_reserva_idx on public.anexos (reserva_id);

alter table public.anexos enable row level security;

drop policy if exists "Equipe pode ver anexos"     on public.anexos;
drop policy if exists "Equipe pode criar anexos"   on public.anexos;
drop policy if exists "Equipe pode excluir anexos" on public.anexos;

create policy "Equipe pode ver anexos"     on public.anexos for select to authenticated using (true);
create policy "Equipe pode criar anexos"   on public.anexos for insert to authenticated with check (true);
create policy "Equipe pode excluir anexos" on public.anexos for delete to authenticated using (true);

do $$
begin
  alter publication supabase_realtime add table public.anexos;
exception when duplicate_object then null;
end;
$$;

-- Pasta privada onde ficam as fotos (máx. 10 MB por arquivo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anexos', 'anexos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "Equipe ve fotos"      on storage.objects;
drop policy if exists "Equipe envia fotos"   on storage.objects;
drop policy if exists "Equipe altera fotos"  on storage.objects;
drop policy if exists "Equipe apaga fotos"   on storage.objects;

create policy "Equipe ve fotos"     on storage.objects for select to authenticated using (bucket_id = 'anexos');
create policy "Equipe envia fotos"  on storage.objects for insert to authenticated with check (bucket_id = 'anexos');
create policy "Equipe altera fotos" on storage.objects for update to authenticated using (bucket_id = 'anexos');
create policy "Equipe apaga fotos"  on storage.objects for delete to authenticated using (bucket_id = 'anexos');

-- Registra (ou atualiza) o aparelho de quem está logado
create or replace function public.registrar_push(
  p_endpoint text, p_p256dh text, p_auth text, p_dispositivo text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  insert into public.inscricoes_push (user_id, endpoint, p256dh, auth, dispositivo)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_dispositivo)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        dispositivo = excluded.dispositivo;
end;
$$;

revoke all on function public.registrar_push(text, text, text, text) from public, anon;
grant execute on function public.registrar_push(text, text, text, text) to authenticated;
