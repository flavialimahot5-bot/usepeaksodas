/* ============================================================
   600vapo - SodaPeak VSL 6.0.0
   Tudo que e especifico do produto/video fica em CONFIG.
   Para replicar: ajustar CONFIG + textos/imagens do index.html.
   ============================================================ */

var CONFIG = {
  // O momento do pitch vem do listPitch da VSL atual, mais abaixo neste arquivo.

  // Timer exibido no banner da oferta.
  countdownStart: "19:59",

  // Purchase notification (canto inferior esquerdo).
  popup: {
    visibleTime: 6,      // segundos visivel
    intervalBetween: 10, // segundos entre popups
    qtys: [2, 4, 6],
    bottleImages: {
      2: "images/sodapeak-2.webp",
      4: "images/sodapeak-4.webp",
      6: "images/sodapeak-6.webp"
    },
    people: ["Benjamin", "Michael", "James", "William", "Daniel", "Christopher", "David", "Henry", "John", "Robert", "Thomas", "Joseph", "Matthew", "Anthony", "Mark", "Richard", "Charles", "Paul", "Steven", "Andrew"],
    cities: ["St. Louis, MO", "Austin, TX", "Denver, CO", "Tampa, FL", "Columbus, OH", "Portland, OR", "Tulsa, OK", "Phoenix, AZ", "Dallas, TX", "Miami, FL"]
  },

  // Pre-carga das fotos da oferta (bloco "Pre-carga" no fim do arquivo): segundos
  // ANTES do pitch da variante (listPitch, mais acima neste arquivo) em que elas baixam.
  preloadLeadSeconds: 20
};

/* ---------- Data "disponivel ate" (sempre hoje, mm/dd/aaaa) ---------- */
(function () {
  var el = document.getElementById("dataHoje");
  if (!el) return;
  var d = new Date();
  el.textContent = ("0" + (d.getMonth() + 1)).slice(-2) + "/" + ("0" + d.getDate()).slice(-2) + "/" + d.getFullYear();
})();

/* ---------- Trackeamento ----------
   Nao ha nada aqui de proposito: o track.js (RedTrack) e o track7.js, no head do
   index.html, cobrem tudo. Os botoes dos potes vao direto para o checkout
   PagAmerican. O que existia antes (injecao de um segundo track.js em lp.<host>
   + reescrita dos antigos links click/N) era duplicado e foi removido. */

/* ---------- Revela a oferta em 01:03:20 da VSL atual ---------- */
var listPitch = {
  '6ad92a0cc5e93d1544cfaa67': { delay: 3800 }, // 1h03min20s
};

(function () {
  var alreadyInitialized = false;

  var onPlayerReady = function (event) {
    if (alreadyInitialized) return;

    var detail = event.detail || {};
    var config = detail.config || {};
    var player = detail.player || document.querySelector('vturb-smartplayer');
    var playerId = config.id;
    var pitchConfig = listPitch[playerId];

    if (!pitchConfig) {
      var keys = Object.keys(listPitch);
      if (keys.length > 0) pitchConfig = listPitch[keys[0]];
    }

    if (!pitchConfig || !player) return;

    alreadyInitialized = true;

    player.displayHiddenElements(pitchConfig.delay, ['.esconder'], { persist: true });
  };

  // O elemento <vturb-smartplayer> reexecuta o 'player:ready' assim que o listener
  // é anexado, caso o player já esteja pronto. Escutar só no document não tem esse
  // replay e perde o evento se ele disparar antes deste script rodar (por isso só
  // aparecia depois do F5). Escutamos nos dois para garantir.
  var playerEl = document.querySelector('vturb-smartplayer');
  if (playerEl) playerEl.addEventListener('player:ready', onPlayerReady);
  document.addEventListener('player:ready', onPlayerReady);
})();

