import taco from "./taco.json";
import usda from "./usda.json";
import {
  foodSchema,
  normalize,
  recipeFood,
  sumItems,
  type AppState,
  type Food,
} from "./model";
export const officialFoods: Food[] = taco.map((food) => foodSchema.parse(food));
export const supplementalFoods: Food[] = usda.map((food) =>
  foodSchema.parse(food),
);
// Explicit house composition; never presented as an official generic vegetable record.
export const mixedVegetables: Food = foodSchema.parse({
  id: "composite:vegetais-variados",
  name: "Vegetais variados (brócolis, cenoura e abobrinha, cozidos)",
  aliases: ["legumes variados", "mix de vegetais", "legumes mistos"],
  category: "Preparações compostas",
  preparation: "cozidos, sem óleo adicionado",
  source: "Composição calculada · ingredientes TACO",
  sourceUrl: "https://nepa.unicamp.br/publicacoes/",
  page: null,
  unit: "g",
  referenceAmount: 100,
  per100: sumItems(
    ["taco:100", "taco:109", "taco:70"].map((id) => ({
      id,
      food: officialFoods.find((f) => f.id === id)!,
      grams: 100 / 3,
    })),
  ),
  manual: false,
  notes:
    "Mistura definida em partes iguais de brócolis cozido (TACO 100, p.32), cenoura cozida (TACO 109, p.32) e abobrinha italiana cozida (TACO 70, p.30), sem óleo adicionado. Composição calculada pela média dos ingredientes; não é um registro oficial de mistura genérica. Para outra proporção, crie uma receita.",
});

const canonical: Record<string, string> = {
  cozida: "cozido",
  cozidas: "cozido",
  cozidos: "cozido",
  crua: "cru",
  cruas: "cru",
  crus: "cru",
  grelhada: "grelhado",
  grelhadas: "grelhado",
  grelhados: "grelhado",
  assada: "assado",
  assadas: "assado",
  assados: "assado",
  frita: "frito",
  fritas: "frito",
  fritos: "frito",
  ovos: "ovo",
  bananas: "banana",
  batatas: "batata",
  mucarela: "mozarela",
  mussarela: "mozarela",
  aipim: "mandioca",
  macaxeira: "mandioca",
  integral: "integral",
};
const stop = new Set(["de", "da", "do", "das", "dos", "e"]);
function tokens(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !stop.has(t))
    .map((t) => canonical[t] ?? t);
}
function oneEdit(a: string, b: string) {
  if (a.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0,
    j = 0,
    edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
export function searchFoods(foods: Food[], query: string, category = "") {
  const terms = tokens(query);
  const preparations = new Set([
    "cru",
    "cozido",
    "grelhado",
    "assado",
    "frito",
  ]);
  return foods
    .map((food, index) => {
      if (category && food.category !== category)
        return { food, index, score: -1 };
      const aliases = [...food.aliases];
      if (food.id === "taco:3" || food.id === "taco:4")
        aliases.push("arroz branco");
      const names = tokens(
        [food.name, food.brand, food.preparation, ...aliases].join(" "),
      );
      const all = [...names, ...tokens(food.category)];
      let score = 0;
      for (const term of terms) {
        if (names.includes(term)) score += 10;
        else if (all.includes(term)) score += 4;
        else if (
          !preparations.has(term) &&
          names.some((w) => w.startsWith(term))
        )
          score += 3;
        else if (!preparations.has(term) && names.some((w) => oneEdit(term, w)))
          score += 1;
        else return { food, index, score: -1 };
      }
      if (
        terms.length &&
        tokens(food.name).join(" ").startsWith(terms.join(" "))
      )
        score += 8;
      if (food.id.startsWith("taco:")) score += terms.length ? 1 : 0;
      return { food, index, score };
    })
    .filter((result) => result.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((result) => result.food);
}
export function catalog(state: AppState) {
  return [
    ...state.customFoods,
    ...state.recipes.map(recipeFood),
    ...officialFoods,
    ...supplementalFoods,
    mixedVegetables,
  ];
}
