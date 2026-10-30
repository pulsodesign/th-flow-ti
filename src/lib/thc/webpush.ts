/**
 * Web Push sem dependências, só com WebCrypto (roda no servidor do app e em qualquer
 * ambiente moderno): assinatura VAPID (RFC 8292) e criptografia aes128gcm (RFC 8291).
 */

export type PushSubscriptionData = { endpoint: string; p256dh: string; auth: string };
export type VapidKeys = { publicKey: string; privateJwk: JsonWebKey };

const enc = new TextEncoder();
type Bytes = Uint8Array<ArrayBuffer>;

export function b64urlEncode(bytes: Bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...partes: Bytes[]) {
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, bytes: number) {
  const chave = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    chave,
    bytes * 8,
  );
  return new Uint8Array(bits);
}

/** Gera o par de chaves VAPID do app (feito uma vez e guardado no banco). */
export async function gerarChavesVapid(): Promise<VapidKeys> {
  const par = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const publica = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
  const privateJwk = await crypto.subtle.exportKey("jwk", par.privateKey);
  return { publicKey: b64urlEncode(publica), privateJwk };
}

async function jwtVapid(endpoint: string, chaves: VapidKeys, contato: string) {
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(
    enc.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: contato,
      }),
    ),
  );
  const privada = await crypto.subtle.importKey(
    "jwk",
    { ...chaves.privateJwk, key_ops: ["sign"] },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privada,
    enc.encode(`${header}.${claims}`),
  );
  return `${header}.${claims}.${b64urlEncode(new Uint8Array(assinatura))}`;
}

/** Par ECDH efêmero. Em produção é sempre novo; os testes injetam um fixo. */
export type ParEfemero = { privateKey: CryptoKey; publicRaw: Bytes };

async function novoParEfemero(): Promise<ParEfemero> {
  const par = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  return {
    privateKey: par.privateKey,
    publicRaw: new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey)),
  };
}

/** Criptografa o conteúdo para um aparelho (RFC 8291, um único registro). */
export async function criptografar(
  conteudo: Bytes,
  sub: Pick<PushSubscriptionData, "p256dh" | "auth">,
  fixo?: { par: ParEfemero; salt: Bytes },
) {
  const uaPublic = b64urlDecode(sub.p256dh);
  const authSecret = b64urlDecode(sub.auth);
  const par = fixo?.par ?? (await novoParEfemero());
  const salt = fixo?.salt ?? crypto.getRandomValues(new Uint8Array(16));

  const uaChave = await crypto.subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const segredo = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaChave }, par.privateKey, 256),
  );
  const ikm = await hkdf(
    authSecret,
    segredo,
    concat(enc.encode("WebPush: info\0"), uaPublic, par.publicRaw),
    32,
  );
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const chaveAes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cifrado = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      chaveAes,
      concat(conteudo, new Uint8Array([2])),
    ),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([par.publicRaw.length]), par.publicRaw, cifrado);
}

/**
 * Envia uma notificação push. Retorna o status HTTP do serviço do navegador
 * (201 = entregue; 404/410 = inscrição expirada, pode ser apagada).
 */
export async function enviarPush(
  sub: PushSubscriptionData,
  dados: unknown,
  chaves: VapidKeys,
  opcoes: { contato: string; urgencia?: "high" | "normal" | "low"; ttl?: number },
) {
  const corpo = await criptografar(enc.encode(JSON.stringify(dados)), sub);
  const jwt = await jwtVapid(sub.endpoint, chaves, opcoes.contato);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${chaves.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(opcoes.ttl ?? 24 * 60 * 60),
      Urgency: opcoes.urgencia ?? "normal",
    },
    body: corpo,
  });
  return res.status;
}