/* ---------- Countdown do banner ---------- */
(function () {
  var el = document.getElementById("countdown");
  if (!el) return;
  var parts = CONFIG.countdownStart.split(":");
  var total = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  el.textContent = CONFIG.countdownStart;
  setInterval(function () {
    if (total <= 0) { el.textContent = "00:00"; return; }
    total--;
    var m = Math.floor(total / 60);
    var s = total % 60;
    el.textContent = (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }, 1000);
})();

/* ---------- Purchase notification ---------- */
(function () {
  var cfg = CONFIG.popup;
  var pop = document.getElementById("ndPop");
  if (!pop) return;
  var imgEl = document.getElementById("ndPopImg");
  var nameEl = document.getElementById("ndPopName");
  var titleEl = document.getElementById("ndPopTitle");
  var timeEl = document.getElementById("ndPopTime");
  var hideTimer;

  function showPopup() {
    var qty = cfg.qtys[Math.floor(Math.random() * cfg.qtys.length)];
    var person = cfg.people[Math.floor(Math.random() * cfg.people.length)];
    var city = cfg.cities[Math.floor(Math.random() * cfg.cities.length)];

    nameEl.textContent = person + " from " + city;
    titleEl.textContent = "Just Bought " + qty + " Bottles";
    timeEl.textContent = Math.floor(Math.random() * 58 + 2) + " min ago";
    imgEl.src = cfg.bottleImages[qty];

    pop.classList.remove("hide");
    pop.classList.add("show");

    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      pop.classList.add("hide");
      setTimeout(function () { pop.classList.remove("show"); }, 400);
    }, cfg.visibleTime * 1000);
  }

  window.ndClosePop = function () {
    clearTimeout(hideTimer);
    pop.classList.add("hide");
    setTimeout(function () { pop.classList.remove("show"); }, 400);
  };

  // So comeca a ciclar quando o vturb revelar a oferta (blocos .esconder).
  var started = false;
  function startCycle() {
    if (started) return;
    started = true;
    setTimeout(showPopup, 3000);
    setInterval(showPopup, (cfg.visibleTime + cfg.intervalBetween) * 1000);
  }
  var banner = document.querySelector(".esconder");
  if (!banner) {
    startCycle();
  } else {
    var watcher = setInterval(function () {
      if (getComputedStyle(banner).display !== "none") {
        clearInterval(watcher);
        startCycle();
      }
    }, 1000);
  }
})();

/* ====== LMN 2026-09-21: repasse de params + sck pro PagAmerican (track7 nao casa pay.pagamerican.app) ====== */
/* ---------- Propaga os query params da URL para todos os links ---------- */
(function () {
  function apply(root) {
    var qs = window.location.search;
    if (!qs) return;
    (root || document).querySelectorAll("a").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#" || /^javascript:/i.test(href)) return;
      var url;
      try { url = new URL(href, location.origin); } catch (e) { return; }
      var merged = new URLSearchParams(url.search);
      new URLSearchParams(qs).forEach(function (v, k) {
        if (!merged.has(k)) merged.set(k, v);
      });
      url.search = merged.toString();
      if (href.slice(0, 2) === "//") {
        a.setAttribute("href", "//" + url.host + url.pathname + url.search + url.hash);
      } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) {
        a.setAttribute("href", url.toString());
      } else {
        a.setAttribute("href", url.pathname + url.search + url.hash);
      }
    });
  }
  apply();
  new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1) return;
        apply(n.tagName === "A" ? n.parentNode || document : n);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
})();


/* ---------- clickid -> sck nos links de checkout ---------- */
(function () {
  var HOSTS = ['pay.pagamerican.app'];
  var PARAM = 'sck';
  function clickId() {
    var q = new URLSearchParams(location.search);
    var v = q.get('subid') || q.get('rtkcid') || q.get('cid') || q.get('tid') || q.get('clickid') || '';
    if (v) return v;
    var m = document.cookie.match(/(?:^|; )rtkclickid-store=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
    try { return sessionStorage.getItem('rtkclickid-store') || ''; } catch (e) { return ''; }
  }
  function isCheckout(href) {
    for (var i = 0; i < HOSTS.length; i++) if (href.indexOf(HOSTS[i]) !== -1) return true;
    return false;
  }
  function decorate() {
    var cid = clickId();
    if (!cid) return false;
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i], href = a.getAttribute('href') || '';
      if (!isCheckout(href)) continue;
      var u;
      try { u = new URL(href, location.origin); } catch (e) { continue; }
      if (!u.searchParams.get(PARAM)) { u.searchParams.set(PARAM, cid); a.setAttribute('href', u.toString()); }
    }
    return true;
  }
  if (!decorate()) {
    // o cookie do RedTrack pode chegar depois do init: tenta por ~20s
    var tries = 0;
    var iv = setInterval(function () { if (decorate() || ++tries > 40) clearInterval(iv); }, 500);
  }
  // links criados depois (ex.: reveal do .esconder)
  new MutationObserver(function () { decorate(); }).observe(document.body, { childList: true, subtree: true });
})();

