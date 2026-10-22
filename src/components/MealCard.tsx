import {
  ArrowDown,
  ArrowUp,
  Copy,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { calculateItem, sumItems, type Meal, type Item } from "../model";
import { MacroLine } from "./Nutrition";
import { EditableName } from "./EditableName";
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
      {meal.items.length > 0 ? (
        <div className="item-list">
          {meal.items.map((item) => (
            <div className="food-row" key={item.id}>
              <div className="food-name">
                <button onClick={() => onSource(item)}>{item.food.name}</button>
                <small>
                  {item.food.brand || item.food.source.split(" · ")[0]}
                  {item.food.manual ? " · pessoal" : ""}
                </small>
              </div>
              <QuantityEditor
                compact
                food={item.food}
                quantity={item.grams}
                measure={item.measure}
                onChange={(grams, measure) =>
                  onChange({
                    ...meal,
                    items: meal.items.map((i) =>
                      i.id === item.id ? { ...i, grams, measure } : i,
                    ),
                  })
                }
              />
              <MacroLine totals={calculateItem(item)} />
              <div className="row-actions">
                <button
                  className="icon-button"
                  title="Substituir alimento"
                  aria-label={`Substituir ${item.food.name}`}
                  onClick={() => onReplace(item)}
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  className="icon-button danger"
                  title="Remover alimento"
                  aria-label={`Remover ${item.food.name}`}
                  onClick={() =>
                    onChange({
                      ...meal,
                      items: meal.items.filter((i) => i.id !== item.id),
                    })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
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
          <MacroLine totals={sumItems(meal.items)} items={meal.items} />
        </div>
      </div>
    </section>
  );
}
