import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Folder,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  LogOut,
  NotebookPen,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Star,
  Trash2,
  User,
  Users,
  Columns3,
} from "@/components/ui/icon";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/dados/cliente";
import { useAuth } from "@/lib/thc/auth";
import { boardLabel, useWorkspace } from "@/lib/thc/store";
import { boardSlug, findBoardByParam } from "@/lib/thc/slug";
import { Avatar } from "@/components/thc/atoms";
import { NotificationBell } from "@/components/thc/NotificationBell";
import { ThemePicker } from "@/components/thc/ThemePicker";
import { ProjectDialog } from "@/components/thc/ProjectDialog";
import { LogoTHFlow } from "@/components/thc/LogoTHFlow";

import { cn } from "@/lib/utils";
import { isEventTask, type Project } from "@/lib/thc/types";

const STATIC_LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/minhas-tarefas", label: "Minhas Tarefas", icon: CheckSquare },
  { to: "/equipe", label: "Equipe", icon: Users },
  { to: "/visao-geral", label: "Visão Geral", icon: Columns3 },
  { to: "/estoque", label: "Estoque", icon: Package },
] as const;

// Item ativo do menu: pílula escura (claro) ou amarela (escuro) com ícone em destaque.
const ACTIVE_ITEM =
  "bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-[var(--shadow-soft)] hover:bg-sidebar-primary [&>.material-symbols-rounded]:text-[var(--sidebar-active-icon)]";

