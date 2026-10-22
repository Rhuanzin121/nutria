// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, it, expect } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableName } from "./EditableName";
import { QuantityEditor } from "./QuantityEditor";
import { MealCard } from "./MealCard";
import { Summary } from "./Nutrition";
import {
  newDiet, sumItems,
  emptyTotals,
  foodSchema,
  type Item,
  type Measure,
} from "../model";
afterEach(cleanup);
function NameHarness() {
  const [name, setName] = useState("Café");
  return (
    <EditableName
      className=""
      label="Nome da refeição"
      value={name}
      onCommit={(value) => setName(value.trim())}
    />
  );
}
function QuantityHarness() {
  const [quantity, setQuantity] = useState(100);
  const [measure, setMeasure] = useState<Measure | undefined>();
  const food = foodSchema.parse({
    id: "quantity-fixture",
    name: "Pão de teste",
    category: "Testes",
    source: "Fixture de teste",
    sourceUrl: "",
    page: null,
    unit: "g",
    referenceAmount: 100,
    per100: emptyTotals(),
  });
  return (
    <>
      <QuantityEditor
        food={food}
        quantity={quantity}
        measure={measure}
        onChange={(q, m) => {
          setQuantity(q);
          setMeasure(m);
        }}
      />
      <output aria-label="Peso convertido">{quantity}</output>
    </>
  );
}

