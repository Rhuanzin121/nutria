import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { activeMealItems, calculateDiet, duplicateDiet, newDiet, macrosPerKg, stateSchema, updateMealItems, emptyTotals, macroDistribution, sumItems } from "./model";
import { officialFoods } from "./foods";
import { householdMeasures } from "./household";
import { dietFilename } from "./storage";
import { createDietPdf } from "./pdf";
const bread = officialFoods.find(f => f.id === "taco:52")!;
const egg = officialFoods.find(f => f.id === "taco:488")!;
function fixture() {
  const diet = newDiet("Plano Ágil / força"); diet.bodyWeightKg = 80;
  diet.meals[0].items = [{id:"main-item", food:bread, grams:50}];
  diet.meals[0].alternatives = [{id:"alternative", name:"Ovos", items:[{id:"alt-item",food:egg,grams:100}]}];
  return diet;
}
describe("Planejamento e documentos", () => {
  it("conta uma opção por refeição e preserva principal ao editar substituição", () => {
    const d = fixture(); const original = calculateDiet(d);
    d.meals[0].activeAlternativeId = "alternative";
    expect(calculateDiet(d).kcal).toBe(egg.per100.kcal);
    d.meals[0] = updateMealItems(d.meals[0], [{id:"edited", food:egg,grams:200}]);
    expect(calculateDiet(d).kcal).toBe(egg.per100.kcal! * 2);
    expect(d.meals[0].items[0].grams).toBe(50);
    d.meals[0].activeAlternativeId = null;
    expect(calculateDiet(d)).toEqual(original);
  });
  it("remapeia IDs e mantém seleção ao duplicar", () => {
    const d = fixture(); d.meals[0].activeAlternativeId = "alternative";
    const copy = duplicateDiet(d);
    expect(copy.meals[0].activeAlternativeId).toBe(copy.meals[0].alternatives[0].id);
    expect(copy.meals[0].alternatives[0].items[0].id).not.toBe("alt-item");
    expect(calculateDiet(copy)).toEqual(calculateDiet(d));
  });
  it("migra backup antigo e rejeita seleção inexistente", () => {
    const d = fixture(); const old = JSON.parse(JSON.stringify(d));
    delete old.bodyWeightKg; delete old.meals[0].alternatives; delete old.meals[0].activeAlternativeId;
    const parsed = stateSchema.parse({version:1,selectedId:d.id,diets:[old],recipes:[],customFoods:[]});
    expect(parsed.diets[0].bodyWeightKg).toBeNull();
    expect(activeMealItems(parsed.diets[0].meals[0])).toHaveLength(1);
    d.meals[0].activeAlternativeId="absent";
    expect(stateSchema.safeParse({...parsed,diets:[d]}).success).toBe(false);
  });
  it("calcula g/kg sem dividir por zero e considera macro ausente como zero", () => {
    const totals = {...emptyTotals(),protein:160,carbs:240,fat:null};
    expect(macrosPerKg(totals,80)).toEqual({protein:2,carbs:3,fat:0});
    expect(macrosPerKg(totals,0)).toBeNull(); expect(macrosPerKg(totals,null)).toBeNull();
  });
  it("oferece fatia média e mantém medidas oficiais", () => {
    expect(householdMeasures(bread)[0].amount).toBe(25);
    expect(householdMeasures(bread)[0].source).toContain("estimado");
    const custom = {...bread,measures:[{name:"fatia do rótulo",amount:30,source:"Rótulo"}]};
    expect(householdMeasures(custom)).toEqual(custom.measures);
    expect(householdMeasures({...bread,id:"unrelated",unit:"ml"})).toEqual([]);
  });
  it("usa nome atualizado e sanitiza nome de arquivo", () => {
    expect(dietFilename("Plano Ágil / força","pdf")).toBe("Plano-Agil-forca.pdf");
    expect(dietFilename("***","json")).toBe("dieta.json");
  });
  it("gera PDF paginado com índice válido e opções fora do total", () => {
    const d=fixture(); d.meals[0].time="07:00"; d.meals[0].activeAlternativeId="alternative";
    d.notes = ("Observações de teste com acentuação e texto longo. ").repeat(35);
    d.meals[1].items = Array.from({length:25},(_,i)=>({id:"long-"+i,food:bread,grams:25}));
    const bytes = createDietPdf(d); const pdf = new TextDecoder().decode(bytes);
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("fora do total"); expect(pdf).toContain("g/kg");
    const start=Number(pdf.match(/startxref\n(\d+)/)![1]); expect(pdf.slice(start,start+4)).toBe("xref");
    const offsets=Array.from(pdf.matchAll(/(\d{10}) 00000 n/g), m=>Number(m[1]));
    offsets.forEach((offset,index)=>expect(pdf.slice(offset)).toMatch(new RegExp("^"+(index+1)+" 0 obj")));
    expect(Number(pdf.match(/\/Count (\d+)/)![1])).toBeGreaterThan(1);
    if (process.env.NUTRIA_PDF_SAMPLE) writeFileSync(process.env.NUTRIA_PDF_SAMPLE, bytes);
  });
});

import { supplements } from "./supplements";
import { calculateItem } from "./model";
it('mantém 40/40/20 ao adicionar alimento cujos nutrientes são todos ausentes',()=>{
  const known = {...bread,per100:{...emptyTotals(),protein:100,carbs:100,fat:200/9}};
  const unknown = {...bread,id:'missing-all',per100:{kcal:null,protein:null,carbs:null,fat:null,fiber:null,sodium:null,saturated:null}};
  const totals = sumItems([{id:'known',food:known,grams:100},{id:'unknown',food:unknown,grams:1}]);
  expect(macroDistribution(totals)).toEqual({protein:40,carbs:40,fat:20});
  expect(totals.fiber).toBe(0);
  expect(unknown.per100.protein).toBeNull();
});
it('converte nutrientes vazios de backup antigo em zero sem definir metas',()=>{
  const d=newDiet('Backup antigo');
  d.meals[0].items=[{id:'old',food:{...bread,per100:{...bread.per100,protein:null,carbs:null}},grams:100}];
  const parsed=stateSchema.parse({version:1,selectedId:d.id,diets:[d],customFoods:[],recipes:[]});
  expect(parsed.diets[0].meals[0].items[0].food.per100.protein).toBe(0);
  expect(parsed.diets[0].meals[0].items[0].food.per100.carbs).toBe(0);
  expect(parsed.diets[0].goals.protein).toBeNull();
  expect(parsed.diets[0].bodyWeightKg).toBeNull();
});
it('usa a porção exata do rótulo de cada whey, sem arredondar para 100 g',()=>{
  expect(supplements).toHaveLength(3);
  expect(supplements.map(f=>calculateItem({id:f.id,food:f,grams:f.referenceAmount}).protein)).toEqual([24,21,24]);
  const growth=supplements[2];
  expect(calculateItem({id:'half',food:growth,grams:15}).protein).toBe(12);
  expect(supplements[0].name).toContain('doce de leite');
});

import { packagedFoods } from "./packagedFoods";
import { searchFoods } from "./foods";
it("encontra pão de hambúrguer Pullman e calcula duas unidades de 50 g",()=>{
  const bread=searchFoods(packagedFoods,"pao de hamburguer pullman")[0];
  expect(bread.brand).toBe("Pullman");
  expect(bread.measures[0].amount).toBe(50);
  expect(calculateItem({id:"two-buns",food:bread,grams:100})).toMatchObject({kcal:266,protein:9,carbs:50,fat:3.4,fiber:2.8,sodium:466});
});
