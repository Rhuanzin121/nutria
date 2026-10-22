import { useState } from "react";
import { Dialog } from "./Dialog";
import {
  foodSchema,
  nutrients,
  scaleTotals,
  unsetTotals,
  type Food,
} from "../model";
import { labels, unit } from "./Nutrition";
export function ManualFood({
  onSave,
  onClose,
}: {
  onSave: (food: Food) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  return (
    <Dialog
      title="Cadastrar alimento"
      description="Transcreva o rótulo ou uma fonte autorizada. Campos nutricionais vazios permanecem desconhecidos."
      onClose={onClose}
    >
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const data = new FormData(e.currentTarget);
            const numeric = (key: string) => {
              const raw = String(data.get(key) ?? "").trim();
              return raw ? Number(raw.replace(",", ".")) : null;
            };
            const reference = numeric("reference");
            if (!reference || reference <= 0 || !Number.isFinite(reference))
              throw new Error("Informe o peso ou volume válido da referência.");
            const totals = unsetTotals();
            for (const key of nutrients) totals[key] = numeric(key);
            const normalized = scaleTotals(totals, 100 / reference);
            const food = foodSchema.parse({
              id: `manual:${crypto.randomUUID()}`,
              name: data.get("name"),
              brand: data.get("brand"),
              category: data.get("category"),
              preparation: data.get("preparation"),
              source: `Manual · ${data.get("source")}`,
              sourceUrl: data.get("url"),
              externalId: "",
              page: null,
              updatedAt: new Date().toISOString(),
              unit: data.get("unit"),
              referenceAmount: 100,
              per100: normalized,
              manual: true,
              notes: `Referência original: ${reference} ${data.get("unit")}. ${data.get("notes")}`,
            });
            onSave(food);
          } catch {
            setError(
              "Revise os campos. Valores devem ser números positivos ou zero; a referência deve ser maior que zero.",
            );
          }
        }}
      >
        <label className="full">
          Nome
          <input name="name" required maxLength={200} />
        </label>
        <label>
          Marca
          <input name="brand" maxLength={120} />
        </label>
        <label>
          Categoria
          <input name="category" required defaultValue="Personalizados" />
        </label>
        <label>
          Estado de preparo
          <input
            name="preparation"
            placeholder="Ex.: cozido, cru, pronto"
            maxLength={120}
          />
        </label>
        <label>
          Fonte dos dados
          <input
            name="source"
            required
            placeholder="Ex.: rótulo da embalagem"
          />
        </label>
        <label>
          Peso ou volume da referência
          <input
            name="reference"
            required
            inputMode="decimal"
            defaultValue="100"
          />
        </label>
        <label>
          Unidade da referência
          <select name="unit">
            <option value="g">gramas (g)</option>
            <option value="ml">mililitros (ml)</option>
          </select>
        </label>
        {nutrients.map((key) => (
          <label key={key}>
            {labels[key]} ({unit(key)})
            <input name={key} inputMode="decimal" placeholder="Desconhecido" />
          </label>
        ))}
        <label className="full">
          Link da fonte (opcional)
          <input type="url" name="url" />
        </label>
        <label className="full">
          Observações
          <textarea name="notes" maxLength={1500} />
        </label>
        <p className="full muted text-small">
          Dados por porção: informe o peso em g ou volume em ml da porção e os
          nutrientes dessa mesma porção. A composição será normalizada para 100
          g ou 100 ml; não há conversão entre massa e volume.
        </p>
        {error && (
          <p role="alert" className="error full">
            {error}
          </p>
        )}
        <button className="primary full">Salvar alimento pessoal</button>
      </form>
    </Dialog>
  );
}
