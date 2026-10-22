import { QuantityEditor } from "./QuantityEditor";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog } from "./Dialog";
import { FoodPicker } from "./FoodPicker";
import { NumberInput } from "./NumberInput";
import { MacroLine } from "./Nutrition";
import {
  sumItems,
  scaleTotals,
  recipeSchema,
  recipePerServing,
  type Food,
  type Recipe,
} from "../model";
export function RecipeEditor({
  foods,
  initial,
  onSave,
  onClose,
}: {
  foods: Food[];
  initial?: Recipe;
  onSave: (recipe: Recipe) => void;
  onClose: () => void;
}) {
  const [recipe, setRecipe] = useState<Recipe>(
    initial
      ? structuredClone(initial)
      : {
          id: crypto.randomUUID(),
          name: "",
          ingredients: [],
          servings: 1,
          finalGrams: null,
          notes: "",
        },
  );
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Dialog
        title={initial ? "Editar receita" : "Nova receita caseira"}
        description="Some os ingredientes e informe o rendimento depois do preparo."
        onClose={onClose}
        wide
      >
        <form
          className="recipe-form"
          onSubmit={(e) => {
            e.preventDefault();
            const result = recipeSchema.safeParse(recipe);
            if (!result.success) {
              setError(
                "Informe nome, ao menos um ingrediente e rendimento válido.",
              );
              return;
            }
            onSave(result.data);
          }}
        >
          <label>
            Nome da receita
            <input
              required
              maxLength={80}
              value={recipe.name}
              onChange={(e) => setRecipe({ ...recipe, name: e.target.value })}
            />
          </label>
          <div className="recipe-ingredients">
            {recipe.ingredients.map((item) => (
              <div key={item.id}>
                <span>{item.food.name}</span>
                <QuantityEditor
                  compact
                  food={item.food}
                  quantity={item.grams}
                  measure={item.measure}
                  onChange={(grams, measure) =>
                    setRecipe({
                      ...recipe,
                      ingredients: recipe.ingredients.map((i) =>
                        i.id === item.id ? { ...i, grams, measure } : i,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label={`Remover ingrediente ${item.food.name}`}
                  onClick={() =>
                    setRecipe({
                      ...recipe,
                      ingredients: recipe.ingredients.filter(
                        (i) => i.id !== item.id,
                      ),
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="secondary"
            type="button"
            onClick={() => setPicker(true)}
          >
            <Plus size={16} />
            Adicionar ingrediente
          </button>
          <div className="form-grid">
            <label>
              Número de porções
              <NumberInput
                label="Número de porções"
                value={recipe.servings}
                onCommit={(n) => setRecipe({ ...recipe, servings: n! })}
                max={10000}
              />
            </label>
            <label>
              Peso final da receita pronta (g)
              <NumberInput
                label="Peso final da receita pronta em gramas"
                value={recipe.finalGrams}
                onCommit={(n) =>
                  setRecipe({ ...recipe, finalGrams: n === 0 ? null : n })
                }
                nullable
                max={100000}
              />
            </label>
          </div>
          <p className="muted text-small">
            Pese a receita pronta: água e gordura podem alterar o rendimento. O
            cálculo soma os nutrientes dos ingredientes; perdas nutricionais do
            preparo não são estimadas.
          </p>
          <label>
            Observações
            <textarea
              value={recipe.notes}
              maxLength={2000}
              onChange={(e) => setRecipe({ ...recipe, notes: e.target.value })}
            />
          </label>
          <div className="recipe-totals">
            <h3>Total da receita</h3>
            <MacroLine totals={sumItems(recipe.ingredients)} />
            <h3>Por porção</h3>
            <MacroLine totals={recipePerServing(recipe)} />
            {recipe.finalGrams && recipe.ingredients.length > 0 && (
              <>
                <h3>Por 100 g da receita pronta</h3>
                <MacroLine
                  totals={scaleTotals(
                    sumItems(recipe.ingredients),
                    100 / recipe.finalGrams,
                  )}
                />
              </>
            )}
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary">Salvar receita</button>
        </form>
      </Dialog>
      {picker && (
        <FoodPicker
          foods={foods.filter((f) => !f.id.startsWith("recipe:"))}
          onClose={() => setPicker(false)}
          onManual={() => {
            setError(
              "Cadastre o alimento no catálogo antes de incluí-lo na receita.",
            );
            setPicker(false);
          }}
          onSelect={(item) => {
            setRecipe({
              ...recipe,
              ingredients: [...recipe.ingredients, item],
            });
            setPicker(false);
          }}
        />
      )}
    </>
  );
}
