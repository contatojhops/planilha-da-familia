-- ENUMS
create type public.family_role as enum ('admin','member','viewer');
create type public.tx_type as enum ('income','expense');
create type public.tx_status as enum ('planned','realized');
create type public.payment_method as enum ('cash','debit','credit','pix','boleto','transfer','other');
create type public.recurrence as enum ('none','monthly','yearly','installment');
create type public.category_kind as enum ('income','fixed_expense','variable_expense','debt');
create type public.bill_status as enum ('pending','paid','overdue','scheduled');
create type public.asset_class as enum ('fixed_income','stocks','funds','crypto','pension','real_estate','other');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  email text,
  whatsapp text,
  notify_bill_due boolean not null default true,
  notify_negative_month boolean not null default true,
  notify_over_budget boolean not null default true,
  notify_goal_reached boolean not null default true,
  alert_days_before int[] not null default '{3,1,0}',
  theme text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- FAMILIES
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'BRL',
  emergency_fund_target numeric(14,2) not null default 0,
  created_by uuid not null references auth.users,
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.families to authenticated;
grant all on public.families to service_role;
alter table public.families enable row level security;

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role public.family_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);
grant select, insert, update, delete on public.family_members to authenticated;
grant all on public.family_members to service_role;
alter table public.family_members enable row level security;

-- SECURITY DEFINER HELPERS
create or replace function public.is_family_member(_family_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.family_members where family_id = _family_id and user_id = auth.uid());
$$;

create or replace function public.family_role_of(_family_id uuid)
returns public.family_role language sql stable security definer set search_path = public as $$
  select role from public.family_members where family_id = _family_id and user_id = auth.uid();
$$;

create or replace function public.can_write(_family_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.family_role_of(_family_id) in ('admin','member');
$$;

create or replace function public.is_family_admin(_family_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.family_role_of(_family_id) = 'admin';
$$;

-- PROFILE POLICIES
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "family profiles read" on public.profiles for select to authenticated using (
  exists (
    select 1 from public.family_members me
    join public.family_members other on other.family_id = me.family_id
    where me.user_id = auth.uid() and other.user_id = profiles.id
  )
);
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- FAMILY POLICIES
create policy "families read" on public.families for select to authenticated using (public.is_family_member(id));
create policy "families insert" on public.families for insert to authenticated with check (created_by = auth.uid());
create policy "families update" on public.families for update to authenticated using (public.is_family_admin(id)) with check (public.is_family_admin(id));
create policy "families delete" on public.families for delete to authenticated using (public.is_family_admin(id));

create policy "members read" on public.family_members for select to authenticated using (public.is_family_member(family_id));
create policy "members self insert" on public.family_members for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.families f where f.id = family_id and f.created_by = auth.uid()));
create policy "members admin insert" on public.family_members for insert to authenticated with check (public.is_family_admin(family_id));
create policy "members admin update" on public.family_members for update to authenticated using (public.is_family_admin(family_id)) with check (public.is_family_admin(family_id));
create policy "members admin delete" on public.family_members for delete to authenticated using (public.is_family_admin(family_id) and user_id <> auth.uid());

-- INVITATIONS
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  email text not null,
  role public.family_role not null default 'member',
  token text not null unique default encode(gen_random_bytes(24),'hex'),
  invited_by uuid not null references auth.users,
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.invitations to authenticated;
grant all on public.invitations to service_role;
alter table public.invitations enable row level security;
create policy "invites read" on public.invitations for select to authenticated using (public.is_family_member(family_id));
create policy "invites admin write" on public.invitations for insert to authenticated with check (public.is_family_admin(family_id) and invited_by = auth.uid());
create policy "invites admin update" on public.invitations for update to authenticated using (public.is_family_admin(family_id)) with check (public.is_family_admin(family_id));
create policy "invites admin delete" on public.invitations for delete to authenticated using (public.is_family_admin(family_id));

-- CATEGORIES
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  name text not null,
  kind public.category_kind not null,
  parent_id uuid references public.categories on delete cascade,
  icon text not null default 'circle',
  color text not null default '#64748b',
  monthly_budget numeric(14,2),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "cat read" on public.categories for select to authenticated using (public.is_family_member(family_id));
create policy "cat insert" on public.categories for insert to authenticated with check (public.can_write(family_id));
create policy "cat update" on public.categories for update to authenticated using (public.can_write(family_id)) with check (public.can_write(family_id));
create policy "cat delete" on public.categories for delete to authenticated using (public.is_family_admin(family_id));

-- CREDIT CARDS
create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  name text not null,
  brand text,
  credit_limit numeric(14,2) not null default 0,
  closing_day int not null default 1,
  due_day int not null default 10,
  owner_id uuid references auth.users,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.credit_cards to authenticated;
