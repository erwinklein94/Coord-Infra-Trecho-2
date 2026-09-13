const APP_VERSION = "2026.09.13-3";

const STORAGE_KEYS = {
  theme: "trecho2-pdm-theme",
};

const TARGET_SHEETS = {
  limpeza: ["ZBV-ZAR PDM Limpeza DR", "ZBV-ZAR PDM Limpeza", "PDM Limpeza"],
  obras: ["ZBV-ZAR Obras DR", "ZBV-ZAR Obras", "Obras DR", "Obras"],
};

const state = {
  limpeza: { rows: [], subSummary: [], generatedAt: null, sourceSheet: "" },
  obras: { rows: [], generatedAt: null, sourceSheet: "" },
  sourceLabel: "Nenhuma planilha carregada",
  loadErrors: [],
};

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  bindNavigation();
  bindPresentationMode();
  bindChartInteractions();
  bindFilters();
  bindSourceActions();
  resetToEmptyData({ silent: true });
});

function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.theme);
  const useDark = saved === "dark";
  document.body.classList.toggle("dark", useDark);
  updateThemeButton();

  document.getElementById("themeToggle").addEventListener("click", () => {
    const isDark = !document.body.classList.contains("dark");
    document.body.classList.toggle("dark", isDark);
    localStorage.setItem(STORAGE_KEYS.theme, isDark ? "dark" : "light");
    updateThemeButton();
  });
}

function updateThemeButton() {
  const isDark = document.body.classList.contains("dark");
  document.getElementById("themeToggleText").textContent = isDark ? "Tema claro" : "Tema escuro";
}

function bindNavigation() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => activatePanel(button.dataset.panel));
  });
}

function activatePanel(panel) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.panel === panel));
  document.querySelectorAll(".panel").forEach((section) => {
    section.classList.toggle("active", section.id === `panel-${panel}`);
  });
}

// Painel de importação não faz sentido durante a apresentação.
const PRESENTATION_HIDDEN_PANEL = "dados";
let presentationHintTimer = null;

function bindPresentationMode() {
  const button = document.getElementById("presentationToggle");
  if (!button) return;

  button.addEventListener("click", () => {
    if (isPresenting()) exitPresentation();
    else enterPresentation();
  });

  // Esc/F11 saem da tela cheia pelo navegador: sincroniza o layout.
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && isPresenting()) setPresentationState(false);
  });

  document.addEventListener("keydown", (event) => {
    // Com um gráfico em destaque aberto, setas e Esc pertencem ao modal.
    if (!isPresenting() || document.getElementById("chartModal")?.open || event.target.closest("input, select, textarea")) return;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      stepPresentationPanel(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepPresentationPanel(-1);
    } else if (event.key === "Escape") {
      exitPresentation();
    }
  });
}

function isPresenting() {
  return document.body.classList.contains("presentation");
}

function enterPresentation() {
  const activeTab = document.querySelector(".tab.active");
  if (!activeTab || activeTab.dataset.panel === PRESENTATION_HIDDEN_PANEL) activatePanel("overview");

  setPresentationState(true);
  window.scrollTo(0, 0);

  const root = document.documentElement;
  if (root.requestFullscreen && !document.fullscreenElement) {
    root.requestFullscreen().catch((error) => {
      console.warn("Tela cheia indisponível neste navegador:", error);
    });
  }

  showPresentationHint();
}

function exitPresentation() {
  setPresentationState(false);
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}

function setPresentationState(active) {
  document.body.classList.toggle("presentation", active);

  const button = document.getElementById("presentationToggle");
  button.setAttribute("aria-pressed", String(active));
  button.title = active ? "Sair do modo apresentação (Esc)" : "Abrir o dashboard em tela cheia";
  document.getElementById("presentationToggleText").textContent = active ? "Sair da apresentação" : "Modo apresentação";

  if (!active) hidePresentationHint();
}

function stepPresentationPanel(direction) {
  const tabs = Array.from(document.querySelectorAll(".tab")).filter((tab) => tab.dataset.panel !== PRESENTATION_HIDDEN_PANEL);
  const current = tabs.findIndex((tab) => tab.classList.contains("active"));
  const next = tabs[(current + direction + tabs.length) % tabs.length];
  activatePanel(next.dataset.panel);
  window.scrollTo(0, 0);
}

function showPresentationHint() {
  const hint = document.getElementById("presentationHint");
  if (!hint) return;
  hint.classList.add("show");
  clearTimeout(presentationHintTimer);
  presentationHintTimer = setTimeout(hidePresentationHint, 4000);
}

function hidePresentationHint() {
  clearTimeout(presentationHintTimer);
  document.getElementById("presentationHint")?.classList.remove("show");
}

function bindFilters() {
  ["limpezaSubFilter", "limpezaSearch"].forEach((id) => {
    document.getElementById(id).addEventListener("input", renderLimpeza);
  });

  ["obrasSubFilter", "obrasStatusFilter", "obrasRiscoFilter", "obrasSearch"].forEach((id) => {
    document.getElementById(id).addEventListener("input", renderObras);
  });
}

function bindSourceActions() {
  const fileInput = document.getElementById("pdmFileInput");
  const importButton = document.getElementById("importWorkbookBtn");
  const clearButton = document.getElementById("clearDataBtn");

  if (!fileInput || !importButton || !clearButton) return;

  importButton.addEventListener("click", importSelectedWorkbook);
  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files.length) {
      setLoadedFileInfo(`Arquivo selecionado: ${fileInput.files[0].name}. Importando...`);
      importSelectedWorkbook();
    }
  });

  clearButton.addEventListener("click", () => {
    fileInput.value = "";
    resetToEmptyData();
  });
}

function resetToEmptyData(options = {}) {
  state.loadErrors = [];
  state.limpeza = {
    title: "ZBV-ZAR PDM Limpeza",
    sourceSheet: "",
    sourceFile: "",
    generatedAt: null,
    rows: [],
    subSummary: [],
  };
  state.obras = {
    title: "ZBV-ZAR Obras",
    sourceSheet: "",
    sourceFile: "",
    generatedAt: null,
    rows: [],
  };
  state.sourceLabel = "Nenhuma planilha carregada";
  fillFilterOptions();
  renderAll();
  setLoadedFileInfo(`Nenhuma planilha local carregada. O dashboard está zerado até a importação da planilha PDM. Versão ${APP_VERSION}.`);
  if (!options.silent) {
    showStatus("Dados locais removidos. Importe uma planilha PDM para preencher o dashboard.");
    setTimeout(hideStatus, 3500);
  } else {
    hideStatus();
  }
}

async function importSelectedWorkbook() {
  const input = document.getElementById("pdmFileInput");
  const file = input?.files?.[0];

  if (!file) {
    showStatus("Selecione primeiro a planilha PDM em formato .xlsx ou .xlsm.");
    return;
  }

  if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
    showStatus("Formato não suportado. Use uma planilha .xlsx ou .xlsm.");
    return;
  }

  if (typeof DecompressionStream === "undefined") {
    showStatus("Este navegador não possui suporte necessário para ler Excel localmente. Use Chrome ou Edge atualizado.");
    return;
  }

  showStatus("Lendo planilha local no navegador. Nenhum arquivo será enviado para a internet...");
  setLoadedFileInfo(`Lendo ${file.name}... aguarde.`);

  try {
    const workbookData = await parsePdmWorkbook(file);
    const generatedAt = file.lastModified ? new Date(file.lastModified).toISOString() : new Date().toISOString();

    state.limpeza = {
      title: "ZBV-ZAR PDM Limpeza",
      sourceSheet: workbookData.limpezaSheetName,
      sourceFile: file.name,
      generatedAt,
      rows: workbookData.limpezaRows,
      subSummary: calculateSubSummary(workbookData.limpezaRows),
    };

    state.obras = {
      title: "ZBV-ZAR Obras",
      sourceSheet: workbookData.obrasSheetName,
      sourceFile: file.name,
      generatedAt,
      rows: workbookData.obrasRows,
    };

    state.sourceLabel = `Planilha local: ${file.name}`;
    fillFilterOptions();
    renderAll();
    setLoadedFileInfo(`Planilha carregada: ${file.name} • Limpeza: ${workbookData.limpezaRows.length} equipamentos • Obras: ${workbookData.obrasRows.length} • Versão ${APP_VERSION}`);
    showStatus(`Planilha importada com sucesso. Abas lidas: ${workbookData.limpezaSheetName} e ${workbookData.obrasSheetName}.`);
    setTimeout(hideStatus, 4500);
  } catch (error) {
    console.error(error);
    setLoadedFileInfo(`Falha na importação de ${file.name}: ${error.message}`);
    showStatus(`Não foi possível importar a planilha: ${error.message}`);
  }
}

function setLoadedFileInfo(message) {
  const el = document.getElementById("loadedFileInfo");
  if (el) el.textContent = message;
}


async function parsePdmWorkbook(file) {
  const buffer = await file.arrayBuffer();
  const zip = parseZipCentralDirectory(buffer);

  const workbookXml = await readZipText(zip, "xl/workbook.xml");
  const relsXml = await readZipText(zip, "xl/_rels/workbook.xml.rels");
  const workbookDoc = parseXml(workbookXml, "workbook.xml");
  const relsDoc = parseXml(relsXml, "workbook.xml.rels");
  const sharedStrings = await readSharedStrings(zip);
  const sheets = parseWorkbookSheets(workbookDoc, relsDoc);

  const limpezaSheet = findWorkbookSheet(sheets, TARGET_SHEETS.limpeza);
  const obrasSheet = findWorkbookSheet(sheets, TARGET_SHEETS.obras);

  if (!limpezaSheet) {
    throw new Error(`Aba de limpeza não encontrada. Abas disponíveis: ${sheets.map((sheet) => sheet.name).join(", ")}`);
  }

  if (!obrasSheet) {
    throw new Error(`Aba de obras não encontrada. Abas disponíveis: ${sheets.map((sheet) => sheet.name).join(", ")}`);
  }

  const limpezaMatrix = parseWorksheetMatrix(
    parseXml(await readZipText(zip, limpezaSheet.path), limpezaSheet.path),
    sharedStrings
  );

  const obrasMatrix = parseWorksheetMatrix(
    parseXml(await readZipText(zip, obrasSheet.path), obrasSheet.path),
    sharedStrings
  );

  return {
    limpezaSheetName: limpezaSheet.name,
    obrasSheetName: obrasSheet.name,
    limpezaRows: normalizeLimpezaFromMatrix(limpezaMatrix),
    obrasRows: normalizeObrasFromMatrix(obrasMatrix),
  };
}

