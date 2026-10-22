import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Dialog } from "./Dialog";
import { supabase, fetchCloud, pushCloud } from "../cloud";
import type { AppState } from "../model";
export function CloudDialog({
  state,
  onLoad,
  onConnect,
  onClose,
}: {
  state: AppState;
  onLoad: (state: AppState) => void;
  onConnect: (userId: string, revision: number) => void;
  onClose: () => void;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void supabase?.auth.getUser().then(({ data }) => setUser(data.user));
    const subscription = supabase?.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user ?? null),
    );
    return () => subscription?.data.subscription.unsubscribe();
  }, []);
  async function connect(mode: "load" | "upload") {
    if (!user) return;
    setBusy(true);
    setMessage("");
    try {
      const cloud = await fetchCloud(user.id);
      if (mode === "load") {
        if (!cloud) {
          setMessage(
            "Não há dietas nesta conta. Envie a cópia deste navegador para começar.",
          );
          return;
        }
        onLoad(cloud.state);
        onConnect(user.id, cloud.revision);
        onClose();
      } else {
        if (
          cloud &&
          !confirm(
            "Substituir a cópia na nuvem pelas dietas deste navegador? Exporte um backup antes de continuar.",
          )
        )
          return;
        const revision = await pushCloud(
          user.id,
          state,
          cloud?.revision ?? null,
        );
        onConnect(user.id, revision);
        onClose();
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha ao conectar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Sua conta e sincronização"
      description="A cópia local funciona sem login. Conecte sua conta para salvar entre dispositivos."
      onClose={onClose}
    >
      {!supabase ? (
        <div className="setup-note">
          <h3>Configuração do Supabase pendente</h3>
          <p>
            Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no
            arquivo .env.local e aplique a migração SQL do projeto. Depois
            reinicie o servidor.
          </p>
          <p>Seus dados continuam sendo salvos neste navegador.</p>
        </div>
      ) : user ? (
        <div className="cloud-options">
          <p>
            Conectado como <b>{user.email}</b>
          </p>
          <p>
            Escolha qual cópia usar ao conectar. A partir daí, alterações são
            enviadas automaticamente. Conflitos entre dispositivos pausam a
            sincronização e preservam a cópia local.
          </p>
          <button
            disabled={busy}
            className="primary"
            onClick={() => connect("load")}
          >
            Abrir dietas da nuvem
          </button>
          <button
            disabled={busy}
            className="secondary"
            onClick={() => connect("upload")}
          >
            Enviar dietas deste navegador
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              await supabase!.auth.signOut();
              setMessage(
                "Conta desconectada. Os dados locais continuam neste navegador.",
              );
            }}
          >
            Sair da conta
          </button>
        </div>
      ) : (
        <form
          className="auth-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setBusy(true);
            const { error } = await supabase!.auth.signInWithPassword({
              email: String(data.get("email")),
              password: String(data.get("password")),
            });
            setMessage(
              error?.message ??
                "Conectado. Escolha uma cópia para sincronizar.",
            );
            setBusy(false);
          }}
        >
          <label>
            E-mail
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Senha
            <input
              name="password"
              type="password"
              minLength={8}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="primary" disabled={busy}>
            Entrar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async (e) => {
              const form = e.currentTarget.form!;
              if (!form.reportValidity()) return;
              const data = new FormData(form);
              setBusy(true);
              const { error } = await supabase!.auth.signUp({
                email: String(data.get("email")),
                password: String(data.get("password")),
              });
              setMessage(
                error?.message ??
                  "Cadastro enviado. Confira o e-mail de confirmação quando solicitado.",
              );
              setBusy(false);
            }}
          >
            Criar conta
          </button>
        </form>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </Dialog>
  );
}
