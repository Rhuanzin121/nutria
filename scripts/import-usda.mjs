import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
export function normalizeUsda(food) {
  if (!food.fdcId || !food.description || !Array.isArray(food.foodNutrients))
    throw new Error("Registro USDA inválido.");
  const get = (id, unit) => {
    const n = food.foodNutrients.find(
      (n) =>
        n.nutrient?.id === id &&
        n.nutrient.unitName?.toLowerCase() === unit.toLowerCase(),
    );
    return typeof n?.amount === "number" &&
      Number.isFinite(n.amount) &&
      n.amount >= 0
      ? n.amount
      : null;
  };
  const household = {
    slice: "fatia",
    piece: "unidade",
    egg: "unidade (ovo)",
    Banana: "unidade (banana)",
    cup: "xícara",
    tablespoon: "colher de sopa",
    teaspoon: "colher de chá",
  };
  const measures = (food.foodPortions ?? [])
    .filter(
      (p) =>
        household[p.measureUnit?.name] &&
        Number.isFinite(p.gramWeight) &&
        p.gramWeight > 0 &&
        Number.isFinite(p.amount) &&
        p.amount > 0,
    )
    .map((p) => ({
      name:
        household[p.measureUnit.name] + (p.modifier ? ` · ${p.modifier}` : ""),
      amount: p.gramWeight / p.amount,
      source: `USDA FDC ${food.fdcId} · medida ${p.id}`,
    }));
  const energyId = [1008, 2048, 2047].find((id) => get(id, "kcal") !== null);
  return {
    id: `usda:${food.fdcId}`,
    externalId: String(food.fdcId),
    name: food.description,
    brand: food.brandOwner ?? "",
    preparation: "Conforme descrição original",
    aliases: [],
    category: food.foodCategory?.description ?? "USDA · Foundation Foods",
    source: "USDA FoodData Central · Foundation Foods · 04/2026",
    sourceUrl: `https://fdc.nal.usda.gov/food-details/${food.fdcId}/nutrients`,
    updatedAt: food.publicationDate ?? null,
    page: null,
    unit: "g",
    referenceAmount: 100,
    per100: {
      kcal: energyId ? get(energyId, "kcal") : null,
      protein: get(1003, "g"),
      carbs: get(1005, "g"),
      fat: get(1004, "g"),
      fiber: get(1079, "g"),
      sodium: get(1093, "mg"),
      saturated: get(1258, "g"),
    },
    manual: false,
    measures,
    notes: `Descrição original em inglês. Composição por 100 g; não converter ml em g sem densidade. Energia: nutriente USDA ${energyId ?? "não informado"}. Valores ausentes permanecem desconhecidos.`,
  };
}
if (process.argv[1]?.endsWith("import-usda.mjs")) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output)
    throw new Error(
      "Uso: node scripts/import-usda.mjs arquivo-oficial.json destino.json",
    );
  const bytes = await readFile(input);
  const data = JSON.parse(bytes.toString("utf8"));
  if (!Array.isArray(data.FoundationFoods))
    throw new Error(
      "Use o arquivo oficial FoundationFoods; outros tipos exigem revisão do contrato.",
    );
  const result = data.FoundationFoods.filter((food) => food !== null).map(
    normalizeUsda,
  );
  await writeFile(output, JSON.stringify(result, null, 2));
  console.log(
    `${result.length} registros reais importados. SHA256 da origem: ${createHash("sha256").update(bytes).digest("hex")}`,
  );
}
