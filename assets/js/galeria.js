/* galeria.js — visualizador de fotos acessível para as galerias do site.

   Marcação:
     <div data-gallery>
       <button type="button" data-full="foto-grande.jpg" data-caption="Legenda"><img …></button> …
     </div>
     <dialog class="photo-viewer"> <figure><img alt=""><figcaption>
        <span class="pv-caption"></span><span class="pv-count"></span></figcaption></figure>
        <button class="pv-close">, <button class="pv-prev">, <button class="pv-next"> </dialog>

   Teclado: Enter/Espaço abre, ← → trocam de foto, Esc fecha, e o foco volta para a
   miniatura de origem. Usa <dialog>, então o foco fica preso no visualizador e o
   resto da página fica inerte enquanto ele está aberto. Sem JavaScript, as
   miniaturas continuam visíveis na página.
*/
(function () {
  "use strict";

  function init() {
    var dlg = document.querySelector("dialog.photo-viewer");
    if (!dlg || typeof dlg.showModal !== "function") return;
    var img = dlg.querySelector("img");
    var cap = dlg.querySelector(".pv-caption");
    var count = dlg.querySelector(".pv-count");
    var set = [], idx = 0, opener = null;

    function show(i) {
      idx = (i + set.length) % set.length;
      var item = set[idx];
      var thumb = item.querySelector("img");
      img.src = item.getAttribute("data-full");
      img.alt = thumb ? thumb.alt : "";
      cap.textContent = item.getAttribute("data-caption") || "";
      count.textContent = (idx + 1) + " / " + set.length;
    }

    document.addEventListener("click", function (event) {
      var item = event.target.closest && event.target.closest("[data-gallery] [data-full]");
      if (!item) return;
      set = Array.prototype.slice.call(item.closest("[data-gallery]").querySelectorAll("[data-full]"));
      opener = item;
      show(set.indexOf(item));
      dlg.showModal();
    });
    dlg.querySelector(".pv-prev").addEventListener("click", function () { show(idx - 1); });
    dlg.querySelector(".pv-next").addEventListener("click", function () { show(idx + 1); });
    dlg.querySelector(".pv-close").addEventListener("click", function () { dlg.close(); });
    dlg.addEventListener("click", function (event) { if (event.target === dlg) dlg.close(); });
    dlg.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") { event.preventDefault(); show(idx - 1); }
      if (event.key === "ArrowRight") { event.preventDefault(); show(idx + 1); }
    });
    dlg.addEventListener("close", function () {
      img.removeAttribute("src");
      if (opener) opener.focus();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
