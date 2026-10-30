import { useQueries } from "@tanstack/react-query";

export interface Holiday {
  /** ISO YYYY-MM-DD */
  date: string;
  name: string;
  scope: "nacional" | "estadual" | "municipal";
}

interface BrasilApiHoliday {
  date: string;
  name: string;
  type: string;
}

/** Feriados fixos de SP (estado) e Bragança Paulista (município). MM-DD. */
const FIXED_HOLIDAYS: Array<{ md: string; name: string; scope: Holiday["scope"] }> = [
  { md: "01-25", name: "Aniversário de São Paulo", scope: "municipal" },
  { md: "07-09", name: "Revolução Constitucionalista (SP)", scope: "estadual" },
  { md: "12-15", name: "Aniversário de Bragança Paulista", scope: "municipal" },
];

async function fetchNationalHolidays(year: number): Promise<Holiday[]> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
    if (!res.ok) return [];
    const data = (await res.json()) as BrasilApiHoliday[];
    return data.map((h) => ({ date: h.date, name: h.name, scope: "nacional" as const }));
  } catch {
    return [];
  }
}

/**
 * Feriados visíveis no calendário: nacionais (BrasilAPI) + fixos SP/Bragança.
 * Apenas referência visual — nunca viram tarefas no Kanban.
 */
export function useHolidays(years: number[]) {
  const unique = [...new Set(years)];
  const results = useQueries({
    queries: unique.map((year) => ({
      queryKey: ["feriados", year],
      queryFn: () => fetchNationalHolidays(year),
      staleTime: 24 * 60 * 60 * 1000,
      gcTime: 7 * 24 * 60 * 60 * 1000,
    })),
  });

  const byDate = new Map<string, Holiday[]>();
  results.forEach((r, i) => {
    const year = unique[i];
    const fixed: Holiday[] = FIXED_HOLIDAYS.map((f) => ({
      date: `${year}-${f.md}`,
      name: f.name,
      scope: f.scope,
    }));
    for (const h of [...(r.data ?? []), ...fixed]) {
      const list = byDate.get(h.date) ?? [];
      list.push(h);
      byDate.set(h.date, list);
    }
  });
  return byDate;
}
