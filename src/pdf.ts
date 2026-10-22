import { activeMealItems, calculateDiet, dietSchema, format, macroDistribution, macrosPerKg, nutrients, sumItems, type Diet, type Item, type Totals } from "./model";
import { dietFilename } from "./storage";

const names = {kcal: "Calorias", protein: "Proteínas", carbs: "Carboidratos", fat: "Gorduras", fiber: "Fibras", sodium: "Sódio", saturated: "Gorduras saturadas"};
const unit = (key: keyof Totals) => key === "kcal" ? "kcal" : key === "sodium" ? "mg" : "g";
// PDF literal strings use WinAnsi octal escapes, keeping byte offsets ASCII and
// preserving Portuguese accents with the standard Helvetica fonts.
function literal(text: string) {
  return text.normalize("NFC").replace(/[–—]/g, "-").replace(/≥/g, ">=").replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .split("").map(c => {
      const n = c.charCodeAt(0);
      if (n > 255) return "?";
      if (n < 32) return " ";
      if (n >= 127) return "\\" + n.toString(8).padStart(3, "0");
      return /[()\\]/.test(c) ? "\\" + c : c;
    }).join("");
}
function wrap(text: string, max = 86) {
  const rows: string[] = [];
  const width = (s: string) => Array.from(s).reduce((n,c) => n + (/[MW@%]/.test(c) ? 1 : /[ilI.,:;! ']/.test(c) ? 0.3 : 0.68), 0);
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const chunks = word.match(new RegExp(`.{1,${Math.floor(max * 0.5)}}`, "gu")) ?? [""];
      for (const chunk of chunks) {
        if (line && width(line + " " + chunk) > max * 0.5) { rows.push(line); line = ""; }
        line += (line ? " " : "") + chunk;
      }
    }
    rows.push(line);
  }
  return rows;
}
const macroText = (t: Totals) => (["kcal", "protein", "carbs", "fat", "fiber"] as const)
  .map(k => `${names[k]}: ${format(t[k], k === "kcal" ? 0 : 1)} ${unit(k)}`).join("  |  ");

/** A real downloadable A4 PDF; no network calls or uploaded diet data. */
export function createDietPdf(input: Diet): Uint8Array {
  const diet = dietSchema.parse(input);
  const pages: string[][] = [[]];
  let y = 775;
  const page = () => { pages.push([]); y = 775; };
  function text(value: string, size = 10, bold = false) {
    for (const line of wrap(value, size >= 16 ? 42 : size >= 12 ? 65 : 86)) {
      if (y < 60) page();
      pages.at(-1)!.push(`BT /${bold ? "F2" : "F1"} ${size} Tf 0.14 0.22 0.17 rg 1 0 0 1 45 ${y} Tm (${literal(line)}) Tj ET`);
      y -= size + 5;
    }
  }
  function heading(value: string) {
    if (y < 120) page();
    y -= 12;
    text(value, 13, true);
  }
  function items(rows: Item[]) {
    if (!rows.length) text("Nenhum alimento nesta opção.");
    for (const item of rows) {
      const quantity = item.measure ? `${format(item.grams / item.measure.amount, 2)} ${item.measure.name} = ${format(item.grams)} ${item.food.unit} (${item.measure.source})` : `${format(item.grams)} ${item.food.unit}`;
      const source = `Fonte: ${item.food.source}${item.food.brand ? " | " + item.food.brand : ""}`;
      const height = wrap(item.food.name).length * 15 + wrap(quantity).length * 15 + wrap(macroText(sumItems([item]))).length * 14 + wrap(source).length * 13 + 10;
      if (y - height < 60) page();
      text(item.food.name, 10, true);
      text(item.measure
        ? `${format(item.grams / item.measure.amount, 2)} ${item.measure.name} = ${format(item.grams)} ${item.food.unit} (${item.measure.source})`
        : `${format(item.grams)} ${item.food.unit}`);
      text(macroText(sumItems([item])), 9);
      text(source, 8);
      y -= 5;
    }
    text("Subtotal - " + macroText(sumItems(rows)), 9, true);
  }
  text("NUTRIA | PLANEJAMENTO NUTRICIONAL", 9, true);
  y -= 10;
  text(diet.name, 22, true);
  text("Totais calculados usando somente a opção selecionada de cada refeição.", 9);
  heading("Resumo da dieta");
  const totals = calculateDiet(diet);
  for (const key of nutrients) text(`${names[key]}: ${format(totals[key])} ${unit(key)}${diet.goals[key] === null ? "" : ` | Meta: ${format(diet.goals[key])} ${unit(key)}`}`);
  const dist = macroDistribution(totals);
  if (dist) text(`Energia dos macros: carboidratos ${format(dist.carbs)}% | proteínas ${format(dist.protein)}% | gorduras ${format(dist.fat)}%`, 9);
  const perKg = macrosPerKg(totals, diet.bodyWeightKg);
  if (perKg) {
    text(`Peso corporal: ${format(diet.bodyWeightKg)} kg`);
    text(`Proteínas ${format(perKg.protein, 2)} g/kg | Carboidratos ${format(perKg.carbs, 2)} g/kg | Gorduras ${format(perKg.fat, 2)} g/kg`, 9);
  }
  for (const meal of diet.meals) {
    heading(meal.name + (meal.time ? ` - ${meal.time}` : ""));
    const active = meal.alternatives.find(a => a.id === meal.activeAlternativeId);
    text(`Opção selecionada: ${active?.name ?? "Refeição principal"}`, 10, true);
    items(activeMealItems(meal));
    if (active) { heading("Alternativa: refeição principal (fora do total)"); items(meal.items); }
    for (const alternative of meal.alternatives.filter(a => a.id !== active?.id)) {
      heading(`Substituição: ${alternative.name} (fora do total)`);
      items(alternative.items);
    }
  }
  if (diet.notes) { heading("Anotações"); text(diet.notes); }
  heading("Como ler este plano");
  text("Valores desconhecidos aparecem como '-'; não foram tratados como zero. Medidas médias são estimativas: confirme rótulo ou pesagem. As substituições não são automaticamente equivalentes. Percentuais usam 4 kcal/g para proteínas e carboidratos e 9 kcal/g para gorduras.", 9);
  const objects: string[] = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"];
  const kids: string[] = [];
  pages.forEach((commands, index) => {
    const pageId = objects.length + 1;
    const streamId = pageId + 1;
    kids.push(`${pageId} 0 R`);
    commands.push(`BT /F1 8 Tf 0.4 g 1 0 0 1 45 30 Tm (Nutria | ${index + 1} / ${pages.length}) Tj ET`);
    const stream = commands.join("\n") + "\n";
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  });
  objects[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`; });
  const start = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(n => `${String(n).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
export function exportDietPdf(diet: Diet) {
  const bytes = createDietPdf(diet);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], {type: "application/pdf"}));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = dietFilename(diet.name, "pdf");
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
