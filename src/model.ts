import { z } from "zod";
export const nutrients = [
  "kcal",
  "protein",
  "carbs",
  "fat",
  "fiber",
  "sodium",
  "saturated",
] as const;
export type Nutrient = (typeof nutrients)[number];
const value = z.number().finite().min(0).max(1000000).nullable();
export const totalsSchema = z.object({
  kcal: value,
  protein: value,
  carbs: value,
  fat: value,
  fiber: value,
  sodium: value,
  saturated: value,
});
export type Totals = z.infer<typeof totalsSchema>;
// User-selected policy: missing food nutrients are zero. Goals stay nullable.
export function zeroMissingNutrients(totals: Totals): Totals {
  return Object.fromEntries(nutrients.map(key => [key, totals[key] ?? 0])) as Totals;
}
export const unitSchema = z.enum(["g", "ml", "porção"]);
export const measureSchema = z.object({
  name: z.string().trim().min(1).max(100),
  amount: z.number().finite().positive().max(10000),
  source: z.string().max(300),
});
export type Measure = z.infer<typeof measureSchema>;
export const foodSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  brand: z.string().max(120).default(""),
  preparation: z.string().max(120).default(""),
  aliases: z.array(z.string()).default([]),
  category: z.string(),
  source: z.string().min(1),
  sourceUrl: z.union([
    z
      .string()
      .url()
      .regex(/^https?:\/\//i),
    z.literal(""),
  ]),
  externalId: z.string().default(""),
  updatedAt: z.string().nullable().default(null),
  page: z.number().int().nullable(),
  unit: unitSchema,
  referenceAmount: z.number().positive().finite().min(0.001),
  per100: totalsSchema.transform(zeroMissingNutrients),
  manual: z.boolean().default(false),
  notes: z.string().max(2000).default(""),
  measures: z.array(measureSchema).max(100).default([]),
});
export type Food = z.infer<typeof foodSchema>;
export const itemSchema = z.object({
  id: z.string(),
  food: foodSchema,
  grams: z.number().finite().positive().max(10000),
  measure: measureSchema.optional(),
});
export const alternativeSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  items: z.array(itemSchema).max(300),
});
export const mealSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(80),
  time: z
    .string()
    .regex(/^$|^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .default(""),
  items: z.array(itemSchema).max(300),
  alternatives: z.array(alternativeSchema).max(20).default([]),
  activeAlternativeId: z.string().nullable().default(null),
}).superRefine((meal, ctx) => {
  if (new Set(meal.alternatives.map(a => a.id)).size !== meal.alternatives.length ||
      (meal.activeAlternativeId !== null && !meal.alternatives.some(a => a.id === meal.activeAlternativeId)))
    ctx.addIssue({code: "custom", message: "Opção de refeição inválida."});
});
export const dietSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(80),
  notes: z.string().max(2000),
  goals: totalsSchema,
  bodyWeightKg: z.number().finite().positive().max(600).nullable().default(null),
  meals: z.array(mealSchema).max(50),
  updatedAt: z.string().datetime(),
});
export const recipeSchema = z
  .object({
    id: z.string(),
    name: z.string().trim().min(1).max(80),
    ingredients: z.array(itemSchema).min(1).max(300),
    servings: z.number().finite().positive().max(10000),
    finalGrams: z.number().finite().positive().max(100000).nullable(),
    notes: z.string().max(2000),
  })
  .superRefine((recipe, ctx) => {
    const factor = recipe.finalGrams
      ? 100 / recipe.finalGrams
      : 1 / recipe.servings;
    const totals = scaleTotals(sumItems(recipe.ingredients), factor);
    if (!totalsSchema.safeParse(totals).success)
      ctx.addIssue({
        code: "custom",
        message:
          "Rendimento incompatível com os limites numéricos. Revise peso e porções.",
      });
  });
export const stateSchema = z.object({
  version: z.literal(1),
  selectedId: z.string(),
  diets: z.array(dietSchema).max(100),
  customFoods: z.array(foodSchema).max(5000),
  recipes: z.array(recipeSchema).max(1000),
});
export type Diet = z.infer<typeof dietSchema>;
export type Meal = z.infer<typeof mealSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type AppState = z.infer<typeof stateSchema>;
export const emptyTotals = (): Totals => ({
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sodium: 0,
  saturated: 0,
});
export const unsetTotals = (): Totals => ({
  kcal: null,
  protein: null,
  carbs: null,
  fat: null,
  fiber: null,
  sodium: null,
  saturated: null,
});
export function scaleTotals(totals: Totals, factor: number): Totals {
  return Object.fromEntries(
    nutrients.map((key) => [
      key,
      totals[key] === null ? null : totals[key] * factor,
    ]),
  ) as Totals;
}
export function calculateItem(item: Item): Totals {
  const parsed = itemSchema.parse(item);
  return scaleTotals(parsed.food.per100, parsed.grams / parsed.food.referenceAmount);
}
// Compensated summation avoids accumulating floating-point error.
export function sumItems(items: Item[]): Totals {
  const rows = items.map(calculateItem);
  return Object.fromEntries(
    nutrients.map((key) => {
      let sum = 0,
        compensation = 0;
      for (const row of rows) {
        if (row[key] === null) return [key, null];
        const y = row[key] - compensation;
        const next = sum + y;
        compensation = next - sum - y;
        sum = next;
      }
      return [key, sum];
    }),
  ) as Totals;
}
export const activeMealItems = (meal: Meal): Item[] =>
  meal.alternatives.find(a => a.id === meal.activeAlternativeId)?.items ?? meal.items;
