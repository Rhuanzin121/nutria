-- Nutria: transactional workspace + relational projections. Apply to a new Supabase project.
begin;
create table public.nutrition_sources (
 id text primary key, name text not null, url text not null, license_notes text not null
);
insert into public.nutrition_sources values
 ('taco','TACO / NEPA-UNICAMP, 4ª edição, 2011','https://nepa.unicamp.br/publicacoes/','Reprodução autorizada com citação da fonte, conforme páginas ii e iii do PDF.'),
 ('usda','USDA FoodData Central','https://fdc.nal.usda.gov/','CC0; atribuir FoodData Central.'),
 ('manual','Cadastro pessoal / receita caseira','','Fonte e valores informados pelo proprietário.');
create table public.public_foods (
 id text primary key, source_id text not null references public.nutrition_sources(id), external_id text,
 name text not null, reference_unit text not null check(reference_unit in ('g','ml','porção')),
 reference_amount numeric not null check(reference_amount>0), composition jsonb not null,
 source_snapshot jsonb not null, source_updated_at text
);
-- Public catalog is bundled locally; optional server-side seeding must use trusted migration/admin tools.
create table public.diet_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null check(jsonb_typeof(data)='object' and data->>'version'='1'
   and jsonb_typeof(data->'diets')='array' and jsonb_typeof(data->'customFoods')='array'
   and jsonb_typeof(data->'recipes')='array'),
 revision bigint not null check(revision>0), updated_at timestamptz not null default now(),
 check(octet_length(data::text)<15000000)
);
create table public.diets (
 user_id uuid not null references auth.users(id) on delete cascade, id text not null,
 name text not null check(length(name) between 1 and 80), notes text not null,
 updated_at timestamptz not null, primary key(user_id,id)
);
create table public.diet_goals (
 user_id uuid not null, diet_id text not null, nutrient text not null,
 value numeric check(value>=0), primary key(user_id,diet_id,nutrient),
 foreign key(user_id,diet_id) references public.diets(user_id,id) on delete cascade
);
create table public.meals (
 user_id uuid not null, id text not null, diet_id text not null,
 name text not null check(length(name) between 1 and 80), position integer not null check(position>=0),
 primary key(user_id,id), foreign key(user_id,diet_id) references public.diets(user_id,id) on delete cascade
);
create index meals_by_diet on public.meals(user_id,diet_id,position);
create table public.meal_items (
 user_id uuid not null,id text not null,meal_id text not null,position integer not null,
 quantity numeric not null check(quantity>0 and quantity<=10000),
 food_snapshot jsonb not null, primary key(user_id,id),
 foreign key(user_id,meal_id) references public.meals(user_id,id) on delete cascade
);
create index items_by_meal on public.meal_items(user_id,meal_id,position);
create table public.private_foods (
 user_id uuid not null references auth.users(id) on delete cascade,id text not null,
 name text not null, source_id text not null default 'manual' references public.nutrition_sources(id),
 snapshot jsonb not null, primary key(user_id,id)
);
create table public.recipes (
 user_id uuid not null references auth.users(id) on delete cascade,id text not null,
 name text not null check(length(name) between 1 and 80), servings numeric not null check(servings>0),
 final_grams numeric check(final_grams>0), notes text not null,primary key(user_id,id)
);
create table public.recipe_ingredients (
 user_id uuid not null,id text not null,recipe_id text not null,position integer not null,
 quantity numeric not null check(quantity>0 and quantity<=10000), food_snapshot jsonb not null,
 primary key(user_id,id),foreign key(user_id,recipe_id) references public.recipes(user_id,id) on delete cascade
);
create index ingredients_by_recipe on public.recipe_ingredients(user_id,recipe_id,position);
alter table public.nutrition_sources enable row level security;
alter table public.public_foods enable row level security;
create policy source_read on public.nutrition_sources for select using (true);
create policy food_read on public.public_foods for select using (true);
grant select on public.nutrition_sources,public.public_foods to anon,authenticated;
alter table public.diet_workspaces enable row level security;
create policy workspace_owner on public.diet_workspaces for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.diet_workspaces to authenticated;
-- Projections are read-only to clients. Only the transactional trigger writes them.
do $$ declare t text; begin
 foreach t in array array['diets','diet_goals','meals','meal_items','private_foods','recipes','recipe_ingredients'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create function public.project_workspace() returns trigger language plpgsql security definer set search_path='' as $$
declare d jsonb;m jsonb;i jsonb;r jsonb;f jsonb;g record;mp integer;ip integer;
begin
 if tg_op='UPDATE' then
  if new.user_id<>old.user_id or new.revision<>old.revision+1 then raise exception 'Invalid owner/revision';end if;
 else
  if new.revision<>1 then raise exception 'Initial revision must be 1';end if;
 end if;
 if jsonb_array_length(new.data->'diets')>100 or jsonb_array_length(new.data->'recipes')>1000 or jsonb_array_length(new.data->'customFoods')>5000 then raise exception 'Workspace limit exceeded';end if;
 new.updated_at=now();
 delete from public.diets where user_id=new.user_id;
 delete from public.recipes where user_id=new.user_id;
 delete from public.private_foods where user_id=new.user_id;
 for d in select value from jsonb_array_elements(new.data->'diets') loop
  insert into public.diets values(new.user_id,d->>'id',d->>'name',d->>'notes',(d->>'updatedAt')::timestamptz);
  for g in select key,value from jsonb_each(d->'goals') loop
   insert into public.diet_goals values(new.user_id,d->>'id',g.key,(g.value#>>'{}')::numeric);
  end loop;
  mp=0;
  for m in select value from jsonb_array_elements(d->'meals') loop
   insert into public.meals values(new.user_id,m->>'id',d->>'id',m->>'name',mp);mp=mp+1;ip=0;
   for i in select value from jsonb_array_elements(m->'items') loop
    insert into public.meal_items values(new.user_id,i->>'id',m->>'id',ip,(i->>'grams')::numeric,i->'food');ip=ip+1;
   end loop;
  end loop;
 end loop;
 for f in select value from jsonb_array_elements(new.data->'customFoods') loop
  insert into public.private_foods(user_id,id,name,snapshot) values(new.user_id,f->>'id',f->>'name',f);
 end loop;
 for r in select value from jsonb_array_elements(new.data->'recipes') loop
  insert into public.recipes values(new.user_id,r->>'id',r->>'name',(r->>'servings')::numeric,(r->>'finalGrams')::numeric,r->>'notes');ip=0;
  for i in select value from jsonb_array_elements(r->'ingredients') loop
   insert into public.recipe_ingredients values(new.user_id,i->>'id',r->>'id',ip,(i->>'grams')::numeric,i->'food');ip=ip+1;
  end loop;
 end loop;
 return new;
end $$;
revoke all on function public.project_workspace() from public,anon,authenticated;
create trigger workspace_projection before insert or update on public.diet_workspaces for each row execute function public.project_workspace();
create function public.delete_workspace_projection() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.diets where user_id=old.user_id;
 delete from public.recipes where user_id=old.user_id;
 delete from public.private_foods where user_id=old.user_id;
 return old;
end $$;
revoke all on function public.delete_workspace_projection() from public,anon,authenticated;
create trigger workspace_projection_delete after delete on public.diet_workspaces for each row execute function public.delete_workspace_projection();
commit;
