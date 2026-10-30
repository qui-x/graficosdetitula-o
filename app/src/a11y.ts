// @ts-nocheck -- adaptado do editor anterior; os controles são mantidos para compatibilidade visual.

  /* Preferências A11Y adaptadas do SIAB; o editor continua independente. */
  (function () {
    "use strict";
    var root = document.documentElement;
    var storageKey = "graficos_titulacao_a11y_v1";
    var defaults = { theme: "dark", contrast: false, fontScale: 1, spacing: false, reading: false, motion: false, colorblind: "none", libras: false };
    var state = Object.assign({}, defaults);
    var allowedColorModes = ["none", "protanopia", "deuteranopia", "tritanopia", "acromatopsia"];
    var colorLayer = document.getElementById("colorblindOverlay");
    var status = document.getElementById("a11y-status");
    var librasScript = null;

    function clampFont(value) {
      var n = Number(value);
      if (!Number.isFinite(n)) n = 1;
      return Math.max(0.75, Math.min(2, Math.round(n * 100) / 100));
    }
    function normalize(source) {
      var result = Object.assign({}, defaults, source || {});
      result.theme = result.theme === "light" ? "light" : "dark";
      result.contrast = result.contrast === true;
      result.fontScale = clampFont(result.fontScale);
      ["spacing", "reading", "motion", "libras"].forEach(function (key) { result[key] = result[key] === true; });
      result.colorblind = allowedColorModes.indexOf(result.colorblind) >= 0 ? result.colorblind : "none";
      return result;
    }
    function readPrefs() {
      try {
        var saved = localStorage.getItem(storageKey);
        if (saved) state = normalize(JSON.parse(saved));
      } catch (error) { state = Object.assign({}, defaults); }
    }
    function savePrefs() {
      try { localStorage.setItem(storageKey, JSON.stringify(state)); return true; }
      catch (error) { return false; }
    }
    function updateStatus(message) {
      if (message) status.textContent = message;
    }
    function syncControls() {
      document.getElementById("a11y-theme").checked = state.theme === "dark";
      document.getElementById("a11y-contrast").checked = state.contrast;
      document.getElementById("a11y-font-output").textContent = Math.round(state.fontScale * 100) + "%";
      document.getElementById("a11y-font-minus").disabled = state.fontScale <= 0.75;
      document.getElementById("a11y-font-plus").disabled = state.fontScale >= 2;
      document.getElementById("a11y-spacing").checked = state.spacing;
      document.getElementById("a11y-reading").checked = state.reading;
      document.getElementById("a11y-motion").checked = state.motion;
      document.getElementById("a11y-colorblind").value = state.colorblind;
      document.getElementById("a11y-libras").checked = state.libras;
    }
    function applyState() {
      root.setAttribute("data-theme", state.theme);
      root.setAttribute("data-contrast", state.contrast ? "on" : "off");
      root.setAttribute("data-spacing", state.spacing ? "on" : "off");
      root.setAttribute("data-reading", state.reading ? "on" : "off");
      root.setAttribute("data-motion", state.motion ? "on" : "off");
      root.setAttribute("data-colorblind", state.colorblind);
      root.style.setProperty("--font-scale", state.fontScale);
      root.style.setProperty("--a11y-font-scale", state.fontScale);
      root.style.colorScheme = state.contrast ? "dark" : state.theme;
      var themeColor = document.querySelector('meta[name="theme-color"]');
      if (themeColor) themeColor.setAttribute("content", state.contrast ? "#000000" : state.theme === "light" ? "#edf3f8" : "#101d2b");
      if (colorLayer) {
        var filter = state.colorblind === "none" ? "none" : "url(#f-" + state.colorblind + ")";
        colorLayer.style.backdropFilter = filter;
        colorLayer.style.webkitBackdropFilter = filter;
      }
      syncControls();
    }
    function setPreference(key, value, message) {
      var next = Object.assign({}, state);
      next[key] = value;
      state = normalize(next);
      applyState();
      var saved = savePrefs();
      if (window.A11Y) { window.A11Y.estado = state; window.A11Y.state = state; }
      updateStatus(message || (saved ? "Preferência aplicada." : "Aplicada nesta sessão; o navegador não permitiu salvar."));
    }
    function loadLibras() {
      var existingScript = document.getElementById("vlibras-script");
      var existingWidget = document.getElementById("vlibras-widget");
      if (existingScript && existingWidget) {
        existingWidget.hidden = false;
        updateStatus("VLibras ativado.");
        return;
      }
      if (existingScript) {
        updateStatus("VLibras já foi solicitado.");
        return;
      }
      if (navigator.onLine === false) {
        setPreference("libras", false, "VLibras precisa de internet.");
        return;
      }
      var widget = document.createElement("div");
      widget.setAttribute("vw", "");
      widget.className = "enabled";
      widget.id = "vlibras-widget";
      widget.innerHTML = '<div vw-access-button class="active"></div><div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
      document.body.appendChild(widget);
      var script = document.createElement("script");
      script.id = "vlibras-script";
      script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
      librasScript = script;
      script.onload = function () {
        try {
          if (!window.VLibras || !window.VLibras.Widget) throw new Error("VLibras indisponível");
          new window.VLibras.Widget("https://vlibras.gov.br/app");
          updateStatus("VLibras ativado.");
        } catch (error) {
          widget.remove();
          setPreference("libras", false, "VLibras não pôde ser iniciado.");
        }
      };
      script.onerror = function () {
        widget.remove();
        script.remove();
        setPreference("libras", false, "VLibras indisponível. Verifique a conexão.");
      };
      document.body.appendChild(script);
      updateStatus("Carregando VLibras…");
    }
    function disableLibras() {
      var widget = document.getElementById("vlibras-widget");
      if (widget) widget.hidden = true;
      updateStatus("VLibras ocultado.");
    }

    readPrefs();
    applyState();
    window.A11Y = {
      estado: state,
      state: state,
      definir: function (key, value) { setPreference(key, value); this.estado = state; this.state = state; },
      restaurar: function () {
        state = Object.assign({}, defaults);
        applyState();
        savePrefs();
        this.estado = state;
        this.state = state;
        updateStatus("Preferências restauradas.");
      }
    };
    document.getElementById("a11y-theme").addEventListener("change", function (event) { setPreference("theme", event.target.checked ? "dark" : "light"); window.A11Y.estado = window.A11Y.state = state; });
    document.getElementById("a11y-contrast").addEventListener("change", function (event) { setPreference("contrast", event.target.checked); window.A11Y.estado = window.A11Y.state = state; });
    document.getElementById("a11y-spacing").addEventListener("change", function (event) { setPreference("spacing", event.target.checked); window.A11Y.estado = window.A11Y.state = state; });
    document.getElementById("a11y-reading").addEventListener("change", function (event) { setPreference("reading", event.target.checked); window.A11Y.estado = window.A11Y.state = state; });
    document.getElementById("a11y-motion").addEventListener("change", function (event) { setPreference("motion", event.target.checked); window.A11Y.estado = window.A11Y.state = state; });
    document.getElementById("a11y-colorblind").addEventListener("change", function (event) { setPreference("colorblind", event.target.value); window.A11Y.estado = window.A11Y.state = state; });
    document.getElementById("a11y-font-minus").addEventListener("click", function () { setPreference("fontScale", clampFont((state.fontScale - 0.1).toFixed(2))); window.A11Y.estado = window.A11Y.state = state; });
    document.getElementById("a11y-font-plus").addEventListener("click", function () { setPreference("fontScale", clampFont((state.fontScale + 0.1).toFixed(2))); window.A11Y.estado = window.A11Y.state = state; });
    document.getElementById("a11y-libras").addEventListener("change", function (event) {
      if (event.target.checked) setPreference("libras", true);
      else { setPreference("libras", false); disableLibras(); }
      window.A11Y.estado = window.A11Y.state = state;
      if (state.libras) loadLibras();
    });
    document.getElementById("a11y-reset").addEventListener("click", function () {
      if (state.libras) disableLibras();
      state = Object.assign({}, defaults);
      applyState();
      savePrefs();
      window.A11Y.estado = window.A11Y.state = state;
      updateStatus("Preferências restauradas.");
    });
    if (state.libras) loadLibras();
  })();
