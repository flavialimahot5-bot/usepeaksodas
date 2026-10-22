/*!
 * track8.js — MINIMALISTA (config via query string do proprio <script>)
 *
 * O QUE FAZ (3 coisas):
 *  1. Forward TODOS os params da URL atual pros links de checkout
 *     (href contendo "cartpanda" ou "checkout" — cobre checkout.php e BuyGoods;
 *     so adiciona se ainda nao tiver no href; nao sobrescreve nada).
 *     Clickid: URL (rtkcid) > cookie rtkclickid-store > sessionStorage
 *     (so leitura; cookies podem falhar) e injeta como "subid"
 *     (mude o nome com ?cidparam=xxx).
 *  2. Click id de anuncio (gclid/wbraid/gbraid/fbclid/tblci): captura da URL,
 *     do cookie trk_* (setado pelo Worker da Cloudflare na presell) ou do
 *     localStorage, e injeta nos links BuyGoods como subid4 PREFIXADO:
 *       g_<gclid> | wb_<wbraid> | gb_<gbraid> | f_<fbclid> | tb_<tblci>
 *     (o backend/n8n recebem via {SUBID4} -> param "adclick")
 *  3. Dispara o LP click do RedTrack MAX 1x por sessao de pagina.
 *
 * USO:
 *   <script src="https://cdn.../track8.js" defer></script>
 * Pra desligar debug: ?debug=false na query string do script.
 */
