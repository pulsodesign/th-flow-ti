import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import {
  Bold,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Paperclip,
  Underline,
} from "@/components/ui/icon";
import { toast } from "sonner";
import { sanitizeRichHtml } from "@/lib/thc/sanitize";
import { cn } from "@/lib/utils";
import { uploadAnexo } from "@/lib/thc/uploads";

const CMDS = [
  { cmd: "bold", icon: Bold, label: "Negrito" },
  { cmd: "italic", icon: Italic, label: "Itálico" },
  { cmd: "underline", icon: Underline, label: "Sublinhado" },
  { cmd: "insertUnorderedList", icon: List, label: "Lista" },
  { cmd: "insertOrderedList", icon: ListOrdered, label: "Lista numerada" },
];

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function RichText({
  value,
  onChange,
  placeholder,
  prefix = "descricoes",
  people = [],
  headings = false,
  minHeightClass,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  prefix?: string;
  people?: { id: string; nome: string }[];
  /** Exibe botões de Título 1 e Título 2 (usado apenas nas Anotações). */
  headings?: boolean;
  minHeightClass?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  useEffect(() => {
    const limpo = sanitizeRichHtml(value);
    if (ref.current && ref.current.innerHTML !== limpo) ref.current.innerHTML = limpo;
  }, [value]);

  const exec = (cmd: string) => {
    ref.current?.focus();
    document.execCommand(cmd);
    onChange(sanitizeRichHtml(ref.current?.innerHTML ?? ""));
  };

  const insert = (html: string) => {
    ref.current?.focus();
    document.execCommand("insertHTML", false, sanitizeRichHtml(html));
    onChange(sanitizeRichHtml(ref.current?.innerHTML ?? ""));
  };

  const normalizeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
  const URL_RE = /^(https?:\/\/|www\.)[^\s]+$/i;

  /** Limpa HTML colado mantendo apenas formatação básica e links. */
  const sanitizeHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const permitidas = new Set([
      "A",
      "B",
      "STRONG",
      "I",
      "EM",
      "U",
      "S",
      "BR",
      "P",
      "DIV",
      "SPAN",
      "UL",
      "OL",
      "LI",
      "H1",
      "H2",
      "H3",
    ]);
    const limpar = (no: Element) => {
      for (const filho of Array.from(no.children)) limpar(filho);
      if (!permitidas.has(no.tagName)) {
        no.replaceWith(...Array.from(no.childNodes));
        return;
      }
      const href = no.tagName === "A" ? no.getAttribute("data-href") : null;
      for (const attr of Array.from(no.attributes)) no.removeAttribute(attr.name);
      if (href) no.setAttribute("data-href", href);
    };
    // preserva hrefs antes de remover atributos
    const anchors = Array.from(doc.body.querySelectorAll("a"));
    const hrefs = anchors.map((a) => a.getAttribute("href") ?? "");
    anchors.forEach((a, i) => a.setAttribute("data-href", hrefs[i] ?? ""));
    for (const filho of Array.from(doc.body.children)) limpar(filho);
    for (const a of Array.from(doc.body.querySelectorAll("a"))) {
      const href = a.getAttribute("data-href") || a.getAttribute("href");
      a.removeAttribute("data-href");
      if (href) {
        a.setAttribute("href", normalizeUrl(href));
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noreferrer");
      }
    }
    return sanitizeRichHtml(doc.body.innerHTML);
  };

  /** Cola de links: mantém hiperlinks do conteúdo copiado; URL pura vira link clicável. */
  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData("text/html");
    const texto = e.clipboardData.getData("text/plain").trim();
    if (html) {
      e.preventDefault();
      insert(sanitizeHtml(html));
      return;
    }
    if (!texto) return;
    if (URL_RE.test(texto)) {
      e.preventDefault();
      const href = normalizeUrl(texto);
      insert(
        `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(texto)}</a>&nbsp;`,
      );
    }
  };

  const inserirLink = () => {
    const sel = window.getSelection();
    const selecionado = sel?.toString() ?? "";
    const url = window.prompt("Cole ou digite o endereço do link:", "https://");
    if (!url || url === "https://") return;
    const href = normalizeUrl(url.trim());
    insert(
      `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(selecionado || href)}</a>&nbsp;`,
    );
  };

  const handleFiles = async (files: FileList | null, asImage: boolean) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const a = await uploadAnexo(file, prefix);
        insert(
          asImage && a.tipo.startsWith("image/")
            ? `<img src="${escapeHtml(a.url)}" alt="${escapeHtml(a.nome)}" style="max-width:100%;border-radius:8px;margin:6px 0" />`
            : `<p><a href="${escapeHtml(a.url)}" target="_blank" rel="noreferrer">📎 ${escapeHtml(a.nome)}</a></p>`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload.");
    } finally {
      setBusy(false);
    }
  };

  /** Detecta "@texto" imediatamente antes do cursor para abrir a lista de menções. */
  const detectMention = () => {
    if (!people.length) return;
    const sel = window.getSelection();
    const node = sel?.anchorNode;
    if (!sel || !node || node.nodeType !== Node.TEXT_NODE) {
      setMentionQuery(null);
      return;
    }
    const antes = (node.textContent ?? "").slice(0, sel.anchorOffset);
    const m = /@([\p{L}\d._-]*)$/u.exec(antes);
    setMentionQuery(m ? (m[1] ?? "") : null);
  };

  const sugestoes =
    mentionQuery === null
      ? []
      : people.filter((p) => p.nome.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6);

  const pickMention = (p: { id: string; nome: string }) => {
    const sel = window.getSelection();
    const node = sel?.anchorNode;
    if (sel && node && mentionQuery !== null) {
      const offset = sel.anchorOffset;
      const range = document.createRange();
      range.setStart(node, Math.max(0, offset - (mentionQuery.length + 1)));
      range.setEnd(node, offset);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    insert(
      `<span data-mention="${escapeHtml(p.id)}" style="color:var(--color-primary);font-weight:600">@${escapeHtml(p.nome)}</span>&nbsp;`,
    );
    setMentionQuery(null);
  };

  return (
    <div className="relative rounded-lg border border-border bg-surface/50 focus-within:border-primary/60">
      <div className="flex items-center gap-0.5 border-b border-border/70 px-1.5 py-1">
        {CMDS.map(({ cmd, icon: Icon, label }) => (
          <button
            key={cmd}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(cmd)}
            title={label}
            className="rounded p-1.5 text-muted-foreground fluid hover:bg-surface-2 hover:text-foreground"
          >
            <Icon className="size-3.5" />
          </button>
        ))}
        {headings && (
          <>
            <span className="mx-1 h-4 w-px bg-border" />
            {(["H1", "H2"] as const).map((tag) => (
              <button
                key={tag}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  ref.current?.focus();
                  document.execCommand("formatBlock", false, tag);
                  onChange(sanitizeRichHtml(ref.current?.innerHTML ?? ""));
                }}
                title={tag === "H1" ? "Título 1" : "Título 2"}
                className="rounded px-1.5 py-1 text-[11px] font-semibold text-muted-foreground fluid hover:bg-surface-2 hover:text-foreground"
              >
                {tag}
              </button>
            ))}
          </>
        )}
        <span className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={inserirLink}
          title="Inserir link"
          className="rounded p-1.5 text-muted-foreground fluid hover:bg-surface-2 hover:text-foreground"
        >
          <LinkIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => imgInput.current?.click()}
          title="Inserir imagem"
          className="rounded p-1.5 text-muted-foreground fluid hover:bg-surface-2 hover:text-foreground"
        >
          <ImageIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => fileInput.current?.click()}
          title="Anexar arquivo"
          className="rounded p-1.5 text-muted-foreground fluid hover:bg-surface-2 hover:text-foreground"
        >
          <Paperclip className="size-3.5" />
        </button>
        {busy && <span className="ml-1 text-[10.5px] text-muted-foreground">Enviando…</span>}
        <input
          ref={imgInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files, true);
            e.target.value = "";
          }}
        />
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files, false);
            e.target.value = "";
          }}
        />
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={(e) => {
          onChange(sanitizeRichHtml(e.currentTarget.innerHTML));
          detectMention();
        }}
        onPaste={handlePaste}
        onKeyUp={detectMention}
        onMouseDown={(e) => {
          // Dentro do contentEditable o navegador não segue links: abrimos manualmente.
          const a = (e.target as HTMLElement).closest?.("a");
          const href = a?.getAttribute("href");
          if (href) {
            e.preventDefault();
            window.open(normalizeUrl(href), "_blank", "noopener,noreferrer");
          }
        }}
        onBlur={() => window.setTimeout(() => setMentionQuery(null), 150)}
        className={cn(
          "px-3 py-2.5 text-[13px] leading-relaxed outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_a]:cursor-pointer [&_a]:text-primary-ink [&_a]:underline [&_h1]:text-[19px] [&_h1]:font-bold [&_h2]:text-[16px] [&_h2]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc",
          minHeightClass ?? "min-h-[110px]",
        )}
      />
      {!!sugestoes.length && (
        <div className="absolute bottom-2 left-3 z-50 w-[240px] overflow-hidden rounded-lg border border-border bg-popover shadow-[var(--shadow-lift)]">
          <p className="border-b border-border/70 px-2.5 py-1.5 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
            Mencionar
          </p>
          {sugestoes.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pickMention(p)}
              className="block w-full px-2.5 py-2 text-left text-[12.5px] hover:bg-surface"
            >
              {p.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
