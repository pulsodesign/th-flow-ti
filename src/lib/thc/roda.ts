import type { WheelEvent } from "react";

/**
 * Faz a roda vertical do mouse (Windows, mouse comum) mover um quadro de colunas na horizontal.
 * Sobre uma coluna que ainda tem cards para rolar, a roda continua rolando a coluna.
 */
export function rodaHorizontal(e: WheelEvent<HTMLElement>) {
  const el = e.currentTarget;
  if (el.scrollWidth <= el.clientWidth) return;
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
  for (let n = e.target as HTMLElement | null; n && n !== el; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight) return;
  }
  el.scrollLeft += e.deltaY;
}