function parseZipCentralDirectory(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder("utf-8");
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const localSignature = 0x04034b50;
  const maxCommentLength = Math.min(bytes.length, 66000);

  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= bytes.length - maxCommentLength; i--) {
    if (i < 0) break;
    if (view.getUint32(i, true) === eocdSignature) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset < 0) throw new Error("Arquivo Excel inválido ou corrompido.");

  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const entries = new Map();
  let offset = centralDirectoryOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(offset, true) !== centralSignature) break;

    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const fileName = decoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));

    if (view.getUint32(localHeaderOffset, true) !== localSignature) {
      throw new Error(`Entrada ZIP inválida: ${fileName}`);
    }

    const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;

    entries.set(fileName.replace(/^\//, ""), {
      name: fileName,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      data: buffer.slice(dataStart, dataEnd),
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

async function readZipText(zip, path) {
  const entry = zip.get(path.replace(/^\//, ""));
  if (!entry) throw new Error(`Arquivo interno não encontrado na planilha: ${path}`);

  let data;
  if (entry.compressionMethod === 0) {
    data = entry.data;
  } else if (entry.compressionMethod === 8) {
    data = await inflateRaw(entry.data);
  } else {
    throw new Error(`Método de compressão não suportado na planilha: ${entry.compressionMethod}`);
  }

  return new TextDecoder("utf-8").decode(data);
}

async function inflateRaw(data) {
  try {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(stream).arrayBuffer();
  } catch (rawError) {
    try {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate"));
      return await new Response(stream).arrayBuffer();
    } catch {
      throw rawError;
    }
  }
}

function parseXml(text, label) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const error = doc.getElementsByTagName("parsererror")[0];
  if (error) throw new Error(`Erro ao ler ${label}.`);
  return doc;
}

async function readSharedStrings(zip) {
  if (!zip.has("xl/sharedStrings.xml")) return [];

  const doc = parseXml(await readZipText(zip, "xl/sharedStrings.xml"), "sharedStrings.xml");
  return Array.from(doc.getElementsByTagName("si")).map((si) => {
    return Array.from(si.getElementsByTagName("t")).map((node) => node.textContent || "").join("");
  });
}

function parseWorkbookSheets(workbookDoc, relsDoc) {
  const relMap = new Map();
  Array.from(relsDoc.getElementsByTagName("Relationship")).forEach((rel) => {
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target") || "";
    if (id) relMap.set(id, normalizeWorkbookTarget(target));
  });

  return Array.from(workbookDoc.getElementsByTagName("sheet")).map((sheet) => {
    const relId = sheet.getAttribute("r:id") || sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    return {
      name: sheet.getAttribute("name") || "Sem nome",
      relId,
      path: relMap.get(relId),
    };
  }).filter((sheet) => sheet.path);
}

function normalizeWorkbookTarget(target) {
  if (!target) return "";
  if (target.startsWith("/")) return target.replace(/^\//, "");
  const parts = (`xl/${target}`).split("/");
  const normalized = [];
  parts.forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") normalized.pop();
    else normalized.push(part);
  });
  return normalized.join("/");
}

function findWorkbookSheet(sheets, candidates) {
  const normalizedCandidates = candidates.map(normalizeHeader);

  return sheets.find((sheet) => normalizedCandidates.includes(normalizeHeader(sheet.name))) ||
    sheets.find((sheet) => normalizedCandidates.some((candidate) => normalizeHeader(sheet.name).includes(candidate)));
}

function parseWorksheetMatrix(sheetDoc, sharedStrings) {
  const rawRows = [];
  const rowNodes = Array.from(sheetDoc.getElementsByTagName("row"));

  rowNodes.forEach((rowNode) => {
    const excelRow = Number(rowNode.getAttribute("r"));
    const targetRowIndex = Number.isFinite(excelRow) && excelRow > 0 ? excelRow - 1 : rawRows.length;
    const row = rawRows[targetRowIndex] || [];

    Array.from(rowNode.getElementsByTagName("c")).forEach((cell) => {
      const reference = cell.getAttribute("r") || "";
      const columnLetters = reference.replace(/\d+/g, "");
      const columnIndex = columnLetters ? columnNameToIndex(columnLetters) : row.length;
      row[columnIndex] = readCellValue(cell, sharedStrings);
    });

    rawRows[targetRowIndex] = row;
  });

  const compactRows = rawRows.filter(Boolean);
  const maxLength = compactRows.reduce((max, row) => Math.max(max, row.length), 0);
  return compactRows.map((row) => Array.from({ length: maxLength }, (_, index) => row[index] ?? ""));
}

function columnNameToIndex(name) {
  return String(name || "").toUpperCase().split("").reduce((index, char) => {
    return index * 26 + char.charCodeAt(0) - 64;
  }, 0) - 1;
}

function readCellValue(cell, sharedStrings) {
  const type = cell.getAttribute("t");
  const valueNode = cell.getElementsByTagName("v")[0];
  const rawValue = valueNode ? valueNode.textContent || "" : "";

  if (type === "s") {
    return sharedStrings[Number(rawValue)] ?? "";
  }

  if (type === "inlineStr") {
    const inline = cell.getElementsByTagName("is")[0] || cell;
    return Array.from(inline.getElementsByTagName("t")).map((node) => node.textContent || "").join("");
  }

  if (type === "b") return rawValue === "1" ? "TRUE" : "FALSE";
  return rawValue;
}

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function compactHeader(value) {
  return normalizeHeader(value).replace(/\s+/g, "");
}

function findHeaderRow(matrix, requiredTerms) {
  return matrix.findIndex((row) => {
    const map = headerMap(row);
    return requiredTerms.every((term) => {
      const aliases = Array.isArray(term) ? term : [term];
      return getHeaderIndex(map, aliases) !== undefined;
    });
  });
}

function headerMap(row) {
  const map = {};
  row.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    const compact = compactHeader(cell);
    if (key && map[key] === undefined) map[key] = index;
    if (compact && map[compact] === undefined) map[compact] = index;
  });
  return map;
}

function getHeaderIndex(map, aliases) {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    const compact = compactHeader(alias);
    if (map[key] !== undefined) return map[key];
    if (map[compact] !== undefined) return map[compact];
  }

  const keys = Object.keys(map);
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    const compact = compactHeader(alias);
    const found = keys.find((mapKey) => mapKey.includes(key) || mapKey.includes(compact));
    if (found !== undefined) return map[found];
  }

  return undefined;
}

function getByHeader(row, map, name) {
  return getByAnyHeader(row, map, [name]);
}

function getByAnyHeader(row, map, aliases) {
  const index = getHeaderIndex(map, aliases);
  return index === undefined ? "" : row[index];
}

function normalizeLimpezaFromMatrix(matrix) {
  const headerIndex = findHeaderRow(matrix, [["EQUIP_INFRA", "EQUIP INFRA", "EQUIPAMENTO INFRA"], ["EXT", "EXTENSÃO"], ["EXT REAL", "EXT REALIZADA", "EXECUTADO"]]);
  if (headerIndex < 0) throw new Error("Cabeçalho da aba de limpeza não encontrado.");

  const map = headerMap(matrix[headerIndex]);
  const rows = [];

  matrix.slice(headerIndex + 1).forEach((row, index) => {
    const equip = String(getByAnyHeader(row, map, ["EQUIP_INFRA", "EQUIP INFRA", "EQUIPAMENTO INFRA"]) || "").trim();
    if (!equip || !equip.includes("/")) return;

    const ext = parseNumber(getByAnyHeader(row, map, ["EXT", "EXTENSÃO", "EXTENSAO"]));
    const real = parseNumber(getByAnyHeader(row, map, ["EXT REAL", "EXT REALIZADA", "EXT EXECUTADA", "EXECUTADO"]));
    const sub = String(getByAnyHeader(row, map, ["SUB", "SUBDIVISÃO", "SUBDIVISAO"]) || equip.split("/")[0] || "").trim();

    rows.push({
      excelRow: headerIndex + index + 2,
      equipInfra: equip,
      atividade: String(getByAnyHeader(row, map, ["ATV", "ATIVIDADE"]) || "").trim(),
      kmi: parseInteger(getByAnyHeader(row, map, ["KMI", "KM INICIAL"])),
      kmf: parseInteger(getByAnyHeader(row, map, ["KMF", "KM FINAL"])),
      kmiReal: parseInteger(getByAnyHeader(row, map, ["KMI REAL", "KM INICIAL REAL"])),
      kmfReal: parseInteger(getByAnyHeader(row, map, ["KMF REAL", "KM FINAL REAL"])),
      ext,
      extM: `${Math.round(ext)}m`,
      extReal: real,
      extRealM: `${Math.round(real)}m`,
      percentualReal: ext ? real / ext : 0,
      sb: cleanOptional(getByAnyHeader(row, map, ["SB", "SUBTRECHO"])),
      sub,
      percentualSub: parseNumber(getByAnyHeader(row, map, ["%SUB", "PERCENTUAL SUB"])),
    });
  });

  return rows;
}

