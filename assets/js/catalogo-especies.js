/* catalogo-especies.js — lista de espécies sob demanda, reaproveitável em outros painéis.
 *
 * Marcação esperada (gerada por species_drawer() em R/painel_biodiversidade.R):
 *   <details class="species-drawer" data-catalogo-especies
 *            data-indice="../assets/data/acesso/especies.json"
 *            data-detalhes="../assets/data/acesso/detalhes.json"
 *            data-grupo="Fungos">            <!-- "Geral" ou vazio = todos os grupos -->
 *     <summary>...</summary><div class="species-drawer-panel"></div>
 *   </details>
 *
 * - especies.json só é baixado quando a gaveta é aberta (uma vez para todas as gavetas);
 * - detalhes.json (links e registros) só ao abrir a primeira espécie;
 * - a lista é desenhada em lotes, para continuar leve com milhares de espécies.
 *
 * Apresentação: uma coluna, agrupada por família. Cada espécie é uma linha clicável
 * (botão com aria-expanded) que abre os links para bases externas, em blocos com o
 * ícone de cada base, e a tabela de registros de coleta.
 */
(function () {
  'use strict';
  const LOTE = 80;
  const REGISTROS_VISIVEIS = 5;
  const cache = new Map();
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = new Intl.NumberFormat('pt-BR');
  const norm = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // Ícone de cada base (arquivos em _input_data/icons/). Sem ícone: iniciais.
  const ICONES = {
    ffb_taxon_url: 'ffb.png', powo_taxon_url: 'powo.png', gbif_taxon_url: 'gbif.png', wfo_taxon_url: 'wfo.png',
    col_url: 'col.png', opentree_url: 'OpenTree.png', inaturalist_url: 'inaturalist.png',
    ncbi_taxonomy_url: 'nih.png', ncbi_nucleotide_url: 'nih.png', ebi_search_url: 'ebi.png', europepmc_url: 'ebi.png',
    index_fungorum_taxon_url: 'indexfungorum.png', mycobank_taxon_url: 'mycobank.png'
  };

  function carregar(url) {
    if (!cache.has(url)) {
      cache.set(url, fetch(url).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }).catch((err) => { cache.delete(url); throw err; }));
    }
    return cache.get(url);
  }

  function linhasDoIndice(indice) {
    const cols = indice.colunas;
    return indice.linhas.map((row, id) => {
      const o = { id };
      cols.forEach((c, k) => { o[c] = row[k]; });
      o.busca = norm(o.especie + ' ' + o.familia);
      return o;
    });
  }

  // Realça o trecho encontrado pela busca (comparação sem acentos).
  function realce(texto, q) {
    if (!q) return esc(texto);
    const base = norm(texto);
    const i = base.indexOf(q);
    if (i < 0 || base.length !== String(texto).length) return esc(texto);
    return esc(texto.slice(0, i)) + '<mark>' + esc(texto.slice(i, i + q.length)) + '</mark>' + esc(texto.slice(i + q.length));
  }

  const rotuloRegistros = (n) => (n === 1 ? '1 registro' : `${fmt.format(n)} registros`);
  const rotuloAnos = (sp) => (sp.ano_min ? (sp.ano_min === sp.ano_max ? String(sp.ano_min) : `${sp.ano_min}–${sp.ano_max}`) : '');

  function linha(sp, q, comFamilia, uid) {
    const projeto = sp.reg_projeto
      ? '<span class="sp-dot" role="img" aria-label="Registrada nas expedições do projeto" title="Registrada nas expedições do projeto"></span>' : '';
    const familia = comFamilia ? `<span class="sp-row-family">${realce(sp.familia, q)}</span>` : '';
    const alvo = `sp-${uid}-${sp.id}`;
    return `<div class="sp-row" data-id="${sp.id}" role="listitem">
      <button type="button" class="sp-row-btn" aria-expanded="false" aria-controls="${alvo}">
        <span class="sp-chevron" aria-hidden="true"></span>
        <span class="sp-name"><em translate="no">${realce(sp.especie, q)}</em>${projeto}${familia}</span>
        <span class="sp-count">${rotuloRegistros(sp.registros)}</span>
        <span class="sp-years">${rotuloAnos(sp)}</span>
      </button>
      <div class="sp-detail" id="${alvo}" hidden></div>
    </div>`;
  }

  function dominio(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  function detalheHtml(det, info, raiz) {
    const links = (info.l && !Array.isArray(info.l)) ? info.l : {};
    const grupos = new Map();
    det.fontes_links.forEach((f) => {
      [].concat(links[f.chave] || []).forEach((url, j, arr) => {
        if (!grupos.has(f.grupo)) grupos.set(f.grupo, []);
        const rotulo = arr.length > 1 ? `${f.rotulo} · ${j + 1}` : f.rotulo;
        const icone = ICONES[f.chave]
          ? `<img class="sp-link-icon" src="${raiz}_input_data/icons/${ICONES[f.chave]}" alt="" width="22" height="22" loading="lazy">`
          : `<span class="sp-link-icon sp-link-mono" aria-hidden="true">${esc(f.rotulo.replace(/[^A-Za-z]/g, '').slice(0, 2))}</span>`;
        grupos.get(f.grupo).push(
          `<a class="sp-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icone}` +
          `<span class="sp-link-text"><span class="sp-link-name">${esc(rotulo)}</span><span class="sp-link-host" translate="no">${esc(dominio(url))}</span></span>` +
          '<span class="sp-link-arrow" aria-hidden="true">↗</span></a>');
      });
    });
    const blocoLinks = grupos.size ? `<div class="sp-links">${[...grupos].map(([g, items]) =>
      `<div class="sp-link-group"><h6>${esc(g)}</h6><div class="sp-link-grid">${items.join('')}</div></div>`).join('')}</div>` : '';

    const registros = info.r || [];
    const linhas = registros.map(([rotulo, url, gbifId, data, meta, local, fonte], k) => {
      const href = url || (gbifId ? `https://www.gbif.org/occurrence/search?OCCURRENCE_ID=${encodeURIComponent(gbifId)}` : '');
      const titulo = href
        ? `<a class="occurrence-record-primary${!url && gbifId ? ' gbif-occurrence-lookup' : ''}" href="${esc(href)}" target="_blank" rel="noopener noreferrer"${!url && gbifId ? ` data-occurrence-id="${esc(gbifId)}"` : ''}>${esc(rotulo)}<span aria-hidden="true"> ↗</span></a>`
        : `<span class="occurrence-record-primary">${esc(rotulo)}</span>`;
      return `<tr${k >= REGISTROS_VISIVEIS ? ' class="sp-extra" hidden' : ''}>
        <td>${titulo}${meta ? `<small>${esc(meta)}</small>` : ''}</td>
        <td class="sp-num" data-th="Data">${esc(data)}</td><td>${esc(local)}</td><td>${esc(fonte)}</td></tr>`;
    }).join('');
    const resto = registros.length - REGISTROS_VISIVEIS;
    const blocoRegistros = registros.length ? `<div class="sp-records">
        <h6>Registros de ocorrência · ${fmt.format(registros.length)}</h6>
        <div class="sp-table-wrap"><table>
          <thead><tr><th scope="col">Registro</th><th scope="col">Data</th><th scope="col">Localidade</th><th scope="col">Origem</th></tr></thead>
          <tbody>${linhas}</tbody></table></div>
        ${resto > 0 ? `<button type="button" class="sp-more-records">Mostrar todos os registros (${fmt.format(registros.length)})</button>` : ''}
      </div>` : '';
    return (blocoLinks + blocoRegistros) || '<p class="taxon-links-empty">Nenhum link ou registro disponível para esta espécie.</p>';
  }

  let contador = 0;

  function montar(drawer) {
    const painel = drawer.querySelector('.species-drawer-panel');
    const grupo = drawer.dataset.grupo || '';
    const uid = ++contador;
    const raiz = (drawer.dataset.indice || '').replace(/assets\/data\/.*$/, '');
    painel.innerHTML = '<p class="species-search-status" role="status">Carregando a lista...</p>';

    carregar(drawer.dataset.indice).then((indice) => {
      const todas = linhasDoIndice(indice).filter((s) => !grupo || grupo === 'Geral' || s.grupo === grupo);
      const st = { q: '', fonte: 'todas', ordem: 'familia', mostradas: LOTE, filtradas: todas };
      painel.innerHTML = `
        <p class="sp-intro">Clique em uma espécie para ver os links para bases taxonômicas e os registros de coleta.
          <span class="sp-legend"><span class="sp-dot" aria-hidden="true"></span>Registrada nas expedições do projeto</span></p>
        <div class="sp-toolbar">
          <label class="sp-field sp-field-search"><span>Buscar por espécie ou família</span>
            <input type="search" class="species-search-input" placeholder="Ex.: Pouteria ou Sapotaceae" autocomplete="off"></label>
          <label class="sp-field"><span>Fonte</span>
            <select data-filtro="fonte"><option value="todas">Todas</option><option value="projeto">Registradas nas expedições</option><option value="so-projeto">Só nas expedições</option><option value="externas">Só em coleções/GBIF</option></select></label>
          <label class="sp-field"><span>Ordenar</span>
            <select data-filtro="ordem"><option value="familia">Família e espécie</option><option value="registros">Mais registros</option><option value="recentes">Registro mais recente</option></select></label>
          <p class="species-search-status" role="status" aria-live="polite"></p>
        </div>
        <div class="sp-list" role="list"></div>
        <div class="catalogo-mais"></div>`;
      const lista = painel.querySelector('.sp-list');
      const status = painel.querySelector('.sp-toolbar .species-search-status');
      const mais = painel.querySelector('.catalogo-mais');

      function aplicar() {
        const q = norm(st.q.trim());
        let itens = todas.filter((s) => (!q || s.busca.includes(q)) && (
          st.fonte === 'todas' ||
          (st.fonte === 'projeto' && s.reg_projeto > 0) ||
          (st.fonte === 'so-projeto' && s.reg_projeto > 0 && s.reg_externos === 0) ||
          (st.fonte === 'externas' && s.reg_projeto === 0)));
        if (st.ordem === 'registros') itens = itens.slice().sort((a, b) => b.registros - a.registros || a.especie.localeCompare(b.especie));
        if (st.ordem === 'recentes') itens = itens.slice().sort((a, b) => (b.ano_max || 0) - (a.ano_max || 0) || a.especie.localeCompare(b.especie));
        st.filtradas = itens;
        desenhar();
      }

      function desenhar() {
        const q = norm(st.q.trim());
        const vis = st.filtradas.slice(0, st.mostradas);
        let html = '';
        if (!vis.length) {
          html = '<p class="taxon-links-empty">Nenhuma espécie encontrada.</p>';
        } else if (st.ordem === 'familia') {
          // total de espécies por família no resultado inteiro (não só no lote visível)
          const porFamilia = new Map();
          st.filtradas.forEach((s) => porFamilia.set(s.familia, (porFamilia.get(s.familia) || 0) + 1));
          let atual = null;
          vis.forEach((sp) => {
            if (sp.familia !== atual) {
              if (atual !== null) html += '</div>';
              atual = sp.familia;
              const n = porFamilia.get(atual);
              html += `<div class="sp-family" role="group" aria-label="${esc(atual)}"><h5 class="sp-family-head"><span translate="no">${realce(atual, q)}</span><small>${n === 1 ? '1 espécie' : fmt.format(n) + ' espécies'}</small></h5>`;
            }
            html += linha(sp, q, false, uid);
          });
          html += '</div>';
        } else {
          html = vis.map((sp) => linha(sp, q, true, uid)).join('');
        }
        lista.innerHTML = html;
        status.textContent = `${fmt.format(st.filtradas.length)} de ${fmt.format(todas.length)} espécies`;
        const resto = st.filtradas.length - vis.length;
        mais.innerHTML = resto > 0 ? `<button type="button" class="catalogo-btn-mais">Mostrar mais ${fmt.format(Math.min(resto, LOTE))} (restam ${fmt.format(resto)})</button>` : '';
      }

      // Busca inicial pela URL (/acesso/?q=Pouteria#conservacao-catalogo), usada pela página 404.
      const qInicial = new URLSearchParams(window.location.search).get('q');
      if (qInicial) {
        st.q = qInicial.slice(0, 80);
        painel.querySelector('.species-search-input').value = st.q;
      }

      let t;
      painel.querySelector('.species-search-input').addEventListener('input', (e) => {
        clearTimeout(t);
        t = setTimeout(() => { st.q = e.target.value; st.mostradas = LOTE; aplicar(); }, 160);
      });
      painel.querySelectorAll('select[data-filtro]').forEach((sel) => sel.addEventListener('change', () => {
        st[sel.dataset.filtro] = sel.value; st.mostradas = LOTE; aplicar();
      }));
      mais.addEventListener('click', () => { st.mostradas += LOTE; desenhar(); });
      lista.addEventListener('click', (e) => {
        const todos = e.target.closest('.sp-more-records');
        if (todos) {
          todos.closest('.sp-records').querySelectorAll('tr.sp-extra').forEach((tr) => { tr.hidden = false; });
          todos.remove();
          return;
        }
        const btn = e.target.closest('.sp-row-btn');
        if (btn) expandir(btn, drawer, raiz);
      });
      aplicar();
    }).catch((err) => {
      painel.innerHTML = `<p class="species-drawer-empty">Não foi possível carregar a lista de espécies (${esc(err.message)}). Recarregue a página para tentar de novo.</p>`;
    });
  }

  function expandir(btn, drawer, raiz) {
    const row = btn.closest('.sp-row');
    const conteudo = row.querySelector('.sp-detail');
    const abrir = btn.getAttribute('aria-expanded') !== 'true';
    drawer.querySelectorAll('.sp-row-btn[aria-expanded="true"]').forEach((b) => {
      if (b === btn) return;
      b.setAttribute('aria-expanded', 'false');
      const r = b.closest('.sp-row');
      r.classList.remove('is-open');
      r.querySelector('.sp-detail').hidden = true;
    });
    btn.setAttribute('aria-expanded', String(abrir));
    row.classList.toggle('is-open', abrir);
    conteudo.hidden = !abrir;
    if (!abrir || conteudo.dataset.pronto) return;
    conteudo.innerHTML = '<p class="species-search-status">Carregando links e registros...</p>';
    carregar(drawer.dataset.detalhes).then((det) => {
      conteudo.innerHTML = detalheHtml(det, det.especies[Number(row.dataset.id)], raiz);
      conteudo.dataset.pronto = '1';
    }).catch((err) => {
      conteudo.innerHTML = `<p class="taxon-links-empty">Não foi possível carregar os detalhes (${esc(err.message)}).</p>`;
    });
  }

  // Links GBIF por occurrenceID: resolve a chave do registro antes de abrir.
  document.addEventListener('click', (event) => {
    const link = event.target.closest && event.target.closest('a.gbif-occurrence-lookup[data-occurrence-id]');
    if (!link) return;
    event.preventDefault();
    const destino = window.open('about:blank', '_blank');
    if (!destino) { window.location.assign(link.href); return; }
    destino.opener = null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch(`https://api.gbif.org/v1/occurrence/search?occurrenceId=${encodeURIComponent(link.dataset.occurrenceId)}&limit=1`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((res) => { const k = res.results && res.results[0] && res.results[0].key; destino.location.replace(k ? `https://www.gbif.org/occurrence/${k}` : link.href); })
      .catch(() => destino.location.replace(link.href))
      .finally(() => clearTimeout(timer));
  });

  function iniciar() {
    document.querySelectorAll('details[data-catalogo-especies]').forEach((drawer) => {
      drawer.addEventListener('toggle', () => {
        if (drawer.open && !drawer.dataset.montado) { drawer.dataset.montado = '1'; montar(drawer); }
      });
      if (drawer.open && !drawer.dataset.montado) { drawer.dataset.montado = '1'; montar(drawer); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
  window.CatalogoEspecies = { iniciar };
})();
