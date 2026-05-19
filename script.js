const STORAGE = {
  reports: "trecho2_reports_v1",
  works: "trecho2_works_override_v1",
  theme: "trecho2_theme_v1"
};

const state = {
  baseData: null,
  worksData: null,
  reportsToApply: [],
  selectedPhotos: []
};

const fallbackWorksData = {
  versao: "1.0.0",
  trecho: "Trecho 2",
  area: "Infraestrutura ferroviária",
  atualizadoEm: new Date().toISOString().slice(0, 10),
  obras: [
    {
      id: "OBR-001",
      nome: "Implantação de canaletas - KM 101+200 ao 101+900",
      frente: "Drenagem",
      tipo: "Canaleta / escoamento superficial",
      kmInicio: "101+200",
      kmFim: "101+900",
      metaMetros: 700,
      executadoMetros: 280,
      responsavel: "Fiscal 1",
      status: "Em andamento",
      ultimaAtualizacao: new Date().toISOString().slice(0, 10),
      observacoes: "Exemplo inicial. Edite em data/obras.json.",
      apontamentosAplicados: []
    },
    {
      id: "OBR-002",
      nome: "Correção de talude - KM 108+500",
      frente: "Terraplenagem",
      tipo: "Talude / contenção",
      kmInicio: "108+300",
      kmFim: "108+700",
      metaMetros: 400,
      executadoMetros: 80,
      responsavel: "Fiscal 2",
      status: "Atenção",
      ultimaAtualizacao: new Date().toISOString().slice(0, 10),
      observacoes: "Acompanhar drenagem provisória.",
      apontamentosAplicados: []
    },
    {
      id: "OBR-003",
      nome: "Recomposição de lastro e sublastro - KM 112+000 ao 112+600",
      frente: "Plataforma",
      tipo: "Lastro / sublastro",
      kmInicio: "112+000",
      kmFim: "112+600",
      metaMetros: 600,
      executadoMetros: 510,
      responsavel: "Fiscal 3",
      status: "Em andamento",
      ultimaAtualizacao: new Date().toISOString().slice(0, 10),
      observacoes: "Próximo de conclusão.",
      apontamentosAplicados: []
    }
  ]
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return dateString;
  return `${day}/${month}/${year}`;
}

function toNumber(value) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : 0;
}

function formatMeters(value) {
  return `${toNumber(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m`;
}

function percent(done, goal) {
  if (!goal || goal <= 0) return 0;
  return Math.min(100, Math.round((done / goal) * 100));
}

function safeId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `rel-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3400);
}

function setupTheme() {
  const savedTheme = localStorage.getItem(STORAGE.theme) || "light";
  applyTheme(savedTheme);

  const button = $("#themeToggle");
  button?.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("dark-theme") ? "light" : "dark";
    applyTheme(nextTheme);
    localStorage.setItem(STORAGE.theme, nextTheme);
  });
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-theme", isDark);

  const button = $("#themeToggle");
  if (!button) return;
  button.textContent = isDark ? "☀" : "☾";
  button.title = isDark ? "Usar tema claro" : "Usar tema escuro";
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-pressed", String(isDark));
}

async function init() {
  setupTheme();
  setupNavigation();
  setupReportForm();
  setupHistoryExports();
  setupCoordinatorTools();
  setupDashboardFilters();

  $("#reportDate").value = todayIso();
  $("#periodStart").value = todayIso();
  $("#periodEnd").value = todayIso();

  await loadWorksData();
  renderAll();
  addActivityRow("08:00", "Início das atividades / deslocamento para frente de serviço");
}

function setupNavigation() {
  $$('[data-target]').forEach(button => {
    button.addEventListener("click", () => openTab(button.dataset.target));
  });

  window.addEventListener("hashchange", () => {
    const target = location.hash.replace("#", "");
    if (target) openTab(target, false);
  });

  const initialTab = location.hash.replace("#", "");
  if (initialTab) openTab(initialTab, false);
}

function openTab(target, updateHash = true) {
  if (!$("#" + target)) return;
  $$(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.id === target));
  $$(".tab-button").forEach(button => button.classList.toggle("active", button.dataset.target === target));
  if (updateHash) history.replaceState(null, "", `#${target}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadWorksData() {
  try {
    const response = await fetch("data/obras.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Arquivo data/obras.json não encontrado");
    state.baseData = await response.json();
  } catch (error) {
    console.warn(error);
    state.baseData = clone(fallbackWorksData);
  }

  const localOverride = localStorage.getItem(STORAGE.works);
  if (localOverride) {
    try {
      state.worksData = JSON.parse(localOverride);
      return;
    } catch (error) {
      console.warn("Base local inválida. Voltando ao arquivo do repositório.", error);
      localStorage.removeItem(STORAGE.works);
    }
  }
  state.worksData = clone(state.baseData);
}