function normalizeObrasFromMatrix(matrix) {
  const headerIndex = findHeaderRow(matrix, [["SUB", "SUBDIVISÃO", "SUBDIVISAO"], ["DESCRIÇÃO OBRA", "DESCRICAO OBRA", "DESCRIÇÃO DA OBRA", "OBRA"], ["STATUS", "SITUAÇÃO", "SITUACAO"]]);
  if (headerIndex < 0) throw new Error("Cabeçalho da aba de obras não encontrado.");

  const map = headerMap(matrix[headerIndex]);
  const rows = [];
  let currentSub = "";

  matrix.slice(headerIndex + 1).forEach((row, index) => {
    const maybeSub = cleanOptional(getByAnyHeader(row, map, ["SUB", "SUBDIVISÃO", "SUBDIVISAO"]));
    if (maybeSub) currentSub = maybeSub;

    const descricao = cleanOptional(getByAnyHeader(row, map, ["DESCRIÇÃO OBRA", "DESCRICAO OBRA", "DESCRIÇÃO DA OBRA", "OBRA"]));
    if (!descricao || descricao.toLowerCase().includes("plano de drenagem")) return;

    const status = cleanOptional(getByAnyHeader(row, map, ["STATUS", "SITUAÇÃO", "SITUACAO"])) || "NÃO INFORMADO";
    rows.push({
      excelRow: headerIndex + index + 2,
      sub: currentSub,
      sb: cleanOptional(getByAnyHeader(row, map, ["SB", "SUBTRECHO"])),
      km: parseInteger(getByAnyHeader(row, map, ["KM", "KILOMETRO", "QUILÔMETRO", "QUILOMETRO"])),
      descricao,
      tipoObra: cleanOptional(getByAnyHeader(row, map, ["TIPO DE OBRA", "TIPO OBRA"])),
      risco: cleanOptional(getByAnyHeader(row, map, ["RISCO", "RISCO MATRIZ", "MATRIZ DE RISCO"])),
      motivo: cleanOptional(getByAnyHeader(row, map, ["MOTIVO", "JUSTIFICATIVA"])),
      equipamento: cleanOptional(getByAnyHeader(row, map, ["EQUIPAMENTO", "EQUIP_INFRA", "EQUIP INFRA"])),
      extEq: parseNullableNumber(getByAnyHeader(row, map, ["EXT EQ.", "EXT EQ", "EXTENSÃO EQ", "EXTENSAO EQ"])),
      extEqM: cleanOptional(getByAnyHeader(row, map, ["EXT EQ.(M)", "EXT EQ M", "EXTENSÃO EQ M", "EXTENSAO EQ M"])),
      prazoMes: parseNullableNumber(getByAnyHeader(row, map, ["PRAZO (MÊS)", "PRAZO MES", "PRAZO"])),
      dtInicio: cleanOptional(getByAnyHeader(row, map, ["DT INÍCIO", "DT INICIO", "DATA INÍCIO", "DATA INICIO"])),
      status,
      progresso: statusToProgress(status),
      obs: cleanOptional(getByAnyHeader(row, map, ["OBS.", "OBS", "OBSERVAÇÃO", "OBSERVACAO"])),
    });
  });

  return rows;
}

function cleanOptional(value) {
  const text = String(value ?? "").trim();
  return text && text !== "-" ? text : "";
}

function parseNumber(value) {
  if (typeof value === "number") return value;
  const text = String(value ?? "")
    .replace(/\s/g, "")
    .replace(/m/gi, "")
    .replace("%", "");
  if (!text || text === "-") return 0;
  const normalized = text.includes(",") && !text.includes(".")
    ? text.replace(/\./g, "").replace(",", ".")
    : text.replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function parseNullableNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "" || String(value).trim() === "-") return null;
  return parseNumber(value);
}

function parseInteger(value) {
  const number = parseNullableNumber(value);
  return number === null ? null : Math.round(number);
}

function statusToProgress(status) {
  const normalized = normalizeHeader(status);
  if (normalized.includes("CONCLUI")) return 1;
  if (normalized.includes("ANDAMENTO")) return 0.5;
  return 0;
}

function calculateSubSummary(rows) {
  const groups = new Map();

  rows.forEach((row) => {
    const sub = String(row.sub || "").trim() || "Sem SUB";
    if (!groups.has(sub)) groups.set(sub, []);
    groups.get(sub).push(row);
  });

  return Array.from(groups.entries())
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([sub, items]) => {
      const planejadoM = sum(items, "ext");
      const realizadoM = sum(items, "extReal");
      const atividades = {};

      items.forEach((item) => {
        const key = item.atividade || "Sem ATV";
        atividades[key] = (atividades[key] || 0) + 1;
      });

      return {
        sub,
        planejadoM,
        realizadoM,
        saldoM: Math.max(planejadoM - realizadoM, 0),
        percentual: planejadoM ? realizadoM / planejadoM : 0,
        quantidadeFrentes: items.length,
        frentesConcluidas: items.filter((item) => item.ext > 0 && item.extReal >= item.ext).length,
        frentesAndamento: items.filter((item) => item.extReal > 0 && item.extReal < item.ext).length,
        frentesPendentes: items.filter((item) => !item.extReal).length,
        kmInicial: min(items.map((item) => item.kmi).filter(Number.isFinite)),
        kmFinal: max(items.map((item) => item.kmf).filter(Number.isFinite)),
        sbs: unique(items.map((item) => item.sb).filter(Boolean)),
        atividades,
      };
    });
}

function renderAll() {
  renderHeaderMeta();
  renderOverview();
  renderLimpeza();
  renderObras();
}

function renderHeaderMeta() {
  const lastUpdate = document.getElementById("lastUpdateLabel");
  if (lastUpdate) {
    lastUpdate.textContent = latestDateLabel([
      state.limpeza.generatedAt,
      state.obras.generatedAt,
    ]);
  }
}

function renderOverview() {
  const limpezaRows = state.limpeza.rows || [];
  const obraRows = state.obras.rows || [];
  const planejado = sum(limpezaRows, "ext");
  const realizado = sum(limpezaRows, "extReal");
  const pct = planejado ? realizado / planejado : 0;
  const obrasConcluidas = obraRows.filter((row) => statusToProgress(row.status) === 1).length;
  const obrasAndamento = obraRows.filter((row) => statusToProgress(row.status) > 0 && statusToProgress(row.status) < 1).length;

  document.getElementById("overviewKpis").innerHTML = [
    kpiCard("Limpeza planejada", formatMeters(planejado), `${limpezaRows.length} equipamentos cadastrados`),
    kpiCard("Limpeza executada", formatMeters(realizado), `${formatPercent(pct)} do planejado`),
    kpiCard("Saldo de limpeza", formatMeters(Math.max(planejado - realizado, 0)), "metros restantes"),
    kpiCard("Obras", String(obraRows.length), `${obrasAndamento} em andamento • ${obrasConcluidas} concluída(s)`),
  ].join("");

  const subListHtml = (state.limpeza.subSummary || [])
    .map((sub) => compactProgressRow(`SUB ${escapeHtml(sub.sub)}`, formatPercent(sub.percentual), sub.percentual))
    .join("");
  document.getElementById("overviewSubList").innerHTML = subListHtml ||
    `<div class="empty-state small">Importe uma planilha PDM para visualizar as SUBs.</div>`;

  const statusCounts = countBy(obraRows, (row) => row.status || "NÃO INFORMADO");
  const obrasListHtml = Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => compactProgressRow(escapeHtml(status), `${count} obra(s)`, count / Math.max(obraRows.length, 1)))
    .join("");
  document.getElementById("overviewObrasList").innerHTML = obrasListHtml ||
    `<div class="empty-state small">Importe uma planilha PDM para visualizar as obras.</div>`;

  renderOverviewCharts();
}

function kpiCard(label, value, detail) {
  return `
    <article class="kpi-card">
      <span class="kpi-label">${escapeHtml(label)}</span>
      <strong class="kpi-value">${escapeHtml(value)}</strong>
      <span class="kpi-detail">${escapeHtml(detail)}</span>
    </article>
  `;
}

function compactProgressRow(label, value, pct) {
  return `
    <div class="compact-row">
      <strong>${label}</strong>
      <div class="progress" aria-label="${stripHtml(label)} ${stripHtml(value)}">
        <span style="width: ${clampPercent(pct)}%"></span>
      </div>
      <strong>${value}</strong>
    </div>
  `;
}

// ===== Gráficos da visão geral =====

const ACTIVITY_LABELS = { CT: "Corte", AT: "Aterro", SM: "Seção mista" };
const RISK_ORDER = ["Alto", "Moderado", "Baixo"];
const LIMPEZA_STATUS_SERIES = [
  { key: "concluido", label: "Concluídas" },
  { key: "andamento", label: "Em andamento" },
  { key: "pendente", label: "Pendentes" },
];
const OBRA_STATUS_SERIES = [
  { key: "concluido", label: "Concluída" },
  { key: "andamento", label: "Em andamento" },
  { key: "pendente", label: "Não iniciada" },
];
const LIMPEZA_STATUS_LABELS = { concluido: "Concluída", andamento: "Em andamento", pendente: "Pendente" };
const STATUS_BADGE_CLASS = { concluido: "status-concluido", andamento: "status-andamento", pendente: "status-nao-iniciado" };
// Filtros do gráfico ampliado: a marca clicada leva data-f-<chave>, as linhas da lista levam data-<chave>.
const FILTER_KEYS = ["sub", "status", "risk", "atv"];
const EXPAND_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>';

// Ordem dos gráficos na página e na navegação do modal.
const OVERVIEW_CHARTS = [
  { id: "mapa-linear", source: "limpeza", build: linemapChart },
  { id: "saldo-sub", source: "limpeza", build: saldoChart },
  { id: "frentes-situacao", source: "limpeza", build: frentesChart },
  { id: "tipo-secao", source: "limpeza", build: activityChart },
  { id: "obras-risco", source: "obras", build: riskStatusChart },
  { id: "obras-sub", source: "obras", build: obrasPorSubChart },
];

// Segmentos do mapa linear por SUB, usados para achar a frente mais próxima do ponteiro.
let linemapData = new Map();

function renderOverviewCharts() {
  const container = document.getElementById("overviewCharts");
  if (!container) return;

  hideChartTooltip();
  linemapData = new Map();
  container.innerHTML = availableCharts()
    .map((chart) => chartCard(chart.id, chart.build(chartRows(chart), false)))
    .join("");
}

function availableCharts() {
  return OVERVIEW_CHARTS.filter((chart) => chartRows(chart).length);
}

function chartRows(chart) {
  const source = chart.source === "limpeza" ? state.limpeza : state.obras;
  return source.rows || [];
}