grant all on public.credit_cards to service_role;
alter table public.credit_cards enable row level security;
create policy "cards read" on public.credit_cards for select to authenticated using (public.is_family_member(family_id));
create policy "cards insert" on public.credit_cards for insert to authenticated with check (public.can_write(family_id));
create policy "cards update" on public.credit_cards for update to authenticated using (public.can_write(family_id)) with check (public.can_write(family_id));
create policy "cards delete" on public.credit_cards for delete to authenticated using (public.is_family_admin(family_id));

-- TRANSACTIONS
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  description text not null,
  amount numeric(14,2) not null,
  type public.tx_type not null,
  status public.tx_status not null default 'planned',
  tx_date date not null,
  category_id uuid references public.categories on delete set null,
  subcategory_id uuid references public.categories on delete set null,
  owner_id uuid references auth.users,
  payment_method public.payment_method not null default 'pix',
  recurrence public.recurrence not null default 'none',
  recurrence_end date,
  installment_no int,
  installment_total int,
  card_id uuid references public.credit_cards on delete set null,
  is_shared boolean not null default false,
  shared_with uuid[] not null default '{}',
  notes text,
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.transactions (family_id, tx_date);
grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "tx read" on public.transactions for select to authenticated using (public.is_family_member(family_id));
create policy "tx insert" on public.transactions for insert to authenticated with check (public.can_write(family_id) and created_by = auth.uid());
create policy "tx update" on public.transactions for update to authenticated using (public.can_write(family_id)) with check (public.can_write(family_id));
create policy "tx delete" on public.transactions for delete to authenticated using (public.is_family_admin(family_id) or (public.can_write(family_id) and created_by = auth.uid()));

-- BILLS
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  name text not null,
  amount numeric(14,2) not null,
  due_date date not null,
  category_id uuid references public.categories on delete set null,
  recurrence public.recurrence not null default 'none',
  status public.bill_status not null default 'pending',
  owner_id uuid references auth.users,
  paid_at timestamptz,
  transaction_id uuid references public.transactions on delete set null,
  notes text,
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.bills (family_id, due_date);
grant select, insert, update, delete on public.bills to authenticated;
grant all on public.bills to service_role;
alter table public.bills enable row level security;
create policy "bills read" on public.bills for select to authenticated using (public.is_family_member(family_id));
create policy "bills insert" on public.bills for insert to authenticated with check (public.can_write(family_id) and created_by = auth.uid());
create policy "bills update" on public.bills for update to authenticated using (public.can_write(family_id)) with check (public.can_write(family_id));
create policy "bills delete" on public.bills for delete to authenticated using (public.is_family_admin(family_id) or (public.can_write(family_id) and created_by = auth.uid()));

-- GOALS
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null,
  current_amount numeric(14,2) not null default 0,
  target_date date,
  icon text not null default 'target',
  color text not null default '#0f766e',
  auto_save_percent numeric(5,2) not null default 0,
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.goals to authenticated;
grant all on public.goals to service_role;
alter table public.goals enable row level security;
create policy "goals read" on public.goals for select to authenticated using (public.is_family_member(family_id));
create policy "goals insert" on public.goals for insert to authenticated with check (public.can_write(family_id) and created_by = auth.uid());
create policy "goals update" on public.goals for update to authenticated using (public.can_write(family_id)) with check (public.can_write(family_id));
create policy "goals delete" on public.goals for delete to authenticated using (public.is_family_admin(family_id));

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals on delete cascade,
  family_id uuid not null references public.families on delete cascade,
  amount numeric(14,2) not null,
  contributed_at date not null default current_date,
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.goal_contributions to authenticated;
grant all on public.goal_contributions to service_role;
alter table public.goal_contributions enable row level security;
create policy "gc read" on public.goal_contributions for select to authenticated using (public.is_family_member(family_id));
create policy "gc insert" on public.goal_contributions for insert to authenticated with check (public.can_write(family_id) and created_by = auth.uid());
create policy "gc delete" on public.goal_contributions for delete to authenticated using (public.can_write(family_id));

-- INVESTMENTS
create table public.investments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  name text not null,
  asset_class public.asset_class not null default 'fixed_income',
  invested_amount numeric(14,2) not null default 0,
  current_value numeric(14,2) not null default 0,
  purchase_date date not null default current_date,
  owner_id uuid references auth.users,
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.investments to authenticated;
grant all on public.investments to service_role;
alter table public.investments enable row level security;
create policy "inv read" on public.investments for select to authenticated using (public.is_family_member(family_id));
create policy "inv insert" on public.investments for insert to authenticated with check (public.can_write(family_id) and created_by = auth.uid());
create policy "inv update" on public.investments for update to authenticated using (public.can_write(family_id)) with check (public.can_write(family_id));
create policy "inv delete" on public.investments for delete to authenticated using (public.is_family_admin(family_id));

