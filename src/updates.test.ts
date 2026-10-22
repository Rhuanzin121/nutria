import { describe, it, expect } from "vitest";
import {
  newDiet,
  emptyTotals,
  foodSchema,
  macroDistribution,
  nutrientCoverage,
  measureQuantity,
  mealSchema,
  stateSchema,
  sumItems,
  type Item,
} from "./model";
import {
  officialFoods,
  supplementalFoods,
  mixedVegetables,
  searchFoods,
} from "./foods";

// Artificial nutrient fixture, isolated from the production catalog.
const food = foodSchema.parse({
  id: "measure-test",
  name: "Fixture artificial",
  category: "Teste",
  source: "Fixture de teste",
  sourceUrl: "",
  page: null,
  unit: "g",
  referenceAmount: 100,
  per100: { ...emptyTotals(), kcal: 130, fiber: 4 },
});
describe("Horários e compatibilidade", () => {
  it("aceita horário opcional e rejeita horários inválidos", () => {
    const meal = newDiet().meals[0];
    expect(mealSchema.parse({ ...meal, time: "07:30" }).time).toBe("07:30");
    expect(mealSchema.parse({ ...meal, time: undefined }).time).toBe("");
    expect(mealSchema.safeParse({ ...meal, time: "24:10" }).success).toBe(
      false,
    );
  });
  it("migra backup antigo sem apagar nomes ou refeições", () => {
    const d = newDiet();
    const old = { ...d, meals: d.meals.map(({ time, ...m }) => m) };
    const state = stateSchema.parse({
      version: 1,
      selectedId: d.id,
      diets: [old],
      customFoods: [],
      recipes: [],
    });
    expect(state.diets[0].meals[0].time).toBe("");
    expect(state.diets[0].name).toBe(d.name);
  });
});
describe("Medidas caseiras explícitas", () => {
  it("converte duas fatias de 25 g em 50 g e recalcula nutrientes", () => {
    const measure = { name: "fatia", amount: 25, source: "Fixture de rótulo" };
    const grams = measureQuantity(2, measure);
    expect(grams).toBe(50);
    expect(sumItems([{ id: "test", food, grams, measure }]).kcal).toBe(65);
  });
  it("aceita meia unidade e não transforma ml em g", () => {
    expect(
      measureQuantity(0.5, { name: "unidade", amount: 80, source: "Fixture" }),
    ).toBe(40);
    const mlFood = { ...food, unit: "ml" as const };
    expect(
      sumItems([
        {
          id: "test",
          food: mlFood,
          grams: measureQuantity(2, {
            name: "xícara",
            amount: 150,
            source: "Fixture de volume",
          }),
        },
      ]).kcal,
    ).toBe(390);
  });
  it("rejeita conversões sem referência válida ou acima do limite", () => {
    expect(() =>
      measureQuantity(2, { name: "fatia", amount: 0, source: "Fixture" }),
    ).toThrow();
    expect(() =>
      measureQuantity(-1, { name: "unidade", amount: 50, source: "Fixture" }),
    ).toThrow();
    expect(() =>
      measureQuantity(300, { name: "unidade", amount: 50, source: "Fixture" }),
    ).toThrow();
  });
  it("inclui referências reais do USDA, sem atribuí-las a outros alimentos", () => {
    const egg = supplementalFoods.find((f) => f.id === "usda:748967")!;
    expect(egg.measures.find((m) => m.name.startsWith("unidade"))?.amount).toBe(
      50.3,
    );
    expect(officialFoods.find((f) => f.id === "taco:3")!.measures).toEqual([]);
  });
});
describe("Distribuição dos macros e fibras", () => {
  it("mostra 40% carboidratos, 40% proteínas e 20% gorduras", () => {
    const result = macroDistribution({
      ...emptyTotals(),
      carbs: 100,
      protein: 100,
      fat: 200 / 9,
      kcal: 999,
    });
    expect(result?.carbs).toBe(40);
    expect(result?.protein).toBe(40);
    expect(result?.fat).toBe(20);
  });
  it("não divide por zero nem fabrica percentual com macros desconhecidos", () => {
    expect(macroDistribution(emptyTotals())).toBeNull();
    expect(macroDistribution({ ...emptyTotals(), protein: null })).toBeNull();
  });
  it("mostra subtotal conhecido de fibras sem converter ausentes para zero", () => {
    const items: Item[] = [
      { id: "known", food, grams: 150 },
      {
        id: "unknown",
        food: { ...food, per100: { ...food.per100, fiber: null } },
        grams: 100,
      },
    ];
    expect(sumItems(items).fiber).toBeNull();
    expect(nutrientCoverage(items, "fiber")).toEqual({
      known: 6,
      missing: 1,
      total: 2,
    });
  });
  it("fibras numéricas zero continuam conhecidas", () =>
    expect(
      nutrientCoverage(
        [
          {
            id: "zero",
            food: { ...food, per100: { ...food.per100, fiber: 0 } },
            grams: 100,
          },
        ],
        "fiber",
      ),
    ).toEqual({ known: 0, missing: 0, total: 1 }));
});
describe("Busca e vegetais variados", () => {
  it("encontra nomes com acentos, plural e pequeno erro sem misturar preparos", () => {
    expect(
      searchFoods(officialFoods, "aroz branco cozido").some(
        (f) => f.id === "taco:3",
      ),
    ).toBe(true);
    expect(
      searchFoods(officialFoods, "arroz branco cozida").some(
        (f) => f.id === "taco:4",
      ),
    ).toBe(false);
    expect(searchFoods(officialFoods, "ovos cozidos").length).toBeGreaterThan(
      0,
    );
  });
  it("encontra sinônimos e mantém consulta ausente vazia", () => {
    expect(
      searchFoods(officialFoods, "macaxeira cozida").length,
    ).toBeGreaterThan(0);
    expect(searchFoods(officialFoods, "zzzx alimento inexistente")).toEqual([]);
  });
  it("calcula mistura explicitamente a partir dos ingredientes TACO", () => {
    expect(mixedVegetables.per100.kcal).toBeCloseTo((25 + 30 + 15) / 3);
    expect(mixedVegetables.per100.fiber).toBeCloseTo((3.4 + 2.6 + 1.6) / 3);
    expect(mixedVegetables.source).toContain("Composição calculada");
    expect(searchFoods([mixedVegetables], "vegetais variados")).toHaveLength(1);
    expect(searchFoods([mixedVegetables], "legumes mistos")).toHaveLength(1);
  });
});
