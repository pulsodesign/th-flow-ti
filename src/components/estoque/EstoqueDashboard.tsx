import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fimPeriodo,
  inicioPeriodo,
  totalDoItem,
  type EstoqueItem,
  type EstoqueMovimentacao,
  type EstoqueVariacao,
  type Periodo,
} from "@/lib/estoque/types";

const tooltipStyle = {
  background: "#23254d",
  border: "none",
  borderRadius: 14,
  boxShadow: "0 12px 30px -12px rgb(0 0 0 / 0.45)",
  fontSize: 12,
  color: "#fff",
} as const;

export function EstoqueKpis({
  itens,
  variacoes,
  movimentacoes,
  periodo,
  data,
}: {
  itens: EstoqueItem[];
  variacoes: EstoqueVariacao[];
  movimentacoes: EstoqueMovimentacao[];
  periodo: Periodo;
  data?: string;
}) {
  const zerados = itens.filter((i) => totalDoItem(i, variacoes) === 0).length;
  const de = inicioPeriodo(periodo, data).getTime();
  const ate = fimPeriodo(periodo, data).getTime();
  const noPeriodo = movimentacoes.filter((m) => {
    const t = new Date(m.created_at).getTime();
    return t >= de && t <= ate;
  }).length;

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <Kpi label="Total de itens" value={itens.length} />
      <Kpi label="Estoque baixo (zerado)" value={zerados} alerta={zerados > 0} />
      <Kpi label="Movimentações no período" value={noPeriodo} />
    </div>
  );
}

export function EstoqueGrafico({
  movimentacoes,
  periodo,
  data,
}: {
  movimentacoes: EstoqueMovimentacao[];
  periodo: Periodo;
  data?: string;
}) {
  const serie = useMemo(() => {
    const de = inicioPeriodo(periodo, data);
    const ate = fimPeriodo(periodo, data);
    const dias: { dia: string; entrada: number; saida: number }[] = [];
    const cursor = new Date(de);
    cursor.setHours(0, 0, 0, 0);
    let guard = 0;
    while (cursor <= ate && guard++ < 400) {
      const iso = new Date(cursor.getTime() - cursor.getTimezoneOffset() * 6e4)
        .toISOString()
        .slice(0, 10);
      const doDia = movimentacoes.filter((m) => m.created_at.slice(0, 10) === iso);
      dias.push({
        dia: iso.slice(5),
        entrada: doDia.filter((m) => m.tipo === "entrada").reduce((a, m) => a + m.quantidade, 0),
        saida: doDia.filter((m) => m.tipo === "saida").reduce((a, m) => a + m.quantidade, 0),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return dias;
  }, [movimentacoes, periodo, data]);

  return (
    <div className="panel p-4">
      <h3 className="mb-3 text-[13.5px] font-semibold">Entradas x saídas</h3>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={serie}>
            <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="dia"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Line
              type="monotone"
              dataKey="entrada"
              name="Entradas"
              stroke="var(--primary)"
              dot={false}
              strokeWidth={3}
            />
            <Line
              type="monotone"
              dataKey="saida"
              name="Saídas"
              stroke="var(--destructive)"
              dot={false}
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Kpi({ label, value, alerta }: { label: string; value: number; alerta?: boolean }) {
  return (
    <div className="panel px-3 py-3 sm:px-5 sm:py-4">
      <p className="text-[11.5px] font-medium leading-snug text-muted-foreground sm:text-[12.5px]">
        {label}
      </p>
      <p
        className={
          alerta
            ? "mt-2 text-[30px] font-light leading-none tracking-[-0.03em] text-destructive sm:mt-3 sm:text-[42px]"
            : "mt-2 text-[30px] font-light leading-none tracking-[-0.03em] sm:mt-3 sm:text-[42px]"
        }
      >
        {value}
      </p>
    </div>
  );
}
