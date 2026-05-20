const DEFAULT_FILES = {
  limpezaJson: "data/pdm-limpeza.json",
  obrasJson: "data/obras-dr.json",
  sourceConfig: "data/source-config.json",
};

const STORAGE_KEYS = {
  theme: "trecho2-pdm-theme",
  source: "trecho2-pdm-source-config",
};

const state = {
  limpeza: { rows: [], subSummary: [], generatedAt: null, sourceSheet: "" },
  obras: { rows: [], generatedAt: null, sourceSheet: "" },
  sourceLabel: "Dados exemplo",
  loadErrors: [],
};

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  bindNavigation();
  bindFilters();
  bindSourceActions();
  loadData();
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
    button.addEventListener("click", () => {
      const panel = button.dataset.panel;
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab === button));
      document.querySelectorAll(".panel").forEach((section) => {
        section.classList.toggle("active", section.id === `panel-${panel}`);
      });
    });
  });
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
  document.getElementById("saveSourceBtn").addEventListener("click", () => {
    const config = {
      limpezaCsvUrl: document.getElementById("limpezaCsvUrl").value.trim(),
      obrasCsvUrl: document.getElementById("obrasCsvUrl").value.trim(),
    };
    localStorage.setItem(STORAGE_KEYS.source, JSON.stringify(config));
    showStatus("URLs salvas neste navegador. Recarregando os dashboards...");
    loadData();
  });

  document.getElementById("reloadSourceBtn").addEventListener("click", () => {
    showStatus("Recarregando dados...");
    loadData();
  });

  document.getElementById("clearSourceBtn").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEYS.source);
    document.getElementById("limpezaCsvUrl").value = "";
    document.getElementById("obrasCsvUrl").value = "";
    showStatus("URLs locais removidas. O site voltará a usar o arquivo central ou os JSONs de exemplo.");
    loadData();
  });
}

async function loadData() {
  state.loadErrors = [];
  showStatus("Carregando base do PDM...");

  const centralConfig = await readCentralSourceConfig();
  const localConfig = readLocalSourceConfig();
  const config = mergeConfigs(centralConfig, localConfig);

  document.getElementById("limpezaCsvUrl").value = localConfig.limpezaCsvUrl || centralConfig.limpezaCsvUrl || "";
  document.getElementById("obrasCsvUrl").value = localConfig.obrasCsvUrl || centralConfig.obrasCsvUrl || "";

  try {
    state.limpeza = await loadLimpeza(config);
  } catch (error) {
    state.loadErrors.push(`Limpeza Geral: ${error.message}`);
    state.limpeza = await fetchJson(DEFAULT_FILES.limpezaJson);
  }

  try {
    state.obras = await loadObras(config);
  } catch (error) {
    state.loadErrors.push(`Obras: ${error.message}`);
    state.obras = await fetchJson(DEFAULT_FILES.obrasJson);
  }

  const usingCsv = Boolean(config.limpezaCsvUrl || config.obrasCsvUrl);
  state.sourceLabel = usingCsv ? "Planilha PDM online" : "Dados exemplo da planilha anexada";

  fillFilterOptions();
  renderAll();

  if (state.loadErrors.length) {
    showStatus(`Alguns dados online não foram carregados. Usando fallback local. ${state.loadErrors.join(" | ")}`);
  } else {
    hideStatus();
  }
}

async function readCentralSourceConfig() {
  try {
    const response = await fetch(DEFAULT_FILES.sourceConfig, { cache: "no-store" });
    if (!response.ok) return {};
    return await response.json();
  } catch {
    return {};
  }
}

function readLocalSourceConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.source) || "{}");
  } catch {
    return {};
  }
}

function mergeConfigs(central, local) {
  return {
    limpezaCsvUrl: nonEmpty(local.limpezaCsvUrl) || nonEmpty(central.limpezaCsvUrl) || "",
    obrasCsvUrl: nonEmpty(local.obrasCsvUrl) || nonEmpty(central.obrasCsvUrl) || "",
  };
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

async function loadLimpeza(config) {
  if (config.limpezaCsvUrl) {
    const text = await fetchText(config.limpezaCsvUrl);
    const matrix = parseCsv(text);
    const rows = normalizeLimpezaFromMatrix(matrix);
    return {
      title: "ZBV-ZAR PDM Limpeza",
      sourceSheet: "ZBV-ZAR PDM Limpeza",
      generatedAt: new Date().toISOString(),
      rows,
      subSummary: calculateSubSummary(rows),
    };
  }

  const data = await fetchJson(DEFAULT_FILES.limpezaJson);
  if (!Array.isArray(data.subSummary) || !data.subSummary.length) {
    data.subSummary = calculateSubSummary(data.rows || []);
  }
  return data;
}

async function loadObras(config) {
  if (config.obrasCsvUrl) {
    const text = await fetchText(config.obrasCsvUrl);
    const matrix = parseCsv(text);
    const rows = normalizeObrasFromMatrix(matrix);
    return {
      title: "ZBV-ZAR Obras",
      sourceSheet: "ZBV-ZAR Obras",
      generatedAt: new Date().toISOString(),
      rows,
    };
  }

  return await fetchJson(DEFAULT_FILES.obrasJson);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Não foi possível ler ${url}`);
  return await response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Não foi possível ler a URL CSV`);
  return await response.text();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function findHeaderRow(matrix, requiredTerms) {
  return matrix.findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    return requiredTerms.every((term) => normalized.includes(normalizeHeader(term)));
  });
}

