import DOMPurify from "dompurify";

/**
 * Sanitiza HTML de rich text (descrições e comentários) permitindo apenas
 * formatação básica, links seguros e imagens/anexos. Remove scripts,
 * handlers on*, iframes e URLs javascript:/data: perigosas.
 */
export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "a",
      "b",
      "strong",
      "i",
      "em",
      "u",
      "s",
      "br",
      "p",
      "div",
      "span",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "img",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "style", "data-mention"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:)/i,
  });
}
