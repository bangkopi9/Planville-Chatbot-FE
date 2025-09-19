/**
 * ai_guardrails_vlite.patched.js (enhanced)
 * - Ensures all relative API calls go to CONFIG.BASE_API_URL.
 * - Rewrites both "/chat" and "chat" (no-leading-slash) styles.
 * - Optional allow/deny lists via CONFIG.API_REWRITE_ALLOW / CONFIG.API_REWRITE_DENY (arrays of regex strings).
 * - Safe Request cloning; preserves headers/credentials/signal.
 * - EventSource patched for SSE.
 * - Loads original ai_guardrails_vlite.js AFTER patching (sync order).
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
      // normalize: ensure single leading slash
      if (!/^\//.test(p)) p = "/" + p;
      return base + p;
    } catch (_) { return path; }
  }

  // expose (idempotent)
  try {
    if (typeof window._api !== "function") window._api = _api;
    if (typeof window._baseURL !== "function") window._baseURL = _baseURL;
  } catch (_) {}

  // ---------- Idempotent guard ----------
  if (window.__pv_fetch_patched__) {
    // already patched → still load original
    try {
      var s1 = document.createElement("script");
      s1.src = "ai_guardrails_vlite.js";
      s1.async = false;
      document.head.appendChild(s1);
    } catch (_) {}
    return;
  }
  window.__pv_fetch_patched__ = true;

  // ---------- Matcher ----------
  function compileList(arr, def) {
    try {
      if (!arr || !arr.length) return def || [];
      return arr.map(function (s) {
        try { return new RegExp(s); } catch (_) { return null; }
      }).filter(Boolean);
    } catch (_) { return def || []; }
  }

  var CFG = _cfg() || {};
  var ALLOW = compileList(CFG.API_REWRITE_ALLOW, [
    /^\/?(?:ai)(?:\/|$)/i,
    /^\/?(?:chat)(?:\/|$)/i,
    /^\/?(?:lead)(?:\/|$)/i,
    /^\/?(?:track)(?:\/|$)/i
  ]);
  var DENY = compileList(CFG.API_REWRITE_DENY, []); // e.g. ["^/assets/"]

  function isAbs(url) {
    return /^(?:https?:)?\/\//i.test(url) || /^data:|^blob:/i.test(url);
  }
  function isRelative(url) {
    return typeof url === "string" && !isAbs(url);
  }
  function matchAny(reList, s) {
    for (var i = 0; i < reList.length; i++) if (reList[i].test(s)) return true;
    return false;
  }

  function SHOULD_REWRITE(url) {
    if (!isRelative(url)) return false;
    // normalize for matching (strip leading slash for allow/deny that include ^\/?)
    var test = url.replace(/^\/+/, "");
    if (DENY.length && matchAny(DENY, test)) return false;
    return ALLOW.length ? matchAny(ALLOW, test) : false;
  }

  // ---------- Patch fetch ----------
  var _origFetch = window.fetch ? window.fetch.bind(window) : null;

  function cloneLikeRequest(absUrl, resource, init) {
    // Try to preserve as much of the original Request as possible
    try {
      var method = (resource && resource.method) || (init && init.method) || "GET";
      var headers = (resource && resource.headers) || (init && init.headers) || undefined;
      var body = (resource && resource.body) || (init && init.body) || undefined;

      // If it's a Request, headers might be a Headers object; keep it as-is.
      var opts = {
        method: method,
        headers: headers,
        body: body,
        mode: (resource && resource.mode) || (init && init.mode),
        credentials: (resource && resource.credentials) || (init && init.credentials),
        cache: (resource && resource.cache) || (init && init.cache),
        redirect: (resource && resource.redirect) || (init && init.redirect),
        referrer: (resource && resource.referrer) || (init && init.referrer),
        referrerPolicy: (resource && resource.referrerPolicy) || (init && init.referrerPolicy),
        integrity: (resource && resource.integrity) || (init && init.integrity),
        keepalive: (resource && resource.keepalive) || (init && init.keepalive),
        signal: (resource && resource.signal) || (init && init.signal)
      };
      return new Request(absUrl, opts);
    } catch (_) {
      // fallback to string URL + init
      return absUrl;
    }
  }

  if (_origFetch) {
    window.fetch = function (resource, init) {
      try {
        var url = null, isReq = false;
        if (typeof resource === "string") {
          url = resource;
        } else if (resource && typeof resource.url === "string") {
          url = resource.url;
          isReq = true;
        }

        if (url && SHOULD_REWRITE(url)) {
          var abs = _api(url);
          resource = isReq ? cloneLikeRequest(abs, resource, init) : abs;
        }
      } catch (_) {
        // swallow patch errors and continue
      }
      return _origFetch(resource, init);
    };
  }

  // ---------- Patch EventSource (SSE) ----------
  try {
    var _OrigES = window.EventSource;
    if (_OrigES && !_OrigES.__pv_patched__) {
      var PatchedES = function (url, config) {
        try {
          if (typeof url === "string" && SHOULD_REWRITE(url)) {
            url = _api(url);
          }
        } catch (_) {}
        return new _OrigES(url, config);
      };
      // copy static props
      for (var k in _OrigES) { try { PatchedES[k] = _OrigES[k]; } catch (_) {} }
      PatchedES.prototype = _OrigES.prototype;
      PatchedES.__pv_patched__ = true;
      window.EventSource = PatchedES;
    }
  } catch (_) {}

  // ---------- Load original (after patch) ----------
  try {
    var s = document.createElement("script");
    s.src = "ai_guardrails_vlite.js";
    s.async = false; // keep order
    var here = document.currentScript;
    if (here && here.parentNode) {
      here.parentNode.insertBefore(s, here);
    } else {
      document.head.appendChild(s);
    }
  } catch (_) {
    // even if this fails, fetch/EventSource patches are active
  }
})();
