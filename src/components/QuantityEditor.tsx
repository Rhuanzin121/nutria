import { useEffect, useState } from "react";
import { format, measureQuantity, type Food, type Measure } from "../model";
import { householdMeasures } from "../household";
import { NumberInput } from "./NumberInput";
export function QuantityEditor({
  food,
  quantity,
  measure,
  onChange,
  compact = false,
}: {
  food: Food;
  quantity: number;
  measure?: Measure;
  onChange: (quantity: number, measure?: Measure) => void;
  compact?: boolean;
}) {
  const [custom, setCustom] = useState(false);
  const [name, setName] = useState("fatia");
  const [weight, setWeight] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setCustom(false);
    setMessage("");
  }, [food.id]);
  const measures = [...householdMeasures(food)];
  if (
    measure &&
    !measures.some(
      (m) => m.name === measure.name && m.amount === measure.amount,
    )
  )
    measures.push(measure);
  const selected = measure
    ? String(
        measures.findIndex(
          (m) => m.name === measure.name && m.amount === measure.amount,
        ),
      )
    : "base";
  return (
    <div className={`quantity-editor ${compact ? "compact" : ""}`}>
      <div className="quantity-controls">
        <NumberInput
          label={`Quantidade de ${food.name} em ${measure?.name ?? food.unit}`}
          value={measure ? quantity / measure.amount : quantity}
          max={measure ? 10000 / measure.amount : 10000}
          onCommit={(n) => {
            try {
              onChange(measure ? measureQuantity(n!, measure) : n!, measure);
              setMessage("");
            } catch {
              setMessage("A quantidade convertida deve ser de até 10.000.");
            }
          }}
        />
        <select
          aria-label={`Medida de ${food.name}`}
          value={custom ? "custom" : selected}
          onChange={(e) => {
            setMessage("");
            if (e.target.value === "custom") {
              setCustom(true);
              return;
            }
            setCustom(false);
            if (e.target.value === "base") {
              onChange(quantity);
              return;
            }
            const next = measures[Number(e.target.value)];
            onChange(quantity, next);
          }}
        >
          <option value="base">{food.unit}</option>
          {measures.map((m, index) => (
            <option key={index} value={index}>
              {m.name} ({format(m.amount)} {food.unit})
            </option>
          ))}
          {food.unit !== "porção" && (
            <option value="custom">Outra medida…</option>
          )}
        </select>
      </div>
      {measure && !custom && (
        <small className="measure-hint">
          {format(quantity)} {food.unit} · 1 {measure.name} ={" "}
          {format(measure.amount)} {food.unit}
          <span>{measure.source}</span>
        </small>
      )}
      {custom && (
        <div className="custom-measure">
          <label>
            Medida
            <select
              aria-label="Nome da medida caseira"
              value={name}
              onChange={(e) => setName(e.target.value)}
            >
              {[
                "fatia",
                "unidade",
                "colher de sopa",
                "colher de chá",
                "xícara",
                "concha",
              ].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            {food.unit} por {name}
            <NumberInput
              label={`${food.unit} por ${name}`}
              value={weight}
              max={10000}
              onCommit={setWeight}
            />
          </label>
          <p>
            Informe o peso/volume de uma medida deste alimento, conforme rótulo
            ou pesagem.
          </p>
          <button
            type="button"
            className="secondary"
            disabled={!weight}
            onClick={() => {
              if (!weight) return;
              onChange(quantity, {
                name,
                amount: weight,
                source: "Medida informada pelo usuário (rótulo/pesagem)",
              });
              setCustom(false);
            }}
          >
            Usar medida
          </button>
          <button type="button" onClick={() => setCustom(false)}>
            Cancelar
          </button>
        </div>
      )}
      {message && (
        <small role="alert" className="error">
          {message}
        </small>
      )}
    </div>
  );
}