/* ---------- Pre-carga das fotos da oferta ~20 s antes do pitch ----------
   As fotos dentro do .esconder (potes, avatares, selos) tem loading="lazy": nao baixam no
   carregamento e nao disputam banda com o VSL. No 'player:ready' pegamos o pitch da variante
   sorteada no listPitch (mais acima neste arquivo) (sem match, a 1a chave - igual ao reveal) e
   baixamos as fotos quando o video passa de (pitch - CONFIG.preloadLeadSeconds): no reveal
   elas ja estao no cache. Fallbacks: player sem onTime -> confere player.currentTime a cada
   1 s; oferta ja visivel (reveal salvo de visita anterior) ou revelada antes do gatilho
   (ex.: seek) -> baixa na hora; sem player:ready em 15 s -> nao faz nada (o lazy cobre). */
(function () {
  var done = false, armed = false, stopped = false;
  var keep = []; // segura as Image ate o reveal: o <img> reaproveita da memoria, sem novo download

  function offerVisible() {
    var el = document.querySelector(".esconder");
    return !!el && getComputedStyle(el).display !== "none";
  }

  function preload() {
    if (done) return;
    done = true;
    watcher.disconnect();
    var urls = [];
    function add(src) { if (src && urls.indexOf(src) === -1) urls.push(src); }
    Object.keys(CONFIG.popup.bottleImages).forEach(function (q) { add(CONFIG.popup.bottleImages[q]); });
    document.querySelectorAll('.esconder img[loading="lazy"], img.nd-avatar').forEach(function (img) {
      add(img.getAttribute("src"));
    });
    urls.forEach(function (src) {
      var img = new Image();
      img.src = src;
      keep.push(img);
    });
  }

  // oferta revelada antes do gatilho (reveal salvo, seek alem do pitch...) -> baixa na hora
  var watcher = new MutationObserver(function () { if (offerVisible()) preload(); });
  document.querySelectorAll(".esconder").forEach(function (el) {
    watcher.observe(el, { attributes: true, attributeFilter: ["style", "class"] });
  });

  function onReady(event) {
    if (armed || stopped) return;
    var detail = (event && event.detail) || {};
    var player = detail.player || document.querySelector("vturb-smartplayer");
    if (!player) return;
    armed = true;
    clearTimeout(giveUp);
    if (done) return;
    if (offerVisible()) { preload(); return; }

    var list = (typeof listPitch !== "undefined" && listPitch) || {};
    var pitch = list[(detail.config || {}).id];
    if (!pitch) {
      var keys = Object.keys(list);
      if (keys.length > 0) pitch = list[keys[0]];
    }
    if (!pitch || !(pitch.delay >= 0)) return; // sem pitch: o lazy cobre
    var at = Math.max(0, pitch.delay - CONFIG.preloadLeadSeconds);

    var poll = function () {
      var iv = setInterval(function () {
        if (done) { clearInterval(iv); return; }
        if ((player.currentTime || 0) >= at) { clearInterval(iv); preload(); }
      }, 1000);
    };
    if (typeof player.onTime !== "function") { poll(); return; }
    try {
      var r = player.onTime(at, preload, { once: true });
      if (r && typeof r.catch === "function") r.catch(poll);
    } catch (e) { poll(); }
  }

  // sem player:ready em 15 s -> desiste (o lazy cobre)
  var giveUp = setTimeout(function () {
    if (armed) return;
    stopped = true;
    watcher.disconnect();
  }, 15000);

  if (offerVisible()) preload();

  // mesmo padrao do reveal (listPitch): o <vturb-smartplayer> repete o 'player:ready' para quem
  // escuta depois do player pronto; o document cobre o resto. A guarda (armed) roda 1 vez so.
  var playerEl = document.querySelector("vturb-smartplayer");
  if (playerEl) playerEl.addEventListener("player:ready", onReady);
  document.addEventListener("player:ready", onReady);
})();