describe("Regressões da interface", () => {
  it("permite digitar espaço entre palavras mesmo quando o valor salvo é aparado", async () => {
    const user = userEvent.setup();
    render(<NameHarness />);
    const input = screen.getByLabelText("Nome da refeição") as HTMLInputElement;
    await user.click(input);
    await user.keyboard("{End} da manhã");
    expect(input.value).toBe("Café da manhã");
    await user.tab();
    expect(input.value).toBe("Café da manhã");
  });
  it("permite apagar e reescrever o título inteiro", async () => {
    const user = userEvent.setup();
    render(<NameHarness />);
    const input = screen.getByLabelText("Nome da refeição") as HTMLInputElement;
    await user.clear(input);
    await user.type(input, "Almoço pré treino");
    await user.tab();
    expect(input.value).toBe("Almoço pré treino");
  });
  it("converte duas fatias a partir do peso informado e permite voltar para gramas", async () => {
    const user = userEvent.setup();
    render(<QuantityHarness />);
    await user.selectOptions(
      screen.getByLabelText("Medida de Pão de teste"),
      "custom",
    );
    await user.type(screen.getByLabelText("g por fatia"), "25");
    await user.click(screen.getByRole("button", { name: /^Usar medida$/ }));
    const count = screen.getByLabelText("Quantidade de Pão de teste em fatia");
    await user.clear(count);
    await user.type(count, "2");
    expect(screen.getByLabelText("Peso convertido").textContent).toBe("50");
    await user.selectOptions(
      screen.getByLabelText("Medida de Pão de teste"),
      "base",
    );
    expect(
      (
        screen.getByLabelText(
          "Quantidade de Pão de teste em g",
        ) as HTMLInputElement
      ).value,
    ).toBe("50");
  });
  it("edita o horário sem criar registro por data", () => {
    const initial = newDiet().meals[0];
    let time = "";
    render(
      <MealCard
        meal={initial}
        index={0}
        count={1}
        onChange={(meal) => {
          time = meal.time;
        }}
        onAdd={() => {}}
        onReplace={() => {}}
        onRemove={() => {}}
        onDuplicate={() => {}}
        onMove={() => {}}
        onSource={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText(`Horário de ${initial.name}`), {
      target: { value: "12:30" },
    });
    expect(time).toBe("12:30");
  });
  it("exibe fibras parciais e percentuais dos macros", () => {
    const food = foodSchema.parse({
      id: "ui-fixture",
      name: "Fixture artificial de fibras",
      source: "Teste",
      sourceUrl: "",
      category: "Teste",
      page: null,
      unit: "g",
      referenceAmount: 100,
      per100: { ...emptyTotals(), fiber: 4 },
    });
    const items: Item[] = [
      { id: "a", food, grams: 100 },
      {
        id: "b",
        food: { ...food, per100: { ...food.per100, fiber: null } },
        grams: 100,
      },
    ];
    render(
      <Summary
        items={items}
        totals={{
          ...emptyTotals(),
          carbs: 100,
          protein: 100,
          fat: 200 / 9,
          fiber: null,
        }}
        goals={emptyTotals()}
        onGoals={() => {}}
      />,
    );
    expect(
      screen.getByText(
        "Total parcial: 1 de 2 alimentos sem informação de fibras.",
      ),
    ).toBeTruthy();
    expect(screen.getAllByText("40%")).toHaveLength(2);
    expect(screen.getByText("20%")).toBeTruthy();
  });
});

function AlternativesHarness() {
  const [meal,setMeal] = useState({...newDiet().meals[0], items:[{id:'main',food:foodSchema.parse({id:'x',name:'Principal',category:'Testes',source:'Teste',sourceUrl:'',page:null,unit:'g',referenceAmount:100,per100:emptyTotals()}),grams:50}]});
  return <MealCard meal={meal} index={0} count={1} onChange={setMeal} onAdd={()=>{}} onReplace={()=>{}} onRemove={()=>{}} onDuplicate={()=>{}} onMove={()=>{}} onSource={()=>{}}/>;
}
it('cria substituição vazia, permite renomear e recupera alimentos da principal',async()=>{
  const user=userEvent.setup();render(<AlternativesHarness/>);
  await user.click(screen.getByRole('button',{name:'Adicionar substituição'}));
  expect(screen.queryByRole('button',{name:/^Principal$/})).toBeNull();
  const name=screen.getByLabelText('Nome da substituição de Café da manhã');
  await user.clear(name);await user.type(name,'Alternativa com ovos');await user.tab();
  expect(screen.getByRole('option',{name:'Alternativa com ovos'})).toBeTruthy();
  await user.selectOptions(screen.getByLabelText('Opção de Café da manhã'),'main');
  expect(screen.getByRole('button',{name:/^Principal$/})).toBeTruthy();
});

it('mostra proteínas e carboidratos conhecidos quando outro alimento não informa macros',()=>{
  const known=foodSchema.parse({id:'known-macros',name:'Alimento com dados',category:'Teste',source:'Fixture',sourceUrl:'',page:null,unit:'g',referenceAmount:100,per100:{...emptyTotals(),protein:30,carbs:50,fat:10}});
  const missing={...known,id:'missing-macros',name:'Alimento sem macros',per100:{...known.per100,protein:null,carbs:null}};
  const items=[{id:'known',food:known,grams:100},{id:'missing',food:missing,grams:100}];
  const totals=sumItems(items);
  expect(totals.protein).toBeNull();expect(totals.carbs).toBeNull();
  render(<Summary totals={totals} items={items} goals={emptyTotals()} bodyWeightKg={80} onGoals={()=>{}}/>);
  expect(screen.getByLabelText('Total de Proteínas').textContent).toContain('≥ 30');
  expect(screen.getByLabelText('Total de Carboidratos').textContent).toContain('≥ 50');
  expect(screen.getByLabelText('Total de Gorduras').textContent).toContain('20');
  expect(screen.getByLabelText('Total de Gorduras').textContent).not.toContain('parcial');
  expect(screen.getAllByText('Alimento sem macros')).toHaveLength(2);
  expect(screen.getByText('≥ 0,38 g/kg')).toBeTruthy();
  expect(screen.getByText('≥ 0,63 g/kg')).toBeTruthy();
});
it('distingue ausência total de informação de um zero conhecido',()=>{
  const food=foodSchema.parse({id:'all-missing',name:'Sem informação',category:'Teste',source:'Fixture',sourceUrl:'',page:null,unit:'g',referenceAmount:100,per100:{...emptyTotals(),protein:null,carbs:null}});
  const items=[{id:'x',food,grams:100}];
  render(<Summary totals={sumItems(items)} items={items} goals={emptyTotals()} onGoals={()=>{}}/>);
  expect(screen.getByLabelText('Total de Proteínas').textContent).toContain('Não informado');
  expect(screen.getByLabelText('Total de Carboidratos').textContent).toContain('Não informado');
  expect(screen.getByLabelText('Total de Gorduras').textContent).toContain('0');
});
