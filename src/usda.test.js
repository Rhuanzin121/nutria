import { describe, it, expect } from "vitest";
import { normalizeUsda } from "../scripts/import-usda.mjs";
import {
  supplementalFoods,
  officialFoods,
  catalog,
  searchFoods,
} from "./foods";
import { foodSchema } from "./model";
// Artificial API fixture only for converter tests; never inserted in the real catalog.
const fixture = {
  fdcId: 999999999,
  description: "Fixture USDA artificial",
  foodNutrients: [
    { nutrient: { id: 1003, unitName: "g" }, amount: 12 },
    { nutrient: { id: 2048, unitName: "kcal" }, amount: 151 },
    { nutrient: { id: 1093, unitName: "mg" }, amount: 20 },
  ],
};
describe("Importação USDA e procedência", () => {
  it("converte IDs e unidades sem fabricar ausentes", () => {
    const food = foodSchema.parse(normalizeUsda(fixture));
    expect(food.per100.protein).toBe(12);
    expect(food.per100.kcal).toBe(151);
    expect(food.per100.fiber).toBeNull();
    expect(food.per100.sodium).toBe(20);
  });
  it("não confunde kcal com kJ nem sódio em g com mg", () => {
    const f = normalizeUsda({
      ...fixture,
      foodNutrients: [
        { nutrient: { id: 1008, unitName: "kJ" }, amount: 500 },
        { nutrient: { id: 1093, unitName: "g" }, amount: 2 },
      ],
    });
    expect(f.per100.kcal).toBeNull();
    expect(f.per100.sodium).toBeNull();
  });
  it("inclui 363 registros reais, sem fixture artificial", () => {
    expect(supplementalFoods).toHaveLength(363);
    expect(
      supplementalFoods.some((f) => f.externalId === String(fixture.fdcId)),
    ).toBe(false);
    expect(
      supplementalFoods.every(
        (f) =>
          f.unit === "g" &&
          f.referenceAmount === 100 &&
          f.sourceUrl.startsWith("https://fdc.nal.usda.gov/"),
      ),
    ).toBe(true);
  });
  it("mantém fonte brasileira antes do complemento", () => {
    const foods = catalog({
      version: 1,
      selectedId: "",
      diets: [],
      customFoods: [],
      recipes: [],
    });
    expect(foods[0].id).toBe(officialFoods[0].id);
    expect(foods[597].id.startsWith("usda:")).toBe(true);
    expect(searchFoods(foods, "zzzzxyz nao encontrado")).toEqual([]);
  });
  it("recusa links ativos e nutrientes inválidos de importações", () => {
    expect(() =>
      foodSchema.parse({
        ...normalizeUsda(fixture),
        sourceUrl: "javascript:alert(1)",
      }),
    ).toThrow();
    expect(() =>
      foodSchema.parse({
        ...normalizeUsda(fixture),
        per100: { ...normalizeUsda(fixture).per100, kcal: -1 },
      }),
    ).toThrow();
  });
});
