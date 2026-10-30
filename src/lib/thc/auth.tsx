import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { db, type Sessao as Session } from "@/lib/dados/cliente";
import type { Profile, Role } from "./types";

type AuthValue = {
  session: Session | null;
  userId: string | null;
  profile: Profile | null;
  role: Role;
  isGestor: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role>("membro");
  const [loading, setLoading] = useState(true);

  const load = async (uid: string | null) => {
    if (!uid) {
      setProfile(null);
      setRole("membro");
      return;
    }
    const [{ data: p }, { data: gestor }] = await Promise.all([
      db.from("profiles").select("*").eq("id", uid).maybeSingle(),
      db.rpc("is_gestor"),
    ]);
    setProfile((p as Profile | null) ?? null);
    setRole(gestor ? "gestor" : "membro");
  };

  useEffect(() => {
    let active = true;
    db.auth.sessao().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await load(data.session?.user.id ?? null);
      setLoading(false);
    });

    const cancelar = db.auth.aoMudarSessao((event, s) => {
      setSession(s);
      if (event !== "inicial") {
        void load(s?.user.id ?? null);
      }
    });
    return () => {
      active = false;
      cancelar();
    };
  }, []);

  const value: AuthValue = {
    session,
    userId: session?.user.id ?? null,
    profile,
    role,
    isGestor: role === "gestor",
    loading,
    refresh: async () => load(session?.user.id ?? null),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
