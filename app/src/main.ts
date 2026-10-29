// @ts-nocheck -- migração progressiva da camada DOM; os cálculos ficam tipados em graph-model.ts.
import {
  parseLocaleNumber as parseNumber,
  validateMeasurementRows,
  groupConsecutiveSegments as makeSegments,
  calculateSlopes as getSlopes,
  niceAxisStep as niceStep,
  createAxisTicks as ticks
} from "./graph-model";
import "./style.css";
import "./a11y";
import "./pwa";


    "use strict";
    (function () {
      var COLORS = ["#087eaa", "#c44555", "#26836d", "#7856b5", "#d17a17", "#3972c6", "#a43b87", "#617d32"];
      var points = [
        { series: "Série A", volume: "", ph: "" },
        { series: "Série A", volume: "", ph: "" },
        { series: "Série A", volume: "", ph: "" }
      ];
      var currentView = "curve";
      var rowsEl = document.getElementById("point-rows");
      var chartHost = document.getElementById("chart-host");
      var legendEl = document.getElementById("series-legend");
      var validationEl = document.getElementById("validation");
      var downloadSvgButton = document.getElementById("download-svg");
      var chartTitle = document.getElementById("chart-title");
      var chartExplanation = document.getElementById("chart-explanation");
      var seriesColorsEl = document.getElementById("series-colors");
      var settingsStatusEl = document.getElementById("settings-status");
      var settingsWarnings = [];
      var seriesColors = {};
      var colorNamesSignature = "";
      var undoButton = document.getElementById("undo-action");
      var redoButton = document.getElementById("redo-action");
      var draftStatusEl = document.getElementById("draft-status");
      var draftStatusTextEl = document.getElementById("draft-status-text");
      var historyStatusEl = document.getElementById("history-status");
      var undoStack = [];
      var redoStack = [];
      var HISTORY_LIMIT = 100;
      var pendingUndoSnapshot = null;
      var historyTimer = null;
      var committedSnapshot = null;
      var PANEL_STORAGE_KEY = "graficos_investigacao_panels_v1";
      var PANEL_IDS = ["data-panel", "chart-panel", "series-colors-details", "customization", "csv-import-help"];
      var SETTINGS_IDS = [
        "cfg-curve-title", "cfg-curve-x-label", "cfg-curve-y-label",
        "cfg-curve-x-min", "cfg-curve-x-max", "cfg-curve-x-step",
        "cfg-curve-y-min", "cfg-curve-y-max", "cfg-curve-y-step",
        "cfg-curve-grid", "cfg-curve-lines", "cfg-curve-markers",
        "cfg-derivative-title", "cfg-derivative-x-label", "cfg-derivative-y-label",
        "cfg-derivative-x-min", "cfg-derivative-x-max", "cfg-derivative-x-step",
        "cfg-derivative-y-min", "cfg-derivative-y-max", "cfg-derivative-y-step",
        "cfg-derivative-grid", "cfg-derivative-lines", "cfg-derivative-markers", "cfg-decimals"
      ];
      var W = 880, H = 500;
      var M = { left: 78, right: 28, top: 42, bottom: 76 };
      function updateChartDimensions() {
        var available = chartHost.clientWidth || 880;
        W = Math.max(330, Math.min(1200, Math.floor(available)));
        H = W < 560 ? Math.max(340, Math.min(400, Math.round(W * 0.98))) : Math.round(W * 500 / 880);
        M = W < 560 ? { left: 52, right: 18, top: 45, bottom: 70 } : { left: 78, right: 28, top: 46, bottom: 76 };
      }

      function escapeHTML(value) {
        return String(value == null ? "" : value)
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
      }
      function displayDigits() {
        var value = Number(document.getElementById("cfg-decimals").value);
        return Number.isInteger(value) && value >= 3 && value <= 6 ? value : 3;
      }
      function formatNumber(value, digits) {
        if (!Number.isFinite(value)) return "—";
        return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits == null ? displayDigits() : digits }).format(value);
      }
      function nonEmpty(point) {
        return String(point.volume).trim() !== "" || String(point.ph).trim() !== "";
      }
      function getPointState() {
        return validateMeasurementRows(points);
      }
      function renderRows() {
        var names = currentSeriesNames();
        rowsEl.innerHTML = points.map(function (point, index) {
          var seriesName = String(point.series || "").trim() || "Série A";
          var color = colorFor(seriesName, names);
          var paddedIndex = String(index + 1).padStart(2, "0");
          return '<tr data-index="' + index + '">' +
            '<td class="row-index-cell" data-label="Nº"><span class="row-index" aria-label="Ponto ' + (index + 1) + '">' + paddedIndex + '</span></td>' +
            '<td data-label="Série / amostra"><div class="series-edit"><span class="series-swatch" data-series-swatch aria-hidden="true" style="background-color:' + color + '"></span><label class="series-input-wrap"><span class="visually-hidden">Nome da série do ponto ' + (index + 1) + '</span>' +
            '<input class="series-input" id="series-' + index + '" type="text" data-field="series" maxlength="60" value="' + escapeHTML(point.series) + '" placeholder="Ex.: Amostra A" aria-label="Série do ponto ' + (index + 1) + '"></label></div></td>' +
            '<td class="numeric-cell" data-label="Volume (mL)"><label class="visually-hidden" for="volume-' + index + '">Volume do ponto ' + (index + 1) + '</label>' +
            '<input class="numeric-input" id="volume-' + index + '" type="text" inputmode="decimal" autocomplete="off" data-field="volume" value="' + escapeHTML(point.volume) + '" placeholder="0,000" aria-describedby="data-precision-note" aria-label="Volume em mL do ponto ' + (index + 1) + '"></td>' +
            '<td class="numeric-cell" data-label="pH"><label class="visually-hidden" for="ph-' + index + '">pH do ponto ' + (index + 1) + '</label>' +
            '<input class="numeric-input" id="ph-' + index + '" type="text" inputmode="decimal" autocomplete="off" data-field="ph" value="' + escapeHTML(point.ph) + '" placeholder="7,000" aria-describedby="data-precision-note" aria-label="pH do ponto ' + (index + 1) + '"></td>' +
            '<td data-label="Ação"><button type="button" class="remove-btn quiet" data-remove="' + index + '" aria-label="Remover ponto ' + (index + 1) + '" title="Remover ponto">×</button></td>' +
            '</tr>';
        }).join("");
      }
      function settingValue(id) {
        var element = document.getElementById(id);
        var raw = element ? String(element.value || "").trim() : "";
        if (!raw) return null;
        return parseNumber(raw);
      }
      function autoUpper(values, minimum) {
        var actualMax = values.length ? Math.max.apply(null, values) : minimum + 1;
        var range = Math.max(actualMax - minimum, 0.001);
        var step = niceStep(range, 6);
        var max = Math.ceil((actualMax - minimum) / step) * step + minimum;
        if (max <= minimum) max = minimum + step;
        return Number(max.toFixed(9));
      }
      function makeAxis(prefix, axisName, automaticMin, automaticMax, target, minAllowed) {
        var minId = "cfg-" + prefix + "-" + axisName + "-min";
        var maxId = "cfg-" + prefix + "-" + axisName + "-max";
        var stepId = "cfg-" + prefix + "-" + axisName + "-step";
        var rawMinText = document.getElementById(minId).value.trim();
        var rawMaxText = document.getElementById(maxId).value.trim();
        var rawStepText = document.getElementById(stepId).value.trim();
        var rawMin = settingValue(minId), rawMax = settingValue(maxId), rawStep = settingValue(stepId);
        var min = rawMinText === "" ? automaticMin : rawMin;
        var max = rawMaxText === "" ? automaticMax : rawMax;
        if (rawMinText !== "" && (rawMin === null || !Number.isFinite(rawMin))) {
          settingsWarnings.push("O início do eixo " + axisName.toUpperCase() + " de " + prefix + " não é numérico; usei o automático.");
          min = automaticMin;
        }
        if (rawMaxText !== "" && (rawMax === null || !Number.isFinite(rawMax))) {
          settingsWarnings.push("O fim do eixo " + axisName.toUpperCase() + " de " + prefix + " não é numérico; usei o automático.");
          max = automaticMax;
        }
        if (minAllowed != null && min < minAllowed) {
          settingsWarnings.push("O início do eixo " + axisName.toUpperCase() + " não pode ser menor que " + formatNumber(minAllowed, 3) + "; usei o limite permitido.");
          min = minAllowed;
        }
        if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
          settingsWarnings.push("A faixa do eixo " + axisName.toUpperCase() + " de " + prefix + " precisa ter mínimo menor que máximo; usei o ajuste automático.");
          min = automaticMin;
          max = automaticMax;
        }
        var step = null;
        if (rawStepText !== "") {
          if (rawStep === null || !Number.isFinite(rawStep) || rawStep < 0.001) {
            settingsWarnings.push("O intervalo do eixo " + axisName.toUpperCase() + " precisa ser de pelo menos 0,001; usei o automático.");
          } else {
            step = rawStep;
          }
        }
        if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
          min = 0;
          max = 1;
        }
        var automaticStep = niceStep(max - min, target || 6);
        if (step == null) step = automaticStep;
        if ((max - min) / step > 120) {
          if (rawStepText !== "") settingsWarnings.push("O intervalo solicitado no eixo " + axisName.toUpperCase() + " de " + prefix + " criaria mais de 120 marcações; aumentei o intervalo visual para " + formatNumber(automaticStep, displayDigits()) + " para manter o gráfico legível.");
          step = automaticStep;
        }
        return { min: min, max: max, step: step, ticks: ticks(min, max, step) };
      }
      function getGraphConfig(view, values) {
        var prefix = view === "curve" ? "curve" : "derivative";
        var title = document.getElementById("cfg-" + prefix + "-title").value.trim();
        var xLabel = document.getElementById("cfg-" + prefix + "-x-label").value.trim();
        var yLabel = document.getElementById("cfg-" + prefix + "-y-label").value.trim();
        var volumes = values.map(function (point) { return point.volume; });
        var autoXMax = autoUpper(volumes, 0);
        var autoYMin = 0, autoYMax = 14;
        if (view === "derivative" && values.length) {
          var slopes = values.map(function (point) { return point.slope; });
          var minSlope = Math.min.apply(null, slopes), maxSlope = Math.max.apply(null, slopes);
          var delta = maxSlope - minSlope;
          var padding = delta > 0 ? delta * 0.12 : Math.max(0.1, Math.abs(maxSlope) * 0.15);
          autoYMin = Math.min(0, minSlope - padding);
          autoYMax = Math.max(0, maxSlope + padding);
          if (autoYMax - autoYMin < 0.001) { autoYMin = -1; autoYMax = 1; }
        }
        return {
          title: title || (view === "curve" ? "pH medido por volume adicionado" : "Variação de pH por volume"),
          xLabel: xLabel || (view === "curve" ? "Volume adicionado (mL)" : "Volume final do intervalo (mL)"),
          yLabel: yLabel || (view === "curve" ? "pH medido" : "ΔpH/ΔV (pH/mL)"),
          grid: document.getElementById("cfg-" + prefix + "-grid").checked,
          lines: document.getElementById("cfg-" + prefix + "-lines").checked,
          markers: document.getElementById("cfg-" + prefix + "-markers").checked,
          x: makeAxis(prefix, "x", 0, autoXMax, 6, 0),
          y: makeAxis(prefix, "y", autoYMin, autoYMax, 6, null)
        };
      }
      function colorFor(seriesName, names) {
        var custom = seriesColors[seriesName];
        if (typeof custom === "string" && /^#[0-9a-f]{6}$/i.test(custom)) return custom;
        var index = names.indexOf(seriesName);
        return COLORS[(index < 0 ? 0 : index) % COLORS.length];
      }
      function currentSeriesNames() {
        var names = [];
        points.forEach(function (point) {
          var name = String(point.series || "").trim() || "Série A";
          if (names.indexOf(name) < 0) names.push(name);
        });
        return names;
      }
      function syncSeriesColorControls() {
        var names = currentSeriesNames();
        var signature = JSON.stringify(names);
        if (signature === colorNamesSignature) return;
        colorNamesSignature = signature;
        if (!names.length) {
          seriesColorsEl.innerHTML = '<p class="hint">As cores aparecerão quando os dados forem preenchidos.</p>';
          return;
        }
        seriesColorsEl.innerHTML = names.map(function (name, index) {
          var color = colorFor(name, names);
          return '<div class="series-color-item"><label for="series-color-' + index + '">' + escapeHTML(name) + '</label><input type="color" id="series-color-' + index + '" data-series-color="' + escapeHTML(name) + '" value="' + color + '" aria-label="Cor da série ' + escapeHTML(name) + '"></div>';
        }).join("");
      }
      function seriesNames(segments) {
        var names = [];
        segments.forEach(function (segment) {
          if (names.indexOf(segment.series) < 0) names.push(segment.series);
        });
        return names;
      }
      function buildLegend(names) {
        legendEl.innerHTML = names.map(function (name) {
          return '<span class="legend-item"><span class="legend-swatch" style="background:' + colorFor(name, names) + '"></span><span>' + escapeHTML(name) + '</span></span>';
        }).join("");
      }
      function svgStart(label) {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + escapeHTML(label) + '">' +
          '<title>' + escapeHTML(label) + '</title><rect width="' + W + '" height="' + H + '" fill="#ffffff"/>' +
          '<style>text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif} .grid{stroke:#dce4eb;stroke-width:1} .axis{stroke:#425467;stroke-width:1.4} .tick{fill:#324659;font-size:12px} .axis-label{fill:#1b2b3a;font-size:13px;font-weight:650} .plot-title{fill:#172b3d;font-size:18px;font-weight:700}</style>' +
          '<text class="plot-title" x="' + (W / 2) + '" y="25" text-anchor="middle">' + escapeHTML(label) + '</text>';
      }
      function pathFor(pointsToDraw, x, y) {
        return pointsToDraw.map(function (point) {
          return x(point.volume).toFixed(2) + "," + y(point.ph).toFixed(2);
        }).join(" ");
      }
      function emptyMessage(title, message) {
        chartHost.innerHTML = '<div class="empty-state"><strong>' + escapeHTML(title) + '</strong><p>' + escapeHTML(message) + '</p></div>';
        downloadSvgButton.disabled = true;
        legendEl.innerHTML = "";
      }
      function renderCurve(segments, validPoints) {
        var derived = validPoints.map(function (point) { return { series: point.series, volume: point.volume, ph: point.ph }; });
        var config = getGraphConfig("curve", derived);
        if (!validPoints.length) {
          emptyMessage("O gráfico aparecerá aqui", "Preencha volume e pH em pelo menos uma linha para mostrar os pontos informados.");
          chartTitle.textContent = config.title;
          chartExplanation.textContent = "O gráfico conecta apenas os pontos digitados. Não há curva prevista nem valores calculados automaticamente.";
          return;
        }
        var plotW = W - M.left - M.right, plotH = H - M.top - M.bottom;
        var x = function (value) { return M.left + ((value - config.x.min) / (config.x.max - config.x.min)) * plotW; };
        var y = function (value) { return M.top + (1 - ((value - config.y.min) / (config.y.max - config.y.min))) * plotH; };
        var svg = svgStart(config.title);
        svg += '<defs><clipPath id="plot-clip"><rect x="' + M.left + '" y="' + M.top + '" width="' + plotW + '" height="' + plotH + '"/></clipPath></defs>';
        config.y.ticks.forEach(function (value) {
          if (config.grid) svg += '<line class="grid" x1="' + M.left + '" y1="' + y(value) + '" x2="' + (W - M.right) + '" y2="' + y(value) + '"/>';
          svg += '<text class="tick" x="' + (M.left - 12) + '" y="' + (y(value) + 4) + '" text-anchor="end">' + formatNumber(value) + '</text>';
        });
        config.x.ticks.forEach(function (value) {
          var xx = x(value);
          if (config.grid) svg += '<line class="grid" x1="' + xx + '" y1="' + M.top + '" x2="' + xx + '" y2="' + (H - M.bottom) + '"/>';
          svg += '<text class="tick" x="' + xx + '" y="' + (H - M.bottom + 22) + '" text-anchor="middle">' + formatNumber(value) + '</text>';
        });
        svg += '<line class="axis" x1="' + M.left + '" y1="' + M.top + '" x2="' + M.left + '" y2="' + (H - M.bottom) + '"/>';
        svg += '<line class="axis" x1="' + M.left + '" y1="' + (H - M.bottom) + '" x2="' + (W - M.right) + '" y2="' + (H - M.bottom) + '"/>';
        svg += '<text class="axis-label" x="' + (M.left + plotW / 2) + '" y="' + (H - 18) + '" text-anchor="middle">' + escapeHTML(config.xLabel) + '</text>';
        svg += '<text class="axis-label" x="22" y="' + (M.top + plotH / 2) + '" transform="rotate(-90 22 ' + (M.top + plotH / 2) + ')" text-anchor="middle">' + escapeHTML(config.yLabel) + '</text>';
        var names = seriesNames(segments);
        svg += '<g clip-path="url(#plot-clip)">';
        segments.forEach(function (segment) {
          var color = colorFor(segment.series, names);
          if (config.lines && segment.points.length > 1) {
            var coords = segment.points.map(function (point) { return x(point.volume).toFixed(3) + "," + y(point.ph).toFixed(3); }).join(" ");
            svg += '<polyline points="' + coords + '" fill="none" stroke="' + color + '" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>';
          }
          if (config.markers) segment.points.forEach(function (point) {
            var tip = segment.series + " · " + formatNumber(point.volume) + " mL · pH " + formatNumber(point.ph);
            svg += '<circle cx="' + x(point.volume).toFixed(3) + '" cy="' + y(point.ph).toFixed(3) + '" r="4.5" fill="' + color + '" stroke="#ffffff" stroke-width="1.5"><title>' + escapeHTML(tip) + '</title></circle>';
          });
        });
        svg += '</g></svg>';
        chartHost.innerHTML = svg;
        downloadSvgButton.disabled = false;
        buildLegend(names);
        chartTitle.textContent = config.title;
        chartExplanation.textContent = "Pontos inseridos; a linha apenas conecta leituras. Pontos fora dos limites não aparecem.";
      }
      function renderDerivative(segments) {
        var slopes = getSlopes(segments);
        var config = getGraphConfig("derivative", slopes);
        if (!slopes.length) {
          emptyMessage("Ainda não há variações calculáveis", "Informe ao menos duas leituras válidas, na mesma sequência, com volumes diferentes. A ferramenta calcula ΔpH/ΔV entre pontos consecutivos.");
          chartTitle.textContent = config.title;
          chartExplanation.textContent = "ΔpH/ΔV usa duas leituras consecutivas, em pH/mL. Valores negativos indicam queda do pH.";
          return;
        }
        var plotW = W - M.left - M.right, plotH = H - M.top - M.bottom;
        var x = function (value) { return M.left + ((value - config.x.min) / (config.x.max - config.x.min)) * plotW; };
        var y = function (value) { return M.top + (1 - ((value - config.y.min) / (config.y.max - config.y.min))) * plotH; };
        var svg = svgStart(config.title);
        svg += '<defs><clipPath id="plot-clip"><rect x="' + M.left + '" y="' + M.top + '" width="' + plotW + '" height="' + plotH + '"/></clipPath></defs>';
        config.y.ticks.forEach(function (value) {
          if (config.grid) svg += '<line class="grid" x1="' + M.left + '" y1="' + y(value) + '" x2="' + (W - M.right) + '" y2="' + y(value) + '"/>';
          svg += '<text class="tick" x="' + (M.left - 12) + '" y="' + (y(value) + 4) + '" text-anchor="end">' + formatNumber(value) + '</text>';
        });
        config.x.ticks.forEach(function (value) {
          var xx = x(value);
          if (config.grid) svg += '<line class="grid" x1="' + xx + '" y1="' + M.top + '" x2="' + xx + '" y2="' + (H - M.bottom) + '"/>';
          svg += '<text class="tick" x="' + xx + '" y="' + (H - M.bottom + 22) + '" text-anchor="middle">' + formatNumber(value) + '</text>';
        });
        svg += '<line class="axis" x1="' + M.left + '" y1="' + M.top + '" x2="' + M.left + '" y2="' + (H - M.bottom) + '"/>';
        svg += '<line class="axis" x1="' + M.left + '" y1="' + (H - M.bottom) + '" x2="' + (W - M.right) + '" y2="' + (H - M.bottom) + '"/>';
        svg += '<g clip-path="url(#plot-clip)">';
        if (config.y.min <= 0 && config.y.max >= 0) {
          svg += '<line x1="' + M.left + '" y1="' + y(0) + '" x2="' + (W - M.right) + '" y2="' + y(0) + '" stroke="#6d7e8c" stroke-width="1.6" stroke-dasharray="6 4"/>';
        }
        var names = [];
        slopes.forEach(function (point) { if (names.indexOf(point.series) < 0) names.push(point.series); });
        names.forEach(function (name) {
          var seriesPoints = slopes.filter(function (point) { return point.series === name; });
          var color = colorFor(name, names);
          if (config.lines && seriesPoints.length > 1) {
            svg += '<polyline points="' + seriesPoints.map(function (point) { return x(point.volume).toFixed(3) + "," + y(point.slope).toFixed(3); }).join(" ") + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
          }
          if (config.markers) seriesPoints.forEach(function (point) {
            var tip = point.series + " · " + formatNumber(point.fromVolume) + "–" + formatNumber(point.toVolume) + " mL · ΔpH/ΔV = " + formatNumber(point.slope);
            svg += '<circle cx="' + x(point.volume).toFixed(3) + '" cy="' + y(point.slope).toFixed(3) + '" r="4.5" fill="' + color + '" stroke="#ffffff" stroke-width="1.5"><title>' + escapeHTML(tip) + '</title></circle>';
          });
        });
        svg += '</g>';
        svg += '<text class="axis-label" x="' + (M.left + plotW / 2) + '" y="' + (H - 18) + '" text-anchor="middle">' + escapeHTML(config.xLabel) + '</text>';
        svg += '<text class="axis-label" x="22" y="' + (M.top + plotH / 2) + '" transform="rotate(-90 22 ' + (M.top + plotH / 2) + ')" text-anchor="middle">' + escapeHTML(config.yLabel) + '</text>';
        svg += "</svg>";
        chartHost.innerHTML = svg;
        downloadSvgButton.disabled = false;
        buildLegend(names);
        chartTitle.textContent = config.title;
        chartExplanation.textContent = "ΔpH/ΔV é calculado entre leituras consecutivas. Valores negativos indicam queda do pH.";
      }
      function renderAll() {
        var state = getPointState();
        var valid = state.valid;
        var segments = makeSegments(valid);
        var slopes = getSlopes(segments);
        settingsWarnings = [];
        updateChartDimensions();
        syncSeriesColorControls();
        document.getElementById("stat-points").textContent = String(valid.length);
        if (valid.length) {
          var phValues = valid.map(function (point) { return point.ph; });
          document.getElementById("stat-range").textContent = formatNumber(Math.min.apply(null, phValues)) + "–" + formatNumber(Math.max.apply(null, phValues));
        } else {
          document.getElementById("stat-range").textContent = "—";
        }
        document.getElementById("stat-slopes").textContent = String(slopes.length);
        var messages = [];
        if (state.incomplete) messages.push(state.incomplete + (state.incomplete === 1 ? " linha incompleta não exibida" : " linhas incompletas não exibidas"));
        if (state.invalid) messages.push(state.invalid + (state.invalid === 1 ? " linha com valor fora do intervalo" : " linhas com valores fora do intervalo"));
        if (!valid.length && !messages.length) messages.push("Preencha volume e pH para inserir pontos no gráfico.");
        validationEl.textContent = messages.length ? messages.join(". ") + "." : valid.length + (valid.length === 1 ? " ponto válido." : " pontos válidos.") + " Os dados são plotados exatamente como informados.";
        validationEl.classList.toggle("warn", state.invalid > 0);
        validationEl.dataset.state = state.invalid > 0 ? "warning" : valid.length > 0 ? "ready" : state.incomplete > 0 ? "warning" : "empty";
        document.getElementById("data-row-count").textContent = String(points.length);
        document.getElementById("data-valid-count").textContent = String(valid.length);
        var namesWithData = [];
        valid.forEach(function (point) { if (namesWithData.indexOf(point.series) < 0) namesWithData.push(point.series); });
        document.getElementById("data-series-count").textContent = String(namesWithData.length);
        var reviewCount = state.incomplete + state.invalid;
        document.getElementById("data-review-count").textContent = String(reviewCount);
        document.getElementById("data-review-card").dataset.state = reviewCount > 0 ? "alert" : "normal";
        var activeNames = currentSeriesNames();
        rowsEl.querySelectorAll("[data-series-swatch]").forEach(function (swatch) {
          var row = swatch.closest("tr");
          var index = Number(row && row.getAttribute("data-index"));
          var name = points[index] ? (String(points[index].series || "").trim() || "Série A") : "Série A";
          swatch.style.backgroundColor = colorFor(name, activeNames);
        });
        rowsEl.querySelectorAll("tr").forEach(function (row, index) {
          var point = points[index];
          ["volume", "ph"].forEach(function (field) {
            var input = row.querySelector('[data-field="' + field + '"]');
            if (!input) return;
            var value = parseNumber(point[field]);
            var invalid = value !== null && (Number.isNaN(value) || (field === "volume" ? value < 0 : value < 0 || value > 14));
            input.setAttribute("aria-invalid", invalid ? "true" : "false");
          });
        });
        if (currentView === "curve") renderCurve(segments, valid);
        else renderDerivative(segments);
        settingsStatusEl.textContent = (settingsWarnings.length ? settingsWarnings.join(" ") + " " : "") +
          "Faixas e valores aceitam resolução de 0,001. As marcações automáticas se adaptam à faixa; intervalos que gerariam mais de 120 marcações são ampliados para legibilidade.";
        settingsStatusEl.classList.toggle("warn", settingsWarnings.length > 0);
        scheduleDraftSave();
      }

      // Rascunho local: dados, cores e personalizações permanecem neste navegador.
      var DRAFT_KEY = "graficos_investigacao_draft_v1";
      var draftSaveTimer = null;
      function collectSettings() {
        var values = {};
        SETTINGS_IDS.forEach(function (id) {
          var element = document.getElementById(id);
          if (!element) return;
          values[id] = element.type === "checkbox" ? element.checked : element.value;
        });
        return values;
      }
      function cloneState(value) {
        return JSON.parse(JSON.stringify(value));
      }
      function captureEditorState() {
        return {
          points: points.map(function (point) {
            return { series: String(point.series || ""), volume: String(point.volume || ""), ph: String(point.ph || "") };
          }),
          currentView: currentView,
          seriesColors: Object.assign({}, seriesColors),
          settings: collectSettings()
        };
      }
      function snapshotKey(snapshot) {
        return JSON.stringify(snapshot);
      }
      function syncHistoryControls() {
        if (undoButton) undoButton.disabled = undoStack.length === 0 && !pendingUndoSnapshot;
        if (redoButton) redoButton.disabled = redoStack.length === 0;
        if (historyStatusEl) {
          historyStatusEl.textContent = pendingUndoSnapshot || undoStack.length
            ? "Há alterações disponíveis no histórico."
            : "Histórico de alterações vazio.";
        }
      }
      function pushUndoSnapshot(stack, snapshot) {
        var last = stack.length ? stack[stack.length - 1] : null;
        if (last && snapshotKey(last) === snapshotKey(snapshot)) return;
        stack.push(cloneState(snapshot));
        if (stack.length > HISTORY_LIMIT) stack.splice(0, stack.length - HISTORY_LIMIT);
      }
      function flushHistoryCheckpoint() {
        if (historyTimer !== null) {
          window.clearTimeout(historyTimer);
          historyTimer = null;
        }
        if (!pendingUndoSnapshot) {
          syncHistoryControls();
          return;
        }
        var current = captureEditorState();
        if (snapshotKey(pendingUndoSnapshot) !== snapshotKey(current)) {
          pushUndoSnapshot(undoStack, pendingUndoSnapshot);
          redoStack = [];
        }
        pendingUndoSnapshot = null;
        committedSnapshot = cloneState(current);
        syncHistoryControls();
      }
      function scheduleHistoryCheckpoint() {
        if (!pendingUndoSnapshot) pendingUndoSnapshot = cloneState(committedSnapshot || captureEditorState());
        if (historyTimer !== null) window.clearTimeout(historyTimer);
        historyTimer = window.setTimeout(flushHistoryCheckpoint, 650);
        syncHistoryControls();
      }
      function recordUndoCheckpoint() {
        flushHistoryCheckpoint();
        pushUndoSnapshot(undoStack, captureEditorState());
        redoStack = [];
        syncHistoryControls();
      }
      function settleHistoryBaseline() {
        if (historyTimer !== null) window.clearTimeout(historyTimer);
        historyTimer = null;
        pendingUndoSnapshot = null;
        committedSnapshot = cloneState(captureEditorState());
        syncHistoryControls();
      }
      function applyEditorState(snapshot) {
        points = cloneState(snapshot.points || []);
        if (!points.length) points = [{ series: "Série A", volume: "", ph: "" }];
        currentView = snapshot.currentView === "derivative" ? "derivative" : "curve";
        seriesColors = Object.assign({}, snapshot.seriesColors || {});
        SETTINGS_IDS.forEach(function (id) {
          if (!Object.prototype.hasOwnProperty.call(snapshot.settings || {}, id)) return;
          var element = document.getElementById(id);
          if (!element) return;
          var value = snapshot.settings[id];
          if (element.type === "checkbox") element.checked = value === true;
          else element.value = String(value == null ? "" : value);
        });
        colorNamesSignature = "";
        document.querySelectorAll("[data-view]").forEach(function (tab) {
          tab.setAttribute("aria-selected", tab.getAttribute("data-view") === currentView ? "true" : "false");
        });
        renderRows();
        renderAll();
        settleHistoryBaseline();
      }
      function undoChange() {
        flushHistoryCheckpoint();
        if (!undoStack.length) return;
        var current = captureEditorState();
        var previous = undoStack.pop();
        pushUndoSnapshot(redoStack, current);
        applyEditorState(previous);
        syncHistoryControls();
      }
      function redoChange() {
        flushHistoryCheckpoint();
        if (!redoStack.length) return;
        var current = captureEditorState();
        var next = redoStack.pop();
        pushUndoSnapshot(undoStack, current);
        applyEditorState(next);
        syncHistoryControls();
      }
      function setDraftStatus(message, state) {
        if (draftStatusEl) draftStatusEl.dataset.state = state || "saved";
        if (draftStatusTextEl) draftStatusTextEl.textContent = message;
      }
      function savePanelStates() {
        try {
          var state = {};
          PANEL_IDS.forEach(function (id) {
            var panel = document.getElementById(id);
            if (panel instanceof HTMLDetailsElement) state[id] = panel.open;
          });
          localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
          // As áreas recolhíveis continuam funcionais sem armazenamento de preferências.
        }
      }
      function restorePanelStates() {
        try {
          var saved = JSON.parse(localStorage.getItem(PANEL_STORAGE_KEY) || "{}");
          PANEL_IDS.forEach(function (id) {
            var panel = document.getElementById(id);
            if (panel instanceof HTMLDetailsElement && typeof saved[id] === "boolean") panel.open = saved[id];
          });
        } catch (error) {
          // Mantém os estados padrão declarados no HTML.
        }
      }
      function setupPanelDisclosures() {
        document.querySelectorAll("details[data-persist-open]").forEach(function (panel) {
          panel.addEventListener("toggle", function () {
            savePanelStates();
            if (panel.matches("[data-workspace-panel]")) {
              window.requestAnimationFrame(function () {
                updateChartDimensions();
                renderAll();
              });
            }
          });
        });
        document.addEventListener("click", function (event) {
          var target = event.target;
          document.querySelectorAll(".action-menu[open]").forEach(function (menu) {
            if (target instanceof Node && !menu.contains(target)) menu.open = false;
          });
        });
      }
      function persistDraft() {
        if (draftSaveTimer !== null) {
          window.clearTimeout(draftSaveTimer);
          draftSaveTimer = null;
        }
        try {
          var payload = {
            schemaVersion: 1,
            points: points.map(function (point) {
              return {
                series: String(point.series == null ? "" : point.series).slice(0, 60),
                volume: String(point.volume == null ? "" : point.volume).slice(0, 80),
                ph: String(point.ph == null ? "" : point.ph).slice(0, 80)
              };
            }),
            currentView: currentView,
            seriesColors: seriesColors,
            settings: collectSettings()
          };
          localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
          var savedAt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
          setDraftStatus("Salvo neste dispositivo · " + savedAt, "saved");
        } catch (error) {
          setDraftStatus("Não foi possível salvar localmente", "error");
        }
      }
      function scheduleDraftSave() {
        if (draftSaveTimer !== null) window.clearTimeout(draftSaveTimer);
        setDraftStatus("Alterações pendentes…", "pending");
        draftSaveTimer = window.setTimeout(persistDraft, 250);
      }
      function restoreDraft() {
        try {
          var raw = localStorage.getItem(DRAFT_KEY);
          if (!raw) return;
          var saved = JSON.parse(raw);
          if (!saved || saved.schemaVersion !== 1) return;
          if (Array.isArray(saved.points)) {
            var restoredPoints = saved.points.filter(function (point) {
              return point && typeof point === "object";
            }).slice(0, 2000).map(function (point) {
              return {
                series: String(point.series == null ? "" : point.series).slice(0, 60),
                volume: String(point.volume == null ? "" : point.volume).slice(0, 80),
                ph: String(point.ph == null ? "" : point.ph).slice(0, 80)
              };
            });
            if (restoredPoints.length) points = restoredPoints;
          }
          if (saved.currentView === "curve" || saved.currentView === "derivative") currentView = saved.currentView;
          if (saved.settings && typeof saved.settings === "object") {
            SETTINGS_IDS.forEach(function (id) {
              if (!Object.prototype.hasOwnProperty.call(saved.settings, id)) return;
              var element = document.getElementById(id);
              if (!element) return;
              var value = saved.settings[id];
              if (element.type === "checkbox") element.checked = value === true;
              else element.value = String(value == null ? "" : value);
            });
          }
          if (saved.seriesColors && typeof saved.seriesColors === "object") {
            seriesColors = {};
            Object.keys(saved.seriesColors).forEach(function (name) {
              var color = String(saved.seriesColors[name] || "");
              if (/^#[0-9a-f]{6}$/i.test(color)) seriesColors[name] = color;
            });
          }
          colorNamesSignature = "";
          document.querySelectorAll("[data-view]").forEach(function (tab) {
            tab.setAttribute("aria-selected", tab.getAttribute("data-view") === currentView ? "true" : "false");
          });
        } catch (error) {
          // Um rascunho corrompido não impede a abertura do editor.
        }
      }
      function addPoint() {
        recordUndoCheckpoint();
        var series = points.length ? String(points[points.length - 1].series || "").trim() : "";
        points.push({ series: series || "Série A", volume: "", ph: "" });
        renderRows();
        renderAll();
        settleHistoryBaseline();
        var target = document.getElementById("volume-" + (points.length - 1));
        if (target) target.focus();
      }
      function download(name, type, text) {
        var blob = new Blob([text], { type: type });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      }
      function csvField(value) {
        var text = String(value == null ? "" : value);
        return /[;"\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
      }
      function exportCSV() {
        var lines = [["Série", "Volume (mL)", "pH"]].concat(points.map(function (point) {
          return [point.series, point.volume, point.ph];
        }));
        var csv = "\uFEFF" + lines.map(function (line) { return line.map(csvField).join(";"); }).join("\r\n");
        download("dados-graficos-investigacao.csv", "text/csv;charset=utf-8", csv);
      }
      function parseCSVLine(line, delimiter) {
        var fields = [], field = "", quoted = false;
        for (var i = 0; i < line.length; i++) {
          var char = line[i];
          if (char === '"' && quoted && line[i + 1] === '"') { field += '"'; i++; }
          else if (char === '"') quoted = !quoted;
          else if (char === delimiter && !quoted) { fields.push(field); field = ""; }
          else field += char;
        }
        fields.push(field);
        return fields;
      }
      function keyName(value) {
        return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      }
      function importCSVText(text) {
        var source = String(text || "").replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n").filter(function (line) { return line.trim() !== ""; });
        if (!source.length) throw new Error("O arquivo está vazio.");
        var firstLine = source[0];
        var delimiter = firstLine.indexOf(";") >= 0 ? ";" : firstLine.indexOf("\t") >= 0 ? "\t" : ",";
        var firstFields = parseCSVLine(firstLine, delimiter);
        var keys = firstFields.map(keyName);
        var hasHeader = keys.some(function (key) { return key.indexOf("volume") >= 0 || key.indexOf("serie") >= 0 || key === "grupo" || key === "ph" || key.indexOf("phmedido") >= 0; });
        var serieIndex = keys.findIndex(function (key) { return key.indexOf("serie") >= 0 || key === "grupo" || key === "conjunto"; });
        var volumeIndex = keys.findIndex(function (key) { return key.indexOf("volume") >= 0; });
        var phIndex = keys.findIndex(function (key) { return key === "ph" || key.indexOf("phmedido") >= 0; });
        var dataLines = hasHeader ? source.slice(1) : source;
        var imported = [];
        dataLines.forEach(function (line) {
          var fields = parseCSVLine(line, delimiter);
          if (!fields.length) return;
          var series, volume, ph;
          if (hasHeader) {
            series = serieIndex >= 0 ? fields[serieIndex] : "Série A";
            volume = volumeIndex >= 0 ? fields[volumeIndex] : "";
            ph = phIndex >= 0 ? fields[phIndex] : "";
          } else if (fields.length >= 3) {
            series = fields[0]; volume = fields[1]; ph = fields[2];
          } else {
            series = "Série A"; volume = fields[0] || ""; ph = fields[1] || "";
          }
          if (String(volume).trim() === "" && String(ph).trim() === "") return;
          imported.push({ series: String(series || "Série A").trim() || "Série A", volume: String(volume || "").trim(), ph: String(ph || "").trim() });
        });
        if (!imported.length) throw new Error("Não encontrei linhas com volume e pH. Verifique o cabeçalho e use ponto e vírgula para separar as colunas.");
        recordUndoCheckpoint();
        points = imported;
        renderRows();
        renderAll();
        settleHistoryBaseline();
      }
      document.getElementById("add-point").addEventListener("click", addPoint);
      undoButton.addEventListener("click", undoChange);
      redoButton.addEventListener("click", redoChange);
      document.getElementById("import-button").addEventListener("click", function () { document.getElementById("import-file").click(); });
      document.getElementById("import-file").addEventListener("change", function (event) {
        var file = event.target.files && event.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try { importCSVText(reader.result); }
          catch (error) { window.alert(error.message || "Não foi possível importar esse arquivo."); }
          event.target.value = "";
        };
        reader.onerror = function () { window.alert("Não foi possível ler o arquivo selecionado."); event.target.value = ""; };
        reader.readAsText(file, "UTF-8");
      });
      document.getElementById("export-csv").addEventListener("click", exportCSV);
      document.getElementById("export-settings").addEventListener("click", function () {
        var settings = {};
        SETTINGS_IDS.forEach(function (id) {
          var element = document.getElementById(id);
          settings[id] = element.type === "checkbox" ? element.checked : element.value;
        });
        download("configuracao-graficos-investigacao.json", "application/json;charset=utf-8", JSON.stringify({
          format: "graficos-investigacao-manual-settings-v1",
          currentView: currentView,
          settings: settings,
          seriesColors: seriesColors
        }, null, 2));
      });
      document.getElementById("import-settings").addEventListener("click", function () {
        document.getElementById("settings-file").click();
      });
      document.getElementById("settings-file").addEventListener("change", function (event) {
        var file = event.target.files && event.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var parsed = JSON.parse(String(reader.result || ""));
            if (!parsed || parsed.format !== "graficos-investigacao-manual-settings-v1" || !parsed.settings) throw new Error("Este arquivo não é uma configuração válida desta ferramenta.");
            recordUndoCheckpoint();
            SETTINGS_IDS.forEach(function (id) {
              if (!Object.prototype.hasOwnProperty.call(parsed.settings, id)) return;
              var element = document.getElementById(id), value = parsed.settings[id];
              if (element.type === "checkbox") element.checked = value === true;
              else element.value = String(value == null ? "" : value);
            });
            var colors = {};
            if (parsed.seriesColors && typeof parsed.seriesColors === "object") {
              Object.keys(parsed.seriesColors).forEach(function (name) {
                if (/^#[0-9a-f]{6}$/i.test(String(parsed.seriesColors[name]))) colors[name] = String(parsed.seriesColors[name]);
              });
            }
            seriesColors = colors;
            colorNamesSignature = "";
            if (parsed.currentView === "curve" || parsed.currentView === "derivative") currentView = parsed.currentView;
            document.querySelectorAll("[data-view]").forEach(function (tab) {
              tab.setAttribute("aria-selected", tab.getAttribute("data-view") === currentView ? "true" : "false");
            });
            renderAll();
            settleHistoryBaseline();
          } catch (error) {
            window.alert(error.message || "Não foi possível carregar as configurações.");
          }
          event.target.value = "";
        };
        reader.onerror = function () { window.alert("Não foi possível ler o arquivo de configuração."); event.target.value = ""; };
        reader.readAsText(file, "UTF-8");
      });
      document.getElementById("clear-data").addEventListener("click", function () {
        if (!window.confirm("Limpar todos os pontos digitados?")) return;
        recordUndoCheckpoint();
        points = [{ series: "Série A", volume: "", ph: "" }];
        renderRows();
        renderAll();
        settleHistoryBaseline();
      });
      document.getElementById("load-example").addEventListener("click", function () {
        recordUndoCheckpoint();
        points = [
          { series: "Exemplo", volume: "0", ph: "6,8" },
          { series: "Exemplo", volume: "1", ph: "6,9" },
          { series: "Exemplo", volume: "2", ph: "6,85" },
          { series: "Exemplo", volume: "3", ph: "7,0" },
          { series: "Exemplo", volume: "4", ph: "7,1" }
        ];
        renderRows();
        renderAll();
        settleHistoryBaseline();
      });
      document.getElementById("print-chart").addEventListener("click", function () { window.print(); });
      downloadSvgButton.addEventListener("click", function () {
        var svg = chartHost.querySelector("svg");
        if (!svg) return;
        var clone = svg.cloneNode(true);
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        download(currentView === "curve" ? "grafico-ph-volume.svg" : "grafico-derivada-dph-dv.svg", "image/svg+xml;charset=utf-8", new XMLSerializer().serializeToString(clone));
      });
      document.querySelectorAll("[data-view]").forEach(function (button) {
        button.addEventListener("click", function () {
          flushHistoryCheckpoint();
          currentView = button.getAttribute("data-view");
          document.querySelectorAll("[data-view]").forEach(function (tab) {
            tab.setAttribute("aria-selected", tab === button ? "true" : "false");
          });
          renderAll();
          settleHistoryBaseline();
        });
      });
      document.getElementById("customization").addEventListener("input", function () {
        scheduleHistoryCheckpoint();
        renderAll();
      });
      document.getElementById("customization").addEventListener("change", function () {
        scheduleHistoryCheckpoint();
        renderAll();
      });
      seriesColorsEl.addEventListener("input", function (event) {
        var input = event.target.closest("input[data-series-color]");
        if (!input) return;
        scheduleHistoryCheckpoint();
        seriesColors[input.getAttribute("data-series-color")] = input.value;
        renderAll();
      });
      if (typeof window.addEventListener === "function") {
        window.addEventListener("resize", function () {
          updateChartDimensions();
          renderAll();
        });
      }
      rowsEl.addEventListener("input", function (event) {
        var input = event.target.closest("input[data-field]");
        if (!input) return;
        var row = input.closest("tr");
        var index = Number(row && row.getAttribute("data-index"));
        if (!Number.isInteger(index) || !points[index]) return;
        scheduleHistoryCheckpoint();
        points[index][input.getAttribute("data-field")] = input.value;
        renderAll();
      });
      rowsEl.addEventListener("click", function (event) {
        var button = event.target.closest("button[data-remove]");
        if (!button) return;
        var index = Number(button.getAttribute("data-remove"));
        if (!Number.isInteger(index)) return;
        recordUndoCheckpoint();
        points.splice(index, 1);
        if (!points.length) points.push({ series: "Série A", volume: "", ph: "" });
        renderRows();
        renderAll();
        settleHistoryBaseline();
      });
      setupPanelDisclosures();
      restorePanelStates();
      restoreDraft();
      renderRows();
      renderAll();
      settleHistoryBaseline();
      window.addEventListener("pagehide", persistDraft);
      window.addEventListener("blur", flushHistoryCheckpoint);
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") {
          flushHistoryCheckpoint();
          persistDraft();
        }
      });
      window.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          var closedAny = false;
          document.querySelectorAll(".action-menu[open], #a11y-menu[open]").forEach(function (menu) {
            menu.open = false;
            closedAny = true;
            var summary = menu.querySelector("summary");
            if (summary) summary.focus();
          });
          if (closedAny) event.stopPropagation();
          return;
        }
        var modifier = event.ctrlKey || event.metaKey;
        if (!modifier) return;
        var key = event.key.toLowerCase();
        var target = event.target;
        var isEditingText = target instanceof HTMLElement &&
          target.matches("input:not([type=checkbox]):not([type=button]):not([type=color]), textarea, select, [contenteditable=true]");
        if ((key === "z" || key === "y") && isEditingText) return;
        if ((key === "z" && event.shiftKey) || key === "y") {
          event.preventDefault();
          redoChange();
          return;
        }
        if (key === "z") {
          event.preventDefault();
          undoChange();
          return;
        }
        if (key === "enter" && !event.shiftKey) {
          event.preventDefault();
          addPoint();
          return;
        }
        if (key === "e" && event.shiftKey) {
          event.preventDefault();
          exportCSV();
        }
      });
    })();
  