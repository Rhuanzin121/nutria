import { createClient } from "@supabase/supabase-js";
import { stateSchema, type AppState } from "./model";
const env = import.meta.env;
export const supabase = (() => {
  try {
    return env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY
      ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY)
      : null;
  } catch {
    return null;
  }
})();
export async function fetchCloud(userId: string) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("diet_workspaces")
    .select("data,revision")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? { state: stateSchema.parse(data.data), revision: data.revision as number }
    : null;
}
export async function pushCloud(
  userId: string,
  state: AppState,
  revision: number | null,
) {
  if (!supabase) throw new Error("Supabase não configurado.");
  stateSchema.parse(state);
  if (revision === null) {
    const { error } = await supabase
      .from("diet_workspaces")
      .insert({ user_id: userId, data: state, revision: 1 });
    if (error)
      throw new Error(
        "Não foi possível iniciar a nuvem. Recarregue para verificar conflitos.",
      );
    return 1;
  }
  const { data, error } = await supabase
    .from("diet_workspaces")
    .update({ data: state, revision: revision + 1 })
    .eq("user_id", userId)
    .eq("revision", revision)
    .select("revision");
  if (error) throw error;
  if (!data?.length)
    throw new Error(
      "A nuvem foi alterada em outro dispositivo. Exporte uma cópia local e recarregue antes de sincronizar.",
    );
  return revision + 1;
}
