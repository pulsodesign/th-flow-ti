import { createFileRoute } from "@tanstack/react-router";
import EstoquePage from "@/pages/Estoque";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — TH Flow" },
      {
        name: "description",
        content:
          "Controle de estoque da operação: itens, variações de tamanho, entradas, saídas e comentários.",
      },
      { property: "og:title", content: "Estoque — TH Flow" },
      {
        property: "og:description",
        content: "Itens, quantidades por tamanho e movimentações de entrada e saída.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EstoquePage,
});