function saveWorksLocal() {
  state.worksData.atualizadoEm = todayIso();
  localStorage.setItem(STORAGE.works, JSON.stringify(state.worksData));
}

function getWorks() {
  return state.worksData?.obras ?? [];
}

function getReports() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE.reports) || "[]");
  } catch {
    return [];
  }
}

function saveReports(reports) {
  localStorage.setItem(STORAGE.reports, JSON.stringify(reports));
}

function renderAll() {
  renderDashboard();
  renderWorkOptions();
  renderHistory();
}

function setupDashboardFilters() {
  $("#dashboardSearch").addEventListener("input", renderDashboard);
  $("#statusFilter").addEventListener("change", renderDashboard);
}

function renderDashboard() {
  const works = getFilteredWorks();
  renderKpis(works);

  const container = $("#obraCards");
  if (!works.length) {
    container.innerHTML = `<div class="empty-state">Nenhuma obra encontrada para o filtro selecionado.</div>`;
    return;
  }

  container.innerHTML = works.map(work => {
    const done = toNumber(work.executadoMetros);
    const goal = toNumber(work.metaMetros);
    const pct = percent(done, goal);
    const remaining = Math.max(goal - done, 0);
    const statusClass = (work.status || "Planejada").replaceAll(" ", "-");

    return `
      <article class="work-card status-${statusClass}">
        <div class="work-top">
          <div>
            <div class="work-id">${escapeHtml(work.id || "Sem ID")}</div>
            <h3>${escapeHtml(work.nome || "Obra sem nome")}</h3>
          </div>
          <span class="status-badge ${escapeHtml(work.status || "Planejada")}">${escapeHtml(work.status || "Planejada")}</span>
        </div>

        <div class="progress-wrap" aria-label="Progresso da obra">
          <div class="progress-meta">
            <span>${pct}% concluído</span>
            <span>${formatMeters(done)} / ${formatMeters(goal)}</span>
          </div>
          <div class="progress-bar"><span class="progress-fill" style="width:${pct}%"></span></div>
        </div>

        <dl class="work-details">
          <div><dt>Frente</dt><dd>${escapeHtml(work.frente || "-")}</dd></div>
          <div><dt>Serviço</dt><dd>${escapeHtml(work.tipo || "-")}</dd></div>
          <div><dt>KM</dt><dd>${escapeHtml(work.kmInicio || "-")} → ${escapeHtml(work.kmFim || "-")}</dd></div>
          <div><dt>Saldo</dt><dd>${formatMeters(remaining)}</dd></div>
          <div><dt>Fiscal</dt><dd>${escapeHtml(work.responsavel || "-")}</dd></div>
          <div><dt>Atualização</dt><dd>${formatDate(work.ultimaAtualizacao)}</dd></div>
        </dl>
      </article>
    `;
  }).join("");
}

function getFilteredWorks() {
  const term = $("#dashboardSearch").value.trim().toLowerCase();
  const status = $("#statusFilter").value;

  return getWorks().filter(work => {
    const matchesStatus = status === "todos" || work.status === status;
    const searchable = [work.id, work.nome, work.frente, work.tipo, work.kmInicio, work.kmFim, work.responsavel]
      .join(" ")
      .toLowerCase();
    return matchesStatus && (!term || searchable.includes(term));
  });
}