(function () {
  'use strict';


  function getScriptParams() {
    var src = '';
    if (document.currentScript) src = document.currentScript.src || '';
    if (!src) {
      var nodes = document.querySelectorAll('script[src*="track"]');
      var last = nodes[nodes.length - 1];
      if (last) src = last.src;
    }
    var q = (src.split('?')[1] || '').split('#')[0];
    return new URLSearchParams(q);
  }
  var sp = getScriptParams();


  var LP_CLICK = true;
  var DEBUG    = sp.get('debug') !== 'false'; // default true
  // link e considerado checkout se o href contiver QUALQUER um destes trechos
  // ("checkout" sozinho ja cobre checkout.php e buygoods.com/secure/checkout)
  var CHECKOUT_MATCHES = ['cartpanda', 'checkout'];
  var FORWARD_COOKIES = ['xcod', 'vlid', 'vid', '_vt_uid'];
  // nome do param de clickid nos links de checkout (troque com ?cidparam=xxx na src do script)
  var CLICKID_PARAM = sp.get('cidparam') || 'subid';


  function log() {
    if (!DEBUG) return;
    try { console.log.apply(console, ['[track]'].concat([].slice.call(arguments))); } catch (e) {}
  }
  log('debug ON | lpClick =', LP_CLICK);


  function cookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  var qs = new URLSearchParams(location.search);


  /* ---- (0) Click ids de anuncio -> subid4 prefixado ---- */
  var AD_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 dias (janela do offline upload do Google)
  // ordem = prioridade quando houver mais de um (nao deve acontecer)
  var AD_IDS = [
    { param: 'gclid',  prefix: 'g'  },
    { param: 'wbraid', prefix: 'wb' },
    { param: 'gbraid', prefix: 'gb' },
    { param: 'fbclid', prefix: 'f'  },
    { param: 'tblci',  prefix: 'tb' }
  ];


  function saveAdIds() { // URL -> localStorage (backup do cookie do Worker)
    AD_IDS.forEach(function (d) {
      var v = qs.get(d.param);
      if (!v) return;
      try { localStorage.setItem('trk_' + d.param, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {}
    });
  }
  function readAdId(param) { // prioridade: URL > cookie (Worker) > localStorage
    var v = qs.get(param);
    if (v) return v;
    v = cookie('trk_' + param);
    if (v) return v;
    try {
      var raw = localStorage.getItem('trk_' + param);
      if (!raw) return '';
      var o = JSON.parse(raw);
      if (Date.now() - o.t > AD_TTL_MS) { localStorage.removeItem('trk_' + param); return ''; }
      return o.v || '';
    } catch (e) { return ''; }
  }
  function adClickParam() { // -> "g_Cj0KCQ..." | "f_IwAR..." | "tb_Gi..." | ""
    for (var i = 0; i < AD_IDS.length; i++) {
      var v = readAdId(AD_IDS[i].param);
      if (v) return AD_IDS[i].prefix + '_' + v;
    }
    return '';
  }
  saveAdIds();


  function clickId() {
    // prioridade: URL (subid/rtkcid) > cookie > sessionStorage (so leitura, nao grava nada)
    var v = qs.get(CLICKID_PARAM) || qs.get('rtkcid') || cookie('rtkclickid-store') || '';
    if (!v) {
      try { v = sessionStorage.getItem('rtkclickid-store') || ''; } catch (e) {}
    }
    return v;
  }
  function campaignId() {
    return window.campaignID || qs.get('rtkcmpid') || '';
  }
  function isCheckout(a) {
    if (!(a && a.tagName === 'A' && a.href)) return false;
    var h = a.href.toLowerCase();
    return CHECKOUT_MATCHES.some(function (m) { return h.indexOf(m) > -1; });
  }
  function getLinks() {
    var out = [];
    document.querySelectorAll('a[href]').forEach(function (a) {
      if (isCheckout(a)) out.push(a);
    });
    return out;
  }


  /* ---- (1) Forward params + subid4 pros links de checkout ---- */
  function decorate(a) {
    var before = a.href;
    var u;
    try { u = new URL(a.href, location.href); } catch (e) { return; }


    // todos os params da URL atual (se ainda nao estiverem no link)
    qs.forEach(function (value, key) {
      if (u.searchParams.get(key)) return;
      u.searchParams.set(key, value);
    });
    // + cookies relevantes que NAO estejam na URL nem no link
    FORWARD_COOKIES.forEach(function (k) {
      if (u.searchParams.get(k)) return;
      var v = cookie(k);
      if (v) u.searchParams.set(k, v);
    });
    // + clickid do RedTrack: se nao veio na URL nem ja esta no link,
    //   pega do cookie rtkclickid-store (gerado na pagina) / window.rtkClickID
    if (!u.searchParams.get(CLICKID_PARAM)) {
      var cid = clickId();
      if (cid) u.searchParams.set(CLICKID_PARAM, cid);
    }

    // + click id de anuncio como subid4 (nao sobrescreve se ja veio preenchido)
    if (!u.searchParams.get('subid4')) {
      var ad = adClickParam();
      if (ad) u.searchParams.set('subid4', ad);
    }


    var newHref = u.toString();
    if (newHref === before) return;
    a.href = newHref;
    log('decorate:', { before: before, after: newHref });
  }
  function decorateAll() { getLinks().forEach(decorate); }


  // o track.js do RedTrack gera o cookie rtkclickid-store DEPOIS do nosso init;
  // fica checando ate o clickid aparecer e re-decora os links (max ~20s)
  function waitClickId() {
    if (clickId()) return; // ja tinha na hora do init
    var tries = 0;
    var iv = setInterval(function () {
      if (clickId()) {
        clearInterval(iv);
        decorateAll();
        log('clickid chegou depois do init -> links re-decorados');
      } else if (++tries >= 40) {
        clearInterval(iv);
        log('clickid nao apareceu em 20s (sem RedTrack na pagina?)');
      }
    }, 500);
  }

  function init() {
    log('init: links checkout =', getLinks().length,
        '| params URL =', Array.from(qs.keys()).join(','),
        '| adclick =', adClickParam() || '(nenhum)');
    decorateAll();
    waitClickId();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // re-decora apos VTurb revelar o CTA (botoes que apareceram depois)
  document.addEventListener('player:ready', function () { setTimeout(decorateAll, 0); });
  // decora ANTES do clique acontecer: pointerdown cobre botao esquerdo, do meio,
  // direito (copiar link / abrir em nova aba) e toque no mobile
  document.addEventListener('pointerdown', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (a && isCheckout(a)) decorate(a);
  }, true);


  /* ---- (2) LP click do RedTrack: dispara MAX 1x por sessao de pagina ---- */
  var lpClickFired = false;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || !isCheckout(a)) return;
    decorate(a); // garante params no link (caso tenha surgido depois do init)


    if (!LP_CLICK || lpClickFired) return;
    var cid = clickId(), cmp = campaignId();
    if (!cid || !cmp) { log('LP click: SKIP (sem clickid ou cmpid)'); return; }
    lpClickFired = true; // marca ANTES do fetch pra blindar contra re-fires
    var root = location.hostname.split('.').slice(-2).join('.');
    var ck = Math.round(Date.now() / 1000);
    var url = 'https://rt.' + root + '/click/' + cmp +
              '?clickid=' + encodeURIComponent(cid) + '&rtkck=' + ck;
    try { fetch(url, { mode: 'no-cors', keepalive: true }); log('LP click ->', url); } catch (_) {}
  }, true);
})();

