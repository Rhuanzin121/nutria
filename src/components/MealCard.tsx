import {
  ArrowDown,
  ArrowUp,
  Copy,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { activeMealItems, selectedItem, editSelectedItem, updateMealItems, calculateItem, sumItems, type Meal, type Item } from "../model";
import { MacroLine } from "./Nutrition";
import { EditableName } from "./EditableName";
import { MealAlternatives } from "./MealAlternatives";
import { QuantityEditor } from "./QuantityEditor";
export function MealCard({
  meal,
  index,
  count,
  onChange,
  onAdd,
  onReplace,
  onRemove,
  onDuplicate,
  onMove,
  onSource,
}: {
  meal: Meal;
  index: number;
  count: number;
  onChange: (meal: Meal) => void;
  onAdd: () => void;
  onReplace: (item: Item) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (delta: number) => void;
  onSource: (item: Item) => void;
}) {
  const items = activeMealItems(meal);
  return (
    <section className="meal-card">
      <div className="meal-heading">
        <span className="meal-number">
          {String(index + 1).padStart(2, "0")}
        </span>
        <EditableName
          className="meal-name"
          label={`Nome da refeição ${index + 1}`}
          value={meal.name}
          onCommit={(name) => onChange({ ...meal, name })}
        />
        <label className="meal-time">
          <span>Horário</span>
          <input
            type="time"
            aria-label={`Horário de ${meal.name}`}
            value={meal.time}
            onChange={(e) => onChange({ ...meal, time: e.target.value })}
          />
        </label>
        <div className="meal-actions">
          <button
            className="icon-button"
            title="Mover para cima"
            aria-label={`Mover ${meal.name} para cima`}
            disabled={!index}
            onClick={() => onMove(-1)}
          >
            <ArrowUp size={15} />
          </button>
          <button
            className="icon-button"
            title="Mover para baixo"
            aria-label={`Mover ${meal.name} para baixo`}
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown size={15} />
          </button>
          <button
            className="icon-button"
            title="Duplicar refeição"
            aria-label={`Duplicar ${meal.name}`}
            onClick={onDuplicate}
          >
            <Copy size={15} />
          </button>
          <button
            className="icon-button danger"
            title="Remover refeição"
            aria-label={`Remover ${meal.name}`}
            onClick={onRemove}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <MealAlternatives meal={meal} onChange={onChange} />
      {items.length > 0 ? (
        <div className="item-list">
          {items.map((item) => { const current = selectedItem(item); return (
            <div className="food-row" key={item.id}>
              <div className="food-name">
                <button onClick={() => onSource(current)}>{current.food.name}</button>
                <small>
                  {current.food.brand || current.food.source.split(" · ")[0]}
                  {current.food.manual ? " · pessoal" : ""}
                </small>
                <button className="food-option-add" aria-label={`Adicionar substituição de ${current.food.name}`} disabled={(item.substitutions?.length ?? 0) >= 20} onClick={() => onReplace(item)}>
                  <RefreshCw size={12} /> Adicionar substituição
                </button>
              </div>
              <QuantityEditor
                compact
                food={current.food}
                quantity={current.grams}
                measure={current.measure}
                onChange={(grams, measure) =>
                  onChange(updateMealItems(meal, items.map((i) =>
                      i.id === item.id ? editSelectedItem(i, grams, measure) : i)))
                }
              />
              <MacroLine totals={calculateItem(item)} />
              <div className="row-actions">
                <button
                  className="icon-button danger"
                  title="Remover alimento"
                  aria-label={`Remover ${current.food.name}`}
                  onClick={() =>
                    onChange(updateMealItems(meal, items.filter((i) => i.id !== item.id)))
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="food-substitutions">
                {(item.substitutions?.length ?? 0) > 0 && <>
                  <label>Opção do alimento<select aria-label={`Opção de ${item.food.name}`} value={item.activeSubstitutionId ?? ""}
                    onChange={e => onChange(updateMealItems(meal, items.map(i => i.id === item.id ? {...i, activeSubstitutionId: e.target.value || null} : i)))}>
                    <option value="">{item.food.name} (principal)</option>
                    {item.substitutions?.map(s => <option key={s.id} value={s.id}>{s.food.name}</option>)}
                  </select></label>
                  {item.activeSubstitutionId && <button className="text-button" onClick={() => onChange(updateMealItems(meal, items.map(i => i.id === item.id ? {...i, activeSubstitutionId: null, substitutions: i.substitutions?.filter(s => s.id !== i.activeSubstitutionId)} : i)))}>Remover esta substituição</button>}
                </>}
              </div>
            </div>
          );})}
        </div>
      ) : (
        <div className="meal-empty">
          Sua refeição começa com o primeiro alimento.
        </div>
      )}
      <div className="meal-footer">
        <button className="add-food" onClick={onAdd}>
          <Plus size={16} /> Adicionar alimento
        </button>
        <div className="subtotal">
          <span>Subtotal</span>
          <MacroLine totals={sumItems(items)} items={items} />
        </div>
      </div>
    </section>
  );
}
