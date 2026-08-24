(function () {
  "use strict";

  const els = {
    file: document.getElementById("excelFile"),
    fileName: document.getElementById("fileName"),
    analyze: document.getElementById("analyzeBtn"),
    saveImage: document.getElementById("saveImageBtn"),
    print: document.getElementById("printBtn"),
    clear: document.getElementById("clearBtn"),
    help: document.getElementById("helpBtn"),
    helpDialog: document.getElementById("helpDialog"),
    status: document.getElementById("statusBox"),
    validation: document.getElementById("validationMessage"),
    recordsBody: document.getElementById("recordsBody"),
    metrics: {
      entries: document.getElementById("totalEntries"),
      exits: document.getElementById("totalExits"),
      balance: document.getElementById("periodBalance"),
      positiveDays: document.getElementById("positiveDays"),
      negativeDays: document.getElementById("negativeDays"),
      best: document.getElementById("bestBalance"),
      worst: document.getElementById("worstBalance"),
      recordCount: document.getElementById("recordCount")
    },
    balanceCard: document.querySelector(".metric.balance"),
    tooltip: document.getElementById("tooltip")
  };

  const state = {
    file: null,
    analysis: null
  };

  const lineChart = new window.FinanceCharts.FinanceChart(
    document.getElementById("flowChart"),
    "line",
    els.tooltip
  );
  const barChart = new window.FinanceCharts.FinanceChart(
    document.getElementById("resultChart"),
    "bar",
    els.tooltip
  );

  function setStatus(message, mode) {
    els.status.textContent = message;
    els.validation.classList.remove("ok", "warn", "error");
    if (mode) {
      els.validation.classList.add(mode);
    }
  }

  function formatMoney(value) {
    return window.FinanceCharts.currency(value);
  }

  function updateMetrics(summary, recordCount) {
    els.metrics.entries.textContent = formatMoney(summary.entries);
    els.metrics.exits.textContent = formatMoney(summary.exits);
    els.metrics.balance.textContent = formatMoney(summary.balance);
    els.metrics.positiveDays.textContent = String(summary.positiveDays);
    els.metrics.negativeDays.textContent = String(summary.negativeDays);
    els.metrics.best.textContent = summary.best ? `${formatMoney(summary.best.balance)} (${summary.best.label})` : "R$ 0,00";
    els.metrics.worst.textContent = summary.worst ? `${formatMoney(summary.worst.balance)} (${summary.worst.label})` : "R$ 0,00";
    els.metrics.recordCount.textContent = String(recordCount);
    els.balanceCard.classList.toggle("positive", summary.balance >= 0);
    els.balanceCard.classList.toggle("negative", summary.balance < 0);
  }

  function updateValidation(analysis) {
    const messages = [];
    const mode = analysis.validation.status === "ok" && analysis.summary.totalCheck?.matches ? "ok" : "warn";

    if (analysis.summary.totalCheck) {
      messages.push(
        analysis.summary.totalCheck.matches
          ? `Totais conferidos com a linha ${analysis.summary.totalCheck.row} da aba Fluxo.`
          : `Totais calculados divergem da linha ${analysis.summary.totalCheck.row} da aba Fluxo.`
      );
    }
    messages.push(analysis.validation.message);

    els.validation.textContent = messages.join(" ");
    els.validation.classList.remove("ok", "warn", "error");
    els.validation.classList.add(mode);
  }

  function updateTable(records) {
    const recent = records.slice(-18).reverse();
    els.recordsBody.innerHTML = recent.map((record) => `
      <tr>
        <td title="${record.label}">${record.label}</td>
        <td class="num">${formatMoney(record.entries)}</td>
        <td class="num negative-value">${formatMoney(record.exits)}</td>
        <td class="num ${record.balance < 0 ? "negative-value" : "positive-value"}">${formatMoney(record.balance)}</td>
      </tr>
    `).join("");
  }

  function resetAnalysis() {
    state.analysis = null;
    updateMetrics({
      entries: 0,
      exits: 0,
      balance: 0,
      positiveDays: 0,
      negativeDays: 0,
      best: null,
      worst: null
    }, 0);
    els.recordsBody.innerHTML = '<tr><td colspan="4">Nenhuma análise gerada.</td></tr>';
    els.validation.textContent = "Importe uma planilha para iniciar.";
    els.validation.classList.remove("ok", "warn", "error");
    lineChart.draw([]);
    barChart.draw([]);
    els.saveImage.disabled = true;
    els.print.disabled = true;
  }

  async function analyze() {
    if (!state.file) {
      return;
    }

    els.analyze.disabled = true;
    setStatus("Lendo planilha...", null);
    els.validation.textContent = "Processando a aba Fluxo.";
    els.validation.classList.remove("ok", "warn", "error");

    try {
      const analysis = await window.FinanceXlsx.parseWorkbook(state.file);
      state.analysis = analysis;
      updateMetrics(analysis.summary, analysis.records.length);
      updateValidation(analysis);
      updateTable(analysis.records);
      lineChart.draw(analysis.records);
      barChart.draw(analysis.records);
      els.saveImage.disabled = false;
      els.print.disabled = false;
      setStatus(`Análise gerada com ${analysis.records.length} registro(s).`, "ok");
    } catch (error) {
      resetAnalysis();
      els.validation.textContent = error.message || "Nao foi possivel analisar a planilha.";
      els.validation.classList.add("error");
      setStatus("Erro na análise.", "error");
    } finally {
      els.analyze.disabled = !state.file;
    }
  }

  function drawText(ctx, text, x, y, options = {}) {
    ctx.fillStyle = options.color || "#000";
    ctx.font = options.font || "bold 18px Arial";
    ctx.textAlign = options.align || "left";
    ctx.textBaseline = "top";
    ctx.fillText(text, x, y);
  }

  function drawMetric(ctx, title, value, x, y, w, color) {
    ctx.fillStyle = "#fff4d6";
    ctx.strokeStyle = "#c09000";
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, 62);
    ctx.strokeRect(x, y, w, 62);
    drawText(ctx, title, x + 8, y + 8, { font: "bold 13px Arial", color: "#4f3100" });
    drawText(ctx, value, x + 8, y + 28, { font: "bold 18px Arial", color });
  }

  function saveImage() {
    if (!state.analysis) {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 1500;
    canvas.height = 1050;
    const ctx = canvas.getContext("2d");
    const summary = state.analysis.summary;

    ctx.fillStyle = "#f5edd8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#143b63";
    ctx.fillRect(20, 20, 1460, 44);
    drawText(ctx, "PAINEL FINANCEIRO - ENTRADAS, SAIDAS E SALDO", 750, 30, {
      font: "bold 26px Arial",
      color: "#fff",
      align: "center"
    });

    drawMetric(ctx, "TOTAL DE ENTRADAS", formatMoney(summary.entries), 40, 86, 330, "#103d5f");
    drawMetric(ctx, "TOTAL DE SAIDAS", formatMoney(summary.exits), 400, 86, 330, "#cc0000");
    drawMetric(ctx, "SALDO DO PERIODO", formatMoney(summary.balance), 760, 86, 330, summary.balance < 0 ? "#cc0000" : "#006b35");
    drawMetric(ctx, "REGISTROS", String(state.analysis.records.length), 1120, 86, 330, "#103d5f");

    ctx.drawImage(document.getElementById("flowChart"), 40, 180, 1420, 390);
    ctx.drawImage(document.getElementById("resultChart"), 40, 610, 1420, 390);

    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
    link.download = `controle-saldos-cheques-${stamp}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  els.file.addEventListener("change", () => {
    state.file = els.file.files[0] || null;
    els.fileName.textContent = state.file ? state.file.name : "Nenhum arquivo selecionado";
    els.analyze.disabled = !state.file;
    resetAnalysis();
    setStatus(state.file ? "Arquivo selecionado. Clique em Gerar análise." : "Aguardando arquivo Excel.");
  });

  els.analyze.addEventListener("click", analyze);
  els.saveImage.addEventListener("click", saveImage);
  els.print.addEventListener("click", () => window.print());
  els.clear.addEventListener("click", () => {
    els.file.value = "";
    state.file = null;
    els.fileName.textContent = "Nenhum arquivo selecionado";
    els.analyze.disabled = true;
    resetAnalysis();
    setStatus("Aguardando arquivo Excel.");
  });
  els.help.addEventListener("click", () => {
    if (typeof els.helpDialog.showModal === "function") {
      els.helpDialog.showModal();
    } else {
      alert("1. Selecione a planilha.\n2. Clique em Gerar analise.\n3. Confira os graficos.\n4. Salve imagem ou imprima.");
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  resetAnalysis();
}());
