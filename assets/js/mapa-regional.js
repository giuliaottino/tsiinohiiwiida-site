/* Mapa regional das páginas de conteúdo.

   Mostra o limite do município de São Gabriel da Cachoeira sobre imagem de
   satélite. De propósito NÃO desenha pontos de coleta, registros nem comunidades:
   localização exata é dado sensível.

   Com data-expedition="<id>", desenha também os trajetos de GPS daquela expedição
   — os mesmos já publicados no mapa e no módulo 3D de /expedicoes/ (expedicoes/3d/data.js).
   Só as linhas: nenhum ponto, registro ou foto georreferenciada. O zoom máximo (11)
   continua baixo de propósito.

   Uso: <div class="doc-map" data-regional-map data-site-root="../../"
             [data-expedition="tiquie-julho-2026"] role="region" aria-label="…"></div>
   O Leaflet (assets/vendor/leaflet) só é baixado quando o mapa se aproxima da tela.
*/
(function () {
  "use strict";

  function build(el, root) {
    if (el.dataset.ready || typeof L === "undefined") return;
    el.dataset.ready = "1";
    var map = L.map(el, { zoomControl: false, scrollWheelZoom: false, attributionControl: true });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 11,
      attribution: "Imagem: Esri, Maxar, Earthstar Geographics"
    }).addTo(map);
    fetch(root + "_input_data/limites/sao_gabriel_da_cachoeira.geojson")
      .then(function (response) {
        if (!response.ok) throw new Error("limite municipal indisponível");
        return response.json();
      })
      .then(function (geojson) {
        var layer = L.geoJSON(geojson, {
          style: { color: "#A93632", weight: 3, opacity: 1, fillColor: "#626A38", fillOpacity: 0.18 }
        }).addTo(map);
        L.control.zoom({ position: "bottomright" }).addTo(map);
        // A vista é definida uma única vez (nos trajetos, se houver; senão no município).
        var fallback = function () { map.fitBounds(layer.getBounds(), { padding: [18, 18] }); };
        trails(el, root, map, fallback);
      })
      .catch(function () {
        el.textContent = "Não foi possível carregar o mapa.";
      });
  }

  /* Trajetos da expedição: linhas simples a partir dos dados do módulo 3D. */
  function trails(el, root, map, fallback) {
    var id = el.getAttribute("data-expedition");
    if (!id) { fallback(); return; }
    function draw() {
      var all = (window.TSIINO_EXP && window.TSIINO_EXP.expeditions) || [];
      var exp = all.filter(function (e) { return e.id === id; })[0];
      if (!exp || !exp.trails || !exp.trails.length) { fallback(); return; }
      var group = L.featureGroup();
      exp.trails.forEach(function (trail) {
        var latlngs = (trail.coords || []).map(function (c) { return [c[1], c[0]]; });
        if (latlngs.length < 2) return;
        L.polyline(latlngs, { color: "#11150d", weight: 5, opacity: 0.55, interactive: false }).addTo(group);
        L.polyline(latlngs, { color: "#e0b354", weight: 2.5, opacity: 1, interactive: false }).addTo(group);
      });
      if (!group.getLayers().length) { fallback(); return; }
      group.addTo(map);
      map.fitBounds(group.getBounds(), { padding: [28, 28], maxZoom: 11 });
    }
    if (window.TSIINO_EXP) { draw(); return; }
    var js = document.createElement("script");
    js.src = root + "expedicoes/3d/data.js";
    js.onload = draw;
    js.onerror = fallback;
    document.head.appendChild(js);
  }

  function load(el) {
    var root = el.getAttribute("data-site-root") || "";
    if (typeof L !== "undefined") { build(el, root); return; }
    if (!document.getElementById("tsiino-leaflet-css")) {
      var css = document.createElement("link");
      css.id = "tsiino-leaflet-css";
      css.rel = "stylesheet";
      css.href = root + "assets/vendor/leaflet/leaflet.css";
      document.head.appendChild(css);
    }
    var js = document.createElement("script");
    js.src = root + "assets/vendor/leaflet/leaflet.js";
    js.onload = function () { build(el, root); };
    document.head.appendChild(js);
  }

  function init() {
    document.querySelectorAll("[data-regional-map]").forEach(function (el) {
      if (!("IntersectionObserver" in window)) { load(el); return; }
      var observer = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) {
          observer.disconnect();
          load(el);
        }
      }, { rootMargin: "500px 0px" });
      observer.observe(el);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
