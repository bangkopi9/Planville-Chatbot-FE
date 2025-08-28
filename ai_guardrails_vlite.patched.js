
/**
 * ai_guardrails_vlite.patched.js
 * Universal patch: ensure all relative API calls go to CONFIG.BASE_API_URL.
 * How it works:
 * 1) Defines _baseURL() and _api(path).
 * 2) Monkey-patches window.fetch to rewrite '/ai/*' and '/chat' to absolute URLs.
 * 3) Dynamically loads the original 'ai_guardrails_vlite.js' after patching.
 *
 * Usage:
 *   Replace in index.html:
 *     <script src="ai_guardrails_vlite.js"></script>
 *   with:
 *     <script src="ai_guardrails_vlite.patched.js"></script>
 *
 *   Keep window.CONFIG.BASE_API_URL defined before this script.
 */
(function () {
  "use strict";

  function _baseURL() {
    try {
      var wcfg = (typeof window !== "undefined" && window.CONFIG) ? window.CONFIG : (typeof CONFIG !== "undefined" ? CONFIG : null);
      var b = wcfg && wcfg.BASE_API_URL ? ("" + wcfg.BASE_API_URL).trim() : "";
      if (!b) return "";
      if (!/^https?:\/\//i.test(b)) b = "https://" + b;
      if (b.endsWith("/")) b = b.slice(0, -1);
      return b;
    } catch (e) {
      return "";
    }
  }

  function _api(path) {
    var base = _baseURL();
    return base ? (base + path) : path;
  }

  // Expose helpers (optional)
  try {
    window._api = _api;
    window._baseURL = _baseURL;
  } catch (e) {}

  // ---- Monkey-patch fetch ----
  var _origFetch = window.fetch ? window.fetch.bind(window) : null;

  if (_origFetch) {
    window.fetch = function(resource, init) {
      try {
        // resource can be string or Request
        var url = null;
        var isRequestObj = false;
        if (typeof resource === "string") {
          url = resource;
        } else if (resource && typeof resource.url === "string") {
          url = resource.url;
          isRequestObj = true;
        }

        var rewritten = false;
        if (url) {
          // Rewrite only our API endpoints
          if (url === "/chat" || url === "/chat/" || url.startsWith("/ai/")) {
            var abs = _api(url);
            if (typeof resource === "string") {
              resource = abs;
              rewritten = true;
            } else if (isRequestObj) {
              // Rebuild Request with updated URL (keeps method/headers/body if provided)
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
                rewritten = true;
              } catch (e) {
                resource = abs; // fallback
                rewritten = true;
              }
            }
          }
        }
        // Optionally: ensure proper headers for JSON posts
        // if (init && init.body && !((init.headers||{})["Content-Type"])) {
        //   init.headers = Object.assign({"Content-Type":"application/json"}, init.headers||{});
        // }

        // Debug (optional):
        // if (rewritten) console.log("[patched fetch] →", resource);

      } catch (e) {
        // swallow patch errors, proceed with original fetch
      }
      return _origFetch(resource, init);
    };
  }

  // ---- Dynamically load the original file AFTER patching fetch ----
  try {
    var s = document.createElement("script");
    s.src = "ai_guardrails_vlite.js";
    s.async = false; // keep execution order
    var here = document.currentScript;
    if (here && here.parentNode) {
      here.parentNode.insertBefore(s, here);
    } else {
      document.head.appendChild(s);
    }
  } catch (e) {
    // If dynamic load fails, at least we left the fetch patch active.
  }
})();