// Cada gráfico devolve uma especificação; `detailed` acrescenta o que só aparece no modal.
function linemapChart(rows, detailed) {
  const groups = groupRows(rows, subKey);
  const equipmentRows = [];
  const summaryRows = [];

  const lines = Array.from(groups.keys()).sort(sortNumericText).map((sub) => {
    const items = groups.get(sub);
    const segments = items
      .filter((row) => Number.isFinite(row.kmi) && Number.isFinite(row.kmf))
      .map((row) => ({
        row,
        start: Math.min(row.kmi, row.kmf),
        end: Math.max(row.kmi, row.kmf),
        done: executedRange(row),
      }));
    if (!segments.length) return "";

    const start = Math.min(...segments.map((segment) => (segment.done ? Math.min(segment.start, segment.done[0]) : segment.start)));
    const end = Math.max(...segments.map((segment) => (segment.done ? Math.max(segment.end, segment.done[1]) : segment.end)));
    const span = Math.max(end - start, 1);
    const position = (km) => ((km - start) / span) * 100;
    linemapData.set(sub, { start, span, segments });

    const marks = segments.map((segment, index) => {
      const { row } = segment;
      equipmentRows.push([
        `SUB ${sub}`,
        row.equipInfra || "Sem código",
        activityLabel(row.atividade),
        formatKmRange(row.kmi, row.kmf),
        formatMeters(row.ext),
        formatMeters(row.extReal),
        formatRatio(ratio(row.extReal, row.ext)),
      ]);

      const plannedMark = `<span class="lm-seg" data-i="${index}" style="left:${position(segment.start)}%;width:${position(segment.end) - position(segment.start)}%"></span>`;
      const doneMark = segment.done
        ? `<span class="lm-done" data-i="${index}" style="left:${position(segment.done[0])}%;width:${position(segment.done[1]) - position(segment.done[0])}%"></span>`
        : "";
      return plannedMark + doneMark;
    }).join("");

    const planned = sum(items, "ext");
    const executed = sum(items, "extReal");
    const executedLabel = formatRatio(ratio(executed, planned));
    const concluded = items.filter((row) => limpezaStatus(row) === "concluido").length;
    summaryRows.push([
      `SUB ${sub}`,
      `${formatKm(start)} a ${formatKm(end)}`,
      String(items.length),
      String(concluded),
      formatMeters(planned),
      formatMeters(executed),
      formatMeters(Math.max(planned - executed, 0)),
      executedLabel,
    ]);

    const ticks = detailed
      ? `<div class="lm-ticks" aria-hidden="true">${[0, 0.25, 0.5, 0.75, 1]
        .map((step) => `<span style="left:${step * 100}%">${formatKm(Math.round(start + step * span))}</span>`)
        .join("")}</div>`
      : "";

    return `
      <div class="lm-row" ${detailed ? `tabindex="0" ${filterAttributes({ sub }, `SUB ${sub}`)}` : ""}>
        <div class="lm-label">
          <strong>SUB ${escapeHtml(sub)}</strong>
          <span>km ${formatKm(start)} – ${formatKm(end)}</span>
          ${detailed ? `<span>${items.length} frentes • ${concluded} concluídas</span>` : ""}
        </div>
        <div class="lm-track-wrap">
          <div class="lm-track" data-sub="${escapeAttribute(sub)}" role="img" aria-label="${escapeAttribute(`SUB ${sub}: ${executedLabel} executado`)}">${marks}</div>
          ${ticks}
        </div>
        <div class="lm-value">
          <strong>${executedLabel}</strong>
          <span>${formatLength(executed)} de ${formatLength(planned)}</span>
        </div>
      </div>
    `;
  }).join("");

  const spec = {
    span: 12,
    eyebrow: "Limpeza Geral",
    title: "Mapa linear das frentes por SUB",
    note: "Posição de cada frente ao longo do km. Cada linha usa a escala de km da própria SUB.",
    legend: chartLegend([{ tone: "concluido", label: "Executado" }, { tone: "pendente", label: "A executar" }]),
    body: `<div class="linemap">${lines}</div>`,
    table: simpleTable(["SUB", "Equipamento", "ATV", "KM", "Planejado", "Executado", "%"], equipmentRows, 4),
  };
  if (!detailed) return spec;

  return {
    ...spec,
    table: simpleTable(["SUB", "Faixa de km", "Frentes", "Concluídas", "Planejado", "Executado", "Saldo", "%"], summaryRows, 2),
    stats: limpezaStats(rows),
    hint: "Passe o mouse sobre uma frente para ver o equipamento. Clique em uma SUB para filtrar a lista de frentes.",
    list: limpezaList(rows),
  };
}

function executedRange(row) {
  if (!(row.extReal > 0)) return null;
  if (Number.isFinite(row.kmiReal) && Number.isFinite(row.kmfReal)) {
    return [Math.min(row.kmiReal, row.kmfReal), Math.max(row.kmiReal, row.kmfReal)];
  }
  const start = Math.min(row.kmi, row.kmf);
  return [start, Math.min(start + row.extReal, Math.max(row.kmi, row.kmf))];
}

function saldoChart(rows, detailed) {
  const items = calculateSubSummary(rows).sort((a, b) => b.saldoM - a.saldoM);
  const max = Math.max(0, ...items.map((item) => item.saldoM));
  const totalSaldo = items.reduce((total, item) => total + item.saldoM, 0);

  const body = `<div class="bar-list">${items.map((item) => {
    const done = formatRatio(ratio(item.realizadoM, item.planejadoM));
    const value = detailed
      ? `<strong>${formatLength(item.saldoM)}</strong> de ${formatLength(item.planejadoM)} • ${done} executado`
      : `<strong>${formatLength(item.saldoM)}</strong>`;

    return `
      <div class="bar-row" tabindex="0" ${tipAttributes({
        value: `${formatMeters(item.saldoM)} a executar`,
        label: `SUB ${item.sub}`,
        detail: `Planejado ${formatMeters(item.planejadoM)} • executado ${formatMeters(item.realizadoM)} (${done})`,
      })} ${detailed ? filterAttributes({ sub: item.sub }, `SUB ${item.sub}`) : ""}>
        <span class="bar-label">SUB ${escapeHtml(item.sub)}</span>
        <span class="bar-line">
          <span class="bar tone-primary${item.saldoM > 0 ? "" : " is-empty"}" style="--t:${ratio(item.saldoM, max)}"></span>
          <span class="bar-value">${value}</span>
        </span>
      </div>
    `;
  }).join("")}</div>`;

  const spec = {
    span: 4,
    eyebrow: "Limpeza Geral",
    title: "Saldo a executar por SUB",
    note: "Metros restantes, do maior para o menor saldo",
    body,
    table: simpleTable(
      ["SUB", "Planejado", "Executado", "Saldo"],
      items.map((item) => [`SUB ${item.sub}`, formatMeters(item.planejadoM), formatMeters(item.realizadoM), formatMeters(item.saldoM)])
    ),
  };
  if (!detailed) return spec;

  const largest = items[0];
  const finished = items.filter((item) => item.planejadoM > 0 && item.saldoM <= 0).length;
  return {
    ...spec,
    table: simpleTable(
      ["SUB", "Planejado", "Executado", "Saldo", "% executado", "% do saldo total"],
      items.map((item) => [
        `SUB ${item.sub}`,
        formatMeters(item.planejadoM),
        formatMeters(item.realizadoM),
        formatMeters(item.saldoM),
        formatRatio(ratio(item.realizadoM, item.planejadoM)),
        formatRatio(ratio(item.saldoM, totalSaldo)),
      ])
    ),
    stats: [
      { label: "Saldo total", value: formatLength(totalSaldo), detail: `em ${items.length} SUBs` },
      {
        label: "Maior saldo",
        value: largest ? `SUB ${largest.sub}` : "—",
        detail: largest ? `${formatLength(largest.saldoM)} • ${formatRatio(ratio(largest.saldoM, totalSaldo))} do saldo total` : "",
      },
      { label: "SUBs concluídas", value: `${finished} de ${items.length}`, detail: "sem saldo a executar" },
      { label: "Executado", value: formatRatio(ratio(sum(rows, "extReal"), sum(rows, "ext"))), detail: "do planejado total" },
    ],
    hint: "Clique em uma SUB para filtrar a lista de frentes.",
    list: limpezaList(rows),
  };
}

function frentesChart(rows, detailed) {
  const items = statusBreakdown(rows, subKey, limpezaStatus);
  const max = Math.max(0, ...items.map((item) => item.total));

  const body = stackedBars(items, LIMPEZA_STATUS_SERIES, max, {
    detailed,
    valueHtml: (item) => (detailed
      ? `${statusCountKeys(item, LIMPEZA_STATUS_SERIES)}<span class="count-total">${item.total} frentes</span>`
      : `<strong>${item.counts.concluido}/${item.total}</strong> concluídas`),
    tip: (item, series, count) => ({
      value: `${count} de ${item.total} frentes`,
      label: `SUB ${item.key} • ${series.label}`,
      detail: `${formatRatio(ratio(count, item.total))} das frentes da SUB`,
    }),
  });

  const spec = {
    span: 4,
    eyebrow: "Limpeza Geral",
    title: "Frentes por situação",
    note: "Quantidade de equipamentos em cada situação, por SUB",
    legend: chartLegend(LIMPEZA_STATUS_SERIES.map((series) => ({ tone: series.key, label: series.label }))),
    body,
    table: simpleTable(
      ["SUB", ...LIMPEZA_STATUS_SERIES.map((series) => series.label), "Total"],
      items.map((item) => [`SUB ${item.key}`, ...LIMPEZA_STATUS_SERIES.map((series) => String(item.counts[series.key])), String(item.total)])
    ),
  };
  if (!detailed) return spec;

  return {
    ...spec,
    table: simpleTable(
      ["SUB", "Concluídas", "%", "Em andamento", "%", "Pendentes", "%", "Total"],
      items.map((item) => [
        `SUB ${item.key}`,
        ...LIMPEZA_STATUS_SERIES.flatMap((series) => [String(item.counts[series.key]), formatRatio(ratio(item.counts[series.key], item.total))]),
        String(item.total),
      ])
    ),
    stats: limpezaStats(rows),
    hint: "Clique em uma SUB ou em uma faixa de cor para filtrar a lista de frentes.",
    list: limpezaList(rows),
  };
}

