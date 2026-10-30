import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/dados/cliente";
import { useServerFn } from "@tanstack/react-start";
import { MailPlus, RefreshCw, ShieldCheck, Trash2, UserPlus } from "@/components/ui/icon";
import { toast } from "sonner";
import { useAuth } from "@/lib/thc/auth";
import { Avatar, AvatarColorPicker } from "@/components/thc/atoms";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  criarMembro,
  definirNivelAcesso,
  listarEquipeAdmin,
  removerMembro,
  reenviarConvite,
  sincronizarQuadros,
} from "@/lib/thc/admin.functions";
import { cn } from "@/lib/utils";
import { traduzErroAuth } from "@/lib/thc/i18n";

/**
 * Painel de administração de usuários (cadastro, níveis de acesso, convites).
 * Extraído da antiga rota /acesso para ser reutilizado dentro da página Equipe.
 */
export function AcessoPanel() {
  const { isGestor, userId } = useAuth();
  const listar = useServerFn(listarEquipeAdmin);
  const { data: profiles = [], refetch } = useQuery({
    queryKey: ["admin-team-directory"],
    enabled: isGestor,
    queryFn: () => listar(),
  });
  const emailDe = (id: string) => profiles.find((profile) => profile.id === id)?.email ?? "";
  const criar = useServerFn(criarMembro);
  const definir = useServerFn(definirNivelAcesso);
  const remover = useServerFn(removerMembro);
  const reenviar = useServerFn(reenviarConvite);
  const sincronizar = useServerFn(sincronizarQuadros);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [nivel, setNivel] = useState<"gestor" | "membro">("membro");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!nome.trim() || !email.trim() || !cargo.trim()) {
      toast.error("Preencha nome, e-mail e cargo.");
      return;
    }
    setBusy(true);
    try {
      await criar({
        data: {
          nome: nome.trim(),
          email: email.trim(),
          cargo: cargo.trim(),
          nivel_acesso: nivel,
        },
      });
      toast.success("Convite enviado por e-mail para criação da senha.");
      setNome("");
      setEmail("");
      setCargo("");
      setNivel("membro");
      void refetch();
    } catch (err) {
      toast.error(traduzErroAuth(err, "Não foi possível cadastrar o usuário."));
    } finally {
      setBusy(false);
    }
  };

  const reenviarPara = async (mail: string) => {
    try {
      const res = await reenviar({ data: { email: mail } });
      if (res.link) {
        await navigator.clipboard.writeText(res.link).catch(() => undefined);
        toast.success("Convite reenviado. Link de acesso copiado para a área de transferência.");
      } else {
        toast.success("Convite reenviado por e-mail.");
      }
    } catch (err) {
      toast.error(traduzErroAuth(err, "Não foi possível reenviar o convite."));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="panel overflow-hidden">
        <table className="w-full text-[12.5px] max-md:block">
          <thead className="bg-surface/70 text-left text-[11px] uppercase tracking-[0.1em] text-muted-foreground max-md:hidden">
            <tr>
              <th className="px-4 py-2.5 font-medium">Usuário</th>
              <th className="px-4 py-2.5 font-medium">E-mail</th>
              <th className="px-4 py-2.5 font-medium">Cargo</th>
              <th className="px-4 py-2.5 font-medium">Nível de acesso</th>
              <th />
            </tr>
          </thead>
          <tbody className="max-md:block">
            {profiles.map((u) => (
              <tr
                key={u.id}
                className="border-t border-border/70 max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-3 max-md:gap-y-1.5 max-md:p-4 max-md:first:border-t-0"
              >
                <td className="px-4 py-2.5 max-md:w-full max-md:p-0">
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger
                        disabled={!isGestor}
                        title={isGestor ? "Alterar cor do avatar" : undefined}
                        className="rounded-full fluid hover:ring-2 hover:ring-primary/50 disabled:cursor-default disabled:hover:ring-0"
                      >
                        <Avatar user={u} size={26} />
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto p-2.5">
                        <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                          Cor do avatar
                        </p>
                        <AvatarColorPicker
                          value={u.cor}
                          onChange={async (cor) => {
                            try {
                              const { error } = await db
                                .from("profiles")
                                .update({ cor })
                                .eq("id", u.id);
                              if (error) throw error;
                              toast.success(`Cor de ${u.nome} atualizada.`);
                              void refetch();
                            } catch (err) {
                              toast.error(traduzErroAuth(err, "Não foi possível atualizar a cor."));
                            }
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="font-medium">{u.nome}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground max-md:w-full max-md:break-all max-md:p-0">
                  {emailDe(u.id)}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground max-md:p-0">{u.cargo}</td>
                <td className="px-4 py-2.5 max-md:p-0">
                  <select
                    disabled={!isGestor}
                    value={u.role}
                    onChange={async (e) => {
                      try {
                        await definir({
                          data: {
                            user_id: u.id,
                            nivel_acesso: e.target.value as "gestor" | "membro",
                          },
                        });
                        toast.success("Nível de acesso atualizado.");
                        void refetch();
                      } catch (err) {
                        toast.error(
                          traduzErroAuth(err, "Não foi possível atualizar o nível de acesso."),
                        );
                      }
                    }}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-[11.5px] outline-none disabled:opacity-60 max-md:h-9 max-md:rounded-full max-md:px-3"
                  >
                    <option value="membro">Membro</option>
                    <option value="gestor">Administrador</option>
                  </select>
                </td>
                <td className="px-2 py-2.5 max-md:ml-auto max-md:p-0">
                  {isGestor && (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => void reenviarPara(emailDe(u.id))}
                        aria-label={`Reenviar convite para ${u.nome}`}
                        title="Reenviar convite / copiar link de acesso"
                        className="rounded-md p-1 text-muted-foreground fluid hover:text-primary-ink max-md:p-2.5"
                      >
                        <MailPlus className="size-3.5" />
                      </button>
                      {u.id !== userId && (
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Remover ${u.nome}?`)) return;
                            try {
                              await remover({ data: { user_id: u.id } });
                              toast.success("Membro removido.");
                              void refetch();
                            } catch (err) {
                              toast.error(
                                traduzErroAuth(err, "Não foi possível remover o usuário."),
                              );
                            }
                          }}
                          aria-label={`Remover ${u.nome}`}
                          className="rounded-md p-1 text-muted-foreground fluid hover:text-destructive max-md:p-2.5"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={cn("panel p-4", !isGestor && "pointer-events-none opacity-50")}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary-ink" />
          <h2 className="text-[13.5px] font-semibold">Novo usuário</h2>
        </div>
        <div className="mt-3 space-y-2.5">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome completo"
            className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12.5px] outline-none focus:border-primary"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail corporativo"
            className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12.5px] outline-none focus:border-primary"
          />
          <input
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Cargo (ex.: Designer)"
            className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12.5px] outline-none focus:border-primary"
          />
          <select
            value={nivel}
            onChange={(e) => setNivel(e.target.value as "gestor" | "membro")}
            className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12.5px] outline-none"
          >
            <option value="membro">Membro</option>
            <option value="gestor">Administrador</option>
          </select>

          <button
            onClick={() => void submit()}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary font-semibold px-3 py-2 text-[12.5px] text-primary-foreground fluid hover:opacity-90 disabled:opacity-60"
          >
            <UserPlus className="size-4" /> {busy ? "Enviando…" : "Cadastrar e convidar"}
          </button>
          <button
            onClick={async () => {
              try {
                const res = await sincronizar({});
                toast.success(
                  res.criados
                    ? `${res.criados} quadro(s) individual(is) criado(s).`
                    : "Todos os membros já possuem quadro individual.",
                );
                void refetch();
              } catch (err) {
                toast.error(traduzErroAuth(err, "Não foi possível sincronizar os quadros."));
              }
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-[12.5px] fluid hover:bg-surface"
          >
            <RefreshCw className="size-4" /> Sincronizar quadros individuais
          </button>
          <p className="text-[11px] text-muted-foreground">
            O convite por e-mail permite que a pessoa crie a própria senha. Um quadro individual é
            criado automaticamente em Demanda da Equipe.
          </p>
        </div>
      </section>
    </div>
  );
}