/** `gaveta`: menu aberto no celular, sempre expandido e sem o botão de minimizar. */
export function AppSidebar({ gaveta = false }: { gaveta?: boolean }) {
  const { profile, isGestor } = useAuth();
  const { projects, masterBoard, departmentBoards, individualBoards, tasks, statuses, profiles } =
    useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  // Menu retrátil (desktop): preferência pessoal salva no navegador.
  const [collapsedSalvo, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("thc-sidebar-collapsed") === "1";
  });
  useEffect(() => {
    try {
      localStorage.setItem("thc-sidebar-collapsed", collapsedSalvo ? "1" : "0");
    } catch {
      /* sem storage disponível */
    }
  }, [collapsedSalvo]);
  const collapsed = !gaveta && collapsedSalvo;

  // Ordem pessoal dos projetos (independente por usuário)
  const [customOrder, setCustomOrder] = useState<string[]>([]);

  useEffect(() => {
    const uid = profile?.id;
    if (!uid) return;
    let ativo = true;
    void db
      .from("user_project_order")
      .select("project_id, posicao")
      .eq("user_id", uid)
      .order("posicao", { ascending: true })
      .then(({ data }) => {
        if (ativo && data) setCustomOrder(data.map((r) => r.project_id));
      });
    return () => {
      ativo = false;
    };
  }, [profile?.id]);

  const activeBoardParam = useRouterState({
    select: (s) => {
      const p = s.location.pathname;
      return p.startsWith("/quadro/") ? p.split("/")[2] : undefined;
    },
  });
  // Aceita slug ou UUID na URL para marcar o quadro ativo.
  const activeBoardId = activeBoardParam
    ? (findBoardByParam(projects, profiles, decodeURIComponent(activeBoardParam))?.id ??
      activeBoardParam)
    : undefined;

  const doneKeys = statuses.filter((s) => s.is_done).map((s) => s.chave);
  const countFor = (b: Project) =>
    tasks.filter(
      (t) =>
        !doneKeys.includes(t.status) &&
        // Eventos são globais e não contam como carga de trabalho da pessoa/quadro.
        !isEventTask(t.status) &&
        (t.board_id === b.id ||
          t.projeto_id === b.id ||
          (b.kind === "individual" && b.owner_id && t.usuario_id.includes(b.owner_id)) ||
          b.kind === "mae"),
    ).length;

  const createProject = async (nome: string, responsaveis: string[]) => {
    const { data, error } = await db
      .from("projects")
      .insert({
        nome,
        kind: "departamento",
        descricao: "",
        icon: "Folder",
        responsaveis_padrao: responsaveis,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      throw error;
    }
    void qc.invalidateQueries();
    void navigate({
      to: "/quadro/$boardId",
      params: { boardId: boardSlug(data as Project, profiles, [...projects, data as Project]) },
      search: {} as never,
    });
  };

  const saveProject = async (nome: string, responsaveis: string[]) => {
    if (!editing) return createProject(nome, responsaveis);
    const { error } = await db
      .from("projects")
      .update({ nome, responsaveis_padrao: responsaveis })
      .eq("id", editing.id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("Projeto atualizado.");
    void qc.invalidateQueries();
  };

  const renameProject = (p: Project) => {
    setEditing(p);
    setCreating(true);
  };

  const deleteProject = async (p: Project) => {
    if (!window.confirm(`Excluir o projeto "${p.nome}"? As tarefas dele serão removidas.`)) return;
    const { error } = await db.from("projects").delete().eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries();
    void navigate({ to: "/dashboard" });
  };

  // Move o projeto na ordem pessoal do usuário e persiste no banco
  const moveProject = (index: number, direction: "up" | "down", currentList: Project[]) => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentList.length) return;

    const copyIds = currentList.map((b) => b.id);
    const [movedId] = copyIds.splice(index, 1);
    if (!movedId) return;
    copyIds.splice(targetIndex, 0, movedId);
    setCustomOrder(copyIds);
    void persistOrder(copyIds);
  };

  const persistOrder = async (ids: string[]) => {
    const uid = profile?.id;
    if (!uid) return;
    const rows = ids.map((project_id, posicao) => ({ user_id: uid, project_id, posicao }));
    const { error } = await db
      .from("user_project_order")
      .upsert(rows, { onConflict: "user_id,project_id" });
    if (error) toast.error("Não foi possível salvar sua ordem de projetos");
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await db.auth.sair();
    void navigate({ to: "/auth", replace: true });
  };

  // Organiza os projetos de departamento aplicando a ordem personalizada pelo usuário
  const sortedDepartmentBoards = [...departmentBoards].sort((a, b) => {
    const indexA = customOrder.indexOf(a.id);
    const indexB = customOrder.indexOf(b.id);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.nome.localeCompare(b.nome);
  });

  return (
    <aside
      className={cn(
        "glass flex h-full shrink-0 flex-col overflow-hidden rounded-[28px] bg-sidebar transition-[width] duration-200 ease-in-out",
        collapsed ? "w-[76px]" : "w-[268px]",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          collapsed ? "flex-col px-2 py-4" : "justify-between px-4 pb-6 pt-5",
        )}
      >
        <Link
          to="/"
          title="TH Flow"
          className={cn("flex min-w-0 items-center gap-2.5", !collapsed && "flex-1")}
        >
          {collapsed ? (
            <img src="/marca/favicon.svg" alt="TH Flow" className="h-10 w-auto shrink-0" />
          ) : (
            <LogoTHFlow className="h-[46px]" />
          )}
        </Link>
        {!collapsed && <NotificationBell />}
        {!gaveta && (
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expandir menu" : "Minimizar menu"}
            title={collapsed ? "Expandir menu" : "Minimizar menu"}
            className="grid size-9 place-items-center rounded-full text-muted-foreground fluid hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-5" />
            ) : (
              <PanelLeftClose className="size-5" />
            )}
          </button>
        )}
      </div>

      <nav
        className={cn("min-h-0 flex-1 space-y-4 overflow-auto pb-4", collapsed ? "px-2" : "px-3")}
      >
        <div className={collapsed ? "space-y-2" : "space-y-1"}>
          {STATIC_LINKS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              activeProps={{ className: ACTIVE_ITEM }}
              className={cn(
                "flex h-10 items-center gap-3 rounded-full px-3.5 text-[13px] text-sidebar-foreground/85 fluid hover:bg-sidebar-accent",
                collapsed && "mx-auto w-11 justify-center px-0",
              )}
            >
              <Icon className="size-5 shrink-0" />
              {!collapsed && label}
            </Link>
          ))}
        </div>

        {masterBoard && (
          <div>
            {collapsed ? <CollapsedDivider /> : <SectionLabel>Operação Geral</SectionLabel>}
            <BoardLink
              board={masterBoard}
              count={countFor(masterBoard)}
              icon={Inbox}
              isActive={masterBoard.id === activeBoardId}
              collapsed={collapsed}
            />
          </div>
        )}

        <div>
          <div className={cn("flex items-center justify-between", !collapsed && "pr-1")}>
            {collapsed ? <CollapsedDivider /> : <SectionLabel>PROJETOS</SectionLabel>}
            {isGestor && !collapsed && (
              <button
                onClick={() => {
                  setEditing(null);
                  setCreating(true);
                }}
                aria-label="Criar projeto"
                className="rounded-md p-1 text-muted-foreground fluid hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <Plus className="size-3.5" />
              </button>
            )}
          </div>
          <ProjectDialog
            open={creating}
            project={editing}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
            onSave={saveProject}
          />

          <div className={collapsed ? "space-y-2" : "space-y-1"}>
            {sortedDepartmentBoards.map((b, index) => (
              <BoardLink
                key={b.id}
                board={b}
                count={countFor(b)}
                icon={Folder}
                isActive={b.id === activeBoardId}
                collapsed={collapsed}
                {...(isGestor && !collapsed
                  ? { onRename: () => renameProject(b), onDelete: () => deleteProject(b) }
                  : {})}
                {...(index > 0 && !collapsed
                  ? { onMoveUp: () => moveProject(index, "up", sortedDepartmentBoards) }
                  : {})}
                {...(index < sortedDepartmentBoards.length - 1 && !collapsed
                  ? { onMoveDown: () => moveProject(index, "down", sortedDepartmentBoards) }
                  : {})}
              />
            ))}
            {!sortedDepartmentBoards.length && !collapsed && <Empty>Nenhum projeto ainda</Empty>}
          </div>
        </div>

        <div>
          {collapsed ? <CollapsedDivider /> : <SectionLabel>EQUIPE</SectionLabel>}
          <div className={collapsed ? "space-y-2" : "space-y-1"}>
            {individualBoards
              .slice()
              .sort((a, b) =>
                a.owner_id === profile?.id ? -1 : b.owner_id === profile?.id ? 1 : 0,
              )
              .map((b) => {
                const meu = !!profile?.id && b.owner_id === profile.id;
                return (
                  <BoardLink
                    key={b.id}
                    board={b}
                    label={
                      meu ? `${boardLabel(b, profiles)} · Meu quadro` : boardLabel(b, profiles)
                    }
                    count={countFor(b)}
                    icon={meu ? Star : User}
                    highlight={meu}
                    dim={!meu}
                    isActive={b.id === activeBoardId}
                    collapsed={collapsed}
                  />
                );
              })}
            {!individualBoards.length && !collapsed && <Empty>Cadastre membros em Acesso</Empty>}
          </div>
        </div>

        {!projects.length && !collapsed && <Empty>Carregando quadros…</Empty>}

        <div>
          {collapsed && <CollapsedDivider />}
          <Link
            to="/anotacoes"
            title={collapsed ? "Anotações" : undefined}
            activeProps={{ className: ACTIVE_ITEM }}
            className={cn(
              "flex h-10 items-center gap-3 rounded-full px-3.5 text-[13px] text-sidebar-foreground/85 fluid hover:bg-sidebar-accent",
              collapsed && "mx-auto w-11 justify-center px-0",
            )}
          >
            <NotebookPen className="size-5 shrink-0" />
            {!collapsed && "Anotações"}
          </Link>
        </div>

        {!collapsed && (
          <div className="pt-2">
            <SectionLabel>APARÊNCIA</SectionLabel>
            <ThemePicker />
          </div>
        )}
      </nav>

      <div className={cn("space-y-1 pb-4 pt-6", collapsed ? "px-2" : "px-3")}>
        <Link
          to="/ajuda"
          title={collapsed ? "Como usar" : undefined}
          activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground" }}
          className={cn(
            "flex h-10 items-center gap-3 rounded-full px-3.5 text-[13px] text-muted-foreground fluid hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "mx-auto w-11 justify-center px-0",
          )}
        >
          <HelpCircle className="size-5 shrink-0" /> {!collapsed && "Como usar"}
        </Link>
        <Link
          to="/lixeira"
          title={collapsed ? "Lixeira" : undefined}
          activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground" }}
          className={cn(
            "flex h-10 items-center gap-3 rounded-full px-3.5 text-[13px] text-muted-foreground fluid hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "mx-auto w-11 justify-center px-0",
          )}
        >
          <Trash2 className="size-5 shrink-0" /> {!collapsed && "Lixeira"}
        </Link>
      </div>

      <div
        className={cn(
          "flex items-center gap-2 border-t border-sidebar-border py-3",
          collapsed ? "justify-center px-2" : "px-3",
        )}
      >
        <Link
          to="/perfil"
          title={collapsed ? (profile?.nome ?? "Perfil") : undefined}
          className={cn("flex min-w-0 items-center gap-2", !collapsed && "flex-1")}
        >
          <span className="shrink-0 rounded-full ring-2 ring-[var(--glass-border)]">
            <Avatar user={profile} size={34} />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-medium text-sidebar-foreground">
                {profile?.nome ?? "—"}
              </span>
              <span className="block truncate text-[11px] text-sidebar-foreground/65">
                {profile?.cargo} · {isGestor ? "Administrador" : "Membro"}
              </span>
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={signOut}
            aria-label="Sair"
            className="grid size-9 place-items-center rounded-full text-sidebar-foreground/65 fluid hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="size-5" />
          </button>
        )}
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3.5 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </p>
  );
}

