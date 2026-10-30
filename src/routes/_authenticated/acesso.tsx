import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/acesso")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex" }],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/equipe" });
  },
  component: () => null,
});
