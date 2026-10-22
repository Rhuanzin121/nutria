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
export function exportState(state: AppState) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "nutria-dietas.json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