function renderKpis(works) {
  const totalGoal = works.reduce((sum, work) => sum + toNumber(work.metaMetros), 0);
  const totalDone = works.reduce((sum, work) => sum + toNumber(work.executadoMetros), 0);
  const pct = percent(totalDone, totalGoal);
  const concluded = works.filter(work => percent(work.executadoMetros, work.metaMetros) >= 100 || work.status === "Concluída").length;

  const kpis = [
    ["Obras no filtro", works.length],
    ["Execução geral", `${pct}%`],
    ["Meta PDM", formatMeters(totalGoal)],
    ["Concluídas", concluded]
  ];

  $("#kpiGrid").innerHTML = kpis.map(([label, value]) => `
    <article class="kpi-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `).join("");
}

function renderWorkOptions() {
  const options = getWorks().map(work => `<option value="${escapeHtml(work.id)}">${escapeHtml(work.id)} • ${escapeHtml(work.nome)}</option>`).join("");
  $("#obraSelect").innerHTML = `<option value="">Selecione uma obra</option>${options}`;
  $("#obraSelect").addEventListener("change", fillWorkFields);
}

function fillWorkFields() {
  const selected = getWorks().find(work => work.id === $("#obraSelect").value);
  if (!selected) return;
  $("#serviceType").value = selected.tipo || selected.frente || "";
  $("#kmStart").value = selected.kmInicio || "";
  $("#kmEnd").value = selected.kmFim || "";
  $("#plannedMeters").value = selected.metaMetros || "";
}

function setupReportForm() {
  setupResourceChecklist();
  $("#addActivityBtn").addEventListener("click", () => addActivityRow());
  $("#photoInput").addEventListener("change", handlePhotos);
  $("#clearFormBtn").addEventListener("click", clearReportForm);
  $("#reportForm").addEventListener("submit", saveReportFromForm);
}

function addActivityRow(time = "", description = "") {
  const template = $("#activityTemplate");
  const item = template.content.firstElementChild.cloneNode(true);
  $(".activity-time", item).value = time;
  $(".activity-description", item).value = description;
  $(".remove-activity", item).addEventListener("click", () => item.remove());
  $("#activityList").appendChild(item);
}

function setupResourceChecklist() {
  $$("#resourceChecklist .checklist-item").forEach(item => {
    const checkbox = $(".resource-present", item);
    const quantityInput = $(".resource-qty", item);

    quantityInput.addEventListener("input", () => {
      if (toNumber(quantityInput.value) > 0) checkbox.checked = true;
    });

    checkbox.addEventListener("change", () => {
      if (!checkbox.checked) quantityInput.value = "0";
      if (checkbox.checked && toNumber(quantityInput.value) === 0) quantityInput.value = "1";
    });
  });
}

function collectResourceChecklist() {
  return $$("#resourceChecklist .checklist-item").map(item => {
    const name = $("span", item).textContent.trim();
    const present = $(".resource-present", item).checked;
    const quantity = present ? Math.max(0, Math.round(toNumber($(".resource-qty", item).value))) : 0;
    return { nome: name, quantidade: quantity, presente: present && quantity > 0 };
  });
}

function resourceChecklistToText(resources = []) {
  if (!resources.length) return "Não informado.";
  return resources
    .map(resource => `* ${toNumber(resource.quantidade)} ${resource.nome}.`)
    .join("\n");
}

function resourceChecklistToHtml(resources = []) {
  if (!resources.length) return "<li>Não informado.</li>";
  return resources
    .map(resource => `<li><strong>${toNumber(resource.quantidade)}</strong> ${escapeHtml(resource.nome)}.</li>`)
    .join("");
}

