import { Check, Palette, Star } from "@/components/ui/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { THEMES, useTheme } from "@/lib/thc/theme";
import { cn } from "@/lib/utils";

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const atual = THEMES.find((t) => t.id === theme) ?? THEMES[0]!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-10 w-full items-center gap-3 rounded-full px-3.5 text-[13px] text-sidebar-foreground/85 fluid hover:bg-sidebar-accent hover:text-sidebar-foreground"
          aria-label="Selecionar tema"
        >
          <Palette className="size-5 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left">Tema</span>
          <span
            className="size-3.5 shrink-0 rounded-full border border-sidebar-border"
            style={{ background: atual.swatch }}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          Temas
        </DropdownMenuLabel>
        {THEMES.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onSelect={() => setTheme(t.id)}
            className="flex items-center gap-2 text-[12.5px]"
          >
            <span
              className="size-3.5 shrink-0 rounded-full border border-border"
              style={{ background: t.swatch }}
            />
            <span className={cn("min-w-0 flex-1 truncate", t.id === theme && "font-semibold")}>
              {t.label}
            </span>
            {t.padrao && <Star className="size-3.5 shrink-0 fill-warning text-warning" />}
            {t.id === theme && <Check className="size-3.5 shrink-0 text-primary-ink" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
