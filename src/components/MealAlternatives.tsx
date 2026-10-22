import { activeMealItems, format, sumItems, type Meal } from "../model";
import { EditableName } from "./EditableName";
import { MacroLine } from "./Nutrition";
export function MealAlternatives({meal, onChange}: {meal: Meal; onChange: (meal: Meal) => void}) {
  const active = meal.alternatives.find(a => a.id === meal.activeAlternativeId);
  const main = sumItems(meal.items);
  const selected = sumItems(activeMealItems(meal));
  function create(copy: boolean) {
    const id = crypto.randomUUID();
    onChange({...meal, activeAlternativeId: id, alternatives: [...meal.alternatives, {
      id, name: 'Substituição ' + (meal.alternatives.length + 1),
      items: copy ? activeMealItems(meal).map(i => ({...structuredClone(i), id: crypto.randomUUID()})) : [],
    }]});
  }
  return <div className="meal-alternatives">
    <div className="alternative-controls">
      <label>Opção da refeição<select aria-label={'Opção de ' + meal.name} value={meal.activeAlternativeId ?? 'main'} onChange={e => onChange({...meal, activeAlternativeId: e.target.value === 'main' ? null : e.target.value})}>
        <option value="main">Refeição principal</option>
        {meal.alternatives.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select></label>
      <button className="secondary" disabled={meal.alternatives.length >= 20} onClick={() => create(false)}>Adicionar substituição</button>
      <button disabled={meal.alternatives.length >= 20} onClick={() => create(true)}>Copiar como substituição</button>
    </div>
    {active && <div className="alternative-details">
      <EditableName className="alternative-name" label={'Nome da substituição de ' + meal.name} value={active.name} onCommit={name => onChange({...meal, alternatives: meal.alternatives.map(a => a.id === active.id ? {...a, name} : a)})} />
      <button className="danger" onClick={() => {if(confirm('Excluir esta substituição e seus alimentos?')) onChange({...meal, activeAlternativeId: null, alternatives: meal.alternatives.filter(a => a.id !== active.id)});}}>Excluir substituição</button>
      <p>Você está editando esta substituição. Somente a opção selecionada entra no total da dieta.</p>
      <details><summary>Comparar com a refeição principal</summary>
        <p>Principal</p><MacroLine totals={main} items={meal.items}/>
        <p>Substituição selecionada</p><MacroLine totals={selected} items={active.items}/>
        <p>Diferença de calorias: {selected.kcal === null || main.kcal === null ? 'Não disponível' : format(selected.kcal - main.kcal, 0) + ' kcal'}. Substituições não são automaticamente equivalentes.</p>
      </details>
    </div>}
    {!active && meal.alternatives.length > 0 && <p>Somente a refeição principal entra no total. Escolha uma substituição para calcular outra opção.</p>}
  </div>;
}
