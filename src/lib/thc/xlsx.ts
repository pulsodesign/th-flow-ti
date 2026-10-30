/**
 * Gera uma planilha .xlsx simples (várias abas, primeira linha em negrito)
 * direto no navegador, sem dependências: monta os XMLs do formato Office Open
 * e empacota num ZIP sem compressão.
 */
export type Celula = string | number | null | undefined;
export type Aba = { nome: string; linhas: Celula[][] };

const enc = new TextEncoder();

function esc(s: string) {
  return (
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      // remove caracteres de controle que o XML não aceita
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  );
}

function colunaRef(i: number) {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function folhaXml(linhas: Celula[][]) {
  const larguras = new Map<number, number>();
  const rows = linhas
    .map((linha, r) => {
      const cells = linha
        .map((v, c) => {
          if (v === null || v === undefined || v === "") return "";
          const ref = `${colunaRef(c)}${r + 1}`;
          const estilo = r === 0 ? ' s="1"' : "";
          larguras.set(c, Math.max(larguras.get(c) ?? 8, Math.min(60, String(v).length + 2)));
          if (typeof v === "number" && Number.isFinite(v))
            return `<c r="${ref}"${estilo}><v>${v}</v></c>`;
          return `<c r="${ref}" t="inlineStr"${estilo}><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  const cols = [...larguras.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([c, w]) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`)
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    (cols ? `<cols>${cols}</cols>` : "") +
    `<sheetData>${rows}</sheetData></worksheet>`
  );
}

/** Nome de aba válido no Excel: até 31 caracteres, sem []:*?/\ e sem repetir. */
function nomesDeAba(abas: Aba[]) {
  const usados = new Set<string>();
  return abas.map((a, i) => {
    const base =
      a.nome
        .replace(/[[\]:*?/\\]/g, " ")
        .trim()
        .slice(0, 31) || `Aba ${i + 1}`;
    let nome = base;
    let n = 2;
    while (usados.has(nome.toLowerCase())) {
      const suf = ` ${n++}`;
      nome = base.slice(0, 31 - suf.length) + suf;
    }
    usados.add(nome.toLowerCase());
    return nome;
  });
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(d: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = CRC_TABLE[(c ^ d[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** ZIP "store" (sem compressão), suficiente para o Excel/Numbers/Google Planilhas. */
function zip(arquivos: { nome: string; dados: Uint8Array }[]) {
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of arquivos) {
    const nome = enc.encode(f.nome);
    const crc = crc32(f.dados);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nomes em UTF-8
    local.setUint16(8, 0, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, f.dados.length, true);
    local.setUint32(22, f.dados.length, true);
    local.setUint16(26, nome.length, true);
    partes.push(new Uint8Array(local.buffer), nome, f.dados);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, f.dados.length, true);
    cd.setUint32(24, f.dados.length, true);
    cd.setUint16(28, nome.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nome);

    offset += 30 + nome.length + f.dados.length;
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamCentral, true);
  fim.setUint32(16, offset, true);
  return new Blob([...partes, ...central, new Uint8Array(fim.buffer)] as BlobPart[], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function gerarXlsx(abas: Aba[]): Blob {
  const nomes = nomesDeAba(abas);
  const arquivos: { nome: string; dados: Uint8Array }[] = [
    {
      nome: "[Content_Types].xml",
      dados: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
          abas
            .map(
              (_, i) =>
                `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
            )
            .join("") +
          `</Types>`,
      ),
    },
    {
      nome: "_rels/.rels",
      dados: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
          `</Relationships>`,
      ),
    },
    {
      nome: "xl/workbook.xml",
      dados: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
          nomes
            .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
            .join("") +
          `</sheets></workbook>`,
      ),
    },
    {
      nome: "xl/_rels/workbook.xml.rels",
      dados: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          abas
            .map(
              (_, i) =>
                `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
            )
            .join("") +
          `<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
          `</Relationships>`,
      ),
    },
    {
      nome: "xl/styles.xml",
      dados: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
          `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
          `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
          `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
          `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
          `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
          `</styleSheet>`,
      ),
    },
    ...abas.map((a, i) => ({
      nome: `xl/worksheets/sheet${i + 1}.xml`,
      dados: enc.encode(folhaXml(a.linhas)),
    })),
  ];
  return zip(arquivos);
}

export function baixarXlsx(nomeArquivo: string, abas: Aba[]) {
  const url = URL.createObjectURL(gerarXlsx(abas));
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo.endsWith(".xlsx") ? nomeArquivo : `${nomeArquivo}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