function resourceChecklistInline(resources = []) {
  if (!resources.length) return "Checklist não informado.";
  const active = resources.filter(resource => toNumber(resource.quantidade) > 0);
  if (!active.length) return "Sem equipe/equipamentos marcados.";
  return active.map(resource => `${toNumber(resource.quantidade)} ${resource.nome}`).join(" • ");
}

async function handlePhotos(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  try {
    const compressed = [];
    for (const file of files) {
      compressed.push(await compressImage(file));
    }
    state.selectedPhotos.push(...compressed);
    renderPhotoPreview();
    showToast(`${files.length} foto(s) adicionada(s) ao relatório.`);
  } catch (error) {
    console.error(error);
    showToast("Não foi possível processar uma das fotos.");
  } finally {
    event.target.value = "";
  }
}

function compressImage(file, maxSize = 1200, quality = 0.74) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve({
          name: file.name,
          type: "image/jpeg",
          dataUrl: canvas.toDataURL("image/jpeg", quality)
        });
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderPhotoPreview() {
  const container = $("#photoPreview");
  container.innerHTML = state.selectedPhotos.map((photo, index) => `
    <div class="photo-chip">
      <img src="${photo.dataUrl}" alt="Foto ${index + 1} do relatório" />
      <button type="button" class="tiny-button delete" data-remove-photo="${index}">Remover</button>
    </div>
  `).join("");

  $$('[data-remove-photo]').forEach(button => {
    button.addEventListener("click", () => {
      state.selectedPhotos.splice(Number(button.dataset.removePhoto), 1);
      renderPhotoPreview();
    });
  });
}

function saveReportFromForm(event) {
  event.preventDefault();

  const selectedWork = getWorks().find(work => work.id === $("#obraSelect").value);
  const activities = $$("#activityList .activity-item")
    .map(item => ({
      hora: $(".activity-time", item).value,
      descricao: $(".activity-description", item).value.trim()
    }))
    .filter(activity => activity.hora || activity.descricao);

  const report = {
    id: safeId(),
    trecho: "Trecho 2",
    area: "Infraestrutura ferroviária",
    fiscal: $("#fiscalName").value.trim(),
    data: $("#reportDate").value,
    turno: $("#shift").value,
    clima: $("#weather").value,
    base: $("#baseLocation").value.trim(),
    obraId: $("#obraSelect").value,
    obraNome: selectedWork?.nome || "",
    tipoServico: $("#serviceType").value.trim(),
    encarregado: $("#crewLeader").value.trim(),
    atividadePrincipal: $("#mainActivity").value.trim(),
    equipeRecursos: collectResourceChecklist(),
    kmInicio: $("#kmStart").value.trim(),
    kmFim: $("#kmEnd").value.trim(),
    metaPdmMetros: toNumber($("#plannedMeters").value),
    metrosExecutadosDia: toNumber($("#executedMeters").value),
    atividades: activities,
    condicoesExecucao: $("#qualityNotes").value.trim(),
    segurancaInterferencias: $("#safetyNotes").value.trim(),
    naoConformidades: $("#nonConformities").value.trim(),
    fotos: clone(state.selectedPhotos),
    criadoEm: new Date().toISOString()
  };

  if (!report.fiscal || !report.data || !report.obraId) {
    showToast("Preencha fiscal, data e obra antes de salvar.");
    return;
  }

  const reports = getReports();
  reports.unshift(report);
  saveReports(reports);
  clearReportForm(false);
  renderHistory();
  showToast("Relatório salvo no histórico deste navegador.");
  openTab("historico");
}

function clearReportForm(confirmClear = true) {
  if (confirmClear && !window.confirm("Limpar o formulário atual?")) return;
  $("#reportForm").reset();
  $("#reportDate").value = todayIso();
  $("#activityList").innerHTML = "";
  state.selectedPhotos = [];
  renderPhotoPreview();
  addActivityRow("08:00", "Início das atividades / deslocamento para frente de serviço");
}

