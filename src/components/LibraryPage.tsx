import { BookOpen, Leaf, Plus, Trash2, Upload } from "lucide-react";
import { officialFoods, supplementalFoods } from "../foods";
import {
  foodSchema,
  format,
  sumItems,
  type AppState,
  type Recipe,
} from "../model";
import { MacroLine } from "./Nutrition";
export function LibraryPage({
  tab,
  state,
  setState,
  setRecipe,
  setManual,
  setError,
}: {
  tab: "recipes" | "foods";
  state: AppState;
  setState: (s: AppState) => void;
  setRecipe: (r: Recipe | "new") => void;
  setManual: (v: boolean) => void;
  setError: (m: string) => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SUA BIBLIOTECA</div>
          <h1>{tab === "recipes" ? "Receitas caseiras" : "Meus alimentos"}</h1>
          <p>
            {tab === "recipes"
              ? "Ingredientes, rendimento e nutrientes em um só lugar."
              : "Seus rótulos e alimentos personalizados, sempre identificados."}
          </p>
        </div>
        <button
          className="primary"
          onClick={() =>
            tab === "recipes" ? setRecipe("new") : setManual(true)
          }
        >
          <Plus size={17} />
          {tab === "recipes" ? "Nova receita" : "Cadastrar alimento"}
        </button>
      </div>
      {tab === "recipes" ? (
        <div className="library-grid">
          {state.recipes.map((r) => (
            <article className="library-card" key={r.id}>
              <BookOpen size={24} />
              <h2>{r.name}</h2>
              <p>
                {r.ingredients.length} ingredientes · {format(r.servings)}{" "}
                porções
                {r.finalGrams ? ` · ${format(r.finalGrams)} g pronta` : ""}
              </p>
              <MacroLine totals={sumItems(r.ingredients)} />
              <div>
                <button onClick={() => setRecipe(r)}>Editar receita</button>
                <button
                  className="danger"
                  onClick={() => {
                    if (
                      confirm(
                        "Excluir a receita? Os itens já usados em dietas conservam os valores salvos.",
                      )
                    )
                      setState({
                        ...state,
                        recipes: state.recipes.filter((i) => i.id !== r.id),
                      });
                  }}
                >
                  Excluir
                </button>
              </div>
            </article>
          ))}
          {!state.recipes.length && (
            <div className="empty">
              <BookOpen size={32} />
              <h2>Sua primeira receita</h2>
              <p>Adicione os ingredientes e informe o rendimento do preparo.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="setup-note">
            <b>
              {officialFoods.length} alimentos TACO e {supplementalFoods.length}{" "}
              USDA disponíveis na busca das refeições
            </b>
            <p>
              Abaixo ficam seus cadastros pessoais. Também é possível importar
              um catálogo normalizado de arquivo autorizado.
            </p>
            <label className="import-button">
              <Upload size={16} />
              Importar catálogo autorizado
              <input
                type="file"
                accept="application/json,.json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 10000000) throw new Error();
                    const parsed = JSON.parse(await file.text());
                    const incoming = foodSchema.array().max(5000).parse(parsed);
                    if (
                      !confirm(
                        `Importar ${incoming.length} alimentos? Confirme que tem autorização para usar os dados.`,
                      )
                    )
                      return;
                    const imported = incoming.map((f) => ({
                      ...f,
                      id: `import:${crypto.randomUUID()}`,
                      manual: true,
                      source: `Importado pelo usuário · ${f.source}`,
                    }));
                    const next = {
                      ...state,
                      customFoods: [...state.customFoods, ...imported],
                    };
                    if (next.customFoods.length > 5000)
                      throw new Error("Limite de 5000 cadastros.");
                    setState(next);
                  } catch {
                    setError(
                      "Catálogo inválido. Consulte o formato documentado no README.",
                    );
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {state.customFoods.map((food) => (
            <article className="personal-food" key={food.id}>
              <div>
                <h3>{food.name}</h3>
                <p>
                  {food.brand} · {food.source} · referência{" "}
                  {food.referenceAmount} {food.unit}
                </p>
                <MacroLine totals={food.per100} />
              </div>
              <button
                className="icon-button danger"
                aria-label={`Excluir cadastro ${food.name}`}
                onClick={() => {
                  if (
                    confirm(
                      "Excluir cadastro? Itens usados em dietas manterão os valores salvos.",
                    )
                  )
                    setState({
                      ...state,
                      customFoods: state.customFoods.filter(
                        (f) => f.id !== food.id,
                      ),
                    });
                }}
              >
                <Trash2 size={18} />
              </button>
            </article>
          ))}
          {!state.customFoods.length && (
            <div className="empty">
              <Leaf size={30} />
              <h2>Seu catálogo pessoal</h2>
              <p>Cadastre um produto a partir das informações da embalagem.</p>
            </div>
          )}
        </>
      )}
    </>
  );
}
