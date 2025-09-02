/**
 * ai_guardrails_vlite.patched.js
 * Universal patch: ensure all relative API calls go to CONFIG.BASE_API_URL.
 *
 * What it does:
 * 1) Defines _baseURL() and _api(path).
 * 2) Monkey-patches window.fetch to rewrite API calls to absolute URLs.
 * 3) Monkey-patches EventSource for SSE endpoints (e.g., /chat/stream).
 * 4) Loads the original ai_guardrails_vlite.js AFTER patching (sync order).
 *
 * Usage in index.html:
 *   <!-- instead of ai_guardrails_vlite.js -->
 *   <script src="ai_guardrails_vlite.patched.js" defer></script>
 */

(function () {
  "use strict";

  // ---- Helpers -------------------------------------------------------------
  function _baseURL() {
    try {
      var wcfg = (typeof window !== "undefined" && window.CONFIG) ? window.CONFIG
                : (typeof CONFIG !== "undefined" ? CONFIG : null);
      var b = wcfg && wcfg.BASE_API_URL ? ("" + wcfg.BASE_API_URL).trim() : "";
      if (!b) return "";
      if (!/^https?:\/\//i.test(b)) b = "https://" + b;
      return b.replace(/\/+$/,"");
    } catch (_) { return ""; }
  }

  function _api(path) {
    try {
      var base = _baseURL();
      var p = String(path || "");
      if (!base) return p;
      return base + (p.startsWith("/") ? p : ("/" + p));
    } catch(_) { return path; }
  }

  // Expose globally (if not already present)
  try {
    if (typeof window._api !== "function") window._api = _api;
    if (typeof window._baseURL !== "function") window._baseURL = _baseURL;
  } catch(_) {}

  // ---- Idempotent guard so we don't patch twice ---------------------------
  if (window.__pv_fetch_patched__) {
    // Already patched: still try to load original script then exit.
    try {
      var s1 = document.createElement("script");
      s1.src = "ai_guardrails_vlite.js";
      s1.async = false;
      document.head.appendChild(s1);
    } catch(_) {}
    return;
  }
  window.__pv_fetch_patched__ = true;

  // ---- Decide which relative paths to rewrite -----------------------------
  var SHOULD_REWRITE = function (url) {
    // only relative (starts with '/')
    if (typeof url !== "string" || url.charAt(0) !== "/") return false;

    // Match our API endpoints
    // /ai/*, /chat, /chat/*, /lead, /track
    return /^\/(?:ai(?:\/|$)|chat(?:\/|$)|lead(?:\/|$)|track(?:\/|$))/i.test(url);
  };

  var isAbsoluteOrSpecial = function(url) {
    return /^(?:https?:)?\/\//i.test(url) || /^data:|^blob:/i.test(url);
  };

  // ---- Monkey-patch fetch --------------------------------------------------
  var _origFetch = window.fetch ? window.fetch.bind(window) : null;

  if (_origFetch) {
    window.fetch = function(resource, init) {
      try {
        var url = null;
        var isRequestObj = false;

        if (typeof resource === "string") {
          url = resource;
        } else if (resource && typeof resource.url === "string") {
          url = resource.url;
          isRequestObj = true;
        }

        if (url && !isAbsoluteOrSpecial(url) && SHOULD_REWRITE(url)) {
          var abs = _api(url);

          if (typeof resource === "string") {
            resource = abs;
          } else if (isRequestObj) {
            // Rebuild Request with the same options
            try {
              var opts = {
                method: resource.method || (init && init.method) || "GET",
                headers: resource.headers || (init && init.headers) || undefined,
                body: resource.body || (init && init.body) || undefined,
                mode: resource.mode || (init && init.mode) || undefined,
                credentials: resource.credentials || (init && init.credentials) || undefined,
                cache: resource.cache || (init && init.cache) || undefined,
                redirect: resource.redirect || (init && init.redirect) || undefined,
                referrer: resource.referrer || (init && init.referrer) || undefined,
                referrerPolicy: resource.referrerPolicy || (init && init.referrerPolicy) || undefined,
                integrity: resource.integrity || (init && init.integrity) || undefined,
                keepalive: resource.keepalive || (init && init.keepalive) || undefined,
                signal: resource.signal || (init && init.signal) || undefined,
              };
              resource = new Request(abs, opts);
            } catch (_) {
              resource = abs; // fallback
            }
          }
        }
      } catch (_) {
        // ignore patch errors, proceed to original fetch
      }
      return _origFetch(resource, init);
    };
  }

  // ---- Monkey-patch EventSource (for SSE like /chat/stream) ---------------
  try {
    var _OrigES = window.EventSource;
    if (_OrigES && !_OrigES.__pv_patched__) {
      var PatchedES = function(url, config) {
        try {
          if (typeof url === "string" && !isAbsoluteOrSpecial(url) && SHOULD_REWRITE(url)) {
            url = _api(url);
          }
        } catch(_) {}
        return new _OrigES(url, config);
      };
      // copy static props if any
      for (var k in _OrigES) { try { PatchedES[k] = _OrigES[k]; } catch(_) {} }
      PatchedES.prototype = _OrigES.prototype;
      PatchedES.__pv_patched__ = true;
      window.EventSource = PatchedES;
    }
  } catch(_) {}

  // ---- Dynamically load the original file AFTER patching fetch ------------
  try {
    var s = document.createElement("script");
    s.src = "ai_guardrails_vlite.js";
    s.async = false; // preserve execution order
    var here = document.currentScript;
    if (here && here.parentNode) {
      here.parentNode.insertBefore(s, here);
    } else {
      document.head.appendChild(s);
    }
  } catch (_) {
    // If dynamic load fails, at least the fetch/EventSource patches are active.
  }
})();