// Menu minimizado: linha curta separando os grupos no lugar dos títulos de seção.
function CollapsedDivider() {
  return <div className="mx-auto mb-3 h-px w-8 bg-sidebar-border" />;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-2.5 py-1 text-[11.5px] text-muted-foreground/70">{children}</p>;
}

function BoardLink({
  board,
  count,
  icon: Icon,
  label,
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
  highlight,
  dim,
  isActive,
  collapsed,
}: {
  board: Project;
  count: number;
  icon: typeof Folder;
  label?: string;
  onRename?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  highlight?: boolean;
  dim?: boolean;
  isActive?: boolean;
  collapsed?: boolean;
}) {
  const { projects, profiles } = useWorkspace();
  const slug = boardSlug(board, profiles, projects);
  return (
    <div className="group relative flex items-center">
      <Link
        to="/quadro/$boardId"
        params={{ boardId: slug }}
        search={{} as never}
        title={collapsed ? (label ?? board.nome) : undefined}
        className={cn(
          "flex h-10 min-w-0 flex-1 items-center gap-3 rounded-full px-3.5 text-[13px] fluid",
          collapsed && "mx-auto w-11 flex-none justify-center px-0",
          isActive
            ? ACTIVE_ITEM
            : cn(
                "text-sidebar-foreground/85 hover:bg-sidebar-accent",
                highlight && "bg-sidebar-accent text-sidebar-foreground",
              ),
          dim && !isActive && "opacity-60 hover:opacity-100",
        )}
      >
        <Icon className={cn("size-5 shrink-0", !isActive && highlight && "text-primary-ink")} />
        {!collapsed && <span className="min-w-0 flex-1 truncate">{label ?? board.nome}</span>}
        {!collapsed && (
          <span
            className={cn(
              "text-[11px]",
              isActive ? "text-sidebar-primary-foreground/75" : "text-muted-foreground",
            )}
          >
            {count || ""}
          </span>
        )}
      </Link>

      {!collapsed && (onRename || onDelete || onMoveUp || onMoveDown) && (
        <span className="absolute right-1.5 hidden items-center gap-0.5 rounded-full bg-popover px-1.5 shadow-[var(--shadow-soft)] group-hover:flex">
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              aria-label={`Mover para cima ${board.nome}`}
              className="p-1 text-muted-foreground hover:text-sidebar-foreground"
            >
              <ChevronUp className="size-3" />
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={onMoveDown}
              aria-label={`Mover para baixo ${board.nome}`}
              className="p-1 text-muted-foreground hover:text-sidebar-foreground"
            >
              <ChevronDown className="size-3" />
            </button>
          )}
          {onRename && (
            <button
              onClick={onRename}
              aria-label={`Renomear ${board.nome}`}
              className="p-1 text-muted-foreground hover:text-sidebar-foreground"
            >
              <Pencil className="size-3" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              aria-label={`Excluir ${board.nome}`}
              className="p-1 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </span>
      )}
    </div>
  );
}
