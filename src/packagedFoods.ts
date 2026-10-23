import { foodSchema, type Food } from "./model";

export const packagedFoods: Food[] = [foodSchema.parse({
  id: "label:pullman-hamburguer-sem-gergelim-200g",
  name: "Pão de hambúrguer sem gergelim (tradicional)",
  brand: "Pullman",
  aliases: ["pao de hamburguer pullman", "pao de hamburger pullman", "pao hamburguer", "pao hamburger", "pullman"],
  category: "Pães e produtos de panificação",
  source: "Rótulo comercial · Carrefour",
  sourceUrl: "https://newsitefood.cloud.carrefour.com.br/pao-para-hamburguer-sem-gergelim-pullman-200g-5813646/p",
  externalId: "Pullman sem gergelim · pacote 200 g / 4 unidades · Carrefour 5813646",
  page: null,
  unit: "g",
  referenceAmount: 50,
  per100: {kcal: 133, protein: 4.5, carbs: 25, fat: 1.7, fiber: 1.4, sodium: 233, saturated: 0.3},
  measures: [{name: "unidade", amount: 50, source: "Rótulo comercial Carrefour: porção 50 g = 1 unidade"}],
  notes: "Pão de hambúrguer tradicional sem gergelim, pacote de 200 g com 4 unidades. Tabela por 50 g divulgada pelo Carrefour, consultada em 23/10/2026. Não corresponde às versões Artesano, brioche ou com gergelim. Valores e peso conforme este rótulo comercial; confira a embalagem da sua versão.",
})];
