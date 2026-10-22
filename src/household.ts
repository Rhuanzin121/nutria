import { type Food, type Measure } from "./model";
// Explicit average estimates for named foods, never applied by fuzzy search to
// a different preparation, brand, liquid or recipe. Existing source measures win.
const averages: Record<string, [string, number][]> = {
  "taco:48": [["fatia média",25]], "taco:50": [["fatia média",25]],
  "taco:51": [["fatia média",25]], "taco:52": [["fatia média",25]],
  "taco:53": [["unidade média",50]], "taco:54": [["fatia média",25]],
  "taco:140": [["unidade média",25]],
  "taco:461": [["fatia média",30]], "taco:462": [["fatia média",30]],
  "taco:463": [["fatia média",20]], "taco:467": [["fatia média",20]],
  "taco:469": [["fatia média",30]], "taco:468": [["colher de sopa",30]],
  "taco:488": [["unidade média sem casca",50]], "taco:489": [["unidade média sem casca",50]],
  "taco:486": [["unidade (clara)",30]], "taco:487": [["unidade (gema)",20]],
  "taco:485": [["unidade sem casca",10]],
  "taco:179": [["unidade média sem casca",90]], "taco:182": [["unidade média sem casca",70]],
  "taco:178": [["unidade média sem casca",65]], "taco:180": [["unidade média sem casca",40]],
  "taco:221": [["unidade média",130]], "taco:222": [["unidade média",130]],
  "taco:3": [["colher de sopa cheia",25]], "taco:1": [["colher de sopa cheia",25]],
  "taco:561": [["concha média",80]],
};
export function householdMeasures(food: Food): Measure[] {
  if (food.measures.length || food.unit !== "g") return food.measures;
  return (averages[food.id] ?? []).map(([name, amount]) => ({name, amount,
    source: "Peso médio estimado pelo aplicativo; varia com tamanho, corte e preparo. Confirme no rótulo ou na balança."}));
}
