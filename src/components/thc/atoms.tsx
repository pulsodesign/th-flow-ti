import { cn } from "@/lib/utils";
import { PRIORITIES, TAG_COLORS, initialsOf, type Priority, type Profile } from "@/lib/thc/types";

export const AVATAR_NEUTRAL_COLOR = "oklch(0.68 0.017 260)";

/** Cores a mais só para o avatar, com tons que não existem na paleta das tags (azuis da marca, frios e terrosos). */
export const AVATAR_EXTRA_COLORS = [
  "#293785", // azul TH
  "#4a5be0", // azul royal
  "oklch(0.68 0.13 235)", // azul céu
  "oklch(0.7 0.12 200)", // turquesa
  "oklch(0.5 0.08 220)", // azul petróleo
  "oklch(0.52 0.2 290)", // roxo
  "oklch(0.6 0.22 345)", // magenta
  "oklch(0.55 0.08 55)", // terracota
];

/** Seletor de cor de fundo do avatar (paleta das tags + cores extras). */
export function AvatarColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (cor: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {[AVATAR_NEUTRAL_COLOR, ...TAG_COLORS, ...AVATAR_EXTRA_COLORS].map((cor) => {
        const active = value === cor;
        return (
          <button
            key={cor}
            type="button"
            disabled={disabled}
            aria-label={`Cor ${cor}`}
            title={cor === AVATAR_NEUTRAL_COLOR ? "Neutro (padrão)" : cor}
            onClick={() => onChange(cor)}
            className={cn(
              "size-7 rounded-full border transition-all fluid disabled:opacity-50",
              active
                ? "scale-110 border-foreground/70 ring-2 ring-primary/60"
                : "border-border/60 hover:scale-105",
            )}
            style={{ background: cor }}
          />
        );
      })}
    </div>
  );
}

export function Avatar({
  user,
  size = 26,
  className,
}: {
  user?: Profile | null | undefined;
  size?: number;
  className?: string | undefined;
}) {
  if (!user) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-dashed border-border text-muted-foreground",
          className,
        )}
        style={{ width: size, height: size, fontSize: size * 0.38 }}
      >
        ?
      </span>
    );
  }

  if (user.foto_perfil) {
    return (
      <img
        src={user.foto_perfil}
        alt={user.nome}
        title={`${user.nome} · ${user.cargo}`}
        className={cn("rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      title={`${user.nome} · ${user.cargo}`}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `color-mix(in oklab, ${user.cor} 26%, transparent)`,
        color: user.cor,
        border: `1px solid color-mix(in oklab, ${user.cor} 45%, transparent)`,
      }}
    >
      {initialsOf(user.nome)}
    </span>
  );
}

export function AvatarGroup({ users, size = 24 }: { users: (Profile | null)[]; size?: number }) {
  const list = users.filter(Boolean) as Profile[];
  if (!list.length) return <Avatar size={size} />;
  return (
    <span className="flex -space-x-1.5">
      {list.slice(0, 3).map((u) => (
        <Avatar key={u.id} user={u} size={size} className="ring-2 ring-[var(--tile)]" />
      ))}
      {list.length > 3 && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-muted-foreground ring-2 ring-[var(--tile)]"
          style={{ width: size, height: size }}
        >
          +{list.length - 3}
        </span>
      )}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const p = PRIORITIES.find((x) => x.id === priority) ?? PRIORITIES[1]!;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase leading-none tracking-[0.06em]"
      style={{
        background: `color-mix(in oklab, ${p.color} 20%, transparent)`,
        color: `color-mix(in oklab, ${p.color} 62%, var(--foreground))`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: p.color }} />
      {p.label}
    </span>
  );
}

export function TagChip({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase leading-none tracking-[0.06em]"
      style={{
        background: `color-mix(in oklab, ${color} 18%, transparent)`,
        color: `color-mix(in oklab, ${color} 62%, var(--foreground))`,
      }}
    >
      {label}
    </span>
  );
}

export function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full", className)}
      style={{
        backgroundImage:
          "repeating-linear-gradient(-45deg, color-mix(in oklab, var(--foreground) 14%, transparent) 0 2px, transparent 2px 6px)",
      }}
    >
      <div className="h-full rounded-full bg-primary fluid" style={{ width: `${pct}%` }} />
    </div>
  );
}
