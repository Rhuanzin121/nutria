import { describe, it, expect } from "vitest";
import { addItemSubstitution, calculateDiet, calculateItem, editSelectedItem, itemSchema, newDiet, selectedItem, stateSchema } from "./model";
import { brazilianFoods, searchFoods } from "./foods";
import { packagedFoods } from "./packagedFoods";
import { createDietPdf } from "./pdf";

describe("Substituições individuais", () => {
  const original = {id:"bun",food:packagedFoods[0],grams:50};
  const choice = {id:"sesame",food:packagedFoods[1],grams:100};
  it("salva opções sem somá-las e mantém quantidade independente ao alternar", () => {
    const item = addItemSubstitution(original, choice);
    expect(calculateItem(item).kcal).toBe(133);
    const selected = {...item,activeSubstitutionId:choice.id};
    expect(calculateItem(selected).kcal).toBe(276);
    const edited = editSelectedItem(selected,50,choice.food.measures[0]);
    expect(calculateItem(edited).kcal).toBe(138);
    expect(edited.grams).toBe(50);
    expect(selectedItem(edited).measure?.name).toBe("unidade");
    expect(calculateItem({...edited,activeSubstitutionId:null}).kcal).toBe(133);
    expect(itemSchema.safeParse({...edited,activeSubstitutionId:"inexistente"}).success).toBe(false);
  });
  it("preserva escolhas em backup, total de refeição alternativa e PDF", () => {
    const diet = newDiet("Opções");
    diet.meals[0].alternatives=[{id:"meal-alt",name:"Alternativa",items:[{...addItemSubstitution(original,choice),activeSubstitutionId:choice.id}]}];
    diet.meals[0].activeAlternativeId="meal-alt";
    const parsed=stateSchema.parse(JSON.parse(JSON.stringify({version:1,selectedId:diet.id,diets:[diet],customFoods:[],recipes:[]})));
    expect(calculateDiet(parsed.diets[0]).kcal).toBe(276);
    expect(parsed.diets[0].meals[0].alternatives[0].items[0].substitutions).toHaveLength(1);
    const pdf=new TextDecoder().decode(createDietPdf(parsed.diets[0]));
    expect(pdf).toContain("fora do total");
    expect(pdf).not.toContain("Saturadas");
    expect(pdf).not.toContain("S\\363dio");
  });
});

describe("IBGE/POF — composição por 100 g", () => {
  it("importa 1971 combinações únicas de alimento e preparo com procedência", () => {
    expect(brazilianFoods).toHaveLength(1971);
    expect(new Set(brazilianFoods.map(f=>f.id)).size).toBe(1971);
    for(const f of brazilianFoods) {
      expect(f.referenceAmount).toBe(100);
      expect(f.page).toBeGreaterThanOrEqual(36);
      expect(f.page).toBeLessThanOrEqual(96);
      expect(f.name).not.toContain("�");
      expect(f.source).toContain("IBGE");
    }
    const rice=brazilianFoods.find(f=>f.id==='ibge:6300101:99')!;
    expect(rice.per100).toMatchObject({kcal:135.62,protein:2.5,fat:1.2,carbs:27.78,fiber:1.55});
    expect(searchFoods(brazilianFoods,"tapioca de goma").length).toBeGreaterThan(0);
    expect(searchFoods(brazilianFoods,"cuscuz paulista").length).toBeGreaterThan(0);
  });
});
