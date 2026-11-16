/* painel-graficos.js — interação dos gráficos do painel (R/painel_biodiversidade.R).

   Os gráficos funcionam sem este arquivo (são SVG estático com legenda e tabela
   "Ver dados"). Aqui entram só as melhorias:
   - dica flutuante (tooltip) ao passar o mouse, tocar ou focar pelo teclado em uma
     fatia, uma linha da legenda ou um ano da série;
   - rosca: a fatia em foco se destaca e o centro mostra o valor dela;
   - série anual: os textos mantêm tamanho legível quando o SVG encolhe no celular.
*/
(function () {
  "use strict";

  var tip = null;

  function ensureTip() {
    if (tip) return tip;
    tip = document.createElement("div");
    tip.className = "chart-tip";
    tip.setAttribute("role", "status");
    tip.hidden = true;
    document.body.appendChild(tip);
    return tip;
  }

  function showTip(html, x, y) {
    var el = ensureTip();
    el.innerHTML = html;
    el.hidden = false;
    var w = el.offsetWidth, h = el.offsetHeight;
    var left = Math.min(Math.max(8, x - w / 2), document.documentElement.clientWidth - w - 8);
    var top = y - h - 14;
    if (top < 8) top = y + 18;
    el.style.left = left + window.scrollX + "px";
    el.style.top = top + window.scrollY + "px";
  }

  function hideTip() { if (tip) tip.hidden = true; }

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function pointOf(event, el) {
    if (event && event.clientX !== undefined && (event.clientX || event.clientY)) return [event.clientX, event.clientY];
    var r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + Math.min(r.height / 2, 40)];
  }

  /* ---------- rosca ---------- */
  function setupDonut(figure) {
    var total = figure.querySelector(".svg-donut-total");
    var sub = figure.querySelector(".svg-donut-sub");
    var segs = figure.querySelectorAll(".donut-seg");
    var rows = figure.querySelectorAll(".svg-legend li");

    function activate(i, event, source) {
      var seg = figure.querySelector('.donut-seg[data-i="' + i + '"]');
      if (!seg) return;
      figure.classList.add("has-active");
      segs.forEach(function (s) { s.classList.toggle("is-active", s === seg); });
      rows.forEach(function (r) { r.classList.toggle("is-active", r.getAttribute("data-i") === String(i)); });
      if (total) total.textContent = seg.getAttribute("data-pct");
      if (sub) sub.textContent = seg.getAttribute("data-label");
      var color = seg.getAttribute("fill");
      var p = pointOf(event, source || seg);
      showTip('<span class="chart-tip-swatch" style="background:' + esc(color) + '"></span>' +
        "<strong>" + esc(seg.getAttribute("data-label")) + "</strong>" +
        '<span class="chart-tip-value">' + esc(seg.getAttribute("data-value")) + " registros · " + esc(seg.getAttribute("data-pct")) + "</span>",
        p[0], p[1]);
    }
    function reset() {
      figure.classList.remove("has-active");
      segs.forEach(function (s) { s.classList.remove("is-active"); });
      rows.forEach(function (r) { r.classList.remove("is-active"); });
      if (total) total.textContent = total.getAttribute("data-default");
      if (sub) sub.textContent = sub.getAttribute("data-default");
      hideTip();
    }
    [].concat([].slice.call(segs), [].slice.call(rows)).forEach(function (el) {
      var i = el.getAttribute("data-i");
      el.addEventListener("pointerenter", function (e) { activate(i, e, el); });
      el.addEventListener("pointermove", function (e) { activate(i, e, el); });
      el.addEventListener("pointerleave", reset);
      el.addEventListener("focus", function () { activate(i, null, el); });
      el.addEventListener("blur", reset);
      el.addEventListener("click", function (e) { activate(i, e, el); });
    });
  }

  /* ---------- série anual ---------- */
  function setupSerie(figure) {
    var svg = figure.querySelector("svg");
    if (!svg) return;
    var cursor = document.createElementNS("http://www.w3.org/2000/svg", "line");
    cursor.setAttribute("class", "svg-cursor");
    cursor.setAttribute("stroke", "#1a1c17");
    cursor.setAttribute("stroke-width", "1");
    cursor.setAttribute("stroke-dasharray", "2 3");
    cursor.setAttribute("visibility", "hidden");
    svg.insertBefore(cursor, svg.querySelector(".svg-hit"));

    svg.querySelectorAll(".svg-hit").forEach(function (rect) {
      function on(e) {
        var x = Number(rect.getAttribute("x")) + Number(rect.getAttribute("width")) / 2;
        cursor.setAttribute("x1", x); cursor.setAttribute("x2", x);
        cursor.setAttribute("y1", rect.getAttribute("y"));
        cursor.setAttribute("y2", Number(rect.getAttribute("y")) + Number(rect.getAttribute("height")));
        cursor.setAttribute("visibility", "visible");
        var p = pointOf(e, rect);
        showTip("<strong>" + esc(rect.getAttribute("data-label")) + "</strong>" +
          '<span class="chart-tip-value">' + esc(rect.getAttribute("data-value")) + " registros</span>", p[0], p[1]);
      }
      rect.addEventListener("pointerenter", on);
      rect.addEventListener("pointermove", on);
      rect.addEventListener("click", on);
    });
    svg.addEventListener("pointerleave", function () { cursor.setAttribute("visibility", "hidden"); hideTip(); });

    /* Texto legível em qualquer largura: compensa a escala do viewBox. */
    var base = Number((svg.getAttribute("viewBox") || "0 0 640 280").split(" ")[2]) || 640;
    function fit() {
      var scale = svg.getBoundingClientRect().width / base;
      if (!scale) return;
      var factor = Math.min(Math.max(1 / scale, 1), 1.6);
      svg.querySelectorAll("text[data-fs]").forEach(function (t) {
        t.setAttribute("font-size", (Number(t.getAttribute("data-fs")) * factor).toFixed(1));
      });
      svg.classList.toggle("is-narrow", scale < 0.75);
    }
    fit();
    if ("ResizeObserver" in window) new ResizeObserver(fit).observe(svg);
    else window.addEventListener("resize", fit);
  }

  function init() {
    document.querySelectorAll("figure.svg-donut").forEach(setupDonut);
    document.querySelectorAll("figure.svg-serie").forEach(setupSerie);
    window.addEventListener("scroll", hideTip, { passive: true });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") hideTip(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
