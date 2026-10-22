import { EditableName } from "./components/EditableName";
import { LibraryPage } from "./components/LibraryPage";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  Cloud,
  Copy,
  Download,
  Leaf,
  Plus,
  Salad,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";
import {
  calculateDiet,
  activeMealItems, dietItems, updateMealItems,
  duplicateDiet,
  duplicateMeal,
  newDiet,
  nutrients,
  stateSchema,
  type AppState,
  type Diet,
  type Item,
  type Recipe,
} from "./model";
import { catalog } from "./foods";
import { exportDietPdf } from "./pdf";
import { exportState, loadState, saveState } from "./storage";
import { pushCloud, supabase } from "./cloud";
import { Dialog } from "./components/Dialog";
import { NumberInput } from "./components/NumberInput";
import { Summary, labels, unit, MacroLine } from "./components/Nutrition";
import { MealCard } from "./components/MealCard";
import { FoodPicker } from "./components/FoodPicker";
import { ManualFood } from "./components/ManualFood";
import { RecipeEditor } from "./components/RecipeEditor";
import { CloudDialog } from "./components/CloudDialog";

function initialize() {
  try {
    const saved = loadState();
    if (saved) return { state: saved, error: "" };
  } catch {
    return { state: emptyState(), error: "Dados locais inválidos." };
  }
  return { state: emptyState(), error: "" };
}
function emptyState(): AppState {
  const diet = newDiet("Dieta principal");
  return {
    version: 1,
    diets: [diet],
    selectedId: diet.id,
    customFoods: [],
    recipes: [],
  };
}
type PickerTarget = { mealId: string; replaceId?: string };
export default function App() {
  const [initial] = useState(initialize);
  const [state, setState] = useState(initial.state);
  const [error, setError] = useState(
    initial.error
      ? "Os dados locais não puderam ser lidos. O salvamento está pausado para preservar o arquivo. Exporte uma cópia ou importe um backup válido."
      : "",
  );
  const [blocked, setBlocked] = useState(!!initial.error);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"diets" | "recipes" | "foods">("diets");
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [manual, setManual] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | "new" | null>(null);
  const [modal, setModal] = useState<
    "goals" | "create" | "source" | "cloud" | null
  >(null);
  const [sourceItem, setSourceItem] = useState<Item | null>(null);
  const [dietName, setDietName] = useState("");
  const [cloudStatus, setCloudStatus] = useState("Somente neste navegador");
  const cloud = useRef<{ userId: string; revision: number } | null>(null);
  const latest = useRef(state);
  const syncing = useRef(false);
  const synced = useRef<AppState | null>(null);
  const diet =
    state.diets.find((d) => d.id === state.selectedId) ?? state.diets[0];
  const foods = catalog(state);
  latest.current = state;
  useEffect(() => {
    setSaved(false);
    if (blocked) return;
    const timeout = setTimeout(() => {
      try {
        saveState(state);
        setSaved(true);
      } catch {
        setError(
          "Não foi possível salvar neste navegador. Exporte um backup antes de fechar.",
        );
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [state, blocked]);
  useEffect(() => {
    const flush = () => {
      if (!blocked)
        try {
          saveState(latest.current);
        } catch {
          /* Visible saving error is handled by the autosave effect. */
        }
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [blocked]);
  useEffect(() => {
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      if (cloud.current && session?.user.id !== cloud.current.userId) {
        cloud.current = null;
        setCloudStatus("Sincronização desconectada");
      }
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void syncLoop(), 900);
    return () => clearTimeout(timer);
  }, [state]);
  async function syncLoop() {
    if (syncing.current || !cloud.current) return;
    syncing.current = true;
    try {
      while (cloud.current && synced.current !== latest.current) {
        const current = latest.current;
        const session: { userId: string; revision: number } = cloud.current;
        setCloudStatus("Sincronizando…");
        const revision = await pushCloud(
          session.userId,
          current,
          session.revision,
        );
        if (cloud.current !== session) break;
        cloud.current = { ...session, revision };
        synced.current = current;
        setCloudStatus("Sincronizado com a nuvem");
      }
    } catch (e) {
      cloud.current = null;
      setCloudStatus("Sincronização pausada");
      setError(
        e instanceof Error
          ? e.message
          : "Erro ao sincronizar. Sua cópia local foi preservada.",
      );
    } finally {
      syncing.current = false;
    }
  }
  function updateDiet(updated: Diet) {
    const stamped = { ...updated, updatedAt: new Date().toISOString() };
    const next = {
      ...state,
      diets: state.diets.map((d) => (d.id === updated.id ? stamped : d)),
    };
    const parsed = stateSchema.safeParse(next);
    if (!parsed.success) {
      setError("Limite ou dados inválidos. Revise os campos.");
      return;
    }
    setState(parsed.data);
  }
  function addFood(item: Item) {
    if (!picker || !diet) return;
    updateDiet({
      ...diet,
      meals: diet.meals.map((meal) =>
        meal.id !== picker.mealId
          ? meal
          : {
              ...meal,
              ...updateMealItems(meal, picker.replaceId
                ? activeMealItems(meal).map((i) => (i.id === picker.replaceId ? item : i))
                : [...activeMealItems(meal), item]),
            },
      ),
    });
    setPicker(null);
  }
  function removeDiet() {
    if (
      !diet ||
      !confirm(`Excluir a dieta “${diet.name}” e todas as suas refeições?`)
    )
      return;
    const diets = state.diets.filter((d) => d.id !== diet.id);
    setState({ ...state, diets, selectedId: diets[0]?.id ?? "" });
  }
  async function importBackup(file: File) {
    try {
      if (file.size > 15000000) throw new Error("Arquivo muito grande.");
      const parsed = stateSchema.parse(JSON.parse(await file.text()));
      if (!confirm("Substituir todos os dados deste navegador pelo backup?"))
        return;
      cloud.current = null;
      setCloudStatus("Somente neste navegador");
      setBlocked(false);
      setState(parsed);
      setError("");
    } catch {
      setError(
        "Backup inválido. Selecione um JSON exportado pelo Nutria (até 15 MB).",
      );
    }
  }
  const activeCount = diet ? dietItems(diet).length : 0;
  return (
    <div className="app">
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("diets");
          }}
        >
          <span>
            <Leaf size={23} />
          </span>
          nutria
          <span className="brand-divider" />
          <small>Planejamento nutricional</small>
        </a>
        <div className="top-actions">
          <span className="saved" role="status">
            {saved ? <CheckCheck size={15} /> : <Cloud size={15} />}
            <span>
              {blocked
                ? "Salvamento pausado"
                : saved
                  ? "Alterações salvas"
                  : "Salvando…"}
            </span>
          </span>
          <button
            className="icon-button"
            aria-label="Exportar backup"
            title="Exportar backup"
            onClick={() => exportState(state)}
          >
            <Download size={17} />
          </button>
          <label className="import-button top-import" title="Importar backup">
            <Upload size={17} />
            <span className="sr-only">Importar backup</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importBackup(file);
                e.target.value = "";
              }}
            />
          </label>
          <button
            aria-label="Minha conta e sincronização"
            className="secondary account"
            onClick={() => setModal("cloud")}
          >
            <Cloud size={16} />
            <span>Minha conta</span>
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="workspace-label">SEU ESPAÇO</div>
          <nav aria-label="Navegação principal">
            <button
              className={tab === "diets" ? "active" : ""}
              onClick={() => setTab("diets")}
            >
              <Salad size={18} />
              Minhas dietas <span>{state.diets.length}</span>
            </button>
            <button
              className={tab === "recipes" ? "active" : ""}
              onClick={() => setTab("recipes")}
            >
              <BookOpen size={18} />
              Receitas <span>{state.recipes.length}</span>
            </button>
            <button
              className={tab === "foods" ? "active" : ""}
              onClick={() => setTab("foods")}
            >
              <Leaf size={18} />
              Meus alimentos <span>{state.customFoods.length}</span>
            </button>
          </nav>
          <div className="diet-list-heading">
            <h2>DIETAS SALVAS</h2>
            <button
              className="icon-button"
              aria-label="Criar dieta"
              onClick={() => {
                setDietName("");
                setModal("create");
              }}
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="diet-list">
            {state.diets.map((d) => (
              <button
                className={diet?.id === d.id ? "selected" : ""}
                key={d.id}
                onClick={() => {
                  setState({ ...state, selectedId: d.id });
                  setTab("diets");
                }}
              >
                <span className="diet-symbol">
                  <Salad size={16} />
                </span>
                <span>
                  {d.name}
                  <small>{d.meals.length} refeições</small>
                </span>
                {diet?.id === d.id && <ChevronRight size={15} />}
              </button>
            ))}
          </div>
          <button
            className="new-diet"
            onClick={() => {
              setDietName("");
              setModal("create");
            }}
          >
            <Plus size={16} />
            Criar nova dieta
          </button>
          <div className="sidebar-bottom">
            <span className="local-tag">
              <span className="dot" />
              {cloudStatus}
            </span>
            <button onClick={() => exportState(state)}>
              <Download size={15} />
              Exportar backup
            </button>
            <label className="import-button">
              <Upload size={15} />
              Importar backup
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importBackup(file);
                  e.target.value = "";
                }}
              />
            </label>
            <p>
              Planeje uma vez.
              <br />
              Ajuste quando precisar.
            </p>
          </div>
        </aside>
        <main>
          <div className="breadcrumb">
            Meu espaço <ChevronRight size={12} />
            {tab === "diets"
              ? "Minhas dietas"
              : tab === "recipes"
                ? "Receitas"
                : "Meus alimentos"}
          </div>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button onClick={() => setError("")}>Fechar</button>
            </div>
          )}
          {tab === "diets" && diet ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">PLANEJADOR DE DIETAS</div>
                  <EditableName
                    className="diet-title"
                    label="Nome da dieta"
                    value={diet.name}
                    onCommit={(name) => updateDiet({ ...diet, name })}
                  />
                  <p>Organize suas refeições. Confira cada nutriente.</p>
                </div>
                <div className="heading-actions">
                  <button className="secondary" onClick={() => { try { exportDietPdf(diet); } catch { setError("Não foi possível gerar o PDF. Tente novamente."); } }}><Download size={16} />Exportar PDF</button>
                  <button className="secondary" onClick={() => exportState({...state, diets: [diet], selectedId: diet.id}, false)}>Baixar dieta (JSON)</button>
                  <button
                    className="primary"
                    onClick={() => {
                      setDietName("");
                      setModal("create");
                    }}
                  >
                    <Plus size={16} />
                    Nova dieta
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      const copy = duplicateDiet(diet);
                      setState({
                        ...state,
                        diets: [...state.diets, copy],
                        selectedId: copy.id,
                      });
                    }}
                  >
                    <Copy size={16} />
                    Duplicar
                  </button>
                  <button
                    className="icon-button bordered danger"
                    aria-label="Excluir dieta"
                    title="Excluir dieta"
                    onClick={removeDiet}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
              <div className="diet-toolbar">
                <span>
                  <span className="dot" />
                  {diet.meals.length} refeições <i /> {activeCount} alimentos
                </span>
                <button onClick={() => setModal("goals")}>
                  <Settings2 size={15} />
                  Definir metas
                </button>
              </div>
              <div className="editor-layout">
                <div className="meals">
                  {diet.meals.map((meal, index) => (
                    <MealCard
                      key={meal.id}
                      meal={meal}
                      index={index}
                      count={diet.meals.length}
                      onChange={(updated) =>
                        updateDiet({
                          ...diet,
                          meals: diet.meals.map((m) =>
                            m.id === meal.id ? updated : m,
                          ),
                        })
                      }
                      onAdd={() => setPicker({ mealId: meal.id })}
                      onReplace={(item) =>
                        setPicker({ mealId: meal.id, replaceId: item.id })
                      }
                      onRemove={() => {
                        if (confirm(`Remover “${meal.name}” e seus alimentos?`))
                          updateDiet({
                            ...diet,
                            meals: diet.meals.filter((m) => m.id !== meal.id),
                          });
                      }}
                      onDuplicate={() => {
                        const next = [...diet.meals];
                        next.splice(index + 1, 0, duplicateMeal(meal));
                        updateDiet({ ...diet, meals: next });
                      }}
                      onMove={(delta) => {
                        const meals = [...diet.meals];
                        [meals[index], meals[index + delta]] = [
                          meals[index + delta],
                          meals[index],
                        ];
                        updateDiet({ ...diet, meals });
                      }}
                      onSource={(item) => {
                        setSourceItem(item);
                        setModal("source");
                      }}
                    />
                  ))}
                  <button
                    className="add-meal"
                    onClick={() =>
                      updateDiet({
                        ...diet,
                        meals: [
                          ...diet.meals,
                          {
                            id: crypto.randomUUID(),
                            name: `Refeição ${diet.meals.length + 1}`,
                            time: "",
                            items: [], alternatives: [], activeAlternativeId: null,
                          },
                        ],
                      })
                    }
                  >
                    <Plus size={19} />
                    Adicionar refeição
                  </button>
                  <section className="notes">
                    <label htmlFor="diet-notes">
                      Anotações da dieta <span>Opcional</span>
                    </label>
                    <textarea
                      id="diet-notes"
                      maxLength={2000}
                      placeholder="Preferências, substituições ou observações para este plano…"
                      value={diet.notes}
                      onChange={(e) =>
                        updateDiet({ ...diet, notes: e.target.value })
                      }
                    />
                  </section>
                  <div className="source-footer">
                    <Check size={15} />
                    <span>
                      Dados rastreáveis · TACO / NEPA – UNICAMP
                      <a
                        href="https://nepa.unicamp.br/publicacoes/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Conheça a fonte
                      </a>
                    </span>
                  </div>
                </div>
                <Summary
                  items={dietItems(diet)}
                  bodyWeightKg={diet.bodyWeightKg}
                  onWeight={(bodyWeightKg) => updateDiet({...diet, bodyWeightKg})}
                  totals={calculateDiet(diet)}
                  goals={diet.goals}
                  onGoals={() => setModal("goals")}
                />
              </div>
            </>
          ) : tab === "diets" ? (
            <div className="empty">
              <Salad size={36} />
              <h1>Seu próximo plano começa aqui</h1>
              <p>
                Crie uma dieta para organizar refeições e conferir os valores
                nutricionais.
              </p>
              <button className="primary" onClick={() => setModal("create")}>
                <Plus size={17} />
                Criar dieta
              </button>
            </div>
          ) : (
            <LibraryPage
              tab={tab}
              state={state}
              setState={setState}
              setRecipe={setRecipe}
              setManual={setManual}
              setError={setError}
            />
          )}
        </main>
      </div>
      {picker && (
        <FoodPicker
          foods={foods}
          onClose={() => setPicker(null)}
          onSelect={addFood}
          onManual={() => setManual(true)}
        />
      )}{" "}
      {manual && (
        <ManualFood
          onClose={() => setManual(false)}
          onSave={(food) => {
            setState({ ...state, customFoods: [...state.customFoods, food] });
            setManual(false);
          }}
        />
      )}
      {recipe && (
        <RecipeEditor
          foods={foods}
          initial={recipe === "new" ? undefined : recipe}
          onClose={() => setRecipe(null)}
          onSave={(r) => {
            setState({
              ...state,
              recipes: [...state.recipes.filter((i) => i.id !== r.id), r],
            });
            setRecipe(null);
          }}
        />
      )}
      {modal === "create" && (
        <Dialog
          title="Criar dieta"
          description="Escolha um nome para o seu plano alimentar."
          onClose={() => setModal(null)}
        >
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              const created = newDiet(dietName.trim() || "Nova dieta");
              setState({
                ...state,
                diets: [...state.diets, created],
                selectedId: created.id,
              });
              setTab("diets");
              setModal(null);
            }}
          >
            <label>
              Nome da dieta
              <input
                autoFocus
                value={dietName}
                maxLength={80}
                onChange={(e) => setDietName(e.target.value)}
                placeholder="Ex.: Dieta alternativa"
              />
            </label>
            <button className="primary">Criar dieta</button>
          </form>
        </Dialog>
      )}
      {modal === "goals" && diet && (
        <Dialog
          title="Metas nutricionais"
          description="Informe suas próprias metas. Deixe vazio para não definir uma meta."
          onClose={() => setModal(null)}
        >
          <div className="form-grid">
            {nutrients
              .filter((k) => k !== "saturated")
              .map((key) => (
                <label key={key}>
                  {labels[key]} ({unit(key)})
                  <NumberInput
                    label={`Meta de ${labels[key]}`}
                    value={diet.goals[key]}
                    nullable
                    onCommit={(n) =>
                      updateDiet({
                        ...diet,
                        goals: { ...diet.goals, [key]: n },
                      })
                    }
                  />
                </label>
              ))}
          </div>
          <p className="muted text-small">
            As metas são pessoais e não são prescritas pelo aplicativo. Uma meta
            zero não gera divisão por zero.
          </p>
          <button className="primary" onClick={() => setModal(null)}>
            Concluir
          </button>
        </Dialog>
      )}
      {modal === "source" && sourceItem && (
        <Dialog
          title="Origem dos valores"
          description={sourceItem.food.name}
          onClose={() => setModal(null)}
        >
          <div className="source-detail">
            <p>
              <b>Fonte:</b> {sourceItem.food.source}
            </p>
            <p>
              <b>Identificador:</b>{" "}
              {sourceItem.food.externalId || sourceItem.food.id}
            </p>
            <p>
              <b>Referência:</b> {sourceItem.food.referenceAmount}{" "}
              {sourceItem.food.unit}
            </p>
            <p>
              <b>Atualização conhecida:</b>{" "}
              {sourceItem.food.updatedAt ?? "Não informada"}
            </p>
            {sourceItem.food.page && (
              <p>Página impressa: {sourceItem.food.page}</p>
            )}
            <MacroLine totals={sourceItem.food.per100} />
            <p>{sourceItem.food.notes}</p>
            {sourceItem.food.sourceUrl && (
              <a
                href={sourceItem.food.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Abrir fonte original ↗
              </a>
            )}
            <p className="muted">
              Os valores deste item são uma cópia da composição usada ao
              adicioná-lo. Atualizações do catálogo não modificam sua dieta.
            </p>
          </div>
        </Dialog>
      )}
      {modal === "cloud" && (
        <CloudDialog
          state={state}
          onLoad={(incoming) => {
            setState(incoming);
            setBlocked(false);
          }}
          onConnect={(userId, revision) => {
            cloud.current = { userId, revision };
            synced.current = null;
            setCloudStatus("Sincronização ativa");
            setTimeout(() => void syncLoop(), 0);
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
