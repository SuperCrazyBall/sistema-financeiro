(function () {
  "use strict";

  const DATE_FORMAT_IDS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
  const MONEY_TOLERANCE = 0.02;

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
  }

  function columnToNumber(ref) {
    let total = 0;
    for (const char of ref) {
      total = total * 26 + char.charCodeAt(0) - 64;
    }
    return total;
  }

  function splitCellRef(ref) {
    const match = /^([A-Z]+)(\d+)$/i.exec(ref);
    if (!match) {
      return null;
    }
    return { col: columnToNumber(match[1].toUpperCase()), row: Number(match[2]) };
  }

  function excelSerialToDate(serial) {
    const days = Math.floor(serial);
    const ms = Math.round((serial - days) * 86400000);
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + days * 86400000 + ms);
  }

  function formatDateKey(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function labelKey(value) {
    if (value instanceof Date) {
      return formatDateKey(value);
    }
    return normalizeText(value).replace(/\s+/g, "");
  }

  function formatLabel(value) {
    if (value instanceof Date) {
      const day = String(value.getUTCDate()).padStart(2, "0");
      const month = String(value.getUTCMonth() + 1).padStart(2, "0");
      return `${day}/${month}/${value.getUTCFullYear()}`;
    }
    return String(value || "").trim();
  }

  function numberValue(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value !== "string") {
      return 0;
    }
    const cleaned = value
      .replace(/[R$\s]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function parseXml(text) {
    const xml = new DOMParser().parseFromString(text, "application/xml");
    const error = xml.querySelector("parsererror");
    if (error) {
      throw new Error("Nao foi possivel ler a estrutura XML da planilha.");
    }
    return xml;
  }

  async function loadXml(zip, path) {
    const file = zip.file(path);
    if (!file) {
      return null;
    }
    return parseXml(await file.async("text"));
  }

  function getRelationshipMap(relsXml) {
    const rels = new Map();
    if (!relsXml) {
      return rels;
    }
    relsXml.querySelectorAll("Relationship").forEach((rel) => {
      rels.set(rel.getAttribute("Id"), rel.getAttribute("Target"));
    });
    return rels;
  }

  function resolveWorkbookTarget(target) {
    const clean = target.replace(/^\/+/, "");
    return clean.startsWith("xl/") ? clean : `xl/${clean}`;
  }

  function readSharedStrings(xml) {
    if (!xml) {
      return [];
    }
    return Array.from(xml.querySelectorAll("si")).map((item) => (
      Array.from(item.querySelectorAll("t")).map((t) => t.textContent || "").join("")
    ));
  }

  function readStyles(xml) {
    const styleFormats = [];
    const customFormats = new Map();
    if (!xml) {
      return styleFormats;
    }

    xml.querySelectorAll("numFmts numFmt").forEach((fmt) => {
      customFormats.set(Number(fmt.getAttribute("numFmtId")), fmt.getAttribute("formatCode") || "");
    });

    xml.querySelectorAll("cellXfs xf").forEach((xf) => {
      const id = Number(xf.getAttribute("numFmtId") || 0);
      const custom = customFormats.get(id) || "";
      const isDate = DATE_FORMAT_IDS.has(id) || /[dmyhs]/i.test(custom.replace(/\[[^\]]+\]/g, ""));
      styleFormats.push({ id, isDate });
    });

    return styleFormats;
  }

  function cellText(cell) {
    const inline = cell.querySelector("is");
    if (inline) {
      return Array.from(inline.querySelectorAll("t")).map((t) => t.textContent || "").join("");
    }
    const value = cell.querySelector("v");
    return value ? value.textContent : "";
  }

  function readCellValue(cell, sharedStrings, styles) {
    const type = cell.getAttribute("t");
    const raw = cellText(cell);
    if (type === "s") {
      return sharedStrings[Number(raw)] || "";
    }
    if (type === "inlineStr" || type === "str") {
      return raw;
    }
    if (type === "b") {
      return raw === "1";
    }
    if (raw === "") {
      return "";
    }

    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) {
      return raw;
    }

    const styleIndex = Number(cell.getAttribute("s") || 0);
    if (styles[styleIndex] && styles[styleIndex].isDate && numeric > 1) {
      return excelSerialToDate(numeric);
    }

    return numeric;
  }

  function parseSheet(xml, sharedStrings, styles) {
    const rows = new Map();
    let maxRow = 0;
    let maxCol = 0;

    xml.querySelectorAll("sheetData row").forEach((rowNode) => {
      const rowIndex = Number(rowNode.getAttribute("r"));
      const values = new Map();
      rowNode.querySelectorAll("c").forEach((cell) => {
        const ref = splitCellRef(cell.getAttribute("r"));
        if (!ref) {
          return;
        }
        values.set(ref.col, readCellValue(cell, sharedStrings, styles));
        maxRow = Math.max(maxRow, ref.row);
        maxCol = Math.max(maxCol, ref.col);
      });
      rows.set(rowIndex, values);
    });

    return {
      rows,
      maxRow,
      maxCol,
      get(row, col) {
        return rows.get(row)?.get(col);
      }
    };
  }

  function findWorkbookSheets(workbookXml, relsXml) {
    const rels = getRelationshipMap(relsXml);
    return Array.from(workbookXml.querySelectorAll("sheets sheet")).map((sheet) => ({
      name: sheet.getAttribute("name"),
      path: resolveWorkbookTarget(rels.get(sheet.getAttribute("r:id")) || "")
    }));
  }

  function findFluxoHeader(sheet) {
    for (let row = 1; row <= sheet.maxRow; row += 1) {
      const a = normalizeText(sheet.get(row, 1));
      const b = normalizeText(sheet.get(row, 2));
      const c = normalizeText(sheet.get(row, 3));
      const d = normalizeText(sheet.get(row, 4));
      if (a === "DATA" && b === "ENTRADAS" && c === "SAIDAS" && d === "SALDO") {
        return row;
      }
    }
    throw new Error("A aba Fluxo nao possui a tabela DATA, ENTRADAS, SAIDAS e SALDO.");
  }

  function findTotalRow(sheet, headerRow) {
    let candidate = null;
    for (let row = headerRow + 1; row <= sheet.maxRow; row += 1) {
      const label = sheet.get(row, 1);
      const entries = numberValue(sheet.get(row, 2));
      const exits = numberValue(sheet.get(row, 3));
      const balance = numberValue(sheet.get(row, 4));
      if ((label === undefined || label === "") && (entries || exits || balance)) {
        candidate = { row, entries, exits: Math.abs(exits), balance };
      }
    }
    return candidate;
  }

  function extractFluxoRecords(sheet) {
    const headerRow = findFluxoHeader(sheet);
    const records = [];
    const totalRow = findTotalRow(sheet, headerRow);

    for (let row = headerRow + 1; row <= sheet.maxRow; row += 1) {
      const label = sheet.get(row, 1);
      if (label === undefined || label === "" || label === null) {
        continue;
      }
      if (normalizeText(label) === "DATA") {
        continue;
      }

      const entries = numberValue(sheet.get(row, 2));
      const exits = Math.abs(numberValue(sheet.get(row, 3)));
      const rawBalance = sheet.get(row, 4);
      const balance = rawBalance === undefined || rawBalance === "" || rawBalance === null
        ? entries - exits
        : numberValue(rawBalance);

      if (!entries && !exits && !balance) {
        continue;
      }

      records.push({
        row,
        label: formatLabel(label),
        key: labelKey(label),
        rawLabel: label,
        entries,
        exits,
        balance
      });
    }

    if (!records.length) {
      throw new Error("Nenhum registro valido foi encontrado na aba Fluxo.");
    }

    return { headerRow, records, totalRow };
  }

  function findLabelRow(sheet, label) {
    const wanted = normalizeText(label);
    for (let row = 1; row <= sheet.maxRow; row += 1) {
      for (let col = 1; col <= Math.min(sheet.maxCol, 8); col += 1) {
        if (normalizeText(sheet.get(row, col)) === wanted) {
          return row;
        }
      }
    }
    return null;
  }

  function validateFluxoDiario(sheet, records) {
    if (!sheet) {
      return { status: "warn", message: "A aba fluxo diario nao foi encontrada para conferencia." };
    }

    const entriesRow = findLabelRow(sheet, "RECEBIMENTOS");
    const exitsRow = findLabelRow(sheet, "PAGAMENTOS");
    if (!entriesRow || !exitsRow) {
      return { status: "warn", message: "Nao foi possivel localizar RECEBIMENTOS e PAGAMENTOS na aba fluxo diario." };
    }

    const source = new Map();
    for (let col = 1; col <= sheet.maxCol; col += 1) {
      const label = sheet.get(1, col);
      const key = labelKey(label);
      if (!key) {
        continue;
      }
      const entries = numberValue(sheet.get(entriesRow, col));
      const exits = Math.abs(numberValue(sheet.get(exitsRow, col)));
      if (entries || exits) {
        source.set(key, { entries, exits });
      }
    }

    let checked = 0;
    let divergences = 0;
    for (const record of records) {
      const match = source.get(record.key);
      if (!match) {
        continue;
      }
      checked += 1;
      if (
        Math.abs(match.entries - record.entries) > MONEY_TOLERANCE ||
        Math.abs(match.exits - record.exits) > MONEY_TOLERANCE
      ) {
        divergences += 1;
      }
    }

    if (!checked) {
      return { status: "warn", message: "A conferencia com fluxo diario nao encontrou datas equivalentes." };
    }

    if (divergences) {
      return { status: "warn", message: `${divergences} registro(s) divergem da aba fluxo diario em ${checked} conferido(s).` };
    }

    return { status: "ok", message: `Conferencia concluida: ${checked} registro(s) batem com fluxo diario.` };
  }

  function summarize(records, totalRow) {
    const totals = records.reduce((acc, record) => {
      acc.entries += record.entries;
      acc.exits += record.exits;
      acc.balance += record.balance;
      if (record.balance > 0) {
        acc.positiveDays += 1;
      }
      if (record.balance < 0) {
        acc.negativeDays += 1;
      }
      if (!acc.best || record.balance > acc.best.balance) {
        acc.best = record;
      }
      if (!acc.worst || record.balance < acc.worst.balance) {
        acc.worst = record;
      }
      return acc;
    }, {
      entries: 0,
      exits: 0,
      balance: 0,
      positiveDays: 0,
      negativeDays: 0,
      best: null,
      worst: null
    });

    let totalCheck = null;
    if (totalRow) {
      totalCheck = {
        row: totalRow.row,
        entriesDiff: totals.entries - totalRow.entries,
        exitsDiff: totals.exits - totalRow.exits,
        balanceDiff: totals.balance - totalRow.balance,
        matches: Math.abs(totals.entries - totalRow.entries) <= MONEY_TOLERANCE &&
          Math.abs(totals.exits - totalRow.exits) <= MONEY_TOLERANCE &&
          Math.abs(totals.balance - totalRow.balance) <= MONEY_TOLERANCE
      };
    }

    return { ...totals, totalCheck };
  }

  async function parseWorkbook(file) {
    if (!window.JSZip) {
      throw new Error("Biblioteca local JSZip nao foi carregada.");
    }

    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const workbookXml = await loadXml(zip, "xl/workbook.xml");
    const relsXml = await loadXml(zip, "xl/_rels/workbook.xml.rels");
    if (!workbookXml || !relsXml) {
      throw new Error("Arquivo Excel invalido ou incompleto.");
    }

    const sharedStrings = readSharedStrings(await loadXml(zip, "xl/sharedStrings.xml"));
    const styles = readStyles(await loadXml(zip, "xl/styles.xml"));
    const sheets = findWorkbookSheets(workbookXml, relsXml);
    const parsedSheets = new Map();

    for (const sheet of sheets) {
      if (!sheet.path) {
        continue;
      }
      const xml = await loadXml(zip, sheet.path);
      if (xml) {
        parsedSheets.set(normalizeText(sheet.name), parseSheet(xml, sharedStrings, styles));
      }
    }

    const fluxo = parsedSheets.get("FLUXO");
    if (!fluxo) {
      throw new Error("A planilha precisa conter a aba Fluxo.");
    }

    const { records, totalRow } = extractFluxoRecords(fluxo);
    const summary = summarize(records, totalRow);
    const validation = validateFluxoDiario(parsedSheets.get("FLUXO DIARIO"), records);

    return {
      records,
      summary,
      validation,
      sheets: sheets.map((sheet) => sheet.name)
    };
  }

  window.FinanceXlsx = {
    parseWorkbook,
    formatLabel,
    labelKey,
    numberValue
  };
}());
