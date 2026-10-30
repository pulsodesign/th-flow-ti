import { useCallback, useEffect, useState } from "react";
import { db } from "@/lib/dados/cliente";
import { b64urlDecode, b64urlEncode } from "./webpush";
import { chavePublicaPush, testarPush } from "./notificacoes.functions";

export type EstadoPush =
  | "carregando"
  | "sem-suporte" // navegador sem push (ou iPhone fora do atalho na tela inicial)
  | "iphone-atalho" // iPhone no Safari: precisa abrir pelo atalho da tela inicial
  | "bloqueado" // a pessoa negou a permissão
  | "desativado"
  | "ativado";

function ehIphone() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function abertoComoApp() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function nomeDoAparelho() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Navegador";
}

/** Registra o service worker das notificações (sem efeito em quem não suporta). */
export async function registrarServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    // Ex.: pré-visualização dentro de iframe. O app segue funcionando sem push.
    return null;
  }
}

async function salvarInscricao(sub: PushSubscription, userId: string) {
  const json = sub.toJSON();
  const { error } = await db.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.["p256dh"] ?? "",
      auth: json.keys?.["auth"] ?? "",
      aparelho: nomeDoAparelho(),
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    throw new Error(
      "O banco ainda não tem a atualização das notificações. Rode o SQL da migração 20261014140000 no banco.",
    );
  }
}

/** Estado e ações do push neste aparelho. */
export function usePush(userId: string | null) {
  const [estado, setEstado] = useState<EstadoPush>("carregando");
  const [ocupado, setOcupado] = useState(false);

  const atualizar = useCallback(async () => {
    if (typeof window === "undefined") return;
    const suporta =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!suporta) {
      setEstado(ehIphone() && !abertoComoApp() ? "iphone-atalho" : "sem-suporte");
      return;
    }
    if (Notification.permission === "denied") {
      setEstado("bloqueado");
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    // Mantém a inscrição gravada (o navegador às vezes troca o endereço).
    if (sub && userId) await salvarInscricao(sub, userId).catch(() => undefined);
    setEstado(sub ? "ativado" : "desativado");
  }, [userId]);

  useEffect(() => {
    void atualizar();
  }, [atualizar]);

  /** Precisa ser chamado a partir de um toque/clique (exigência do iPhone). */
  const ativar = async () => {
    if (!userId) return;
    setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado(permissao === "denied" ? "bloqueado" : "desativado");
        return;
      }
      const reg = (await registrarServiceWorker()) ?? (await navigator.serviceWorker.ready);
      const { publicKey } = await chavePublicaPush();
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64urlDecode(publicKey),
        }));
      // Se a chave do servidor mudou, refaz a inscrição.
      const chaveAtual = sub.options.applicationServerKey;
      if (chaveAtual && b64urlEncode(new Uint8Array(chaveAtual)) !== publicKey) {
        await sub.unsubscribe();
        return await ativar();
      }
      await salvarInscricao(sub, userId);
      setEstado("ativado");
      await testarPush().catch(() => undefined);
    } finally {
      setOcupado(false);
    }
  };

  const desativar = async () => {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setEstado("desativado");
    } finally {
      setOcupado(false);
    }
  };

  const testar = async () => {
    setOcupado(true);
    try {
      return await testarPush();
    } finally {
      setOcupado(false);
    }
  };

  return { estado, ocupado, ativar, desativar, testar };
}
