<script>
/**
 * ai_guardrails_vlite.patched.js (final, 2025-09-23)
 * - Rewrite request relatif → CONFIG.BASE_API_URL (ALLOW/DENY aware)
 * - Menangani path "/chat" & "chat" (match grup 'ai|chat|lead|track' by default)
 * - Clone Request aman (tanpa konsumsi body) via req.clone()
 * - Patch fetch, EventSource (SSE), XMLHttpRequest, navigator.sendBeacon
 * - Idempotent (multi-include safe) + debug toggle via CONFIG.API_REWRITE_DEBUG
 * - Auto-load ai_guardrails_vlite.js setelah patch (sync order dipertahankan)
 */

(function () {
  "use strict";

  // ---------- Helpers ----------
  function _cfg() {
    try {
      return (typeof window !== "undefined" && window.CONFIG)
        ? window.CONFIG
        : (typeof CONFIG !== "undefined" ? CONFIG : null);
    } catch (_) { return null; }
  }

  function _baseURL() {
    try {
      var c = _cfg();
      var b = c && c.BASE_API_URL ? ("" + c.BASE_API_URL).trim() : "";
      if (!b) return "";
      if (!/^https?:\/\//i.test(b)) b = "https://" + b;
      return b.replace(/\/+$/, "");
    } catch (_) { return ""; }
  }

  function _api(path) {
    try {
      var base = _baseURL();
      var p = String(path || "");
      if (!base) return p;
      if (!/^\//.test(p)) p = "/" + p; // single leading slash
      return base + p;
    } catch (_) { return path; }
  }

  try {
    if (typeof window._api !== "function") window._api = _api;
    if (typeof window._baseURL !== "function") window._baseURL = _baseURL;
  } catch (_) {}

  // ---------- Idempotent guard ----------
  if (window.__pv_fetch_patched__) {
    // Sudah dipatch? tetap pastikan file utama diload setelahnya.
    try {
      var s1 = document.createElement("script");
      s1.src = "ai_guardrails_vlite.js";
      s1.async = false;
      s1.onerror = function(){};
      document.head.appendChild(s1);
    } catch (_) {}
    return;
  }
  window.__pv_fetch_patched__ = true;

  // ---------- Matcher ----------
  function compileList(arr, fallback) {
    try {
      if (!arr || !arr.length) return fallback || [];
      return arr.map(function (s) {
        try { return new RegExp(s); } catch (_) { return null; }
      }).filter(Boolean);
    } catch (_) { return fallback || []; }
  }
  function isAbs(url){ return /^(?:https?:)?\/\//i.test(url) || /^data:|^blob:/i.test(url); }
  function isRelative(url){ return typeof url === "string" && !isAbs(url); }
  function matchAny(reList, s){ for (var i=0;i<reList.length;i++) if (reList[i].test(s)) return true; return false; }

  var CFG = _cfg() || {};
  var DEFAULT_ALLOW = [
    /^\/?(?:ai)(?:\/|$)/i,
    /^\/?(?:chat)(?:\/|$)/i,
    /^\/?(?:lead)(?:\/|$)/i,
    /^\/?(?:track)(?:\/|$)/i
  ];
  // Jangan rewrite asset/statics
  var DEFAULT_DENY = [
    /^\/?(?:assets|img|images|static|public)\//i,
    /\.svg(?:\?|#|$)/i, /\.png(?:\?|#|$)/i, /\.jpg(?:\?|#|$)/i, /\.jpeg(?:\?|#|$)/i, /\.webp(?:\?|#|$)/i, /\.ico(?:\?|#|$)/i,
    /\.css(?:\?|#|$)/i, /\.js(?:\?|#|$)/i, /\.map(?:\?|#|$)/i,
    /^(?:manifest\.json|site\.webmanifest)(?:\?|#|$)/i
  ];

  var ALLOW = compileList(CFG.API_REWRITE_ALLOW, DEFAULT_ALLOW);
  var DENY  = compileList(CFG.API_REWRITE_DENY,  DEFAULT_DENY);
  var DBG   = !!CFG.API_REWRITE_DEBUG;

  function SHOULD_REWRITE(url) {
    try {
      if (!isRelative(url)) return false;
      var test = url.replace(/^\/+/, ""); // strip leading slash
      if (DENY.length && matchAny(DENY, test)) { if (DBG) console.debug("[guardrails] deny", test); return false; }
      var ok = ALLOW.length ? matchAny(ALLOW, test) : false;
      if (DBG) console.debug("[guardrails] allow?", test, ok);
      return ok;
    } catch (_) { return false; }
  }

  if (DBG) {
    try {
      console.groupCollapsed("%c[guardrails] patched v2025-09-23", "color:#0b8; font-weight:700");
      console.log("BASE_API_URL:", _baseURL());
      console.log("ALLOW:", ALLOW);
      console.log("DENY :", DENY);
      console.groupEnd();
    } catch(_) {}
  }

  // ---------- Patch fetch ----------
  var _origFetch = window.fetch ? window.fetch.bind(window) : null;

  function cloneLikeRequest(absUrl, req, init) {
    // Buat Request baru dengan URL sudah direwrite, tanpa konsumsi body:
    // gunakan req.clone() agar stream body tetap utuh.
    try {
      var src = (req && typeof req.clone === "function") ? req.clone() : req;
      var method = (init && init.method) || (src && src.method) || "GET";
      var upper = String(method).toUpperCase();
      var useBody = (init && typeof init.body !== "undefined")
        ? init.body
        : (!src ? undefined : (upper === "GET" || upper === "HEAD") ? undefined : src.body);

      var headers = (init && init.headers)
        ? init.headers
        : (src && src.headers) ? new Headers(src.headers) : undefined;

      var opts = {
        method: method,
        headers: headers,
        body: useBody,
        mode: (init && init.mode) || (src && src.mode),
        credentials: (init && init.credentials) || (src && src.credentials),
        cache: (init && init.cache) || (src && src.cache),
        redirect: (init && init.redirect) || (src && src.redirect),
        referrer: (init && init.referrer) || (src && src.referrer),
        referrerPolicy: (init && init.referrerPolicy) || (src && src.referrerPolicy),
        integrity: (init && init.integrity) || (src && src.integrity),
        keepalive: (init && typeof init.keepalive !== "undefined") ? init.keepalive : (src && src.keepalive),
        signal: (init && init.signal) || (src && src.signal)
      };
      return new Request(absUrl, opts);
    } catch (_) {
      // fallback ke string URL bila gagal cloning (edge cases)
      return absUrl;
    }
  }

  if (_origFetch) {
    var _ver = "v2025-09-23";
    var patchedFetch = function (resource, init) {
      try {
        var url = null, isReq = false;
        if (typeof resource === "string") { url = resource; }
        else if (resource && typeof resource.url === "string") { url = resource.url; isReq = true; }

        if (url && SHOULD_REWRITE(url)) {
          var abs = _api(url);
          if (DBG) console.debug("[guardrails] rewrite fetch:", url, "→", abs);
          resource = isReq ? cloneLikeRequest(abs, resource, init) : abs;
        }
      } catch (_) {}
      return _origFetch(resource, init);
    };
    patchedFetch.__pv_patch_ver__ = _ver;
    window.fetch = patchedFetch;
  }

  // ---------- Patch EventSource (SSE) ----------
  try {
    var _OrigES = window.EventSource;
    if (_OrigES && !_OrigES.__pv_patched__) {
      var PatchedES = function (url, config) {
        try {
          if (typeof url === "string" && SHOULD_REWRITE(url)) {
            var abs = _api(url);
            if (DBG) console.debug("[guardrails] rewrite EventSource:", url, "→", abs);
            url = abs;
          }
        } catch (_) {}
        return new _OrigES(url, config);
      };
      for (var k in _OrigES) { try { PatchedES[k] = _OrigES[k]; } catch (_) {} }
      PatchedES.prototype = _OrigES.prototype;
      PatchedES.__pv_patched__ = true;
      window.EventSource = PatchedES;
    }
  } catch (_) {}

  // ---------- Patch XMLHttpRequest ----------
  try {
    var XHRp = XMLHttpRequest && XMLHttpRequest.prototype;
    if (XHRp && !XHRp.__pv_patched__) {
      var _origOpen = XHRp.open;
      XHRp.open = function(method, url, async, user, password){
        try{
          if (typeof url === "string" && SHOULD_REWRITE(url)) {
            var abs = _api(url);
            if (DBG) console.debug("[guardrails] rewrite XHR:", url, "→", abs);
            url = abs;
          }
        }catch(_){}
        return _origOpen.call(this, method, url, async !== false, user, password);
      };
      XHRp.__pv_patched__ = true;
    }
  } catch(_) {}

  // ---------- Patch navigator.sendBeacon ----------
  try {
    if (navigator && typeof navigator.sendBeacon === "function" && !navigator.sendBeacon.__pv_patched__) {
      var _origBeacon = navigator.sendBeacon.bind(navigator);
      var patchedBeacon = function(url, data){
        try{
          if (typeof url === "string" && SHOULD_REWRITE(url)) {
            var abs = _api(url);
            if (DBG) console.debug("[guardrails] rewrite beacon:", url, "→", abs);
            url = abs;
          }
        }catch(_){}
        return _origBeacon(url, data);
      };
      patchedBeacon.__pv_patched__ = true;
      navigator.sendBeacon = patchedBeacon;
    }
  } catch(_) {}

  // ---------- Load original (after patch) ----------
  try {
    var s = document.createElement("script");
    s.src = "ai_guardrails_vlite.js";
    s.async = false; // pertahankan urutan
    s.onerror = function(){};
    var here = document.currentScript;
    if (here && here.parentNode) here.parentNode.insertBefore(s, here);
    else document.head.appendChild(s);
  } catch (_) {}
})();
</script>
