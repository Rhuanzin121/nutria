import { describe, it, expect, vi } from "vitest";
import {
  calculateItem,
  calculateDiet,
  sumItems,
  emptyTotals,
  unsetTotals,
  foodSchema,
  newDiet,
  duplicateDiet,
  goalDifference,
  parseGrams,
  recipeFood,
  recipePerServing,
  stateSchema,
  type Item,
  type AppState,
} from "./model";
import { officialFoods, searchFoods } from "./foods";
import { loadState, saveState } from "./storage";
// Artificial fixtures are ONLY used in tests, never in the application catalog.
const fixtureFood = foodSchema.parse({
  id: "test-fixture",
  name: "Fixture artificial",
  category: "Testes",
  source: "Fixture de teste",
  sourceUrl: "",
  page: null,
  unit: "g",
  referenceAmount: 100,
  per100: { ...emptyTotals(), kcal: 130, protein: 10, carbs: 20, fat: 1 },
});
const item = (grams = 160): Item => ({
  id: crypto.randomUUID(),
  food: structuredClone(fixtureFood),
  grams,
});
describe("Motor nutricional", () => {
  it("130 kcal/100 g × 160 g = 208 kcal", () =>
    expect(calculateItem(item()).kcal).toBe(208));
  it("soma vários alimentos em uma refeição", () =>
    expect(sumItems([item(100), item(50)]).kcal).toBe(195));
  it("soma todas as refeições", () => {
    const d = newDiet();
    d.meals[0].items = [item(100)];
    d.meals[1].items = [item(200)];
    expect(calculateDiet(d).kcal).toBe(390);
  });
  it("recalcula após mudar quantidade", () => {
    const row = item(100);
    expect(sumItems([row]).kcal).toBe(130);
    row.grams = 160;
    expect(sumItems([row]).kcal).toBe(208);
  });
  it("recalcula após remover alimento", () => {
    const items = [item(100), item(50)];
    items.pop();
    expect(sumItems(items).kcal).toBe(130);
  });
  it("compara com meta", () =>
    expect(goalDifference(2050, 2200)).toEqual({
      difference: -150,
      percent: (2050 / 2200) * 100,
    }));
  it("não divide por zero e não define metas sozinho", () => {
    expect(goalDifference(5, 0)).toEqual({ difference: 5, percent: null });
    expect(goalDifference(5, null)).toEqual({
      difference: null,
      percent: null,
    });
    expect(newDiet().goals).toEqual(unsetTotals());
  });
  it("considera nutrientes ausentes como zero e mantém os valores conhecidos", () => {
    const row = item();
    row.food.per100.fiber = null;
    const result = sumItems([row, item(100)]);
    expect(result.fiber).toBe(0);
    expect(result.kcal).toBe(338);
    expect(goalDifference(null, 20).percent).toBeNull();
  });
  it("mantém precisão até a exibição", () =>
    expect(
      sumItems(Array.from({ length: 1000 }, () => item(0.1))).kcal,
    ).toBeCloseTo(130, 12));
  it("converte 100 ml apenas para ml e porção documentada", () => {
    const row = item(150);
    row.food.unit = "ml";
    expect(calculateItem(row).kcal).toBe(195);
    row.food.referenceAmount = 30;
    row.grams = 60;
    expect(calculateItem(row).kcal).toBe(260);
  });
  it("valida negativos, vazio, NaN e aceita vírgula decimal", () => {
    for (const v of ["-2", "", "NaN", "Infinity", "0", "10001"])
      expect(() => parseGrams(v)).toThrow();
    expect(parseGrams("12,5")).toBe(12.5);
    expect(() => calculateItem({ ...item(), grams: -1 })).toThrow();
  });
  it("usa energia da fonte mesmo quando macros não fecham", () => {
    const row = item(100);
    row.food.per100.kcal = 151;
    expect(calculateItem(row).kcal).toBe(151);
  });
  it("preserva snapshots e independência ao duplicar", () => {
    const d = newDiet();
    d.meals[0].items = [item()];
    const copy = duplicateDiet(d);
    copy.meals[0].items[0].food.per100.kcal = 999;
    expect(d.meals[0].items[0].food.per100.kcal).toBe(130);
    expect(copy.id).not.toBe(d.id);
    expect(copy.meals[0].id).not.toBe(d.meals[0].id);
  });
  it("calcula receita com rendimento final e porção", () => {
    const r = {
      id: "test",
      name: "Receita de teste",
      ingredients: [item(100), item(100)],
      servings: 2,
      finalGrams: 160,
      notes: "",
    };
    expect(recipePerServing(r).kcal).toBe(130);
    expect(recipeFood(r).per100.kcal).toBe(162.5);
    expect(recipeFood({ ...r, finalGrams: null }).unit).toBe("porção");
    expect(recipeFood({ ...r, finalGrams: null }).per100.kcal).toBe(130);
  });
});
describe("Catálogo real", () => {
  it("importa os 597 IDs oficiais únicos", () => {
    expect(officialFoods).toHaveLength(597);
    expect(new Set(officialFoods.map((f) => f.id)).size).toBe(597);
  });
  it("não inventa resultados ausentes", () =>
    expect(searchFoods(officialFoods, "zzzzzz inexistente 98123")).toEqual([]));
  it("busca sinônimos sem acentos e mantém preparo distinto", () => {
    const foods = searchFoods(officialFoods, "arroz branco cozido");
    expect(foods.some((f) => f.id === "taco:3")).toBe(true);
    expect(foods.some((f) => f.id === "taco:4")).toBe(false);
    expect(searchFoods(officialFoods, "mucarela").length).toBeGreaterThan(0);
  });
  it("confere arroz e converte NA em zero conforme configuração", () => {
    expect(officialFoods.find((f) => f.id === "taco:3")?.per100).toMatchObject({
      kcal: 128,
      protein: 2.5,
      carbs: 28.1,
      fat: 0.2,
      fiber: 1.6,
      sodium: 1,
    });
    expect(
      officialFoods.find((f) => f.id === "taco:260")?.per100.protein,
    ).toBe(0);
  });
});
describe("Persistência", () => {
  it("salva e recupera dietas, refeições, receitas e cadastros", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    });
    const d = newDiet();
    d.meals[0].items = [item()];
    const s: AppState = {
      version: 1,
      selectedId: d.id,
      diets: [d],
      customFoods: [fixtureFood],
      recipes: [],
    };
    saveState(s);
    expect(loadState()).toEqual(s);
    vi.unstubAllGlobals();
  });
  it("rejeita backup inválido", () =>
    expect(() =>
      stateSchema.parse({ version: 1, diets: [{ name: "inválido" }] }),
    ).toThrow());
});
