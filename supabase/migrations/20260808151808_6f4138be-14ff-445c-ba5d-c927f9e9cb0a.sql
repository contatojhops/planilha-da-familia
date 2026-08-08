create or replace function public.seed_default_categories_for(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_contas_id uuid;
begin
  for c in select * from (values
    ('Salário','income','wallet','#0f766e'),
    ('Freelance/Autônomo','income','briefcase','#0d9488'),
    ('Rendimentos de investimento','income','trending-up','#14b8a6'),
    ('Aluguel recebido','income','home','#2dd4bf'),
    ('Outras receitas','income','plus-circle','#5eead4'),
    ('Moradia','fixed_expense','home','#1e3a5f'),
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
    select p_family_id, c.name, c.kind::public.category_kind, c.icon, c.color
    where not exists (
      select 1 from public.categories x
      where x.family_id = p_family_id and x.name = c.name and x.parent_id is null
    );
  end loop;

  select id into v_contas_id from public.categories
  where family_id = p_family_id and name = 'Contas' and parent_id is null
  limit 1;

  if v_contas_id is null then
    insert into public.categories(family_id,name,kind,icon,color)
    values (p_family_id,'Contas','fixed_expense','file-text','#25507a')
    returning id into v_contas_id;
  end if;

  for c in select * from (values
    ('Água','droplet','#0ea5e9'),
    ('Luz','zap','#eab308'),
    ('Gás','flame','#f97316'),
    ('Internet','wifi','#3b82f6')
  ) as t(name,icon,color) loop
    insert into public.categories(family_id,parent_id,name,kind,icon,color)
    select p_family_id, v_contas_id, c.name, 'fixed_expense'::public.category_kind, c.icon, c.color
    where not exists (
      select 1 from public.categories x
      where x.family_id = p_family_id and x.parent_id = v_contas_id and x.name = c.name
    );
  end loop;
end;
$$;

create or replace function public.seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_categories_for(new.id);
  insert into public.family_members(family_id,user_id,role)
  values (new.id, new.created_by, 'admin')
  on conflict do nothing;
  return new;
end;
$$;

do $$
declare f record;
begin
  for f in select id from public.families loop
    perform public.seed_default_categories_for(f.id);
  end loop;
end;
$$;