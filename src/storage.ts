import { stateSchema, type AppState } from "./model";
export const STORAGE_KEY = "nutria.diets.v1";
export function loadState(): AppState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return stateSchema.parse(JSON.parse(raw));
}
export function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stateSchema.parse(state)));
}
export function dietFilename(name: string, extension: string) {
  const safe = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "dieta";
  return `${safe}.${extension}`;
}
export function exportState(state: AppState, backup = true) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  const selected = state.diets.find(d => d.id === state.selectedId) ?? state.diets[0];
  anchor.download = dietFilename(`${selected?.name ?? "nutria"}${backup ? "-backup" : ""}`, "json");
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