(function () {
  'use strict';

  var ORIGEM = 'subid2';
  var DESTINO = 'utm_term';
  var SOBRESCREVER = true;

  var DEBUG = /[?&]debug_utm=1(?:&|$)/.test(location.search);

  function log() {
    if (DEBUG && window.console) {
      console.log.apply(
        console,
        ['[subid2->utm_term]'].concat([].slice.call(arguments))
      );
    }
  }

  // Pega o valor ainda codificado do query string
  function pegarValor(query, nome) {
    var m = query.match(
      new RegExp('(?:^|&)' + nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^&]*)')
    );

    return m ? m[1] : null;
  }

  function sincronizarHref(href) {
    if (!href) return null;

    // Ignora links que não são URLs
    if (/^(#|javascript:|mailto:|tel:|sms:|whatsapp:)/i.test(href)) {
      return null;
    }

    var hash = '';
    var i = href.indexOf('#');

    if (i > -1) {
      hash = href.slice(i);
      href = href.slice(0, i);
    }

    var q = href.indexOf('?');

    if (q === -1) {
      return null;
    }

    var base = href.slice(0, q);
    var query = href.slice(q + 1);

    var valor = pegarValor(query, ORIGEM);

    // Não existe subid2
    if (valor === null || valor === '') {
      return null;
    }

    var atual = pegarValor(query, DESTINO);

    // Já está correto
    if (atual === valor) {
      return null;
    }

    // Já existe utm_term e não queremos sobrescrever
    if (atual !== null && !SOBRESCREVER) {
      return null;
    }

    // Remove utm_term existente
    var partes = query
      .split('&')
      .filter(function (parte) {
        return !new RegExp(
          '^' + DESTINO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '='
        ).test(parte);
      });

    // Adiciona o novo utm_term
    partes.push(DESTINO + '=' + valor);

    return base + '?' + partes.join('&') + hash;
  }

  function aplicar(el, attr) {
    if (!el.hasAttribute(attr)) {
      return false;
    }

    var novo = sincronizarHref(el.getAttribute(attr));

    if (!novo) {
      return false;
    }

    el.setAttribute(attr, novo);

    log(attr, novo);

    return true;
  }

  function varrer() {
    var els = document.querySelectorAll(
      'a[href], [data-href], [data-url]'
    );

    for (var i = 0; i < els.length; i++) {
      aplicar(els[i], 'href');
      aplicar(els[i], 'data-href');
      aplicar(els[i], 'data-url');
    }
  }

  // 1) MutationObserver:
  // detecta elementos/atributos adicionados ou alterados dinamicamente
  if (window.MutationObserver) {
    var agendado = false;

    new MutationObserver(function () {
      if (agendado) {
        return;
      }

      agendado = true;

      setTimeout(function () {
        agendado = false;
        varrer();
      }, 0);
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'data-href', 'data-url']
    });
  }

  // 2) Varredura periódica nos primeiros 15 segundos
  var n = 0;

  var timer = setInterval(function () {
    varrer();

    if (++n >= 60) {
      clearInterval(timer);
    }
  }, 250);

  // 3) Último recurso:
  // sincroniza exatamente no momento do clique
  document.addEventListener(
    'click',
    function (ev) {
      var el = ev.target;

      while (el && el !== document) {
        if (
          el.tagName === 'A' ||
          el.hasAttribute('data-url') ||
          el.hasAttribute('data-href')
        ) {
          aplicar(el, 'href');
          aplicar(el, 'data-href');
          aplicar(el, 'data-url');
          break;
        }

        el = el.parentNode;
      }
    },
    true
  );

  // 4) Rodadas garantidas
  varrer();

  document.addEventListener('DOMContentLoaded', varrer);

  window.addEventListener('load', function () {
    setTimeout(varrer, 1500);
  });

  // Permite chamar manualmente pelo console
  window.__syncUtmTerm = varrer;
})();

