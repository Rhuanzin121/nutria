import { useMemo, useState } from "react";
import { Search, Plus, ExternalLink } from "lucide-react";
import { Dialog } from "./Dialog";
import { QuantityEditor } from "./QuantityEditor";
import { MacroLine } from "./Nutrition";
import { searchFoods } from "../foods";
import {
  calculateItem,
  format,
  type Food,
  type Item,
  type Measure,
} from "../model";
export function FoodPicker({
  foods,
  onSelect,
  onClose,
  onManual,
}: {
  foods: Food[];
  onSelect: (item: Item) => void;
  onClose: () => void;
  onManual: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<Food | null>(null);
  const [amount, setAmount] = useState(100);
  const [measure, setMeasure] = useState<Measure | undefined>();
  const [source, setSource] = useState("");
  const [visible, setVisible] = useState(40);
  const results = useMemo(
    () =>
      searchFoods(
        foods.filter(
          (f) =>
            !source ||
            (source === "taco"
              ? f.id.startsWith("taco:")
              : source === "usda"
                ? f.id.startsWith("usda:")
                : source === "labels"
                  ? f.id.startsWith("label:")
                : source === "recipes"
                  ? f.id.startsWith("recipe:")
                  : f.manual || f.id.startsWith("composite:")),
        ),
        query,
        category,
      ),
    [foods, query, category, source],
  );
  return (
    <Dialog
      title="Adicionar alimento"
      description="Pesquise no catálogo. Confira o preparo e a unidade antes de adicionar."
      onClose={onClose}
      wide
    >
      <div className="search-box">
        <Search size={19} />
        <input
          autoFocus
          aria-label="Pesquisar alimentos"
          placeholder="Busque por alimento, preparo, marca…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            setVisible(40);
          }}
        />
      </div>
      <div className="search-filters">
        <select
          aria-label="Categoria"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setVisible(40);
            setSelected(null);
          }}
        >
          <option value="">Todas as categorias</option>
          {Array.from(new Set(foods.map((f) => f.category)))
            .sort()
            .map((c) => (
              <option key={c}>{c}</option>
            ))}
        </select>
        <select
          aria-label="Fonte dos alimentos"
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setVisible(40);
            setSelected(null);
          }}
        >
          <option value="">Todas as fontes</option>
          <option value="taco">TACO · Brasil</option>
          <option value="usda">USDA · complemento</option>
          <option value="labels">Rótulos · suplementos e marcas</option>
          <option value="recipes">Minhas receitas</option>
          <option value="personal">Pessoais e composições</option>
        </select>
        <span>{results.length} alimentos encontrados</span>
        <button onClick={onManual}>
          <Plus size={15} /> Cadastrar manualmente
        </button>
      </div>
      <div className="search-suggestions" aria-label="Sugestões de pesquisa">
        {[
          "Arroz branco cozido",
          "Frango grelhado",
          "Ovo cozido",
          "Vegetais variados",
          "Whey",
        ].map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => {
              setQuery(suggestion);
              setCategory("");
              setSource("");
              setVisible(40);
              setSelected(null);
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
      <div className="food-results">
        {results.slice(0, visible).map((food) => (
          <button
            className={`food-result ${selected?.id === food.id ? "selected" : ""}`}
            key={food.id}
            onClick={() => {
              setSelected(food);
              setAmount(food.unit === "porção" ? 1 : food.id.startsWith("label:") ? food.referenceAmount : 100);
              setMeasure(undefined);
            }}
          >
            <div>
              <b>{food.name}</b>
              <small>
                {food.brand && `${food.brand} · `}
                {food.source} {food.manual ? "· cadastro pessoal" : ""}
              </small>
              <small>
                Referência: {format(food.referenceAmount)} {food.unit} ·{" "}
                {food.category}
              </small>
            </div>
            <MacroLine totals={food.per100} />
          </button>
        ))}
        {!results.length && (
          <div className="empty">
            <Search />
            <h3>Nenhum alimento encontrado</h3>
            <p>Tente outro nome ou cadastre os dados do rótulo.</p>
            <button className="primary" onClick={onManual}>
              Cadastrar alimento
            </button>
          </div>
        )}
        {results.length > visible && (
          <button
            className="secondary more-results"
            onClick={() => setVisible(visible + 40)}
          >
            Mostrar mais {Math.min(40, results.length - visible)} resultados
          </button>
        )}
      </div>
      {selected && (
        <div className="selection">
          <div>
            <b>{selected.name}</b>
            <p>
              {selected.source}
              {selected.externalId && ` · ID ${selected.externalId}`}
              {selected.page && ` · página ${selected.page}`}{" "}
              {selected.updatedAt && `· atualização: ${selected.updatedAt}`}
            </p>
            {selected.sourceUrl && (
              <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
                Consultar fonte <ExternalLink size={13} />
              </a>
            )}
            {selected.notes && <p>{selected.notes}</p>}
          </div>
          <div className="selection-quantity">
            <QuantityEditor
              food={selected}
              quantity={amount}
              measure={measure}
              onChange={(quantity, nextMeasure) => {
                setAmount(quantity);
                setMeasure(nextMeasure);
              }}
            />
            <button
              className="primary"
              onClick={() =>
                onSelect({
                  id: crypto.randomUUID(),
                  food: structuredClone(selected),
                  grams: amount,
                  measure,
                })
              }
            >
              <Plus size={17} />
              Adicionar
            </button>
          </div>
          <MacroLine
            totals={calculateItem({
              id: "preview",
              food: selected,
              grams: amount,
            })}
          />
        </div>
      )}
    </Dialog>
  );
}
