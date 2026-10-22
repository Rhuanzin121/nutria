import {
  format, macrosPerKg,
  goalDifference,
  macroDistribution,
  nutrientCoverage,
  type Totals,
  type Nutrient,
  type Item,
} from "../model";
import { NumberInput } from "./NumberInput";
export const labels: Record<Nutrient, string> = {
  kcal: "Calorias",
  protein: "Proteínas",
  carbs: "Carboidratos",
  fat: "Gorduras",
  fiber: "Fibras",
  sodium: "Sódio",
  saturated: "Gorduras saturadas",
};
export const unit = (key: Nutrient) =>
  key === "kcal" ? "kcal" : key === "sodium" ? "mg" : "g";
export function MacroLine({
  totals,
  items,
}: {
  totals: Totals;
  items?: Item[];
}) {
  const fiber = items ? nutrientCoverage(items, "fiber") : null;
  return (
    <div className="macro-line">
      {(["kcal", "protein", "carbs", "fat", "fiber"] as const).map((key) => (
        <span key={key} title={labels[key]}>
          <b>
            {key === "fiber" && totals.fiber === null && fiber
              ? `≥ ${format(fiber.known)}`
              : format(totals[key], key === "kcal" ? 0 : 1)}
          </b>{" "}
          {unit(key)}
          <small>
            {labels[key]}
            {key === "fiber" && totals.fiber === null && fiber
              ? " (parcial)"
              : ""}
          </small>
        </span>
      ))}
    </div>
  );
}
export function Summary({
  totals,
  goals,
  onGoals,
  items, bodyWeightKg = null, onWeight,
}: {
  totals: Totals;
  bodyWeightKg?: number | null;
  onWeight?: (kg: number | null) => void;
  goals: Totals;
  onGoals: () => void;
  items: Item[];
}) {
  const perKg = macrosPerKg(totals, bodyWeightKg);
  const distribution = macroDistribution(totals);
  const fiber = nutrientCoverage(items, "fiber");
  return (
    <aside className="summary">
      <div className="summary-title">
        <h2>Resumo da dieta</h2>
        <span className="dot" />
      </div>
      <div className="energy">
        <span>VALOR ENERGÉTICO TOTAL</span>
        <div>
          {format(totals.kcal, 0)} <small>kcal</small>
        </div>
        <p>Calculado a partir das suas refeições</p>
      </div>
      <div className="summary-macros">
        {(["protein", "carbs", "fat"] as const).map((key) => (
          <div key={key}>
            <i className={key} />
            <span>{labels[key]}</span>
            <b>
              {format(totals[key])} <small>g</small>
            </b>
          </div>
        ))}
      </div>
      <section className="per-kg" aria-label="Macros por peso corporal">
        <h3>Macros por kg de peso corporal</h3>
        <label>Peso corporal (kg)<NumberInput label="Peso corporal em kg" value={bodyWeightKg} nullable min={0.001} max={600} onCommit={n => { if (n === null || n > 0) onWeight?.(n); }} /></label>
        {perKg ? <div className="distribution-values">{(["protein", "carbs", "fat"] as const).map(key => <div key={key}><b>{format(perKg[key], 2)} g/kg</b><span>{labels[key]}</span></div>)}</div> : <p>Informe seu peso para dividir os gramas de cada macro pelo peso em kg.</p>}
      </section>
      <section
        className="macro-distribution"
        aria-label="Distribuição energética dos macronutrientes"
      >
        <h3>Distribuição dos macros</h3>
        {distribution ? (
          <>
            <div className="distribution-bar" aria-hidden="true">
              {(["carbs", "protein", "fat"] as const).map((key) => (
                <span
                  key={key}
                  className={key}
                  style={{ width: `${distribution[key]}%` }}
                />
              ))}
            </div>
            <div className="distribution-values">
              {(["carbs", "protein", "fat"] as const).map((key) => (
                <div key={key}>
                  <b>{format(distribution[key])}%</b>
                  <span>{labels[key]}</span>
                </div>
              ))}
            </div>
            <p>
              Proporção da energia dos macros: carboidratos e proteínas a 4
              kcal/g; gorduras a 9 kcal/g. As calorias da fonte são mantidas.
            </p>
          </>
        ) : (
          <p>
            {items.length
              ? "Há macros desconhecidos ou energia de macros igual a zero. Complete os valores para calcular os percentuais."
              : "Adicione alimentos para ver as porcentagens."}
          </p>
        )}
      </section>
      <section className="fiber-summary" aria-label="Fibras da dieta">
        <div>
          <h3>Fibras alimentares</h3>
          <b>
            {fiber.missing ? "≥ " : ""}
            {format(fiber.known)} <small>g</small>
          </b>
        </div>
        <p>
          {fiber.missing
            ? `Total parcial: ${fiber.missing} de ${fiber.total} alimentos sem informação de fibras.`
            : "Total das fibras informadas nas refeições."}
        </p>
        {fiber.missing > 0 && (
          <details>
            <summary>Ver alimentos sem informação</summary>
            <ul>
              {items
                .filter((item) => item.food.per100.fiber === null)
                .map((item) => (
                  <li key={item.id}>{item.food.name}</li>
                ))}
            </ul>
            <p>
              “≥” indica o subtotal conhecido; os valores ausentes não foram
              tratados como zero.
            </p>
          </details>
        )}
      </section>
      <div className="goals-title">
        <h3>Comparação com metas</h3>
        <button onClick={onGoals}>Editar</button>
      </div>
      {(["kcal", "protein", "carbs", "fat", "fiber", "sodium"] as const).map(
        (key) => {
          const { difference, percent } = goalDifference(
            totals[key],
            goals[key],
          );
          return (
            <div className={`goal ${key}`} key={key}>
              <div>
                <span>{labels[key]}</span>
                <b>
                  {format(totals[key], key === "kcal" ? 0 : 1)}{" "}
                  <small>
                    / {goals[key] === null ? "—" : format(goals[key])}{" "}
                    {unit(key)}
                  </small>
                </b>
              </div>
              <div
                className="track"
                role="progressbar"
                aria-label={labels[key]}
                aria-valuenow={
                  percent === null ? undefined : Math.min(100, percent)
                }
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div style={{ width: `${Math.min(100, percent ?? 0)}%` }} />
              </div>
              <p>
                {goals[key] === null
                  ? "Meta não definida"
                  : totals[key] === null
                    ? "Total desconhecido: há dados ausentes"
                    : `${percent === null ? "Percentual indisponível" : `${format(percent, 0)}% da meta`} · ${format(Math.abs(difference ?? 0))} ${unit(key)} ${(difference ?? 0) > 0 ? "acima" : (difference ?? 0) < 0 ? "abaixo" : "de diferença"}`}
              </p>
            </div>
          );
        },
      )}
      <div className="extra-total">
        <span>Gorduras saturadas</span>
        <b>{format(totals.saturated)} g</b>
      </div>
      <p className="muted text-small">
        “—” indica dados desconhecidos. Um nutriente ausente em um item deixa o
        total desse nutriente desconhecido.
      </p>
    </aside>
  );
}