function activityChart(rows, detailed) {
  const groups = groupRows(rows, (row) => activityLabel(row.atividade));
  const items = Array.from(groups.entries())
    .map(([label, list]) => ({
      label,
      count: list.length,
      concluded: list.filter((row) => limpezaStatus(row) === "concluido").length,
      planned: sum(list, "ext"),
      executed: sum(list, "extReal"),
    }))
    .sort((a, b) => b.planned - a.planned);
  const max = Math.max(0, ...items.map((item) => Math.max(item.planned, item.executed)));

  const body = `<div class="bar-list bar-list-wide">${items.map((item) => {
    const done = ratio(item.executed, item.planned);
    const saldo = Math.max(item.planned - item.executed, 0);
    const value = detailed
      ? `<strong>${formatRatio(done)}</strong> ${formatLength(item.executed)} de ${formatLength(item.planned)} • saldo ${formatLength(saldo)} • ${item.count} frentes`
      : `<strong>${formatRatio(done)}</strong> ${formatLength(item.executed)} de ${formatLength(item.planned)}`;

    return `
      <div class="bar-row" tabindex="0" ${tipAttributes({
        value: `${formatMeters(item.executed)} de ${formatMeters(item.planned)}`,
        label: item.label,
        detail: `${formatRatio(done)} executado • ${item.count} frente(s)`,
      })} ${detailed ? filterAttributes({ atv: item.label }, item.label) : ""}>
        <span class="bar-label">${escapeHtml(item.label)}</span>
        <span class="bar-line">
          <span class="bullet tone-track" style="--t:${ratio(item.planned, max)}"><span class="bullet-fill tone-primary" style="--f:${Math.min(done, 1)}"></span></span>
          <span class="bar-value">${value}</span>
        </span>
      </div>
    `;
  }).join("")}</div>`;

  const spec = {
    span: 4,
    className: "wide-on-medium",
    eyebrow: "Limpeza Geral",
    title: "Limpeza por tipo de seção",
    note: "Executado sobre o planejado em corte, aterro e seção mista",
    legend: chartLegend([{ tone: "track", label: "Planejado" }, { tone: "primary", label: "Executado" }]),
    body,
    table: simpleTable(
      ["Tipo de seção", "Frentes", "Planejado", "Executado", "%"],
      items.map((item) => [item.label, String(item.count), formatMeters(item.planned), formatMeters(item.executed), formatRatio(ratio(item.executed, item.planned))])
    ),
  };
  if (!detailed) return spec;

  const largest = items[0];
  const best = items.slice().sort((a, b) => ratio(b.executed, b.planned) - ratio(a.executed, a.planned))[0];
  const planned = sum(rows, "ext");
  const executed = sum(rows, "extReal");
  return {
    ...spec,
    table: simpleTable(
      ["Tipo de seção", "Frentes", "Concluídas", "Planejado", "Executado", "Saldo", "%"],
      items.map((item) => [
        item.label,
        String(item.count),
        String(item.concluded),
        formatMeters(item.planned),
        formatMeters(item.executed),
        formatMeters(Math.max(item.planned - item.executed, 0)),
        formatRatio(ratio(item.executed, item.planned)),
      ])
    ),
    stats: [
      { label: "Planejado", value: formatLength(planned), detail: `${rows.length} frentes` },
      { label: "Executado", value: formatLength(executed), detail: `${formatRatio(ratio(executed, planned))} do planejado` },
      { label: "Maior extensão", value: largest ? largest.label : "—", detail: largest ? `${formatLength(largest.planned)} planejados` : "" },
      { label: "Maior % executado", value: best ? best.label : "—", detail: best ? formatRatio(ratio(best.executed, best.planned)) : "" },
    ],
    hint: "Clique em um tipo de seção para filtrar a lista de frentes.",
    list: limpezaList(rows),
  };
}

function riskStatusChart(rows, detailed) {
  const columns = OBRA_STATUS_SERIES.slice().reverse();
  const groups = groupRows(rows, riskLabel);
  const risks = Array.from(groups.keys()).sort(compareRisk);
  const matches = (risk, key) => groups.get(risk).filter((row) => obraStatusKey(row) === key);
  const max = Math.max(1, ...risks.flatMap((risk) => columns.map((column) => matches(risk, column.key).length)));
  const statusCounts = countBy(rows, obraStatusKey);

  const head = `<tr><th scope="col">Risco</th>${columns.map((column) => `<th scope="col">${escapeHtml(column.label)}</th>`).join("")}<th scope="col">Total</th></tr>`;
  const bodyRows = risks.map((risk) => {
    const cells = columns.map((column) => {
      const cellRows = matches(risk, column.key);
      const count = cellRows.length;
      const level = count ? Math.ceil((count / max) * 4) : 0;
      const attributes = count
        ? `tabindex="0" ${tipAttributes({ value: `${count} obra(s)`, label: `Risco ${risk} • ${column.label}`, detail: kmList(cellRows) })} ${
          detailed ? filterAttributes({ risk, status: column.key }, `Risco ${risk} • ${column.label}`) : ""
        }`
        : "";
      return `<td class="heat-cell heat-${level}" ${attributes}>${count}</td>`;
    }).join("");
    const totalAttributes = detailed ? `tabindex="0" ${filterAttributes({ risk }, `Risco ${risk}`)}` : "";
    return `<tr><th scope="row">${escapeHtml(risk)}</th>${cells}<td class="heat-total" ${totalAttributes}>${groups.get(risk).length}</td></tr>`;
  }).join("");
  const foot = `<tr><th scope="row">Total</th>${columns.map((column) => {
    const totalAttributes = detailed ? `tabindex="0" ${filterAttributes({ status: column.key }, column.label)}` : "";
    return `<td class="heat-total" ${totalAttributes}>${statusCounts[column.key] || 0}</td>`;
  }).join("")}<td class="heat-total">${rows.length}</td></tr>`;

  const spec = {
    span: 6,
    eyebrow: "Obras",
    title: "Risco × situação das obras",
    note: "Quantidade de obras em cada combinação; tons mais escuros indicam mais obras",
    body: `<div class="table-wrap heat-wrap"><table class="heat-table"><thead>${head}</thead><tbody>${bodyRows}</tbody><tfoot>${foot}</tfoot></table></div>`,
  };
  if (!detailed) return spec;

  const high = groups.get("Alto") || [];
  return {
    ...spec,
    stats: obrasStats(rows, statusCounts, {
      label: "Risco alto",
      value: String(high.length),
      detail: `${high.filter((row) => obraStatusKey(row) === "pendente").length} ainda não iniciada(s)`,
    }),
    hint: "Clique em uma célula ou em um total para filtrar a lista de obras.",
    list: obrasList(rows),
  };
}

function obrasPorSubChart(rows, detailed) {
  const items = statusBreakdown(rows, subKey, obraStatusKey);
  const max = Math.max(0, ...items.map((item) => item.total));

  const body = stackedBars(items, OBRA_STATUS_SERIES, max, {
    detailed,
    valueHtml: (item) => (detailed
      ? `${statusCountKeys(item, OBRA_STATUS_SERIES)}<span class="count-total">${item.total} obra(s)</span>`
      : `<strong>${item.total}</strong> obra(s)`),
    tip: (item, series, count) => ({
      value: `${count} de ${item.total} obra(s)`,
      label: `SUB ${item.key} • ${series.label}`,
      detail: kmList(rows.filter((row) => subKey(row) === item.key && obraStatusKey(row) === series.key)),
    }),
  });

  const spec = {
    span: 6,
    eyebrow: "Obras",
    title: "Obras por SUB e situação",
    note: "Quantidade de obras cadastradas em cada SUB",
    legend: chartLegend(OBRA_STATUS_SERIES.map((series) => ({ tone: series.key, label: series.label }))),
    body,
    table: simpleTable(
      ["SUB", ...OBRA_STATUS_SERIES.map((series) => series.label), "Total"],
      items.map((item) => [`SUB ${item.key}`, ...OBRA_STATUS_SERIES.map((series) => String(item.counts[series.key])), String(item.total)])
    ),
  };
  if (!detailed) return spec;

  const top = items.slice().sort((a, b) => b.total - a.total)[0];
  return {
    ...spec,
    table: simpleTable(
      ["SUB", ...OBRA_STATUS_SERIES.map((series) => series.label), "Total", "Extensão"],
      items.map((item) => [
        `SUB ${item.key}`,
        ...OBRA_STATUS_SERIES.map((series) => String(item.counts[series.key])),
        String(item.total),
        formatMeters(sum(rows.filter((row) => subKey(row) === item.key), "extEq")),
      ])
    ),
    stats: obrasStats(rows, countBy(rows, obraStatusKey), {
      label: "SUB com mais obras",
      value: top ? `SUB ${top.key}` : "—",
      detail: top ? `${top.total} obra(s)` : "",
    }),
    hint: "Clique em uma SUB ou em uma faixa de cor para filtrar a lista de obras.",
    list: obrasList(rows),
  };
}

function limpezaStats(rows) {
  const planned = sum(rows, "ext");
  const executed = sum(rows, "extReal");
  const counts = countBy(rows, limpezaStatus);
  return [
    { label: "Planejado", value: formatLength(planned), detail: `${rows.length} frentes` },
    { label: "Executado", value: formatLength(executed), detail: `${formatRatio(ratio(executed, planned))} do planejado` },
    { label: "Saldo", value: formatLength(Math.max(planned - executed, 0)), detail: "a executar" },
    {
      label: "Frentes concluídas",
      value: `${counts.concluido || 0} de ${rows.length}`,
      detail: `${counts.andamento || 0} em andamento • ${counts.pendente || 0} pendentes`,
    },
  ];
}

function obrasStats(rows, statusCounts, highlight) {
  const count = (key) => statusCounts[key] || 0;
  return [
    { label: "Obras", value: String(rows.length), detail: `extensão de ${formatLength(sum(rows, "extEq"))}` },
    highlight,
    { label: "Não iniciadas", value: String(count("pendente")), detail: `${formatRatio(ratio(count("pendente"), rows.length))} das obras` },
    { label: "Em andamento", value: String(count("andamento")), detail: `${count("concluido")} concluída(s)` },
  ];
}

