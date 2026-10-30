import { UserCheck } from "@/components/ui/icon";
import { QUICK_OPTIONS, type TaskFilters } from "@/lib/thc/filters";
import { cn } from "@/lib/utils";

export function FiltersBar({
  filters,
  onChange,
  className,
}: {
  filters: TaskFilters;
  onChange: (f: TaskFilters) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sem-barra flex items-center gap-1.5 max-md:-mx-4 max-md:overflow-x-auto max-md:px-4 md:flex-wrap",
        className,
      )}
    >
      {QUICK_OPTIONS.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange({ ...filters, quick: o.id })}
          className={cn(
            "h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[12px] fluid",
            filters.quick === o.id
              ? "border-transparent bg-selected text-selected-foreground"
              : "border-[var(--glass-border)] bg-surface text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
      <button
        onClick={() => onChange({ ...filters, onlyMine: !filters.onlyMine })}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[12px] fluid",
          filters.onlyMine
            ? "border-transparent bg-selected text-selected-foreground"
            : "border-[var(--glass-border)] bg-surface text-muted-foreground hover:text-foreground",
        )}
      >
        <UserCheck className="size-4" /> Só minhas tarefas
      </button>
    </div>
  );
}
