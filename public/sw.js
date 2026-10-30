/* TH Flow: service worker só para notificações push (não guarda páginas em cache). */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { titulo: "TH Flow", body: event.data ? event.data.text() : "" };
  }
  const titulo = dados.titulo || "TH Flow";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.body || "",
      icon: "/icones/icon-192.png",
      badge: "/icones/icon-192.png",
      tag: dados.tag,
      data: { url: dados.url || "/notificacoes" },
      // Importância alta fica na tela até a pessoa interagir.
      requireInteraction: dados.nivel === "alta",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/notificacoes";
  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const janela of janelas) {
        if (new URL(janela.url).origin === self.location.origin) {
          await janela.focus();
          if ("navigate" in janela) await janela.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
