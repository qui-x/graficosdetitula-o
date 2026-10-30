// @ts-nocheck -- migração progressiva da camada DOM; os cálculos ficam tipados em graph-model.ts.
import {
  parseLocaleNumber as parseNumber,
  validateMeasurementRows,
  groupConsecutiveSegments as makeSegments,
  calculateSlopes as getSlopes,
  niceAxisStep as niceStep,
  createAxisTicks as ticks
} from "./graph-model";
import { SnapshotHistory } from "./history";
import { ProjectManagerUI } from "./project-manager-ui";
import {
  buildProjectListItems,
  createEmptyProjectDocument,
  createUuid,
  duplicateProjectDocument,
  exportProjectDocument,
  importProjectDocument,
  openProjectRepository,
  projectWithName,
  uniqueImportedProjectName,
  validateProjectDocument
} from "./project-store";
import type { ProjectDocument, ProjectStage } from "./titration-contract";
import "./style.css";
import "./project-manager.css";
import "./a11y";
import "./pwa";


    "use strict";
    (function () {
      var COLORS = ["#087eaa", "#c44555", "#26836d", "#7856b5", "#d17a17", "#3972c6", "#a43b87", "#617d32"];
      var points = [];
      var activeProject = null;
      var projectRepository = null;
      var projectManagerController = null;
      var projectStorageMode = "indexeddb";
      var projectPersistenceSuppressed = false;
      var activeProjectFingerprint = "";
      var projectSaveInFlight = Promise.resolve();
      var seriesCatalog = ["Série A"];
      var hiddenSeries = {};
      var currentView = "curve";
      var rowsEl = document.getElementById("point-rows");
      var tableEmptyStateEl = document.getElementById("table-empty-state");
      var entryForm = document.getElementById("measurement-entry-form");
      var entrySeriesInput = document.getElementById("entry-series");
      var entrySeriesOptionsEl = document.getElementById("series-options");
      var entryVolumeInput = document.getElementById("entry-volume");
      var entryPhInput = document.getElementById("entry-ph");
      var entryStatusEl = document.getElementById("entry-status");
      var chartHost = document.getElementById("chart-host");
      var legendEl = document.getElementById("series-legend");
      var validationEl = document.getElementById("validation");
      var downloadSvgButton = document.getElementById("download-svg");
      var chartTitle = document.getElementById("chart-title");
      var chartExplanation = document.getElementById("chart-explanation");
      var seriesColorsEl = document.getElementById("series-colors");
      var seriesCreateForm = document.getElementById("series-create-form");
      var newSeriesNameInput = document.getElementById("new-series-name");
      var seriesManagerFeedbackEl = document.getElementById("series-manager-feedback");
      var settingsStatusEl = document.getElementById("settings-status");
      var projectManagerDialog = document.getElementById("project-manager-dialog");
      var projectManagerCloseButton = document.getElementById("project-manager-close");
      var projectCreateForm = document.getElementById("project-create-form");
      var newProjectNameInput = document.getElementById("new-project-name");
      var projectManagerFeedbackEl = document.getElementById("project-manager-feedback");
      var projectStorageNoteEl = document.getElementById("project-storage-note");
      var projectListEl = document.getElementById("project-list");
      var projectCountEl = document.getElementById("project-count");
      var projectEmptyStateEl = document.getElementById("project-empty-state");
      var projectImportFileInput = document.getElementById("project-import-file");
      var activeProjectNameEl = document.getElementById("active-project-name");
      var openProjectManagerButton = document.getElementById("open-project-manager");
      var exportProjectJsonButton = document.getElementById("export-project-json");
      var settingsWarnings = [];
      var seriesColors = {};
      var colorNamesSignature = "";
      var undoButton = document.getElementById("undo-action");
      var redoButton = document.getElementById("redo-action");
      var draftStatusEl = document.getElementById("draft-status");
      var draftStatusTextEl = document.getElementById("draft-status-text");
      var historyStatusEl = document.getElementById("history-status");
      var history = new SnapshotHistory(100);
      var pendingUndoSnapshot = null;
      var historyTimer = null;
      var committedSnapshot = null;
      var PANEL_STORAGE_KEY = "graficos_investigacao_panels_v1";
      var PANEL_IDS = ["series-colors-details", "customization", "csv-import-help"];
      var WORKSPACE_VIEW_STORAGE_KEY = "graficos_investigacao_workspace_view_v1";
      var WORKSPACE_VIEWS = ["data", "graph", "export"];

      function applyWorkspaceView(view, persist, refresh) {
        if (WORKSPACE_VIEWS.indexOf(view) === -1) view = "data";
        document.querySelectorAll("[data-workspace-view]").forEach(function (tab) {
          var selected = tab.getAttribute("data-workspace-view") === view;
          tab.setAttribute("aria-selected", selected ? "true" : "false");
          tab.setAttribute("tabindex", selected ? "0" : "-1");
          tab.classList.toggle("is-active", selected);
        });
        document.querySelectorAll("[data-workspace-section]").forEach(function (section) {
          section.hidden = section.getAttribute("data-workspace-section") !== view;
        });
        if (persist && activeProject && !projectPersistenceSuppressed) {
          activeProject.preferences.lastStage = workspaceStageFromView(view);
          scheduleDraftSave();
        }
        if (refresh) {
          window.requestAnimationFrame(function () {
            updateChartDimensions();
            renderAll();
          });
        }
      }

      function setWorkspaceView(view) {
        applyWorkspaceView(view, true, true);
      }

      function restoreWorkspaceView() {
        applyWorkspaceView("data", false, false);
      }

      function setupWorkspaceNavigation() {
        var tabs = Array.prototype.slice.call(document.querySelectorAll("[data-workspace-view]"));
        tabs.forEach(function (tab, index) {
          tab.addEventListener("click", function () {
            setWorkspaceView(tab.getAttribute("data-workspace-view"));
          });
          tab.addEventListener("keydown", function (event) {
            var nextIndex = index;
            if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % tabs.length;
            else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + tabs.length) % tabs.length;
            else if (event.key === "Home") nextIndex = 0;
            else if (event.key === "End") nextIndex = tabs.length - 1;
            else return;
            event.preventDefault();
            tabs[nextIndex].focus();
            setWorkspaceView(tabs[nextIndex].getAttribute("data-workspace-view"));
          });
        });
      }
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
          var seriesName = effectiveSeriesName(point.series);
          var color = colorFor(seriesName, names);
          var paddedIndex = String(index + 1).padStart(2, "0");
          return '<tr data-index="' + index + '" data-measurement-id="' + escapeHTML(point.id || "") + '">' +
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
        if (tableEmptyStateEl) tableEmptyStateEl.hidden = points.length > 0;
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
      function effectiveSeriesName(value) {
        var name = String(value == null ? "" : value);
        return name === "" ? "Série A" : name;
      }
      function createMeasurementId() {
        return createUuid();
      }
      function ensureMeasurementIds(rows) {
        var seen = Object.create(null);
        rows.forEach(function (point) {
          var id = String(point.id || "");
          if (!id || seen[id]) id = createMeasurementId();
          point.id = id;
          seen[id] = true;
        });
      }
      function registerSeriesName(name) {
        var exactName = effectiveSeriesName(name);
        if (seriesCatalog.indexOf(exactName) === -1) seriesCatalog.push(exactName);
        return exactName;
      }
      function ensureSeriesCatalogue() {
        var uniqueNames = [];
        seriesCatalog.forEach(function (name) {
          if (typeof name === "string" && name !== "" && uniqueNames.indexOf(name) === -1) uniqueNames.push(name);
        });
        seriesCatalog = uniqueNames;
        points.forEach(function (point) { registerSeriesName(point.series); });
        if (!seriesCatalog.length) seriesCatalog.push("Série A");
      }
      function isSeriesVisible(name) {
        return hiddenSeries[name] !== true;
      }
      function currentSeriesNames() {
        var names = seriesCatalog.slice();
        points.forEach(function (point) {
          var name = effectiveSeriesName(point.series);
          if (names.indexOf(name) === -1) names.push(name);
        });
        return names;
      }
      function syncEntrySeriesOptions() {
        var names = currentSeriesNames();
        if (!entrySeriesOptionsEl) return;
        entrySeriesOptionsEl.innerHTML = names.map(function (name) {
          return '<option value="' + escapeHTML(name) + '"></option>';
        }).join("");
      }
      function syncSeriesColorControls() {
        var names = currentSeriesNames();
        var summary = names.map(function (name) {
          var count = points.filter(function (point) { return effectiveSeriesName(point.series) === name; }).length;
          return [name, count, isSeriesVisible(name)];
        });
        var signature = JSON.stringify(summary);
        if (signature === colorNamesSignature) return;
        colorNamesSignature = signature;
        if (!names.length) {
          seriesColorsEl.innerHTML = '<p class="hint">Crie uma série para começar a organizar as leituras.</p>';
          return;
        }
        seriesColorsEl.innerHTML = names.map(function (name, index) {
          var color = colorFor(name, names);
          var count = summary[index][1];
          var visible = isSeriesVisible(name);
          var visibilityLabel = visible ? "Ocultar no gráfico" : "Mostrar no gráfico";
          return '<article class="series-manager-item">' +
            '<div class="series-manager-fields">' +
              '<label class="series-manager-name-field"><span>Nome exato</span><input type="text" maxlength="60" data-series-rename-index="' + index + '" value="' + escapeHTML(name) + '" aria-label="Nome exato da série ' + (index + 1) + '"><small class="series-manager-name-preview">Identificador literal: <code>' + escapeHTML(JSON.stringify(name)) + '</code></small></label>' +
              '<label class="series-manager-color-field"><span>Cor</span><input type="color" id="series-color-' + index + '" data-series-color-index="' + index + '" value="' + color + '" aria-label="Cor da série ' + escapeHTML(name) + '"></label>' +
              '<span class="series-manager-count">' + count + (count === 1 ? " leitura" : " leituras") + '</span>' +
            '</div>' +
            '<div class="series-manager-actions">' +
              '<button type="button" data-series-action="rename" data-series-index="' + index + '">Salvar nome</button>' +
              '<button type="button" data-series-action="duplicate" data-series-index="' + index + '">Duplicar leituras</button>' +
              '<button type="button" data-series-action="visibility" data-series-index="' + index + '" aria-pressed="' + (visible ? "true" : "false") + '">' + visibilityLabel + '</button>' +
            '</div>' +
          '</article>';
        }).join("");
      }
      function setSeriesManagerFeedback(message, state) {
        seriesManagerFeedbackEl.textContent = message || "";
        if (state) seriesManagerFeedbackEl.dataset.state = state;
        else seriesManagerFeedbackEl.removeAttribute("data-state");
      }
      function refreshSeriesManager(focusTarget) {
        colorNamesSignature = "";
        syncEntrySeriesOptions();
        renderRows();
        renderAll();
        settleHistoryBaseline();
        if (focusTarget && typeof focusTarget.focus === "function") focusTarget.focus();
      }
      function createSeriesFromForm(event) {
        event.preventDefault();
        var name = String(newSeriesNameInput.value == null ? "" : newSeriesNameInput.value);
        if (name === "") {
          setSeriesManagerFeedback("Digite um nome para criar a série.", "error");
          newSeriesNameInput.focus();
          return;
        }
        if (name.length > 60) {
          setSeriesManagerFeedback("O nome da série pode ter até 60 caracteres.", "error");
          newSeriesNameInput.focus();
          return;
        }
        if (currentSeriesNames().indexOf(name) !== -1) {
          setSeriesManagerFeedback("Já existe uma série com esse nome exato. Maiúsculas e espaços diferentes são aceitos como nomes distintos.", "error");
          newSeriesNameInput.focus();
          return;
        }
        recordUndoCheckpoint();
        seriesCatalog.push(name);
        delete hiddenSeries[name];
        newSeriesNameInput.value = "";
        entrySeriesInput.value = name;
        refreshSeriesManager();
        setSeriesManagerFeedback("Série criada. Ela está pronta para receber leituras.", "success");
      }
      function renameSeriesAt(index) {
        var names = currentSeriesNames();
        var oldName = names[index];
        if (oldName == null) return;
        var input = seriesColorsEl.querySelector('input[data-series-rename-index="' + index + '"]');
        if (!input) return;
        var newName = String(input.value == null ? "" : input.value);
        if (newName === "") {
          setSeriesManagerFeedback("O nome da série não pode ficar vazio.", "error");
          input.focus();
          return;
        }
        if (newName.length > 60) {
          setSeriesManagerFeedback("O nome da série pode ter até 60 caracteres.", "error");
          input.focus();
          return;
        }
        if (newName !== oldName && names.indexOf(newName) !== -1) {
          setSeriesManagerFeedback("Já existe uma série com esse nome exato. Escolha outro nome.", "error");
          input.focus();
          return;
        }
        if (newName === oldName) {
          setSeriesManagerFeedback("O nome da série não foi alterado.", "info");
          return;
        }
        recordUndoCheckpoint();
        points.forEach(function (point) {
          if (effectiveSeriesName(point.series) === oldName) point.series = newName;
        });
        var catalogIndex = seriesCatalog.indexOf(oldName);
        if (catalogIndex >= 0) seriesCatalog[catalogIndex] = newName;
        else seriesCatalog.push(newName);
        if (Object.prototype.hasOwnProperty.call(seriesColors, oldName)) {
          var existingColor = seriesColors[oldName];
          delete seriesColors[oldName];
          if (!Object.prototype.hasOwnProperty.call(seriesColors, newName)) seriesColors[newName] = existingColor;
        }
        if (Object.prototype.hasOwnProperty.call(hiddenSeries, oldName)) {
          var wasHidden = hiddenSeries[oldName];
          delete hiddenSeries[oldName];
          if (wasHidden === true) hiddenSeries[newName] = true;
        }
        if (entrySeriesInput.value === oldName) entrySeriesInput.value = newName;
        refreshSeriesManager();
        setSeriesManagerFeedback("Série renomeada. Todas as leituras associadas foram atualizadas.", "success");
      }
      function duplicateSeriesAt(index) {
        var names = currentSeriesNames();
        var sourceName = names[index];
        if (sourceName == null) return;
        var copyName = sourceName + " (cópia)";
        var suffix = 2;
        while (names.indexOf(copyName) !== -1) {
          copyName = sourceName + " (cópia " + suffix + ")";
          suffix += 1;
        }
        recordUndoCheckpoint();
        var sourcePoints = points.filter(function (point) {
          return effectiveSeriesName(point.series) === sourceName;
        });
        var copiedPoints = sourcePoints.map(function (point) {
          return {
            id: createMeasurementId(),
            series: copyName,
            volume: String(point.volume == null ? "" : point.volume),
            ph: String(point.ph == null ? "" : point.ph)
          };
        });
        seriesCatalog.push(copyName);
        hiddenSeries[copyName] = false;
        points = points.concat(copiedPoints);
        entrySeriesInput.value = copyName;
        refreshSeriesManager();
        setSeriesManagerFeedback(
          sourcePoints.length
            ? "Série duplicada com " + sourcePoints.length + (sourcePoints.length === 1 ? " leitura copiada." : " leituras copiadas.")
            : "Série vazia duplicada. Ela está pronta para receber leituras.",
          "success"
        );
      }
      function toggleSeriesVisibilityAt(index) {
        var names = currentSeriesNames();
        var name = names[index];
        if (name == null) return;
        recordUndoCheckpoint();
        if (isSeriesVisible(name)) hiddenSeries[name] = true;
        else delete hiddenSeries[name];
        refreshSeriesManager();
        setSeriesManagerFeedback(
          isSeriesVisible(name) ? "Série visível no gráfico." : "Série oculta no gráfico. As leituras continuam preservadas.",
          "success"
        );
      }
      function handleSeriesManagerAction(event) {
        var button = event.target.closest("button[data-series-action]");
        if (!button) return;
        var index = Number(button.getAttribute("data-series-index"));
        if (!Number.isInteger(index) || index < 0) return;
        var action = button.getAttribute("data-series-action");
        if (action === "rename") renameSeriesAt(index);
        else if (action === "duplicate") duplicateSeriesAt(index);
        else if (action === "visibility") toggleSeriesVisibilityAt(index);
      }
      function seriesNames(segments) {
        var names = [];
        segments.forEach(function (segment) {
          if (names.indexOf(segment.series) < 0) names.push(segment.series);
        });
        return names;
      }
      function buildLegend(names, colorNames) {
        var paletteNames = colorNames || names;
        legendEl.innerHTML = names.map(function (name) {
          return '<span class="legend-item"><span class="legend-swatch" style="background:' + colorFor(name, paletteNames) + '"></span><span>' + escapeHTML(name) + '</span></span>';
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
      function renderCurve(segments, validPoints, allValidHidden) {
        var derived = validPoints.map(function (point) { return { series: point.series, volume: point.volume, ph: point.ph }; });
        var config = getGraphConfig("curve", derived);
        if (!validPoints.length) {
          emptyMessage(
            allValidHidden ? "Todas as séries estão ocultas" : "O gráfico aparecerá aqui",
            allValidHidden
              ? "As leituras continuam salvas. Reative uma ou mais séries no painel Gerenciar séries para voltar a exibi-las."
              : "Preencha volume e pH em pelo menos uma linha para mostrar os pontos informados."
          );
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
        var colorNames = currentSeriesNames();
        svg += '<g clip-path="url(#plot-clip)">';
        segments.forEach(function (segment) {
          var color = colorFor(segment.series, colorNames);
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
        buildLegend(names, colorNames);
        chartTitle.textContent = config.title;
        chartExplanation.textContent = "Pontos inseridos; a linha apenas conecta leituras. Pontos fora dos limites não aparecem.";
      }
      function renderDerivative(segments, allValidHidden) {
        var slopes = getSlopes(segments);
        var config = getGraphConfig("derivative", slopes);
        if (!slopes.length) {
          emptyMessage(
            allValidHidden ? "Todas as séries estão ocultas" : "Ainda não há variações calculáveis",
            allValidHidden
              ? "As leituras continuam salvas. Reative uma ou mais séries no painel Gerenciar séries para voltar a exibi-las."
              : "Informe ao menos duas leituras válidas, na mesma sequência, com volumes diferentes. A ferramenta calcula ΔpH/ΔV entre pontos consecutivos."
          );
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
        var colorNames = currentSeriesNames();
        var slopeSegments = segments.map(function (segment) {
          return { series: segment.series, points: getSlopes([segment]) };
        }).filter(function (segment) { return segment.points.length > 0; });
        slopeSegments.forEach(function (segment) {
          var name = segment.series;
          var seriesPoints = segment.points;
          var color = colorFor(name, colorNames);
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
        buildLegend(names, colorNames);
        chartTitle.textContent = config.title;
        chartExplanation.textContent = "ΔpH/ΔV é calculado entre leituras consecutivas. Valores negativos indicam queda do pH.";
      }
      function renderAll() {
        ensureMeasurementIds(points);
        syncEntrySeriesOptions();
        var state = getPointState();
        var valid = state.valid;
        var allSegments = makeSegments(valid);
        var visibleValid = valid.filter(function (point) { return isSeriesVisible(point.series); });
        // Filtra segmentos já separados para não conectar pontos de uma série através de outra série oculta.
        var segments = allSegments.filter(function (segment) { return isSeriesVisible(segment.series); });
        var slopes = getSlopes(segments);
        var allValidHidden = valid.length > 0 && visibleValid.length === 0;
        settingsWarnings = [];
        updateChartDimensions();
        var activeElement = document.activeElement;
        var editingSeriesCell = activeElement && typeof activeElement.matches === "function" &&
          activeElement.matches('#point-rows input[data-field="series"]');
        if (!editingSeriesCell) syncSeriesColorControls();
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
        var exportCsvButton = document.getElementById("export-csv");
        if (exportCsvButton) exportCsvButton.disabled = points.length === 0;
        document.getElementById("data-series-count").textContent = String(currentSeriesNames().length);
        var reviewCount = state.incomplete + state.invalid;
        document.getElementById("data-review-count").textContent = String(reviewCount);
        document.getElementById("data-review-card").dataset.state = reviewCount > 0 ? "alert" : "normal";
        var activeNames = currentSeriesNames();
        rowsEl.querySelectorAll("[data-series-swatch]").forEach(function (swatch) {
          var row = swatch.closest("tr");
          var index = Number(row && row.getAttribute("data-index"));
          var name = points[index] ? effectiveSeriesName(points[index].series) : "Série A";
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
        if (currentView === "curve") renderCurve(segments, visibleValid, allValidHidden);
        else renderDerivative(segments, allValidHidden);
        settingsStatusEl.textContent = (settingsWarnings.length ? settingsWarnings.join(" ") + " " : "") +
          "Faixas e valores aceitam resolução de 0,001. As marcações automáticas se adaptam à faixa; intervalos que gerariam mais de 120 marcações são ampliados para legibilidade.";
        settingsStatusEl.classList.toggle("warn", settingsWarnings.length > 0);
        scheduleDraftSave();
      }

      // Rascunho local: dados, cores e personalizações permanecem neste navegador.
      var DRAFT_KEY = "graficos_investigacao_draft_v1";
      var PROJECT_MIGRATION_KEY = "graficos_investigacao_projects_migration_v1";
      var LAST_PROJECT_KEY = "graficos_investigacao_last_project_v1";
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
            return {
              id: String(point.id || createMeasurementId()),
              series: String(point.series == null ? "" : point.series),
              volume: String(point.volume == null ? "" : point.volume),
              ph: String(point.ph == null ? "" : point.ph)
            };
          }),
          currentView: currentView,
          seriesCatalog: seriesCatalog.slice(),
          hiddenSeries: Object.assign({}, hiddenSeries),
          seriesColors: Object.assign({}, seriesColors),
          settings: collectSettings()
        };
      }
      function syncHistoryControls() {
        if (undoButton) undoButton.disabled = !history.canUndo && !pendingUndoSnapshot;
        if (redoButton) redoButton.disabled = !history.canRedo;
        if (historyStatusEl) {
          historyStatusEl.textContent = pendingUndoSnapshot || history.canUndo || history.canRedo
            ? "Há alterações disponíveis no histórico."
            : "Histórico de alterações vazio.";
        }
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
        if (JSON.stringify(pendingUndoSnapshot) !== JSON.stringify(current)) {
          history.record(pendingUndoSnapshot);
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
        history.record(captureEditorState());
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
        ensureMeasurementIds(points);
        currentView = snapshot.currentView === "derivative" ? "derivative" : "curve";
        seriesCatalog = Array.isArray(snapshot.seriesCatalog)
          ? snapshot.seriesCatalog.filter(function (name) { return typeof name === "string" && name !== ""; })
          : [];
        hiddenSeries = Object.assign({}, snapshot.hiddenSeries || {});
        seriesColors = Object.assign({}, snapshot.seriesColors || {});
        ensureSeriesCatalogue();
        syncEntrySeriesOptions();
        if (currentSeriesNames().indexOf(entrySeriesInput.value) === -1) entrySeriesInput.value = currentSeriesNames()[0] || "Série A";
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
        var previous = history.undo(captureEditorState());
        if (!previous) return;
        applyEditorState(previous);
        syncHistoryControls();
      }
      function redoChange() {
        flushHistoryCheckpoint();
        var next = history.redo(captureEditorState());
        if (!next) return;
        applyEditorState(next);
        syncHistoryControls();
      }
      function setDraftStatus(message, state) {
        if (draftStatusEl) draftStatusEl.dataset.state = state || "saved";
        if (draftStatusTextEl) draftStatusTextEl.textContent = message;
      }
      function savePanelStates() {
        if (!activeProject || projectPersistenceSuppressed) return;
        var seriesPanel = document.getElementById("series-colors-details");
        var advancedPanel = document.getElementById("customization");
        if (seriesPanel instanceof HTMLDetailsElement) activeProject.preferences.seriesPanelOpen = seriesPanel.open;
        if (advancedPanel instanceof HTMLDetailsElement) activeProject.preferences.advancedPanelOpen = advancedPanel.open;
        scheduleDraftSave();
      }
      function restorePanelStates(project) {
        if (!project) return;
        var seriesPanel = document.getElementById("series-colors-details");
        var advancedPanel = document.getElementById("customization");
        if (seriesPanel instanceof HTMLDetailsElement) seriesPanel.open = project.preferences.seriesPanelOpen;
        if (advancedPanel instanceof HTMLDetailsElement) advancedPanel.open = project.preferences.advancedPanelOpen;
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
          var elementTarget = target instanceof Element ? target : null;
          var clickedMenu = elementTarget ? elementTarget.closest(".action-menu") : null;
          var clickedSummary = elementTarget ? elementTarget.closest("summary") : null;
          document.querySelectorAll(".action-menu[open]").forEach(function (menu) {
            var clickedAnOption = clickedMenu === menu && !clickedSummary;
            if (!(target instanceof Node) || !menu.contains(target) || clickedAnOption) menu.open = false;
          });
        });
      }
      function workspaceStageFromView(view) {
        return view === "graph" ? "grafico" : view === "export" ? "exportacao" : "dados";
      }
      function workspaceViewFromStage(stage) {
        return stage === "grafico" ? "graph" : stage === "exportacao" ? "export" : "data";
      }
      function currentAccessibilityPreferences() {
        var state = window.A11Y && (window.A11Y.state || window.A11Y.estado) || {};
        var colorMode = state.colorblind === "acromatopsia" ? "grayscale" : state.colorblind;
        return {
          theme: state.theme === "light" ? "light" : "dark",
          highContrast: state.contrast === true,
          fontScale: Math.max(0.8, Math.min(2, Number(state.fontScale) || 1)),
          extraTextSpacing: state.spacing === true,
          reducedMotion: state.motion === true,
          colorVisionSimulation: ["none", "protanopia", "deuteranopia", "tritanopia", "grayscale"].indexOf(colorMode) >= 0 ? colorMode : "none",
          vlibrasEnabled: state.libras === true
        };
      }
      function projectFingerprint(project) {
        var snapshot = cloneState(project);
        snapshot.updatedAt = "";
        return JSON.stringify(snapshot);
      }
      function captureProjectDocument() {
        if (!activeProject) return null;
        var candidate = cloneState(activeProject);
        var measurements = points.map(function (point) {
          return {
            id: String(point.id || createMeasurementId()),
            seriesName: effectiveSeriesName(point.series),
            volumeInput: String(point.volume == null ? "" : point.volume).slice(0, 80),
            phInput: String(point.ph == null ? "" : point.ph).slice(0, 80)
          };
        });
        var dataChanged = JSON.stringify(measurements) !== JSON.stringify(activeProject.data.measurements);
        candidate.data.measurements = measurements;
        candidate.visualSettings.seriesCatalog = currentSeriesNames().slice(0, 200);
        candidate.visualSettings.seriesColors = Object.assign({}, seriesColors);
        candidate.visualSettings.hiddenSeries = Object.keys(hiddenSeries).filter(function (name) { return hiddenSeries[name] === true; });
        candidate.visualSettings.displayDecimals = displayDigits();
        candidate.visualSettings.chartControls = {
          currentView: currentView,
          entrySeriesName: String(entrySeriesInput.value == null ? "" : entrySeriesInput.value),
          settings: collectSettings()
        };
        var viewPrefix = currentView === "curve" ? "curve" : "derivative";
        candidate.visualSettings.showGrid = document.getElementById("cfg-" + viewPrefix + "-grid").checked;
        candidate.visualSettings.chartTitle = String(document.getElementById("cfg-" + viewPrefix + "-title").value || "");
        candidate.visualSettings.xAxisLabel = String(document.getElementById("cfg-" + viewPrefix + "-x-label").value || "");
        candidate.visualSettings.yAxisLabel = String(document.getElementById("cfg-" + viewPrefix + "-y-label").value || "");
        candidate.preferences.lastStage = workspaceStageFromView(
          document.querySelector('[data-workspace-view][aria-selected="true"]')?.getAttribute("data-workspace-view") || "data"
        );
        var advancedPanel = document.getElementById("customization");
        var seriesPanel = document.getElementById("series-colors-details");
        if (advancedPanel instanceof HTMLDetailsElement) candidate.preferences.advancedPanelOpen = advancedPanel.open;
        if (seriesPanel instanceof HTMLDetailsElement) candidate.preferences.seriesPanelOpen = seriesPanel.open;
        candidate.preferences.accessibility = currentAccessibilityPreferences();
        if (dataChanged) candidate.revisions.data = activeProject.revisions.data + 1;
        candidate.updatedAt = activeProject.updatedAt;
        return candidate;
      }
      function legacyBackupFromProject(project) {
        return {
          schemaVersion: 1,
          projectId: project.projectId,
          points: project.data.measurements.map(function (measurement) {
            return {
              id: measurement.id,
              series: measurement.seriesName,
              volume: measurement.volumeInput,
              ph: measurement.phInput
            };
          }),
          currentView: project.visualSettings.chartControls?.currentView || "curve",
          seriesCatalog: project.visualSettings.seriesCatalog || [],
          hiddenSeries: (project.visualSettings.hiddenSeries || []).reduce(function (result, name) {
            result[name] = true;
            return result;
          }, {}),
          seriesColors: project.visualSettings.seriesColors,
          settings: project.visualSettings.chartControls?.settings || {}
        };
      }
      async function persistDraft() {
        if (draftSaveTimer !== null) {
          window.clearTimeout(draftSaveTimer);
          draftSaveTimer = null;
        }
        if (!activeProject || !projectRepository || projectPersistenceSuppressed) return;
        var candidate = captureProjectDocument();
        if (!candidate) return;
        var fingerprint = projectFingerprint(candidate);
        if (fingerprint === activeProjectFingerprint) {
          var savedTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(activeProject.updatedAt));
          setDraftStatus("Projeto salvo · " + savedTime, "saved");
          return;
        }
        candidate.updatedAt = new Date().toISOString();
        var operation = projectSaveInFlight.then(function () {
          return projectRepository.save(candidate);
        });
        projectSaveInFlight = operation.catch(function () { return undefined; });
        try {
          await operation;
          activeProject = candidate;
          activeProjectFingerprint = projectFingerprint(activeProject);
          try { localStorage.setItem(DRAFT_KEY, JSON.stringify(legacyBackupFromProject(activeProject))); } catch (error) {
            // O projeto já foi confirmado no repositório; a cópia legada é apenas uma recuperação auxiliar.
          }
          try { localStorage.setItem(LAST_PROJECT_KEY, activeProject.projectId); } catch (error) {
            // A lista de projetos não depende desta referência auxiliar.
          }
          var savedAt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(activeProject.updatedAt));
          setDraftStatus("Projeto salvo neste dispositivo · " + savedAt, "saved");
        } catch (error) {
          setDraftStatus("Falha ao salvar o projeto. Exporte um JSON para manter uma cópia.", "error");
          setProjectManagerFeedback(error instanceof Error ? error.message : "Não foi possível salvar o projeto.", "error");
        }
      }
      function scheduleDraftSave() {
        if (!activeProject || projectPersistenceSuppressed) return;
        if (draftSaveTimer !== null) window.clearTimeout(draftSaveTimer);
        setDraftStatus("Salvando alterações…", "pending");
        draftSaveTimer = window.setTimeout(function () { void persistDraft(); }, 350);
      }
      function migrateLegacyDraftToProject() {
        var raw = null;
        try { raw = localStorage.getItem(DRAFT_KEY); }
        catch (error) { return null; }
        if (!raw) return null;
        var saved;
        try { saved = JSON.parse(raw); }
        catch (error) { throw new Error("O rascunho antigo existe, mas não contém JSON válido. Ele foi preservado; não foi feita uma migração parcial."); }
        if (!saved || saved.schemaVersion !== 1) {
          throw new Error("O rascunho antigo usa um formato desconhecido. Ele foi preservado para recuperação manual.");
        }

        var project = createEmptyProjectDocument("Rascunho recuperado");
        var restoredRows = Array.isArray(saved.points) ? saved.points.slice(0, 20000) : [];
        project.data.measurements = restoredRows.filter(function (point) {
          if (!point || typeof point !== "object") return false;
          var volume = String(point.volume == null ? "" : point.volume);
          var ph = String(point.ph == null ? "" : point.ph);
          var series = String(point.series == null ? "" : point.series);
          return volume.trim() !== "" || ph.trim() !== "" || (series !== "" && series !== "Série A");
        }).map(function (point) {
          var seriesName = String(point.series == null ? "" : point.series).slice(0, 80);
          if (!/\S/.test(seriesName)) seriesName = "Série A";
          var id = String(point.id || "");
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) id = createMeasurementId();
          return {
            id: id,
            seriesName: seriesName,
            volumeInput: String(point.volume == null ? "" : point.volume).slice(0, 80),
            phInput: String(point.ph == null ? "" : point.ph).slice(0, 80)
          };
        });

        var names = [];
        if (Array.isArray(saved.seriesCatalog)) {
          saved.seriesCatalog.forEach(function (name) {
            if (typeof name === "string" && name.length > 0 && name.length <= 80 && /\S/.test(name) && names.indexOf(name) === -1) names.push(name);
          });
        }
        project.data.measurements.forEach(function (measurement) {
          if (names.indexOf(measurement.seriesName) === -1) names.push(measurement.seriesName);
        });
        if (!names.length) names.push("Série A");
        project.visualSettings.seriesCatalog = names;

        if (saved.seriesColors && typeof saved.seriesColors === "object") {
          Object.keys(saved.seriesColors).forEach(function (name) {
            var color = String(saved.seriesColors[name] || "");
            if (/^#[0-9a-f]{6}$/i.test(color) && /\S/.test(name) && name.length <= 80) {
              project.visualSettings.seriesColors[name] = color;
            }
          });
        }
        if (saved.hiddenSeries && typeof saved.hiddenSeries === "object") {
          project.visualSettings.hiddenSeries = Object.keys(saved.hiddenSeries).filter(function (name) {
            return saved.hiddenSeries[name] === true && /\S/.test(name) && name.length <= 80;
          });
        }

        var settings = {};
        if (saved.settings && typeof saved.settings === "object") {
          SETTINGS_IDS.forEach(function (id) {
            if (!Object.prototype.hasOwnProperty.call(saved.settings, id)) return;
            var value = saved.settings[id];
            if (typeof value === "boolean" || typeof value === "string") settings[id] = value;
          });
        }
        var currentGraph = saved.currentView === "derivative" ? "derivative" : "curve";
        var entrySeriesName = project.data.measurements.length
          ? project.data.measurements[project.data.measurements.length - 1].seriesName
          : names[0];
        project.visualSettings.chartControls = {
          currentView: currentGraph,
          entrySeriesName: entrySeriesName,
          settings: settings
        };
        var prefix = currentGraph === "curve" ? "curve" : "derivative";
        project.visualSettings.showGrid = settings["cfg-" + prefix + "-grid"] !== false;
        project.visualSettings.chartTitle = String(settings["cfg-" + prefix + "-title"] || project.visualSettings.chartTitle);
        project.visualSettings.xAxisLabel = String(settings["cfg-" + prefix + "-x-label"] || project.visualSettings.xAxisLabel);
        project.visualSettings.yAxisLabel = String(settings["cfg-" + prefix + "-y-label"] || project.visualSettings.yAxisLabel);
        var decimals = Number(settings["cfg-decimals"] || 3);
        if ([3, 4, 5, 6].indexOf(decimals) !== -1) project.visualSettings.displayDecimals = decimals;

        var savedWorkspace = null;
        try { savedWorkspace = localStorage.getItem(WORKSPACE_VIEW_STORAGE_KEY); } catch (error) { /* keep default */ }
        var oldView = WORKSPACE_VIEWS.indexOf(savedWorkspace) !== -1 ? savedWorkspace : "data";
        project.preferences.lastStage = workspaceStageFromView(oldView);
        try {
          var panelState = JSON.parse(localStorage.getItem(PANEL_STORAGE_KEY) || "{}");
          project.preferences.advancedPanelOpen = panelState.customization === true;
          project.preferences.seriesPanelOpen = panelState["series-colors-details"] !== false;
        } catch (error) {
          // Preferências antigas inválidas não impedem a migração dos dados.
        }
        project.preferences.accessibility = currentAccessibilityPreferences();
        project.revisions.data = project.data.measurements.length ? 1 : 0;

        var validation = validateProjectDocument(project);
        if (!validation.valid || !validation.project) {
          throw new Error("O rascunho antigo não passou pela validação do projeto: " + validation.issues.join(" "));
        }
        return validation.project;
      }
      function applyProjectToEditor(project) {
        projectPersistenceSuppressed = true;
        activeProject = cloneState(project);
        points = activeProject.data.measurements.map(function (measurement) {
          return {
            id: measurement.id,
            series: measurement.seriesName,
            volume: measurement.volumeInput,
            ph: measurement.phInput
          };
        });
        seriesCatalog = Array.isArray(activeProject.visualSettings.seriesCatalog)
          ? activeProject.visualSettings.seriesCatalog.slice()
          : [];
        ensureSeriesCatalogue();
        hiddenSeries = {};
        (activeProject.visualSettings.hiddenSeries || []).forEach(function (name) { hiddenSeries[name] = true; });
        seriesColors = Object.assign({}, activeProject.visualSettings.seriesColors || {});
        currentView = activeProject.visualSettings.chartControls?.currentView === "derivative" ? "derivative" : "curve";
        var chartSettings = activeProject.visualSettings.chartControls?.settings || {};
        SETTINGS_IDS.forEach(function (id) {
          if (!Object.prototype.hasOwnProperty.call(chartSettings, id)) return;
          var element = document.getElementById(id);
          if (!element) return;
          var value = chartSettings[id];
          if (element.type === "checkbox") element.checked = value === true;
          else element.value = String(value == null ? "" : value);
        });
        entrySeriesInput.value = activeProject.visualSettings.chartControls?.entrySeriesName ||
          (points.length ? effectiveSeriesName(points[points.length - 1].series) : currentSeriesNames()[0] || "Série A");
        syncEntrySeriesOptions();
        colorNamesSignature = "";
        document.querySelectorAll("[data-view]").forEach(function (tab) {
          tab.setAttribute("aria-selected", tab.getAttribute("data-view") === currentView ? "true" : "false");
        });
        restorePanelStates(activeProject);
        applyWorkspaceView(workspaceViewFromStage(activeProject.preferences.lastStage), false, false);
        renderRows();
        renderAll();
        settleHistoryBaseline();
        activeProjectFingerprint = projectFingerprint(activeProject);
        activeProjectNameEl.textContent = activeProject.name;
        projectManagerCloseButton.disabled = false;
        try { localStorage.setItem(LAST_PROJECT_KEY, activeProject.projectId); } catch (error) { /* optional pointer */ }
        setDraftStatus("Projeto aberto · salvamento automático ativo", "saved");
        projectPersistenceSuppressed = false;
      }
      function resetEditorWithoutProject() {
        projectPersistenceSuppressed = true;
        activeProject = null;
        activeProjectFingerprint = "";
        points = [];
        seriesCatalog = ["Série A"];
        hiddenSeries = {};
        seriesColors = {};
        colorNamesSignature = "";
        currentView = "curve";
        entrySeriesInput.value = "Série A";
        entryVolumeInput.value = "";
        entryPhInput.value = "";
        syncEntrySeriesOptions();
        applyWorkspaceView("data", false, false);
        renderRows();
        renderAll();
        settleHistoryBaseline();
        projectManagerCloseButton.disabled = true;
        activeProjectNameEl.textContent = "Nenhum projeto aberto";
        setDraftStatus("Selecione ou crie um projeto", "pending");
        projectPersistenceSuppressed = false;
        try { localStorage.removeItem(LAST_PROJECT_KEY); } catch (error) { /* optional pointer */ }
      }
      function setProjectManagerFeedback(message, state) {
        projectManagerFeedbackEl.textContent = message || "";
        if (state) projectManagerFeedbackEl.dataset.state = state;
        else projectManagerFeedbackEl.removeAttribute("data-state");
      }
      async function initializeProjectManager() {
        try {
          var opened = await openProjectRepository();
          projectRepository = opened.repository;
          projectStorageMode = opened.mode;
          projectStorageNoteEl.textContent = opened.warning || (
            opened.mode === "indexeddb"
              ? "Armazenamento principal: IndexedDB. Os projetos permanecem neste navegador e funcionam offline."
              : "Os projetos usam armazenamento local alternativo neste navegador."
          );
          var existingProjects = await projectRepository.list();
          var migrationDone = false;
          try { migrationDone = localStorage.getItem(PROJECT_MIGRATION_KEY) === "done"; } catch (error) { /* migration still checks the draft */ }
          if (!migrationDone && existingProjects.length === 0) {
            var legacyProject = migrateLegacyDraftToProject();
            if (legacyProject) {
              await projectRepository.save(legacyProject);
              setProjectManagerFeedback("O rascunho anterior foi recuperado como um projeto. O arquivo de recuperação original foi preservado.", "success");
            }
          }
          try { localStorage.setItem(PROJECT_MIGRATION_KEY, "done"); } catch (error) {
            // A presença dos projetos no repositório impede que a migração seja repetida em condições normais.
          }

          projectManagerController = new ProjectManagerUI(projectRepository, projectStorageMode, {
            getActiveProject: function () { return activeProject; },
            saveActiveProject: async function () {
              flushHistoryCheckpoint();
              await persistDraft();
            },
            openProject: async function (project) {
              applyProjectToEditor(project);
            },
            onActiveProjectDeleted: async function () {
              resetEditorWithoutProject();
            }
          });
          await projectManagerController.initialize();
        } catch (error) {
          if (projectManagerDialog instanceof HTMLDialogElement && !projectManagerDialog.open) projectManagerDialog.showModal();
          projectStorageNoteEl.textContent = "Não foi possível abrir o armazenamento de projetos.";
          setProjectManagerFeedback(error instanceof Error ? error.message : "Erro ao iniciar o gerenciador de projetos.", "error");
        }
      }
      function setEntryFeedback(message, state, invalidInput) {
        [entrySeriesInput, entryVolumeInput, entryPhInput].forEach(function (input) {
          input.removeAttribute("aria-invalid");
        });
        if (invalidInput) invalidInput.setAttribute("aria-invalid", "true");
        entryStatusEl.textContent = message;
        entryStatusEl.dataset.state = state || "info";
      }
      function addPoint() {
        var volumeText = String(entryVolumeInput.value || "").trim();
        var phText = String(entryPhInput.value || "").trim();
        if (!volumeText) {
          setEntryFeedback("Informe o volume adicionado em mL.", "error", entryVolumeInput);
          entryVolumeInput.focus();
          return;
        }
        if (!phText) {
          setEntryFeedback("Informe o pH medido.", "error", entryPhInput);
          entryPhInput.focus();
          return;
        }
        var volume = parseNumber(volumeText);
        var ph = parseNumber(phText);
        if (volume === null || Number.isNaN(volume) || !Number.isFinite(volume)) {
          setEntryFeedback("O volume precisa ser um número válido. Use vírgula ou ponto decimal.", "error", entryVolumeInput);
          entryVolumeInput.focus();
          return;
        }
        if (volume < 0) {
          setEntryFeedback("O volume não pode ser negativo.", "error", entryVolumeInput);
          entryVolumeInput.focus();
          return;
        }
        if (ph === null || Number.isNaN(ph) || !Number.isFinite(ph)) {
          setEntryFeedback("O pH precisa ser um número válido. Use vírgula ou ponto decimal.", "error", entryPhInput);
          entryPhInput.focus();
          return;
        }
        if (ph < 0 || ph > 14) {
          setEntryFeedback("O pH informado precisa estar entre 0 e 14.", "error", entryPhInput);
          entryPhInput.focus();
          return;
        }
        var series = String(entrySeriesInput.value == null ? "" : entrySeriesInput.value);
        if (series === "") series = currentSeriesNames()[0] || "Série A";
        series = registerSeriesName(series);
        recordUndoCheckpoint();
        points.push({ id: createMeasurementId(), series: series, volume: volumeText, ph: phText });
        renderRows();
        renderAll();
        settleHistoryBaseline();
        syncEntrySeriesOptions();
        entrySeriesInput.value = series;
        entryVolumeInput.value = "";
        entryPhInput.value = "";
        setEntryFeedback("Leitura adicionada à tabela. Você pode continuar na mesma série ou trocar o nome.", "success");
        entryVolumeInput.focus();
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
          imported.push({
            id: createMeasurementId(),
            series: effectiveSeriesName(series),
            volume: String(volume == null ? "" : volume).trim(),
            ph: String(ph == null ? "" : ph).trim()
          });
        });
        if (!imported.length) throw new Error("Não encontrei linhas com volume e pH. Verifique o cabeçalho e use ponto e vírgula para separar as colunas.");
        recordUndoCheckpoint();
        points = imported;
        ensureSeriesCatalogue();
        syncEntrySeriesOptions();
        entrySeriesInput.value = effectiveSeriesName(imported[imported.length - 1].series);
        entryVolumeInput.value = "";
        entryPhInput.value = "";
        setEntryFeedback("Le CSV foi importado. Revise as leituras na tabela.", "success");
        renderRows();
        renderAll();
        settleHistoryBaseline();
      }
      entryForm.addEventListener("input", function (event) {
        if (event.target && typeof event.target.removeAttribute === "function") {
          event.target.removeAttribute("aria-invalid");
        }
        if (entryStatusEl.textContent) {
          entryStatusEl.textContent = "";
          entryStatusEl.removeAttribute("data-state");
        }
      });
      entryForm.addEventListener("submit", function (event) {
        event.preventDefault();
        addPoint();
      });
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
          seriesCatalog: seriesCatalog.slice(),
          hiddenSeries: Object.assign({}, hiddenSeries),
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
            if (Array.isArray(parsed.seriesCatalog)) {
              seriesCatalog = parsed.seriesCatalog.filter(function (name) {
                return typeof name === "string" && name !== "";
              }).slice(0, 200);
            }
            if (parsed.hiddenSeries && typeof parsed.hiddenSeries === "object") {
              hiddenSeries = {};
              Object.keys(parsed.hiddenSeries).forEach(function (name) {
                if (parsed.hiddenSeries[name] === true) hiddenSeries[name] = true;
              });
            }
            ensureSeriesCatalogue();
            syncEntrySeriesOptions();
            if (currentSeriesNames().indexOf(entrySeriesInput.value) === -1) entrySeriesInput.value = currentSeriesNames()[0];
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
        points = [];
        entrySeriesInput.value = currentSeriesNames()[0] || "Série A";
        entryVolumeInput.value = "";
        entryPhInput.value = "";
        setEntryFeedback("", "");
        renderRows();
        renderAll();
        settleHistoryBaseline();
      });
      document.getElementById("load-example").addEventListener("click", function () {
        recordUndoCheckpoint();
        points = [
          { id: createMeasurementId(), series: "Exemplo", volume: "0", ph: "6,8" },
          { id: createMeasurementId(), series: "Exemplo", volume: "1", ph: "6,9" },
          { id: createMeasurementId(), series: "Exemplo", volume: "2", ph: "6,85" },
          { id: createMeasurementId(), series: "Exemplo", volume: "3", ph: "7,0" },
          { id: createMeasurementId(), series: "Exemplo", volume: "4", ph: "7,1" }
        ];
        registerSeriesName("Exemplo");
        syncEntrySeriesOptions();
        entrySeriesInput.value = "Exemplo";
        renderRows();
        renderAll();
        settleHistoryBaseline();
      });
      document.getElementById("print-chart").addEventListener("click", function () {
        setWorkspaceView("graph");
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () { window.print(); });
        });
      });
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
      seriesCreateForm.addEventListener("submit", createSeriesFromForm);
      seriesColorsEl.addEventListener("click", handleSeriesManagerAction);
      seriesColorsEl.addEventListener("input", function (event) {
        var input = event.target.closest("input[data-series-color-index]");
        if (!input) return;
        var index = Number(input.getAttribute("data-series-color-index"));
        var name = currentSeriesNames()[index];
        if (name == null) return;
        scheduleHistoryCheckpoint();
        seriesColors[name] = input.value;
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
        var field = input.getAttribute("data-field");
        points[index][field] = input.value;
        renderAll();
      });
      rowsEl.addEventListener("focusout", function (event) {
        var input = event.target.closest('input[data-field="series"]');
        if (!input) return;
        registerSeriesName(input.value);
        colorNamesSignature = "";
        renderAll();
      });
      rowsEl.addEventListener("click", function (event) {
        var button = event.target.closest("button[data-remove]");
        if (!button) return;
        var index = Number(button.getAttribute("data-remove"));
        if (!Number.isInteger(index)) return;
        recordUndoCheckpoint();
        points.splice(index, 1);
        renderRows();
        renderAll();
        settleHistoryBaseline();
      });
      setupWorkspaceNavigation();
      setupPanelDisclosures();
      restoreWorkspaceView();
      projectPersistenceSuppressed = true;
      ensureMeasurementIds(points);
      ensureSeriesCatalogue();
      syncEntrySeriesOptions();
      renderRows();
      renderAll();
      settleHistoryBaseline();
      projectPersistenceSuppressed = false;
      window.addEventListener("pagehide", function () {
        flushHistoryCheckpoint();
        void persistDraft();
      });
      window.addEventListener("blur", flushHistoryCheckpoint);
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") {
          flushHistoryCheckpoint();
          void persistDraft();
        }
      });
      void initializeProjectManager();
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
        if (projectManagerDialog instanceof HTMLDialogElement && projectManagerDialog.open) return;
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
          setWorkspaceView("data");
          addPoint();
          return;
        }
        if (key === "e" && event.shiftKey) {
          event.preventDefault();
          exportCSV();
        }
      });
    })();
  