function headerMap(row) {
  const map = {};
  row.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    if (key) map[key] = index;
  });
  return map;
}

function getByHeader(row, map, name) {
  const index = map[normalizeHeader(name)];
  return index === undefined ? "" : row[index];
}

function normalizeLimpezaFromMatrix(matrix) {
  const headerIndex = findHeaderRow(matrix, ["EQUIP_INFRA", "EXT", "EXT REAL"]);
  if (headerIndex < 0) throw new Error("Cabeçalho da aba de limpeza não encontrado.");

  const map = headerMap(matrix[headerIndex]);
  const rows = [];

  matrix.slice(headerIndex + 1).forEach((row, index) => {
    const equip = String(getByHeader(row, map, "EQUIP_INFRA") || "").trim();
    if (!equip || !equip.includes("/")) return;

    const ext = parseNumber(getByHeader(row, map, "EXT"));
    const real = parseNumber(getByHeader(row, map, "EXT REAL"));
    const sub = String(getByHeader(row, map, "SUB") || equip.split("/")[0] || "").trim();

    rows.push({
      excelRow: headerIndex + index + 2,
      equipInfra: equip,
      atividade: String(getByHeader(row, map, "ATV") || "").trim(),
      kmi: parseInteger(getByHeader(row, map, "KMI")),
      kmf: parseInteger(getByHeader(row, map, "KMF")),
      kmiReal: parseInteger(getByHeader(row, map, "KMI REAL")),
      kmfReal: parseInteger(getByHeader(row, map, "KMF REAL")),
      ext,
      extM: `${Math.round(ext)}m`,
      extReal: real,
      extRealM: `${Math.round(real)}m`,
      percentualReal: ext ? real / ext : 0,
      sb: cleanOptional(getByHeader(row, map, "SB")),
      sub,
      percentualSub: parseNumber(getByHeader(row, map, "%SUB")),
    });
  });

  return rows;
}

function normalizeObrasFromMatrix(matrix) {
  const headerIndex = findHeaderRow(matrix, ["SUB", "DESCRIÇÃO OBRA", "STATUS"]);
  if (headerIndex < 0) throw new Error("Cabeçalho da aba de obras não encontrado.");

  const map = headerMap(matrix[headerIndex]);
  const rows = [];
  let currentSub = "";

  matrix.slice(headerIndex + 1).forEach((row, index) => {
    const maybeSub = cleanOptional(getByHeader(row, map, "SUB"));
    if (maybeSub) currentSub = maybeSub;

    const descricao = cleanOptional(getByHeader(row, map, "DESCRIÇÃO OBRA"));
    if (!descricao || descricao.toLowerCase().includes("plano de drenagem")) return;

    const status = cleanOptional(getByHeader(row, map, "STATUS")) || "NÃO INFORMADO";
    rows.push({
      excelRow: headerIndex + index + 2,
      sub: currentSub,
      sb: cleanOptional(getByHeader(row, map, "SB")),
      km: parseInteger(getByHeader(row, map, "KM")),
      descricao,
      tipoObra: cleanOptional(getByHeader(row, map, "TIPO DE OBRA")),
      risco: cleanOptional(getByHeader(row, map, "RISCO")),
      motivo: cleanOptional(getByHeader(row, map, "MOTIVO")),
      equipamento: cleanOptional(getByHeader(row, map, "EQUIPAMENTO")),
      extEq: parseNullableNumber(getByHeader(row, map, "EXT EQ.")),
      extEqM: cleanOptional(getByHeader(row, map, "EXT EQ.(M)")),
      prazoMes: parseNullableNumber(getByHeader(row, map, "PRAZO (MÊS)")),
      dtInicio: cleanOptional(getByHeader(row, map, "DT INÍCIO")),
      status,
      progresso: statusToProgress(status),
      obs: cleanOptional(getByHeader(row, map, "OBS.")),
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

  document.getElementById("overviewSubList").innerHTML = (state.limpeza.subSummary || [])
    .map((sub) => compactProgressRow(`SUB ${escapeHtml(sub.sub)}`, formatPercent(sub.percentual), sub.percentual))
    .join("");

  const statusCounts = countBy(obraRows, (row) => row.status || "NÃO INFORMADO");
  document.getElementById("overviewObrasList").innerHTML = Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => compactProgressRow(escapeHtml(status), `${count} obra(s)`, count / Math.max(obraRows.length, 1)))
    .join("");
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
    container.innerHTML = `<div class="empty-state">Nenhuma SUB encontrada com os filtros atuais.</div>`;
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
    container.innerHTML = `<div class="empty-state">Nenhuma obra encontrada com os filtros atuais.</div>`;
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

function formatPrazo(value) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return escapeHtml(String(value));
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(number)} mês(es)`;
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