function setupHistoryExports() {
  $("#periodStart").addEventListener("change", renderHistory);
  $("#periodEnd").addEventListener("change", renderHistory);
  $("#exportJsonBtn").addEventListener("click", exportSelectedReportsJson);
  $("#exportPdfBtn").addEventListener("click", printSelectedReports);
  $("#exportWhatsBtn").addEventListener("click", exportSelectedReportsWhatsapp);
}

function getSelectedReports() {
  const start = $("#periodStart").value;
  const end = $("#periodEnd").value;
  return getReports().filter(report => {
    const afterStart = !start || report.data >= start;
    const beforeEnd = !end || report.data <= end;
    return afterStart && beforeEnd;
  });
}

function renderHistory() {
  const reports = getSelectedReports();
  const container = $("#historyList");

  if (!reports.length) {
    container.innerHTML = `<div class="empty-state">Nenhum relatório salvo no período selecionado.</div>`;
    return;
  }

  container.innerHTML = reports.map(report => `
    <article class="history-card">
      <div class="history-card-header">
        <div>
          <h3>${escapeHtml(report.obraId)} • ${escapeHtml(report.obraNome || "Obra")}</h3>
          <div class="history-meta">
            ${formatDate(report.data)} • ${escapeHtml(report.fiscal)} • ${escapeHtml(report.turno || "-")}<br>
            Serviço: ${escapeHtml(report.tipoServico || "-")} • KM ${escapeHtml(report.kmInicio || "-")} → ${escapeHtml(report.kmFim || "-")} • Executado: ${formatMeters(report.metrosExecutadosDia)}
          </div>
        </div>
        <div class="history-actions">
          <button class="tiny-button" data-one-whatsapp="${report.id}">WhatsApp</button>
          <button class="tiny-button" data-one-print="${report.id}">PDF</button>
          <button class="tiny-button delete" data-delete-report="${report.id}">Excluir</button>
        </div>
      </div>
      <div class="history-checklist">
        <strong>Encarregado:</strong> ${escapeHtml(report.encarregado || "-")}<br>
        <strong>Atividade:</strong> ${escapeHtml(report.atividadePrincipal || "-")}<br>
        <strong>Equipe/equipamentos:</strong> ${escapeHtml(resourceChecklistInline(report.equipeRecursos || []))}
      </div>
      <p>${escapeHtml(report.condicoesExecucao || report.naoConformidades || "Sem observações adicionais.")}</p>
      ${report.fotos?.length ? `<div class="photo-preview">${report.fotos.map((photo, index) => `<img src="${photo.dataUrl}" alt="Foto ${index + 1} do relatório" />`).join("")}</div>` : ""}
    </article>
  `).join("");

  $$('[data-delete-report]').forEach(button => {
    button.addEventListener("click", () => deleteReport(button.dataset.deleteReport));
  });
  $$('[data-one-whatsapp]').forEach(button => {
    button.addEventListener("click", () => {
      const report = getReports().find(item => item.id === button.dataset.oneWhatsapp);
      openWhatsapp([report]);
    });
  });
  $$('[data-one-print]').forEach(button => {
    button.addEventListener("click", () => {
      const report = getReports().find(item => item.id === button.dataset.onePrint);
      printReports([report]);
    });
  });
}

function deleteReport(id) {
  if (!window.confirm("Excluir este relatório do histórico local?")) return;
  saveReports(getReports().filter(report => report.id !== id));
  renderHistory();
  showToast("Relatório excluído do histórico local.");
}

function exportSelectedReportsJson() {
  const reports = getSelectedReports();
  if (!reports.length) return showToast("Não há relatórios no período selecionado.");

  const payload = {
    sistema: "Controle Trecho 2 - Infraestrutura",
    tipo: "relatorios-fiscais",
    geradoEm: new Date().toISOString(),
    periodo: {
      inicio: $("#periodStart").value || null,
      fim: $("#periodEnd").value || null
    },
    relatorios: reports
  };

  downloadJson(payload, `relatorios-trecho2-${payload.periodo.inicio || "inicio"}-${payload.periodo.fim || "fim"}.json`);
  showToast("JSON gerado. Este é o melhor formato para alimentar o dashboard.");
}