export const dietItems = (diet: Diet) => diet.meals.flatMap(activeMealItems);
export const calculateDiet = (diet: Diet) => sumItems(dietItems(diet));
export function updateMealItems(meal: Meal, items: Item[]): Meal {
  return meal.activeAlternativeId === null ? {...meal, items} : {
    ...meal, alternatives: meal.alternatives.map(a => a.id === meal.activeAlternativeId ? {...a, items} : a),
  };
}
export function macrosPerKg(totals: Totals, kg: number | null) {
  if (kg === null || !Number.isFinite(kg) || kg <= 0) return null;
  return Object.fromEntries((["protein", "carbs", "fat"] as const).map(key =>
    [key, (totals[key] ?? 0) / kg])) as Pick<Totals, "protein" | "carbs" | "fat">;
}
export function newDiet(name = "Nova dieta"): Diet {
  return {
    id: crypto.randomUUID(),
    name,
    notes: "",
    goals: unsetTotals(),
    bodyWeightKg: null,
    meals: ["Café da manhã", "Almoço", "Lanche da tarde", "Jantar"].map(
      (name) => ({ id: crypto.randomUUID(), name, time: "", items: [], alternatives: [], activeAlternativeId: null }),
    ),
    updatedAt: new Date().toISOString(),
  };
}
export function duplicateMeal(meal: Meal): Meal {
  const alternatives = meal.alternatives.map(a => ({...structuredClone(a), id: crypto.randomUUID(),
    items: a.items.map(i => ({...structuredClone(i), id: crypto.randomUUID()}))}));
  return {
    ...structuredClone(meal),
    id: crypto.randomUUID(),
    name: `${meal.name.slice(0, 70)} (cópia)`,
    alternatives,
    activeAlternativeId: meal.activeAlternativeId === null ? null : alternatives[meal.alternatives.findIndex(a => a.id === meal.activeAlternativeId)]?.id ?? null,
    items: meal.items.map((item) => ({
      ...structuredClone(item),
      id: crypto.randomUUID(),
    })),
  };
}
export function duplicateDiet(diet: Diet): Diet {
  return {
    ...structuredClone(diet),
    id: crypto.randomUUID(),
    name: `${diet.name.slice(0, 70)} (cópia)`,
    updatedAt: new Date().toISOString(),
    meals: diet.meals.map(duplicateMeal),
  };
}
export const format = (value: number | null, digits = 1) =>
  value === null
    ? "—"
    : value.toLocaleString("pt-BR", { maximumFractionDigits: digits });
export const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-,]/g, " ");
export function parseGrams(raw: string): number {
  if (!raw.trim()) throw new Error("Informe uma quantidade.");
  return z
    .number()
    .finite()
    .positive()
    .max(10000)
    .parse(Number(raw.replace(",", ".")));
}
export function goalDifference(current: number | null, goal: number | null) {
  return {
    difference: current === null || goal === null ? null : current - goal,
    percent:
      current === null || goal === null || goal === 0
        ? null
        : (current / goal) * 100,
  };
}
export function recipeFood(recipe: Recipe): Food {
  recipeSchema.parse(recipe);
  return foodSchema.parse({
    id: `recipe:${recipe.id}`,
    name: recipe.name,
    category: "Receitas",
    source: "Receita caseira",
    sourceUrl: "",
    page: null,
    unit: recipe.finalGrams ? "g" : "porção",
    referenceAmount: recipe.finalGrams ? 100 : 1,
    per100: scaleTotals(
      sumItems(recipe.ingredients),
      recipe.finalGrams ? 100 / recipe.finalGrams : 1 / recipe.servings,
    ),
    notes: recipe.notes,
    manual: true,
  });
}
export function recipePerServing(recipe: Recipe) {
  return scaleTotals(sumItems(recipe.ingredients), 1 / recipe.servings);
}
export function measureQuantity(count: number, measure: Measure) {
  measureSchema.parse(measure);
  return z
    .number()
    .finite()
    .positive()
    .max(10000)
    .parse(count * measure.amount);
}
export function macroDistribution(totals: Totals) {
  const energy = {
    carbs: (totals.carbs ?? 0) * 4,
    protein: (totals.protein ?? 0) * 4,
    fat: (totals.fat ?? 0) * 9,
  };
  const total = energy.carbs + energy.protein + energy.fat;
  return total > 0
    ? {
        carbs: (energy.carbs / total) * 100,
        protein: (energy.protein / total) * 100,
        fat: (energy.fat / total) * 100,
      }
    : null;
}
export function nutrientCoverage(items: Item[], key: Nutrient) {
  const knownItems = items.filter((item) => item.food.per100[key] !== null);
  return {
    known: sumItems(knownItems)[key] ?? 0,
    missing: items.length - knownItems.length,
    total: items.length,
  };
}
