(function () {
  "use strict";

  const COLORS = {
    entries: "#2078d4",
    exits: "#d8332a",
    balance: "#f1b600",
    positive: "#2078d4",
    negative: "#d8332a",
    axis: "#333",
    grid: "#d0d0d0",
    text: "#000",
    background: "#fff"
  };

  function currency(value) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value || 0);
  }

  function niceStep(range) {
    const rough = range / 6;
    const power = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1))));
    const fraction = rough / power;
    if (fraction <= 1) return power;
    if (fraction <= 2) return 2 * power;
    if (fraction <= 5) return 5 * power;
    return 10 * power;
  }

  function bounds(values, includeZero) {
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (includeZero) {
      min = Math.min(min, 0);
      max = Math.max(max, 0);
    }
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const step = niceStep(max - min);
    return {
      min: Math.floor(min / step) * step,
      max: Math.ceil(max / step) * step,
      step
    };
  }

  function setupCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(320, Math.floor(rect.width || canvas.width));
    const height = Math.max(240, Math.floor(rect.height || canvas.height));
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, width, height };
  }

  function labelEvery(count) {
    if (count <= 12) return 1;
    if (count <= 35) return 3;
    if (count <= 70) return 5;
    return Math.ceil(count / 16);
  }

  class FinanceChart {
    constructor(canvas, type, tooltip) {
      this.canvas = canvas;
      this.type = type;
      this.tooltip = tooltip;
      this.records = [];
      this.points = [];
      this.hoverIndex = -1;
      this.canvas.addEventListener("mousemove", (event) => this.onMove(event));
      this.canvas.addEventListener("mouseleave", () => this.hideTooltip());
      window.addEventListener("resize", () => this.draw(this.records));
    }

    draw(records) {
      this.records = records || [];
      this.points = [];
      const { ctx, width, height } = setupCanvas(this.canvas);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, width, height);

      if (!this.records.length) {
        this.drawEmpty(ctx, width, height);
        return;
      }

      if (this.type === "line") {
        this.drawLine(ctx, width, height);
      } else {
        this.drawBars(ctx, width, height);
      }
    }

    chartArea(width, height) {
      return {
        left: 78,
        right: width - 18,
        top: 22,
        bottom: height - 58,
        width: width - 96,
        height: height - 80
      };
    }

    drawEmpty(ctx, width, height) {
      ctx.fillStyle = "#4f3100";
      ctx.font = "bold italic 13px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Importe a planilha e gere a análise.", width / 2, height / 2);
    }

    drawAxes(ctx, area, scale, formatter) {
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.fillStyle = COLORS.text;
      ctx.font = "11px Arial";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";

      for (let value = scale.min; value <= scale.max + scale.step / 2; value += scale.step) {
        const y = area.bottom - ((value - scale.min) / (scale.max - scale.min)) * area.height;
        ctx.beginPath();
        ctx.moveTo(area.left, y);
        ctx.lineTo(area.right, y);
        ctx.stroke();
        ctx.fillText(formatter(value), area.left - 6, y);
      }

      ctx.strokeStyle = COLORS.axis;
      ctx.beginPath();
      ctx.moveTo(area.left, area.top);
      ctx.lineTo(area.left, area.bottom);
      ctx.lineTo(area.right, area.bottom);
      ctx.stroke();
    }

    drawLabels(ctx, area) {
      const every = labelEvery(this.records.length);
      ctx.save();
      ctx.fillStyle = COLORS.text;
      ctx.font = "10px Arial";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let i = 0; i < this.records.length; i += every) {
        const x = area.left + (i / Math.max(this.records.length - 1, 1)) * area.width;
        ctx.save();
        ctx.translate(x, area.bottom + 8);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(this.records[i].label, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }

    drawLegend(ctx, items, width, y) {
      let x = width / 2 - items.length * 54;
      ctx.font = "11px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      for (const item of items) {
        ctx.fillStyle = item.color;
        ctx.fillRect(x, y - 5, 10, 10);
        ctx.fillStyle = COLORS.text;
        ctx.fillText(item.label, x + 14, y);
        x += 108;
      }
    }

    yFor(area, scale, value) {
      return area.bottom - ((value - scale.min) / (scale.max - scale.min)) * area.height;
    }

    drawLine(ctx, width, height) {
      const area = this.chartArea(width, height);
      const allValues = this.records.flatMap((record) => [record.entries, record.exits]);
      const scale = bounds(allValues, true);
      this.drawAxes(ctx, area, scale, (value) => currency(value).replace(",00", ""));
      this.drawLabels(ctx, area);

      const drawSeries = (key, color) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        this.records.forEach((record, index) => {
          const x = area.left + (index / Math.max(this.records.length - 1, 1)) * area.width;
          const y = this.yFor(area, scale, record[key]);
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          this.points.push({ index, series: key, x, y });
        });
        ctx.stroke();
      };

      drawSeries("entries", COLORS.entries);
      drawSeries("exits", COLORS.exits);
      this.drawLegend(ctx, [
        { label: "Entradas", color: COLORS.entries },
        { label: "Saídas", color: COLORS.exits }
      ], width, height - 18);

      this.drawHover(ctx);
    }

    drawBars(ctx, width, height) {
      const area = this.chartArea(width, height);
      const allValues = this.records.flatMap((record) => [record.entries, record.exits, record.balance]);
      const scale = bounds(allValues, true);
      this.drawAxes(ctx, area, scale, (value) => currency(value).replace(",00", ""));
      this.drawLabels(ctx, area);

      const zeroY = this.yFor(area, scale, 0);
      const slot = area.width / this.records.length;
      const barWidth = Math.max(2, Math.min(9, slot / 4));
      this.points = [];

      this.records.forEach((record, index) => {
        const center = area.left + index * slot + slot / 2;
        const bars = [
          { key: "entries", value: record.entries, color: COLORS.entries, x: center - barWidth * 1.35 },
          { key: "exits", value: record.exits, color: COLORS.exits, x: center },
          { key: "balance", value: record.balance, color: record.balance >= 0 ? COLORS.balance : COLORS.negative, x: center + barWidth * 1.35 }
        ];

        for (const bar of bars) {
          const y = this.yFor(area, scale, bar.value);
          const top = Math.min(y, zeroY);
          const h = Math.max(1, Math.abs(zeroY - y));
          ctx.fillStyle = bar.color;
          ctx.fillRect(bar.x - barWidth / 2, top, barWidth, h);
        }

        this.points.push({ index, series: "all", x: center, y: this.yFor(area, scale, record.balance) });
      });

      ctx.strokeStyle = COLORS.axis;
      ctx.beginPath();
      ctx.moveTo(area.left, zeroY);
      ctx.lineTo(area.right, zeroY);
      ctx.stroke();

      this.drawLegend(ctx, [
        { label: "Entradas", color: COLORS.entries },
        { label: "Saídas", color: COLORS.exits },
        { label: "Saldo", color: COLORS.balance }
      ], width, height - 18);

      this.drawHover(ctx);
    }

    drawHover(ctx) {
      if (this.hoverIndex < 0 || !this.records[this.hoverIndex]) {
        return;
      }
      const hoverPoints = this.points.filter((point) => point.index === this.hoverIndex);
      ctx.save();
      ctx.strokeStyle = "#111";
      ctx.fillStyle = "#111";
      ctx.lineWidth = 1;
      hoverPoints.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    onMove(event) {
      if (!this.records.length) {
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const area = this.chartArea(rect.width, rect.height);
      const ratio = Math.min(Math.max((x - area.left) / area.width, 0), 1);
      const index = Math.round(ratio * (this.records.length - 1));
      this.hoverIndex = index;
      this.draw(this.records);
      this.showTooltip(event, this.records[index]);
    }

    showTooltip(event, record) {
      this.tooltip.hidden = false;
      this.tooltip.innerHTML = `
        <strong>${record.label}</strong><br>
        Entradas: ${currency(record.entries)}<br>
        Saídas: ${currency(record.exits)}<br>
        Saldo: ${currency(record.balance)}
      `;
      const x = Math.min(event.clientX + 14, window.innerWidth - this.tooltip.offsetWidth - 8);
      const y = Math.min(event.clientY + 14, window.innerHeight - this.tooltip.offsetHeight - 8);
      this.tooltip.style.left = `${x}px`;
      this.tooltip.style.top = `${y}px`;
    }

    hideTooltip() {
      this.hoverIndex = -1;
      this.tooltip.hidden = true;
      this.draw(this.records);
    }
  }

  window.FinanceCharts = {
    FinanceChart,
    currency
  };
}());