function printSelectedReports() {
  const reports = getSelectedReports();
  if (!reports.length) return showToast("Não há relatórios no período selecionado.");
  printReports(reports);
}

function exportSelectedReportsWhatsapp() {
  const reports = getSelectedReports();
  if (!reports.length) return showToast("Não há relatórios no período selecionado.");
  openWhatsapp(reports);
}

function reportToText(report) {
  const activities = (report.atividades || [])
    .map(activity => `• ${activity.hora || "--:--"} - ${activity.descricao || "Atividade sem descrição"}`)
    .join("\n");

  return `*Relatório diário - Trecho 2 / Infraestrutura*\n\n` +
    `*Data:* ${formatDate(report.data)}\n` +
    `*Fiscal:* ${report.fiscal || "-"}\n` +
    `*Turno:* ${report.turno || "-"}\n` +
    `*Clima:* ${report.clima || "-"}\n` +
    `*Obra:* ${report.obraId || "-"} - ${report.obraNome || "-"}\n` +
    `*Serviço:* ${report.tipoServico || "-"}\n` +
    `*Encarregado:* ${report.encarregado || "-"}\n` +
    `*Atividade:* ${report.atividadePrincipal || "-"}\n\n` +
    `*Equipe/equipamentos:*\n${resourceChecklistToText(report.equipeRecursos || [])}\n\n` +
    `*KM:* ${report.kmInicio || "-"} → ${report.kmFim || "-"}\n` +
    `*Meta PDM:* ${formatMeters(report.metaPdmMetros)}\n` +
    `*Executado no dia:* ${formatMeters(report.metrosExecutadosDia)}\n\n` +
    `*Atividades:*\n${activities || "Sem atividades por horário."}\n\n` +
    `*Condições:* ${report.condicoesExecucao || "-"}\n` +
    `*Segurança/interferências:* ${report.segurancaInterferencias || "-"}\n` +
    `*Não conformidades:* ${report.naoConformidades || "-"}\n` +
    `*Fotos anexadas no histórico local:* ${(report.fotos || []).length}`;
}

