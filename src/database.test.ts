import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import migration from "../supabase/migrations/202610210001_initial.sql?raw";
import migration2 from "../supabase/migrations/202610210002_meal_time_measures.sql?raw";
import migration3 from "../supabase/migrations/202610220003_meal_alternatives_weight.sql?raw";
import migration4 from "../supabase/migrations/202610230004_food_substitutions.sql?raw";
import { newDiet, foodSchema, emptyTotals, type AppState } from "./model";
// Disposable, artificial users. PostgreSQL auth.uid() is stubbed; Supabase Auth itself is not emulated.
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
async function asUser(id: string) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values ('${A}'),('${B}');`,
  );
  await db.exec(migration);
  await db.exec(migration2);
  await db.exec(migration3);
  await db.exec(migration4);
}, 30000);
afterAll(async () => {
  await db.close();
});
describe("PostgreSQL: persistência e isolamento real por RLS", () => {
  it("aplica migração e projeta dieta, refeição, meta e item em transação", async () => {
    await asUser(A);
    const d = newDiet("Fixture SQL A");
    d.goals.kcal = 2000;
    d.bodyWeightKg = 80;
    d.meals[0].alternatives = [{id:"sql-alt",name:"Substituição",items:[]}];
    d.meals[0].activeAlternativeId = "sql-alt";
    d.meals[0].time = "07:30";
    const food = foodSchema.parse({
      id: "sql-fixture",
      name: "Fixture artificial SQL",
      category: "Testes",
      source: "Fixture",
      sourceUrl: "",
      page: null,
      unit: "g",
      referenceAmount: 100,
      per100: { ...emptyTotals(), kcal: 130 },
      manual: true,
    });
    d.meals[0].items = [
      {
        id: "item-fixture",
        substitutions: [{id:"sql-choice",food,grams:80}],
        activeSubstitutionId: "sql-choice",
        food,
        grams: 160,
        measure: { name: "unidade", amount: 80, source: "Fixture de teste" },
      },
    ];
    const state: AppState = {
      version: 1,
      selectedId: d.id,
      diets: [d],
      customFoods: [food],
      recipes: [
        {
          id: "recipe-fixture",
          name: "Fixture de receita",
          ingredients: [{ id: "ingredient-fixture", food, grams: 100 }],
          servings: 2,
          finalGrams: 160,
          notes: "",
        },
      ],
    };
    await db.query(
      "insert into public.diet_workspaces(user_id,data,revision) values($1,$2,1)",
      [A, JSON.stringify(state)],
    );
    expect((await db.query<{active_substitution_id:string;substitutions:unknown[]}>("select active_substitution_id,substitutions from public.meal_items")).rows[0]).toMatchObject({active_substitution_id:"sql-choice",substitutions:d.meals[0].items[0].substitutions});
    expect((await db.query("select * from public.diets")).rows).toHaveLength(1);
    expect((await db.query<{body_weight_kg:string}>("select body_weight_kg from public.diets")).rows[0].body_weight_kg).toBe("80");
    const projectedMeal = (await db.query<{alternatives: unknown[];active_alternative_id:string}>("select alternatives,active_alternative_id from public.meals where position=0")).rows[0];
    expect(projectedMeal.alternatives).toEqual(d.meals[0].alternatives);
    expect(projectedMeal.active_alternative_id).toBe("sql-alt");
    expect((await db.query("select * from public.meals")).rows).toHaveLength(4);
    expect(
      (
        await db.query<{ time: string }>(
          "select time from public.meals where position=0",
        )
      ).rows[0].time,
    ).toBe("07:30");
    expect(
      (
        await db.query<{ measure: { name: string } }>(
          "select measure from public.meal_items",
        )
      ).rows[0].measure.name,
    ).toBe("unidade");
    for (const table of [
      "meal_items",
      "private_foods",
      "recipes",
      "recipe_ingredients",
    ])
      expect(
        (await db.query(`select * from public.${table}`)).rows,
      ).toHaveLength(1);
    expect(
      (await db.query("select * from public.diet_goals where value=2000")).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query<{ data: AppState }>(
          "select data from public.diet_workspaces",
        )
      ).rows[0].data,
    ).toEqual(state);
  });
  it("outro usuário não lê dietas, refeições ou workspace", async () => {
    await asUser(B);
    for (const table of [
      "diet_workspaces",
      "diets",
      "meals",
      "diet_goals",
      "meal_items",
      "private_foods",
      "recipes",
      "recipe_ingredients",
    ])
      expect(
        (await db.query(`select * from public.${table}`)).rows,
      ).toHaveLength(0);
  });
  it("não permite inserir um workspace no nome de outro usuário", async () => {
    await asUser(B);
    await expect(
      db.query(
        "insert into public.diet_workspaces(user_id,data,revision) values($1,$2,1)",
        [
          A,
          JSON.stringify({
            version: 1,
            selectedId: "",
            diets: [],
            customFoods: [],
            recipes: [],
          }),
        ],
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("não permite atualizar dados de outro usuário", async () => {
    await asUser(B);
    expect(
      (
        await db.query(
          "update public.diet_workspaces set revision=revision+1 where user_id=$1 returning user_id",
          [A],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("projeções são somente leitura ao cliente", async () => {
    await asUser(A);
    await expect(db.exec("delete from public.diets")).rejects.toThrow(
      /permission denied/,
    );
  });
  it("controle de revisão detecta escrita concorrente", async () => {
    await asUser(A);
    expect(
      (
        await db.query(
          "update public.diet_workspaces set revision=2 where user_id=$1 and revision=1 returning revision",
          [A],
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "update public.diet_workspaces set revision=2 where user_id=$1 and revision=1 returning revision",
          [A],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("catálogo público pode ser lido mas não alterado por usuário", async () => {
    await asUser(B);
    expect(
      (await db.query("select * from public.nutrition_sources")).rows,
    ).toHaveLength(3);
    await expect(
      db.exec(
        "insert into public.nutrition_sources values('forged','forged','','')",
      ),
    ).rejects.toThrow();
  });
  it("exclusão do workspace remove as projeções privadas", async () => {
    await asUser(A);
    await db.exec("delete from public.diet_workspaces");
    expect((await db.query("select * from public.diets")).rows).toHaveLength(0);
    expect((await db.query("select * from public.meals")).rows).toHaveLength(0);
  });
});