function limpezaList(rows) {
  const sorted = rows.slice().sort((a, b) => sortNumericText(subKey(a), subKey(b)) || (a.kmi ?? 0) - (b.kmi ?? 0));
  const body = sorted.map((row) => {
    const status = limpezaStatus(row);
    return `
      <tr data-sub="${escapeAttribute(subKey(row))}" data-status="${status}" data-atv="${escapeAttribute(activityLabel(row.atividade))}">
        <td>SUB ${escapeHtml(subKey(row))}</td>
        <td>${escapeHtml(row.equipInfra || "Sem código")}</td>
        <td>${escapeHtml(activityLabel(row.atividade))}</td>
        <td>${formatKmRange(row.kmi, row.kmf)}</td>
        <td><span class="status-badge ${STATUS_BADGE_CLASS[status]}">${LIMPEZA_STATUS_LABELS[status]}</span></td>
        <td class="num">${formatMeters(row.ext)}</td>
        <td class="num">${formatMeters(row.extReal)}</td>
        <td class="num">${formatMeters(Math.max(row.ext - row.extReal, 0))}</td>
        <td class="num">${formatRatio(ratio(row.extReal, row.ext))}</td>
      </tr>
    `;
  }).join("");

  return {
    title: "Frentes de limpeza",
    table: `
      <table>
        <thead><tr>
          <th scope="col">SUB</th><th scope="col">Equipamento</th><th scope="col">Tipo</th><th scope="col">KM</th><th scope="col">Situação</th>
          <th scope="col" class="num">Planejado</th><th scope="col" class="num">Executado</th><th scope="col" class="num">Saldo</th><th scope="col" class="num">%</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
    `,
  };
}

function obrasList(rows) {
  const sorted = rows.slice().sort((a, b) => sortNumericText(subKey(a), subKey(b)) || (a.km ?? 0) - (b.km ?? 0));
  const months = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  const body = sorted.map((row) => `
    <tr data-sub="${escapeAttribute(subKey(row))}" data-status="${obraStatusKey(row)}" data-risk="${escapeAttribute(riskLabel(row))}">
      <td>SUB ${escapeHtml(subKey(row))}</td>
      <td>${formatKm(row.km)}</td>
      <td>${escapeHtml(row.descricao)}</td>
      <td>${escapeHtml(row.tipoObra || "—")}</td>
      <td><span class="risk-badge ${riskClass(row.risco)}">${escapeHtml(riskLabel(row))}</span></td>
      <td><span class="status-badge ${statusClass(row.status)}">${escapeHtml(row.status || "NÃO INFORMADO")}</span></td>
      <td>${escapeHtml(row.motivo || "—")}</td>
      <td class="num">${escapeHtml(row.extEqM || (row.extEq ? formatMeters(row.extEq) : "—"))}</td>
      <td class="num">${row.prazoMes === null || row.prazoMes === undefined ? "—" : `${months.format(row.prazoMes)} mês(es)`}</td>
    </tr>
  `).join("");

  return {
    title: "Obras",
    table: `
      <table>
        <thead><tr>
          <th scope="col">SUB</th><th scope="col">KM</th><th scope="col">Obra</th><th scope="col">Tipo</th><th scope="col">Risco</th>
          <th scope="col">Situação</th><th scope="col">Motivo</th><th scope="col" class="num">Extensão</th><th scope="col" class="num">Prazo</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
    `,
  };
}

function statusBreakdown(rows, getGroup, getStatus) {
  const groups = groupRows(rows, getGroup);
  return Array.from(groups.keys()).sort(sortNumericText).map((key) => {
    const list = groups.get(key);
    const counts = { concluido: 0, andamento: 0, pendente: 0 };
    list.forEach((row) => {
      counts[getStatus(row)] += 1;
    });
    return { key, total: list.length, counts };
  });
}

function stackedBars(items, series, max, { detailed, valueHtml, tip }) {
  return `<div class="bar-list">${items.map((item) => `
    <div class="bar-row" ${detailed ? `tabindex="0" ${filterAttributes({ sub: item.key }, `SUB ${item.key}`)}` : ""}>
      <span class="bar-label">SUB ${escapeHtml(item.key)}</span>
      <span class="bar-line">
        <span class="stack" style="--t:${ratio(item.total, max)}">${series
          .filter((entry) => item.counts[entry.key] > 0)
          .map((entry) => `<span class="seg tone-${entry.key}" tabindex="0" style="--n:${item.counts[entry.key]}" ${tipAttributes(tip(item, entry, item.counts[entry.key]))} ${
            detailed ? filterAttributes({ sub: item.key, status: entry.key }, `SUB ${item.key} • ${entry.label}`) : ""
          }></span>`)
          .join("")}</span>
        <span class="bar-value">${valueHtml(item)}</span>
      </span>
    </div>
  `).join("")}</div>`;
}

function statusCountKeys(item, series) {
  return series.map((entry) => `
    <span class="count-key" title="${escapeAttribute(entry.label)}"><i class="swatch tone-${entry.key}" aria-hidden="true"></i>${item.counts[entry.key]}</span>
  `).join("");
}

function chartCard(id, { span, className = "", eyebrow, title, note = "", legend = "", body, table = "" }) {
  return `
    <article class="surface-card chart-card span-${span} ${className}" data-chart-id="${id}">
      <div class="card-head">
        <div>
          <span class="eyebrow">${escapeHtml(eyebrow)}</span>
          <h3>${escapeHtml(title)}</h3>
          ${note ? `<p class="chart-note">${escapeHtml(note)}</p>` : ""}
        </div>
        <div class="chart-card-actions">
          ${table ? `<button class="chart-view-toggle" type="button" aria-pressed="false">Ver tabela</button>` : ""}
          <button class="chart-expand" type="button" title="Abrir em destaque" aria-label="${escapeAttribute(`Abrir em destaque: ${title}`)}">${EXPAND_ICON}</button>
        </div>
      </div>
      <div class="chart-view">${legend}${body}</div>
      ${table ? `<div class="table-wrap chart-table">${table}</div>` : ""}
    </article>
  `;
}

function chartLegend(items) {
  return `<div class="chart-legend">${items.map((item) => `
    <span class="legend-item"><i class="swatch tone-${item.tone}" aria-hidden="true"></i>${escapeHtml(item.label)}</span>
  `).join("")}</div>`;
}

function simpleTable(columns, rows, numericFrom = 1) {
  const cellClass = (index) => (index >= numericFrom ? ' class="num"' : "");
  return `
    <table>
      <thead><tr>${columns.map((column, index) => `<th scope="col"${cellClass(index)}>${escapeHtml(column)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((value, index) => `<td${cellClass(index)}>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `;
}

function tipAttributes({ value, label, detail = "" }) {
  return `data-tip-value="${escapeAttribute(value)}" data-tip-label="${escapeAttribute(label)}" data-tip-detail="${escapeAttribute(detail)}"`;
}

function filterAttributes(filter, label) {
  const attributes = Object.entries(filter).map(([key, value]) => `data-f-${key}="${escapeAttribute(value)}"`);
  return `${attributes.join(" ")} data-filter-label="${escapeAttribute(label)}"`;
}

function subKey(row) {
  return String(row.sub || "").trim() || "Sem SUB";
}

function limpezaStatus(row) {
  if (row.ext > 0 && row.extReal >= row.ext) return "concluido";
  return row.extReal > 0 ? "andamento" : "pendente";
}

function obraStatusKey(row) {
  const progress = statusToProgress(row.status);
  if (progress === 1) return "concluido";
  return progress > 0 ? "andamento" : "pendente";
}

function activityLabel(code) {
  const key = String(code || "").trim().toUpperCase();
  return ACTIVITY_LABELS[key] || key || "Sem ATV";
}

function riskLabel(row) {
  const normalized = normalizeHeader(row.risco);
  if (normalized.includes("ALTO")) return "Alto";
  if (normalized.includes("MODERADO")) return "Moderado";
  if (normalized.includes("BAIXO")) return "Baixo";
  const text = cleanOptional(row.risco);
  return text && !normalized.includes("NAO INFORMADO") ? text : "Não informado";
}

function compareRisk(a, b) {
  const rank = (risk) => {
    const index = RISK_ORDER.indexOf(risk);
    if (index >= 0) return index;
    return risk === "Não informado" ? RISK_ORDER.length + 1 : RISK_ORDER.length;
  };
  return rank(a) - rank(b) || a.localeCompare(b, "pt-BR");
}

function kmList(rows) {
  const kms = rows.map((row) => `KM ${formatKm(row.km)}`);
  return kms.length > 4 ? `${kms.slice(0, 4).join(" • ")} +${kms.length - 4}` : kms.join(" • ");
}

function groupRows(rows, getKey) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = getKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return groups;
}

function ratio(part, whole) {
  return whole ? part / whole : 0;
}

// formatPercent trata valores > 1 como já percentuais; aqui a razão é sempre 0–1+ (ex.: 1,13 = 113%).
function formatRatio(value) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format((Number(value) || 0) * 100)}%`;
}

function formatLength(meters) {
  const number = Number(meters) || 0;
  if (Math.abs(number) < 1000) return formatMeters(number);
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(number / 1000)} km`;
}

// ----- Modal: gráfico em destaque -----

function openChartModal(id) {
  const modal = document.getElementById("chartModal");
  const charts = availableCharts();
  const index = charts.findIndex((chart) => chart.id === id);
  if (!modal || index < 0) return;

  const chart = charts[index];
  const spec = chart.build(chartRows(chart), true);
  const body = document.getElementById("chartModalBody");

  hideChartTooltip();
  modal.dataset.chartId = chart.id;
  document.getElementById("chartModalEyebrow").textContent = spec.eyebrow;
  document.getElementById("chartModalTitle").textContent = spec.title;
  document.getElementById("chartModalNote").textContent = spec.note || "";
  document.getElementById("chartModalCount").textContent = `${index + 1} de ${charts.length}`;
  modal.querySelectorAll("[data-modal-step]").forEach((button) => {
    button.hidden = charts.length < 2;
  });

  body.innerHTML = chartModalContent(spec);
  body.scrollTop = 0;
  applyModalFilter(body, null);

  if (!modal.open) {
    document.body.classList.add("modal-open");
    modal.showModal();
    modal.querySelector(".modal-close").focus();
  }
}