function openWhatsapp(reports) {
  const text = reports.map(reportToText).join("\n\n----------------------\n\n");
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function printReports(reports) {
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Relatórios Trecho 2</title>
        <style>
          :root { --blue-dark:#003d68; --blue:#00a6d6; --green:#07d85f; --yellow:#f6d400; --line:#d9e4ea; }
          body { font-family: Arial, sans-serif; margin: 28px; color: #10212d; }
          header { border-bottom: 6px solid var(--yellow); padding-bottom: 14px; margin-bottom: 24px; }
          h1 { color: var(--blue-dark); margin: 0; font-size: 28px; }
          h2 { color: var(--blue-dark); margin-bottom: 6px; }
          .report { page-break-inside: avoid; border: 1px solid var(--line); border-left: 8px solid var(--blue); padding: 18px; margin-bottom: 18px; }
          .meta { color: #596a76; line-height: 1.5; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 18px; margin: 14px 0; }
          .label { font-weight: bold; color: var(--blue-dark); }
          ul { padding-left: 18px; }
          .checklist { background: #f4f8fa; border: 1px solid var(--line); padding: 12px; margin: 14px 0; }
          .checklist p { margin: 0 0 8px; }
          .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px; }
          .photos img { width: 100%; height: 150px; object-fit: cover; border: 1px solid var(--line); }
          @page { margin: 16mm; }
        </style>
      </head>
      <body>
        <header>
          <h1>Relatórios diários - Trecho 2</h1>
          <p class="meta">Infraestrutura ferroviária • Gerado em ${new Date().toLocaleString("pt-BR")}</p>
        </header>
        ${reports.map(report => `
          <section class="report">
            <h2>${escapeHtml(report.obraId)} • ${escapeHtml(report.obraNome || "Obra")}</h2>
            <p class="meta">${formatDate(report.data)} • Fiscal: ${escapeHtml(report.fiscal || "-")} • Turno: ${escapeHtml(report.turno || "-")}</p>
            <div class="grid">
              <div><span class="label">Serviço:</span> ${escapeHtml(report.tipoServico || "-")}</div>
              <div><span class="label">Clima:</span> ${escapeHtml(report.clima || "-")}</div>
              <div><span class="label">KM:</span> ${escapeHtml(report.kmInicio || "-")} → ${escapeHtml(report.kmFim || "-")}</div>
              <div><span class="label">Executado no dia:</span> ${formatMeters(report.metrosExecutadosDia)}</div>
              <div><span class="label">Meta PDM:</span> ${formatMeters(report.metaPdmMetros)}</div>
              <div><span class="label">Base:</span> ${escapeHtml(report.base || "-")}</div>
            </div>
            <div class="checklist">
              <p><span class="label">Encarregado:</span> ${escapeHtml(report.encarregado || "-")}</p>
              <p><span class="label">Atividade:</span> ${escapeHtml(report.atividadePrincipal || "-")}</p>
              <h3>Equipe/equipamentos</h3>
              <ul>${resourceChecklistToHtml(report.equipeRecursos || [])}</ul>
            </div>
            <h3>Atividades por horário</h3>
            <ul>${(report.atividades || []).map(activity => `<li><strong>${escapeHtml(activity.hora || "--:--")}</strong> - ${escapeHtml(activity.descricao || "")}</li>`).join("") || "<li>Sem atividades registradas.</li>"}</ul>
            <h3>Condições da execução</h3>
            <p>${escapeHtml(report.condicoesExecucao || "-")}</p>
            <h3>Segurança / interferências</h3>
            <p>${escapeHtml(report.segurancaInterferencias || "-")}</p>
            <h3>Não conformidades</h3>
            <p>${escapeHtml(report.naoConformidades || "-")}</p>
            ${(report.fotos || []).length ? `<h3>Fotos</h3><div class="photos">${report.fotos.map((photo, index) => `<img src="${photo.dataUrl}" alt="Foto ${index + 1}" />`).join("")}</div>` : ""}
          </section>
        `).join("")}
        <script>window.onload = () => { window.print(); };<\/script>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=920,height=720");
  if (!printWindow) {
    showToast("O navegador bloqueou a janela de impressão. Libere pop-ups para gerar PDF.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function setupCoordinatorTools() {
  $("#importReportsInput").addEventListener("change", handleImportReports);
  $("#applyReportsBtn").addEventListener("click", applyImportedReports);
  $("#downloadWorksBtn").addEventListener("click", () => downloadJson(state.worksData, "obras.json"));
  $("#resetLocalDataBtn").addEventListener("click", resetLocalWorks);
  $("#addWorkBtn").addEventListener("click", addManualWork);
}

async function handleImportReports(event) {
  const files = Array.from(event.target.files || []);
  state.reportsToApply = [];
  $("#applyReportsBtn").disabled = true;
  $("#importPreview").innerHTML = "";
  if (!files.length) return;

  const imported = [];
  for (const file of files) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const reports = Array.isArray(json) ? json : (json.relatorios || json.reports || []);
      reports.forEach(report => imported.push(normalizeImportedReport(report)));
    } catch (error) {
      console.error(error);
      showToast(`Não foi possível ler o arquivo ${file.name}.`);
    }
  }

  state.reportsToApply = imported.filter(report => report.obraId && report.metrosExecutadosDia > 0);
  renderImportPreview();
  $("#applyReportsBtn").disabled = state.reportsToApply.length === 0;
}

function normalizeImportedReport(report) {
  return {
    ...report,
    id: report.id || safeId(),
    obraId: report.obraId || report.obra || report.workId || "",
    obraNome: report.obraNome || report.workName || "",
    fiscal: report.fiscal || report.responsavel || "",
    data: report.data || report.date || todayIso(),
    metrosExecutadosDia: toNumber(report.metrosExecutadosDia ?? report.executadoMetros ?? report.executedMeters ?? report.metros)
  };
}

function renderImportPreview() {
  const preview = $("#importPreview");
  if (!state.reportsToApply.length) {
    preview.innerHTML = `<div class="empty-state">Nenhum apontamento com obra e metros executados foi encontrado.</div>`;
    return;
  }

  const grouped = state.reportsToApply.reduce((acc, report) => {
    acc[report.obraId] = acc[report.obraId] || { count: 0, meters: 0, name: report.obraNome };
    acc[report.obraId].count += 1;
    acc[report.obraId].meters += report.metrosExecutadosDia;
    return acc;
  }, {});

  preview.innerHTML = Object.entries(grouped).map(([obraId, info]) => `
    <div class="import-row">
      <span><strong>${escapeHtml(obraId)}</strong> ${escapeHtml(info.name || "")}</span>
      <span>${info.count} relatório(s) • +${formatMeters(info.meters)}</span>
    </div>
  `).join("");
}

function applyImportedReports() {
  if (!state.reportsToApply.length) return;

  let appliedCount = 0;
  let ignoredCount = 0;
  const works = getWorks();

  state.reportsToApply.forEach(report => {
    const work = works.find(item => item.id === report.obraId);
    if (!work) {
      ignoredCount += 1;
      return;
    }

    work.apontamentosAplicados = work.apontamentosAplicados || [];
    if (work.apontamentosAplicados.includes(report.id)) {
      ignoredCount += 1;
      return;
    }

    work.executadoMetros = toNumber(work.executadoMetros) + toNumber(report.metrosExecutadosDia);
    work.ultimaAtualizacao = report.data || todayIso();
    work.responsavel = report.fiscal || work.responsavel;
    work.apontamentosAplicados.push(report.id);

    const pct = percent(work.executadoMetros, work.metaMetros);
    if (pct >= 100) work.status = "Concluída";
    else if (work.status === "Planejada") work.status = "Em andamento";

    appliedCount += 1;
  });

  saveWorksLocal();
  renderAll();
  showToast(`${appliedCount} apontamento(s) aplicado(s). ${ignoredCount} ignorado(s) por duplicidade ou obra inexistente.`);
  openTab("dashboard");
}

function resetLocalWorks() {
  if (!window.confirm("Remover atualizações locais e voltar ao arquivo data/obras.json do repositório?")) return;
  localStorage.removeItem(STORAGE.works);
  state.worksData = clone(state.baseData || fallbackWorksData);
  renderAll();
  showToast("Base local redefinida para o arquivo do repositório.");
}

function addManualWork() {
  const id = $("#newWorkId").value.trim();
  const nome = $("#newWorkName").value.trim();
  if (!id || !nome) {
    showToast("Informe ID e nome da obra para adicionar.");
    return;
  }

  if (getWorks().some(work => work.id === id)) {
    showToast("Já existe uma obra com este ID.");
    return;
  }

  state.worksData.obras.push({
    id,
    nome,
    frente: $("#newWorkFront").value.trim() || "Infraestrutura",
    tipo: $("#newWorkFront").value.trim() || "Serviço de infraestrutura",
    kmInicio: "",
    kmFim: "",
    metaMetros: toNumber($("#newWorkGoal").value),
    executadoMetros: toNumber($("#newWorkDone").value),
    responsavel: "",
    status: $("#newWorkStatus").value,
    ultimaAtualizacao: todayIso(),
    observacoes: "Adicionada manualmente pelo site.",
    apontamentosAplicados: []
  });

  ["#newWorkId", "#newWorkName", "#newWorkFront", "#newWorkGoal", "#newWorkDone"].forEach(selector => $(selector).value = "");
  saveWorksLocal();
  renderAll();
  showToast("Obra adicionada ao dashboard local. Baixe o obras.json para commitar.");
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", init);
