import {
  format, macrosPerKg, zeroMissingNutrients,
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
export function nutrientDisplay(totals: Totals, key: Nutrient, items?: Item[], divisor = 1) {
  const value = totals[key] ?? (items ? nutrientCoverage(items, key).known : 0);
  return {value: format(value / divisor, divisor === 1 ? key === "kcal" ? 0 : 1 : 2), partial: false};
}
export function MacroLine({
  totals,
  items,
}: {
  totals: Totals;
  items?: Item[];
}) {
  return (
    <div className="macro-line">
      {(["kcal", "protein", "carbs", "fat", "fiber"] as const).map((key) => {
        const display = nutrientDisplay(totals, key, items);
        return (
        <span key={key} title={labels[key]}>
          <b>{display.value}</b>{" "}
          {unit(key)}
          <small>
            {labels[key]}
            
          </small>
        </span>
      );})}
    </div>
  );
}
export function Summary({
  totals: originalTotals,
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
  const totals = zeroMissingNutrients(originalTotals);
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
          {nutrientDisplay(totals, "kcal", items).value} <small>kcal</small>
        </div>
        <p>Calculado a partir das suas refeições</p>
      </div>
      <div className="summary-macros" role="region" aria-label="Macronutrientes da dieta">
        {(["protein", "carbs", "fat"] as const).map((key) => {
          const display = nutrientDisplay(totals, key, items);
          return (<div key={key} aria-label={`Total de ${labels[key]}`}>
            <i className={key} />
            <span>{labels[key]}</span>
            <b>
              {display.value} <small>{"g"}</small>
            </b>
          </div>
        );})}
      </div>
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
            <details className="distribution-info"><summary>Como é calculado</summary><p>
              Percentual da energia dos macros: carboidratos e proteínas a 4 kcal/g; gorduras a 9 kcal/g.
               As calorias da fonte são mantidas.
            </p></details>
          </>
        ) : (
          <p>
            {items.length
              ? "Sem energia de macros informada para calcular os percentuais."
              : "Adicione alimentos para ver as porcentagens."}
          </p>
        )}
      </section>
      <section className="per-kg" aria-label="Macros por peso corporal">
        <h3>Macros por kg de peso corporal</h3>
        <label>Peso corporal (kg)<NumberInput label="Peso corporal em kg" value={bodyWeightKg} nullable min={0.001} max={600} onCommit={n => { if (n === null || n > 0) onWeight?.(n); }} /></label>
        {perKg ? <div className="distribution-values">{(["protein", "carbs", "fat"] as const).map(key => { const display = nutrientDisplay(totals, key, items, bodyWeightKg!); return <div key={key}><b>{display.value}{" g/kg"}</b><span>{labels[key]}</span></div>;})}</div> : <p>Informe seu peso para dividir os gramas de cada macro pelo peso em kg.</p>}
      </section>
      <section className="fiber-summary" aria-label="Fibras da dieta">
        <div>
          <h3>Fibras alimentares</h3>
          <b>
            
            {format(fiber.known)} <small>g</small>
          </b>
        </div>
        <p>
          Total das fibras das refeições.
        </p>
      </section>
      <div className="goals-title">
        <h3>Comparação com metas</h3>
        <button onClick={onGoals}>Editar</button>
      </div>
      {(["kcal", "protein", "carbs", "fat", "fiber", "sodium"] as const).map(
        (key) => {
          const display = nutrientDisplay(totals, key, items);
          const { difference, percent } = goalDifference(
            totals[key],
            goals[key],
          );
          return (
            <div className={`goal ${key}`} key={key}>
              <div>
                <span>{labels[key]}</span>
                <b>
                  {display.value}{" "}
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
                    ? "Comparação incompleta: há alimentos sem informação"
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
        Valores nutricionais não informados são considerados 0.
      </p>
    </aside>
  );
}
