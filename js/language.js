/* Tsiino Hiiwiida language switcher — full-site runtime v4
 * Source language: Portuguese (pt-BR). Target: English.
 * Designed for Quarto static pages, R-generated HTML widgets, Leaflet popups,
 * Plotly/SVG labels, and dynamically inserted content.
 */
(function () {
  "use strict";

  window.TSIINO_TRANSLATION_RUNTIME_VERSION = "full-site-v4-2026-10-27";
  if (window.TSIINO_TRANSLATION_RUNTIME_ACTIVE) return;
  window.TSIINO_TRANSLATION_RUNTIME_ACTIVE = true;

  let config = window.TsiinoTranslations || {};
  let strings = config.strings || {};
  let phrases = config.phrases || {};
  let prefixes = config.prefixes || {};
  let regexRules = config.regex || {};
  let labels = config.labels || { pt: "Português", en: "English" };
  let available = config.availableLanguages || ["pt", "en"];
  let defaultLanguage = config.defaultLanguage || "pt";
  let storageKey = config.storageKey || "tsiino-language";

  const excludedSelector = [
    "script", "style", "code", "pre", "kbd", "samp", "textarea", "noscript",
    "template", ".tsiino-language-control", ".MathJax", ".sourceCode",
    "[translate=\"no\"]", ".notranslate", ".team-name", ".popup-taxon",
    ".species-name em"
  ].join(",");

  const attrsToTranslate = ["placeholder", "title", "aria-label", "alt", "data-label", "value"];
  const dataAttrMap = {
    "data-i18n-alt": "alt",
    "data-i18n-title": "title",
    "data-i18n-label": "aria-label",
    "data-i18n-aria": "aria-label",
    "data-i18n-placeholder": "placeholder"
  };

  const textOriginals = new WeakMap();
  const elementOriginals = new WeakMap();
  const attrOriginals = new WeakMap();

  let currentLanguage = defaultLanguage;
  let observer = null;
  let refreshTimer = null;
  let translating = false;
  let staticStrings = null;
  const originalTitle = document.title;

  function normalize(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasLetters(value) {
    return /[A-Za-zÀ-ÿ]/.test(String(value || ""));
  }

  function preserveSpacing(original, translated) {
    const raw = String(original || "");
    const leading = (raw.match(/^\s*/) || [""])[0];
    const trailing = (raw.match(/\s*$/) || [""])[0];
    return leading + translated + trailing;
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function dictionaryFor(language) {
    return strings[language] || {};
  }

  function lookupExact(value, language) {
    const dictionary = dictionaryFor(language);
    const key = normalize(value);
    if (!key) return null;

    if (Object.prototype.hasOwnProperty.call(dictionary, key)) return dictionary[key];

    const noPeriod = key.replace(/\.$/, "");
    if (noPeriod !== key && Object.prototype.hasOwnProperty.call(dictionary, noPeriod)) {
      const translated = dictionary[noPeriod];
      return /[.!?…]$/.test(translated) ? translated : translated + ".";
    }

    const withPeriod = key + ".";
    if (Object.prototype.hasOwnProperty.call(dictionary, withPeriod)) return dictionary[withPeriod];

    const colonTrimmed = key.replace(/:\s*$/, "");
    if (colonTrimmed !== key && Object.prototype.hasOwnProperty.call(dictionary, colonTrimmed)) {
      return dictionary[colonTrimmed] + ":";
    }

    return null;
  }

  function applyPrefix(value, language) {
    if (language === defaultLanguage) return null;
    const languagePrefixes = prefixes[language] || {};
    const key = normalize(value);
    const ordered = Object.keys(languagePrefixes).sort((a, b) => b.length - a.length);
    for (const sourcePrefix of ordered) {
      const normalizedPrefix = normalize(sourcePrefix);
      if (key === normalizedPrefix || (key.startsWith(normalizedPrefix) && (!/[\p{L}\p{N}]$/u.test(normalizedPrefix) || /^[\s:]/.test(key.slice(normalizedPrefix.length))))) {
        return languagePrefixes[sourcePrefix] + translateValue(key.slice(normalizedPrefix.length).trimStart(), language);
      }
    }
    return null;
  }

  function applyPhraseReplacements(value, language) {
    const languagePhrases = phrases[language] || {};
    const protectedValues = [];
    let out = String(value || "").replace(/https?:\/\/[^\s<>]+|(?:[A-Za-z]:[\\/]|\.\.?[\\/]|_input_data[\\/])[^\s<>;]+|[^\s<>/]+\.(?:xlsx|xlsm|xls|csv|tsv|qmd|js|png|jpg|jpeg)\b/g, match => {
      protectedValues.push(match);
      return "\uE000" + (protectedValues.length - 1) + "\uE001";
    });
    const ordered = Object.keys(languagePhrases).sort((a, b) => b.length - a.length);

    const sources = ordered.filter(source => source && languagePhrases[source] != null);
    if (!sources.length) return String(value || "");
    const pattern = sources.map(source => {
      const left = /^[\p{L}\p{N}]/u.test(source) ? "(?<![\\p{L}\\p{N}_])" : "";
      const right = /[\p{L}\p{N}]$/u.test(source) ? "(?![\\p{L}\\p{N}_])" : "";
      return left + escapeRegExp(source) + right;
    }).join("|");
    out = out.replace(new RegExp(pattern, "gu"), source => languagePhrases[source]);

    return out.replace(/\uE000(\d+)\uE001/g, (_, i) => protectedValues[Number(i)]);
  }

  function applyRegexRules(value, language, terminalOnly = false) {
    const rules = regexRules[language] || [];
    let out = String(value || "");

    for (const rule of rules) {
      if (terminalOnly && !rule.terminal) continue;
      try {
        const pattern = rule.pattern || rule[0];
        const replacement = rule.replacement || rule[1] || "";
        const flags = rule.flags ?? rule[2] ?? "g";
        out = out.replace(new RegExp(pattern, flags), replacement);
      } catch (error) {
        // Ignore malformed optional rules.
      }
    }

    return out;
  }

  function translateValue(value, language) {
    const raw = String(value || "");
    if (language === defaultLanguage) return raw;
    if (!hasLetters(raw)) return raw;
    // Página estática já traduzida: o texto que veio no HTML não é retraduzido
    // (o dicionário é PT→EN; aplicá-lo a texto em inglês trocaria palavras soltas).
    if (staticStrings && staticStrings.has(normalize(raw))) return raw;

    const exact = lookupExact(raw, language);
    if (exact !== null) return preserveSpacing(raw, exact);

    const matchedRule = applyRegexRules(raw, language, true);
    if (matchedRule !== raw) return matchedRule;

    const prefixed = applyPrefix(raw, language);
    if (prefixed !== null) return preserveSpacing(raw, prefixed);

    let out = applyPhraseReplacements(raw, language);
    out = applyRegexRules(out, language);

    return out === raw ? raw : out;
  }

  function isExcluded(nodeOrElement) {
    if (!nodeOrElement) return true;
    const element = nodeOrElement.nodeType === Node.ELEMENT_NODE
      ? nodeOrElement
      : nodeOrElement.parentElement;
    return !!(element && element.closest && element.closest(excludedSelector));
  }

  function getOriginalText(node) {
    if (!textOriginals.has(node)) textOriginals.set(node, node.nodeValue || "");
    return textOriginals.get(node);
  }

  function getOriginalElementText(element) {
    if (!elementOriginals.has(element)) elementOriginals.set(element, element.textContent || "");
    return elementOriginals.get(element);
  }

  function getOriginalAttr(element, attr) {
    let map = attrOriginals.get(element);
    if (!map) {
      map = {};
      attrOriginals.set(element, map);
    }
    if (!Object.prototype.hasOwnProperty.call(map, attr)) {
      map[attr] = element.getAttribute(attr) || "";
    }
    return map[attr];
  }

  function translateDataI18nElement(element, language) {
    if (!element || isExcluded(element)) return;
    const key = element.getAttribute("data-i18n") || element.getAttribute("data-i18n-html");
    if (!key || element.children.length) return;

    const original = getOriginalElementText(element);
    if (language === defaultLanguage) {
      if (element.textContent !== original) element.textContent = original;
      return;
    }

    const translated = lookupExact(key, language) ?? lookupExact(original, language);
    if (translated !== null && element.textContent !== translated) element.textContent = translated;
  }

  function translateDataI18nAttributes(element, language) {
    if (!element || isExcluded(element)) return;

    Object.keys(dataAttrMap).forEach(function (dataAttr) {
      const key = element.getAttribute(dataAttr);
      const attr = dataAttrMap[dataAttr];
      if (!key) return;
      const original = getOriginalAttr(element, attr) || element.getAttribute(attr) || "";
      if (language === defaultLanguage) {
        if (original) element.setAttribute(attr, original);
        return;
      }
      const translated = lookupExact(key, language) ?? lookupExact(original, language);
      if (translated !== null) element.setAttribute(attr, translated);
    });
  }

  function translateAttributes(element, language) {
    if (!element || isExcluded(element)) return;

    attrsToTranslate.forEach(function (attr) {
      if (!element.hasAttribute(attr)) return;
      if (Object.keys(dataAttrMap).some(key => dataAttrMap[key] === attr && element.hasAttribute(key))) return;
      if (attr === "value" && !/^(button|submit|reset)$/i.test(element.getAttribute("type") || "")) return;
      const original = getOriginalAttr(element, attr);
      const translated = translateValue(original, language);
      if (translated !== element.getAttribute(attr)) element.setAttribute(attr, translated);
    });
  }

  function translateTextNode(node, language) {
    if (!node || node.nodeType !== Node.TEXT_NODE || isExcluded(node)) return;
    const keyed = node.parentElement;
    if (keyed && !keyed.children.length && (keyed.hasAttribute("data-i18n") || keyed.hasAttribute("data-i18n-html"))) return;
    const original = getOriginalText(node);
    if (!hasLetters(original)) {
      node.nodeValue = original;
      return;
    }

    const normalized = normalize(original);
    if (!normalized || normalized.length > 7000) {
      node.nodeValue = original;
      return;
    }

    const translated = translateValue(original, language);
    if (node.nodeValue !== translated) node.nodeValue = translated;
  }

  function walkTextNodes(root, language) {
    if (!root || isExcluded(root)) return;
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          if (!node.parentElement || isExcluded(node)) return NodeFilter.FILTER_REJECT;
          if (!hasLetters(node.nodeValue)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => translateTextNode(node, language));
  }

  function translateElementTree(root, language) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root, language);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

    const elementRoot = root.nodeType === Node.ELEMENT_NODE ? root : null;
    if (elementRoot) {
      translateDataI18nElement(elementRoot, language);
      translateDataI18nAttributes(elementRoot, language);
      translateAttributes(elementRoot, language);
    }

    const elements = root.querySelectorAll ? root.querySelectorAll("[data-i18n], [data-i18n-html], [data-i18n-aria], [data-i18n-alt], [data-i18n-title], [data-i18n-label], [data-i18n-placeholder], [placeholder], [title], [aria-label], [alt], input[type='button'], input[type='submit'], input[type='reset']") : [];
    elements.forEach(function (element) {
      translateDataI18nElement(element, language);
      translateDataI18nAttributes(element, language);
      translateAttributes(element, language);
    });

    walkTextNodes(root, language);
  }

  function updateDocumentLanguage(language) {
    document.documentElement.setAttribute("lang", language === "en" ? "en" : "pt-BR");
    document.title = translateValue(originalTitle, language);
  }

  const observerOptions = {
    childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ["placeholder", "title", "aria-label", "alt", "data-label", "value",
      "data-i18n", "data-i18n-html", "data-i18n-aria", "data-i18n-alt",
      "data-i18n-title", "data-i18n-label", "data-i18n-placeholder"]
  };

  function invalidateExternalChanges(mutations) {
    let relevant = false;
    mutations.forEach(function(m) {
      if (isExcluded(m.target)) return;
      relevant = true;
      if (m.type === "characterData") textOriginals.delete(m.target);
      if (m.type === "attributes") {
        const map = attrOriginals.get(m.target);
        if (map) delete map[m.attributeName];
      }
      const parent = m.target.nodeType === Node.ELEMENT_NODE ? m.target : m.target.parentElement;
      if (parent) elementOriginals.delete(parent);
    });
    return relevant;
  }

  function applyLanguage(language) {
    if (!available.includes(language)) language = defaultLanguage;
    if (translating) return;
    // Own translations must not be mistaken for changes made by a widget.
    if (observer) {
      invalidateExternalChanges(observer.takeRecords());
      observer.disconnect();
    }
    translating = true;
    currentLanguage = language;
    try {
      try { localStorage.setItem(storageKey, language); } catch (error) {}
      document.documentElement.setAttribute("data-tsiino-language", language);
      updateDocumentLanguage(language);
      translateElementTree(document.body || document.documentElement, language);
      updateSwitcher(language);
    } finally {
      translating = false;
      if (observer && document.body) observer.observe(document.body, observerOptions);
    }
  }

  function scheduleApply() {
    if (translating) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function () { applyLanguage(currentLanguage); }, 80);
  }

  // Páginas estáticas (/en/): só o que muda depois do carregamento é traduzido,
  // nó a nó, em vez de reprocessar a página inteira.
  function translateRecords(records) {
    if (!records || !records.length || translating) return;
    if (observer) observer.disconnect();
    translating = true;
    try {
      invalidateExternalChanges(records);
      records.forEach(function (m) {
        if (m.type === "childList") {
          m.addedNodes.forEach(function (node) {
            if (node.isConnected) translateElementTree(node, currentLanguage);
          });
        } else if (m.type === "characterData") {
          translateTextNode(m.target, currentLanguage);
        } else if (m.type === "attributes" && m.target.nodeType === Node.ELEMENT_NODE) {
          translateDataI18nElement(m.target, currentLanguage);
          translateDataI18nAttributes(m.target, currentLanguage);
          translateAttributes(m.target, currentLanguage);
        }
      });
    } finally {
      translating = false;
      if (observer && document.body) observer.observe(document.body, observerOptions);
    }
  }

  function startObserver() {
    if (observer || !document.body) return;
    observer = new MutationObserver(function (mutations) {
      if (staticStrings) { translateRecords(mutations); return; }
      if (invalidateExternalChanges(mutations)) scheduleApply();
    });
    observer.observe(document.body, observerOptions);
  }

  function refreshConfig() {
    config = window.TsiinoTranslations || {};
    strings = config.strings || {};
    phrases = config.phrases || {};
    prefixes = config.prefixes || {};
    regexRules = config.regex || {};
    labels = config.labels || { pt: "Português", en: "English" };
    available = config.availableLanguages || ["pt", "en"];
    defaultLanguage = config.defaultLanguage || "pt";
    storageKey = config.storageKey || "tsiino-language";
  }
  window.addEventListener("tsiino:translations-ready", function() {
    refreshConfig();
    if (document.body && window.TsiinoSetLanguage) applyLanguage(currentLanguage);
  });

  // O idioma é o da própria página: as versões em inglês são páginas estáticas
  // em /en/ (com <html lang="en">), ligadas pelo link do cabeçalho. Este runtime
  // só traduz o que é criado depois do carregamento (popups de mapa, painéis,
  // mensagens do validador). Nas páginas em português ele não altera nada.
  function getInitialLanguage() {
    const pageLanguage = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    return pageLanguage.indexOf("en") === 0 && available.includes("en") ? "en" : defaultLanguage;
  }

  function updateSwitcher() {}

  function boot() {
    if (!document.body) return;
    refreshConfig();

    const early = window.__tsiinoStatic;
    if (early && getInitialLanguage() !== defaultLanguage) {
      // Página já traduzida no build (ver scripts/build_i18n.mjs e language-router.html).
      staticStrings = early.strings;
      currentLanguage = getInitialLanguage();
      document.documentElement.setAttribute("data-tsiino-language", currentLanguage);
      if (early.observer) {
        early.queue.push.apply(early.queue, early.observer.takeRecords());
        early.observer.disconnect();
      }
      startObserver();
      translateRecords(early.queue.splice(0));
      window.TsiinoSetLanguage = function () {};
      window.TsiinoTranslate = function (value, language) { return translateValue(value, language || currentLanguage); };
      return;
    }

    applyLanguage(getInitialLanguage());
    startObserver();
    window.addEventListener("load", function () {
      scheduleApply();
      setTimeout(scheduleApply, 250);
      setTimeout(scheduleApply, 1000);
      setTimeout(scheduleApply, 2500);
    });
    window.TsiinoSetLanguage = applyLanguage;
    window.TsiinoTranslate = function(value, language) { return translateValue(value, language || currentLanguage); };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
