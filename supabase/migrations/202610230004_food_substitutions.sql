-- Saved alternatives for each food; JSON remains the canonical workspace.
begin;
alter table public.meal_items add column substitutions jsonb not null default '[]'::jsonb check(jsonb_typeof(substitutions)='array' and jsonb_array_length(substitutions)<=20);
alter table public.meal_items add column active_substitution_id text;
create or replace function public.project_workspace() returns trigger language plpgsql security definer set search_path='' as $$
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
  insert into public.diets(user_id,id,name,notes,updated_at,body_weight_kg) values(new.user_id,d->>'id',d->>'name',d->>'notes',(d->>'updatedAt')::timestamptz,(d->>'bodyWeightKg')::numeric);
  for g in select key,value from jsonb_each(d->'goals') loop
   insert into public.diet_goals values(new.user_id,d->>'id',g.key,(g.value#>>'{}')::numeric);
  end loop;
  mp=0;
  for m in select value from jsonb_array_elements(d->'meals') loop
   insert into public.meals(user_id,id,diet_id,name,position,time,alternatives,active_alternative_id) values(new.user_id,m->>'id',d->>'id',m->>'name',mp,coalesce(m->>'time',''),coalesce(m->'alternatives','[]'::jsonb),m->>'activeAlternativeId');mp=mp+1;ip=0;
   for i in select value from jsonb_array_elements(m->'items') loop
    insert into public.meal_items(user_id,id,meal_id,position,quantity,food_snapshot,measure,substitutions,active_substitution_id) values(new.user_id,i->>'id',m->>'id',ip,(i->>'grams')::numeric,i->'food',i->'measure',coalesce(i->'substitutions','[]'::jsonb),i->>'activeSubstitutionId');ip=ip+1;
   end loop;
  end loop;
 end loop;
 for f in select value from jsonb_array_elements(new.data->'customFoods') loop
  insert into public.private_foods(user_id,id,name,snapshot) values(new.user_id,f->>'id',f->>'name',f);
 end loop;
 for r in select value from jsonb_array_elements(new.data->'recipes') loop
  insert into public.recipes values(new.user_id,r->>'id',r->>'name',(r->>'servings')::numeric,(r->>'finalGrams')::numeric,r->>'notes');ip=0;
  for i in select value from jsonb_array_elements(r->'ingredients') loop
   insert into public.recipe_ingredients(user_id,id,recipe_id,position,quantity,food_snapshot,measure) values(new.user_id,i->>'id',r->>'id',ip,(i->>'grams')::numeric,i->'food',i->'measure');ip=ip+1;
  end loop;
 end loop;
 return new;
end $$;
commit;