function chartModalContent({ stats = [], legend = "", body, hint = "", table = "", list = null }) {
  const statsHtml = stats.length
    ? `<div class="modal-stats">${stats.map((stat) => `
        <div class="modal-stat">
          <span>${escapeHtml(stat.label)}</span>
          <strong>${escapeHtml(stat.value)}</strong>
          ${stat.detail ? `<small>${escapeHtml(stat.detail)}</small>` : ""}
        </div>
      `).join("")}</div>`
    : "";

  const listHtml = list
    ? `<section class="modal-section" data-filter-list>
        <div class="modal-section-head">
          <h3>${escapeHtml(list.title)} <span class="modal-list-count" data-list-count></span></h3>
          <button class="filter-chip" type="button" data-clear-filter hidden></button>
        </div>
        <div class="table-wrap modal-list">${list.table}</div>
      </section>`
    : "";

  return `
    ${statsHtml}
    <section class="modal-chart">
      ${legend}${body}
      ${hint ? `<p class="modal-hint">${escapeHtml(hint)}</p>` : ""}
    </section>
    ${listHtml}
    ${table ? `<section class="modal-section"><h3>Resumo em tabela</h3><div class="table-wrap">${table}</div></section>` : ""}
  `;
}

function stepChartModal(direction) {
  const modal = document.getElementById("chartModal");
  const charts = availableCharts();
  if (!modal?.open || charts.length < 2) return;

  const index = charts.findIndex((chart) => chart.id === modal.dataset.chartId);
  const next = charts[(index + direction + charts.length) % charts.length];
  openChartModal(next.id);
}

function closeChartModal() {
  const modal = document.getElementById("chartModal");
  if (modal?.open) modal.close();
}

function markFilter(mark) {
  return FILTER_KEYS.reduce((filter, key) => {
    const value = mark.dataset[`f${key[0].toUpperCase()}${key.slice(1)}`];
    if (value !== undefined) filter[key] = value;
    return filter;
  }, {});
}

function toggleModalFilter(mark) {
  const body = document.getElementById("chartModalBody");
  const selecting = !mark.classList.contains("is-selected");
  clearModalSelection(body);
  if (selecting) {
    mark.classList.add("is-selected");
    mark.parentElement?.closest("[data-filter-label]")?.classList.add("is-selected-parent");
  }
  applyModalFilter(body, selecting ? mark : null);
}

function clearModalSelection(body) {
  body.querySelectorAll(".is-selected, .is-selected-parent").forEach((element) => {
    element.classList.remove("is-selected", "is-selected-parent");
  });
}

function applyModalFilter(body, mark) {
  const filter = mark ? markFilter(mark) : {};
  body.querySelector(".modal-chart")?.classList.toggle("has-selection", Boolean(mark));

  const section = body.querySelector("[data-filter-list]");
  if (!section) return;

  const rows = Array.from(section.querySelectorAll("tbody tr"));
  let visible = 0;
  rows.forEach((row) => {
    const match = Object.entries(filter).every(([key, value]) => row.dataset[key] === value);
    row.hidden = !match;
    if (match) visible += 1;
  });

  section.querySelector("[data-list-count]").textContent = mark ? `(${visible} de ${rows.length})` : `(${rows.length})`;
  const chip = section.querySelector("[data-clear-filter]");
  chip.hidden = !mark;
  chip.textContent = mark ? `Filtro: ${mark.dataset.filterLabel} ✕` : "";
  chip.setAttribute("aria-label", mark ? `Remover filtro ${mark.dataset.filterLabel}` : "Remover filtro");
}

// ----- Interação: tooltip, mapa linear, tabela e modal -----

function bindChartInteractions() {
  const container = document.getElementById("overviewCharts");
  const modal = document.getElementById("chartModal");
  const modalBody = document.getElementById("chartModalBody");
  if (!container) return;

  bindTooltipLayer(container);
  window.addEventListener("scroll", hideChartTooltip, { passive: true });

  container.addEventListener("click", (event) => {
    const toggle = event.target.closest(".chart-view-toggle");
    if (toggle) {
      const card = toggle.closest(".chart-card");
      const showTable = card.classList.toggle("show-table");
      toggle.setAttribute("aria-pressed", String(showTable));
      toggle.textContent = showTable ? "Ver gráfico" : "Ver tabela";
      hideChartTooltip();
      return;
    }

    // Clique em qualquer parte do card abre o destaque; a tabela aberta continua selecionável.
    const card = event.target.closest(".chart-card");
    if (!card || event.target.closest(".chart-table") || window.getSelection()?.toString()) return;
    openChartModal(card.dataset.chartId);
  });

  container.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const mark = event.target.closest("[data-tip-value]");
    const card = event.target.closest(".chart-card");
    if (!mark || !card) return;
    event.preventDefault();
    openChartModal(card.dataset.chartId);
  });

  if (!modal || !modalBody) return;

  bindTooltipLayer(modalBody);
  modalBody.addEventListener("scroll", hideChartTooltip, { passive: true });

  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest(".modal-close")) {
      closeChartModal();
      return;
    }

    const step = event.target.closest("[data-modal-step]");
    if (step) {
      stepChartModal(Number(step.dataset.modalStep));
      return;
    }

    if (event.target.closest("[data-clear-filter]")) {
      clearModalSelection(modalBody);
      applyModalFilter(modalBody, null);
      return;
    }

    const mark = event.target.closest("[data-filter-label]");
    if (mark && modalBody.contains(mark)) toggleModalFilter(mark);
  });

  modal.addEventListener("keydown", (event) => {
    // Esc e setas ficam no modal (sem propagar): fecham/trocam o gráfico sem sair do modo apresentação.
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeChartModal();
      return;
    }

    if (event.target.closest("input, select, textarea")) return;

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      stepChartModal(event.key === "ArrowRight" ? 1 : -1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      const mark = event.target.closest("[data-filter-label]");
      if (mark && modalBody.contains(mark)) {
        event.preventDefault();
        toggleModalFilter(mark);
      }
    }
  });

  modal.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
    hideChartTooltip();
    clearLinemapHover();
    container.querySelector(`[data-chart-id="${modal.dataset.chartId}"] .chart-expand`)?.focus();
  });
}

function bindTooltipLayer(root) {
  root.addEventListener("pointermove", (event) => {
    const track = event.target.closest(".lm-track");
    if (track) {
      if (!showLinemapTip(track, event.clientX, event.clientY)) hideChartTooltip();
      return;
    }

    clearLinemapHover();
    const mark = event.target.closest("[data-tip-value]");
    if (mark) showChartTooltip(tipFromDataset(mark), event.clientX, event.clientY);
    else hideChartTooltip();
  });

  root.addEventListener("pointerleave", () => {
    clearLinemapHover();
    hideChartTooltip();
  });

  root.addEventListener("focusin", (event) => {
    const mark = event.target.closest("[data-tip-value]");
    if (!mark) return;
    const rect = mark.getBoundingClientRect();
    showChartTooltip(tipFromDataset(mark), rect.left + rect.width / 2, rect.top);
  });

  root.addEventListener("focusout", hideChartTooltip);
}

function tipFromDataset(element) {
  return { value: element.dataset.tipValue, label: element.dataset.tipLabel, detail: element.dataset.tipDetail };
}

function showLinemapTip(track, clientX, clientY) {
  const data = linemapData.get(track.dataset.sub);
  if (!data) return false;

  const rect = track.getBoundingClientRect();
  const km = data.start + ((clientX - rect.left) / rect.width) * data.span;
  const tolerance = (8 / rect.width) * data.span;
  let nearest = -1;
  let nearestDistance = Infinity;

  data.segments.forEach((segment, index) => {
    const distance = km < segment.start ? segment.start - km : km > segment.end ? km - segment.end : 0;
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  });

  const found = nearest >= 0 && nearestDistance <= tolerance;
  clearLinemapHover();
  if (!found) return false;

  track.querySelectorAll(`[data-i="${nearest}"]`).forEach((mark) => mark.classList.add("is-hover"));
  const { row } = data.segments[nearest];
  showChartTooltip({
    value: `${formatMeters(row.extReal)} de ${formatMeters(row.ext)} (${formatRatio(ratio(row.extReal, row.ext))})`,
    label: row.equipInfra || "Frente sem código de equipamento",
    detail: `${activityLabel(row.atividade)} • km ${formatKm(row.kmi)} a ${formatKm(row.kmf)}`,
  }, clientX, clientY);
  return true;
}

function clearLinemapHover() {
  document.querySelectorAll(".lm-track .is-hover").forEach((mark) => mark.classList.remove("is-hover"));
}

function chartTooltip() {
  let tip = document.getElementById("chartTooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "chartTooltip";
    tip.className = "chart-tooltip";
    tip.setAttribute("role", "tooltip");
    ["strong", "span", "small"].forEach((tag) => tip.appendChild(document.createElement(tag)));
  }
  // Com o modal aberto, o tooltip precisa estar dentro dele para aparecer acima da camada do diálogo.
  const host = document.querySelector("#chartModal[open]") || document.body;
  if (tip.parentElement !== host) host.appendChild(tip);
  return tip;
}

// Rótulos vêm da planilha: sempre textContent, nunca innerHTML.
function showChartTooltip({ value, label, detail }, x, y) {
  const tip = chartTooltip();
  const [valueEl, labelEl, detailEl] = tip.children;
  valueEl.textContent = value || "";
  labelEl.textContent = label || "";
  detailEl.textContent = detail || "";
  detailEl.hidden = !detail;
  tip.classList.add("show");

  const { width, height } = tip.getBoundingClientRect();
  const left = Math.min(Math.max(8, x + 14), window.innerWidth - width - 8);
  const top = y - height - 12 < 8 ? y + 18 : y - height - 12;
  tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}