-- NOTIFICATIONS
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  user_id uuid references auth.users on delete cascade,
  title text not null,
  body text,
  kind text not null default 'info',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "notif read" on public.notifications for select to authenticated using (public.is_family_member(family_id) and (user_id is null or user_id = auth.uid()));
create policy "notif insert" on public.notifications for insert to authenticated with check (public.is_family_member(family_id));
create policy "notif update" on public.notifications for update to authenticated using (public.is_family_member(family_id) and (user_id is null or user_id = auth.uid())) with check (public.is_family_member(family_id));
create policy "notif delete" on public.notifications for delete to authenticated using (public.is_family_member(family_id) and (user_id is null or user_id = auth.uid()));

-- AUDIT LOG
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  entity text not null,
  entity_id uuid,
  action text not null,
  actor_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "audit read" on public.audit_log for select to authenticated using (public.is_family_member(family_id));

-- TIMESTAMP TRIGGER
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger t_profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger t_families_touch before update on public.families for each row execute function public.touch_updated_at();
create trigger t_tx_touch before update on public.transactions for each row execute function public.touch_updated_at();
create trigger t_bills_touch before update on public.bills for each row execute function public.touch_updated_at();
create trigger t_goals_touch before update on public.goals for each row execute function public.touch_updated_at();
create trigger t_inv_touch before update on public.investments for each row execute function public.touch_updated_at();

-- AUDIT TRIGGER for transactions
create or replace function public.log_tx_audit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_log(family_id, entity, entity_id, action, actor_id, details)
    values (old.family_id,'transaction',old.id,'delete',auth.uid(), to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log(family_id, entity, entity_id, action, actor_id, details)
    values (new.family_id,'transaction',new.id,'update',auth.uid(), jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(new)));
    return new;
  else
    insert into public.audit_log(family_id, entity, entity_id, action, actor_id, details)
    values (new.family_id,'transaction',new.id,'create',auth.uid(), to_jsonb(new));
    return new;
  end if;
end; $$;
create trigger t_tx_audit after insert or update or delete on public.transactions for each row execute function public.log_tx_audit();

-- PROFILE AUTO-CREATE
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email)
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- DEFAULT CATEGORIES ON FAMILY CREATE
create or replace function public.seed_default_categories() returns trigger language plpgsql security definer set search_path = public as $$
declare c record;
begin
  for c in select * from (values
    ('Salário','income','wallet','#0f766e'),
    ('Freelance/Autônomo','income','briefcase','#0d9488'),
    ('Rendimentos de investimento','income','trending-up','#14b8a6'),
    ('Aluguel recebido','income','home','#2dd4bf'),
    ('Outras receitas','income','plus-circle','#5eead4'),
    ('Moradia','fixed_expense','home','#1e3a5f'),
    ('Contas','fixed_expense','zap','#25507a'),
    ('Educação','fixed_expense','graduation-cap','#2c5f94'),
    ('Saúde','fixed_expense','heart-pulse','#3b6fa8'),
    ('Transporte','fixed_expense','car','#4a7fb8'),
    ('Seguros','fixed_expense','shield','#5a8fc8'),
    ('Assinaturas','fixed_expense','tv','#6a9fd8'),
    ('Alimentação/Mercado','variable_expense','shopping-cart','#b45309'),
    ('Lazer','variable_expense','party-popper','#c2670a'),
    ('Vestuário','variable_expense','shirt','#d97706'),
    ('Cuidados pessoais','variable_expense','scissors','#e08a1a'),
    ('Presentes','variable_expense','gift','#f59e0b'),
    ('Manutenção casa/carro','variable_expense','wrench','#fbbf24'),
    ('Cartão de crédito','debt','credit-card','#7f1d1d'),
    ('Empréstimos','debt','landmark','#991b1b'),
    ('Financiamentos','debt','building','#b91c1c'),
    ('Consórcio','debt','handshake','#dc2626')
  ) as t(name,kind,icon,color) loop
    insert into public.categories(family_id,name,kind,icon,color)
    values (new.id, c.name, c.kind::public.category_kind, c.icon, c.color);
  end loop;
  insert into public.family_members(family_id,user_id,role) values (new.id, new.created_by, 'admin')
  on conflict do nothing;
  return new;
end; $$;
create trigger t_family_seed after insert on public.families for each row execute function public.seed_default_categories();