function hideChartTooltip() {
  document.getElementById("chartTooltip")?.classList.remove("show");
}

function renderLimpeza() {
  const selectedSub = document.getElementById("limpezaSubFilter").value;
  const search = normalizeHeader(document.getElementById("limpezaSearch").value);

  let summaries = state.limpeza.subSummary || [];
  if (selectedSub) summaries = summaries.filter((item) => String(item.sub) === selectedSub);

  if (search) {
    summaries = summaries.filter((summary) => {
      const rows = limpezaRowsForSub(summary.sub);
      const haystack = normalizeHeader([
        summary.sub,
        rows.map((row) => `${row.equipInfra} ${row.atividade} ${row.sb}`).join(" "),
      ].join(" "));
      return haystack.includes(search);
    });
  }

  const container = document.getElementById("limpezaCards");
  if (!summaries.length) {
    container.innerHTML = `<div class="empty-state">Nenhuma SUB carregada. Importe uma planilha PDM local para preencher este dashboard.</div>`;
    return;
  }

  container.innerHTML = summaries.map((summary) => {
    const rows = limpezaRowsForSub(summary.sub);
    const activityBadges = Object.entries(summary.atividades || {})
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
      .map(([name, count]) => `<span class="badge">${escapeHtml(String(name).toLowerCase())}: ${count}</span>`)
      .join("");

    const detailCards = rows.map((row) => `
      <div class="detail-row">
        <div class="detail-row-head">
          <strong>${escapeHtml(row.equipInfra || "—")}</strong>
          <span>${formatPercent(row.percentualReal)}</span>
        </div>
        <div class="detail-grid">
          <div><span>ATV</span><strong>${escapeHtml(row.atividade || "—")}</strong></div>
          <div><span>KM</span><strong>${formatKmRange(row.kmi, row.kmf)}</strong></div>
          <div><span>EXT</span><strong>${formatMeters(row.ext)}</strong></div>
          <div><span>EXT real</span><strong>${formatMeters(row.extReal)}</strong></div>
        </div>
      </div>
    `).join("");

    return `
      <article class="sub-card">
        <div class="sub-top">
          <div>
            <span class="eyebrow">Limpeza Geral</span>
            <div class="sub-title">SUB ${escapeHtml(summary.sub)}</div>
          </div>
          <div class="sub-percent">${formatPercent(summary.percentual)}</div>
        </div>

        <div class="progress">
          <span style="width: ${clampPercent(summary.percentual)}%"></span>
        </div>

        <div class="metric-row">
          <div class="metric-pill"><span>Planejado</span><strong>${formatMeters(summary.planejadoM)}</strong></div>
          <div class="metric-pill"><span>Executado</span><strong>${formatMeters(summary.realizadoM)}</strong></div>
          <div class="metric-pill"><span>Saldo</span><strong>${formatMeters(summary.saldoM)}</strong></div>
        </div>

        <div class="meta-grid">
          <div class="meta-item"><span>Faixa KM</span><strong>${formatKmRange(summary.kmInicial, summary.kmFinal)}</strong></div>
          <div class="meta-item"><span>Equipamentos</span><strong>${summary.quantidadeFrentes}</strong></div>
          <div class="meta-item"><span>Concluídas</span><strong>${summary.frentesConcluidas}</strong></div>
          <div class="meta-item"><span>Em andamento</span><strong>${summary.frentesAndamento}</strong></div>
          <div class="meta-item"><span>Pendentes</span><strong>${summary.frentesPendentes}</strong></div>
        </div>

        <div class="tag-row activity-summary">${activityBadges || `<span class="badge">Sem ATV informado</span>`}</div>

        <details>
          <summary>Ver equipamentos da SUB ${escapeHtml(summary.sub)}</summary>
          <div class="detail-list">${detailCards}</div>
        </details>
      </article>
    `;
  }).join("");
}

function renderObras() {
  const selectedSub = document.getElementById("obrasSubFilter").value;
  const selectedStatus = document.getElementById("obrasStatusFilter").value;
  const selectedRisco = document.getElementById("obrasRiscoFilter").value;
  const search = normalizeHeader(document.getElementById("obrasSearch").value);

  let rows = state.obras.rows || [];
  if (selectedSub) rows = rows.filter((row) => String(row.sub) === selectedSub);
  if (selectedStatus) rows = rows.filter((row) => String(row.status) === selectedStatus);
  if (selectedRisco) rows = rows.filter((row) => String(row.risco) === selectedRisco);

  if (search) {
    rows = rows.filter((row) => normalizeHeader([
      row.sub,
      row.sb,
      row.km,
      row.descricao,
      row.tipoObra,
      row.risco,
      row.motivo,
      row.equipamento,
      row.status,
      row.obs,
    ].join(" ")).includes(search));
  }

  const container = document.getElementById("obrasCards");
  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">Nenhuma obra carregada. Importe uma planilha PDM local para preencher este dashboard.</div>`;
    return;
  }

  container.innerHTML = rows.map((row) => {
    const progress = row.progresso ?? statusToProgress(row.status);
    return `
      <article class="obra-card">
        <div class="obra-top">
          <div>
            <span class="eyebrow">SUB ${escapeHtml(row.sub || "—")} - KM ${formatKm(row.km)}</span>
            <div class="obra-title">${escapeHtml(row.descricao)}</div>
          </div>
        </div>

        <div class="badge-row">
          <span class="status-badge ${statusClass(row.status)}">${escapeHtml(row.status || "NÃO INFORMADO")}</span>
          <span class="risk-badge ${riskClass(row.risco)}">Risco Matriz: ${escapeHtml(row.risco || "—")}</span>
        </div>

        <div class="progress" style="margin-top: 14px;">
          <span style="width: ${clampPercent(progress)}%"></span>
        </div>

        <div class="meta-grid">
          <div class="meta-item"><span>SB</span><strong>${escapeHtml(row.sb || "—")}</strong></div>
          <div class="meta-item"><span>KM</span><strong>${formatKm(row.km)}</strong></div>
          <div class="meta-item"><span>Tipo</span><strong>${escapeHtml(row.tipoObra || "—")}</strong></div>
          <div class="meta-item"><span>Equipamento</span><strong>${escapeHtml(row.equipamento || "—")}</strong></div>
          <div class="meta-item"><span>Extensão</span><strong>${escapeHtml(row.extEqM || formatMeters(row.extEq || 0))}</strong></div>
        </div>

        <p><strong>Motivo:</strong> ${escapeHtml(row.motivo || "—")}</p>
        ${row.obs ? `<p><strong>Observação:</strong> ${escapeHtml(row.obs)}</p>` : ""}
      </article>
    `;
  }).join("");
}

function fillFilterOptions() {
  fillSelect("limpezaSubFilter", unique((state.limpeza.subSummary || []).map((row) => String(row.sub))).sort(sortNumericText), "Todas");
  fillSelect("obrasSubFilter", unique((state.obras.rows || []).map((row) => String(row.sub || "")).filter(Boolean)).sort(sortNumericText), "Todas");
  fillSelect("obrasStatusFilter", unique((state.obras.rows || []).map((row) => row.status || "NÃO INFORMADO")).sort(), "Todos");
  fillSelect("obrasRiscoFilter", unique((state.obras.rows || []).map((row) => row.risco || "Não informado")).sort(), "Todos");
}

function fillSelect(id, options, firstLabel) {
  const select = document.getElementById(id);
  const current = select.value;
  select.innerHTML = `<option value="">${escapeHtml(firstLabel)}</option>` +
    options.map((option) => `<option value="${escapeAttribute(option)}">${escapeHtml(option)}</option>`).join("");
  if (options.includes(current)) select.value = current;
}

function limpezaRowsForSub(sub) {
  return (state.limpeza.rows || []).filter((row) => String(row.sub) === String(sub));
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

function min(values) {
  return values.length ? Math.min(...values) : null;
}

function max(values) {
  return values.length ? Math.max(...values) : null;
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value !== null && value !== undefined && String(value).trim() !== "")));
}

function countBy(rows, getter) {
  return rows.reduce((acc, row) => {
    const key = getter(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function sortNumericText(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a).localeCompare(String(b), "pt-BR");
}

function formatMeters(value) {
  const number = Number(value) || 0;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(number)} m`;
}

function formatPercent(value) {
  const number = Number(value) || 0;
  const normalized = number > 1 ? number / 100 : number;
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(normalized * 100)}%`;
}

function clampPercent(value) {
  const number = Number(value) || 0;
  const normalized = number > 1 ? number / 100 : number;
  return Math.max(0, Math.min(100, normalized * 100));
}

function formatKm(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const km = Math.floor(number / 1000);
  const meters = Math.round(number % 1000).toString().padStart(3, "0");
  return `${km}+${meters}`;
}

function formatKmRange(start, end) {
  if (!Number.isFinite(Number(start)) && !Number.isFinite(Number(end))) return "—";
  return `${formatKm(start)} a ${formatKm(end)}`;
}

function latestDateLabel(values) {
  const dates = values
    .map((value) => value ? new Date(value) : null)
    .filter((date) => date && !Number.isNaN(date.getTime()));

  if (!dates.length) return "—";
  const latest = new Date(Math.max(...dates.map((date) => date.getTime())));
  return latest.toLocaleDateString("pt-BR");
}

function statusClass(status) {
  const normalized = normalizeHeader(status);
  if (normalized.includes("CONCLUI")) return "status-concluido";
  if (normalized.includes("ANDAMENTO")) return "status-andamento";
  return "status-nao-iniciado";
}

function riskClass(risk) {
  const normalized = normalizeHeader(risk);
  if (normalized.includes("ALTO")) return "risk-alto";
  if (normalized.includes("MODERADO")) return "risk-moderado";
  return "";
}

function showStatus(message) {
  const el = document.getElementById("statusMessage");
  el.textContent = message;
  el.classList.add("show");
}

function hideStatus() {
  const el = document.getElementById("statusMessage");
  el.textContent = "";
  el.classList.remove("show");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function stripHtml(value) {
  return String(value ?? "").replace(/<[^>]+>/g, "");
}
