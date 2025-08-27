// Lightweight AI guard + turn limiter

(function(global){
  const AIGuard = {};
  let turns = 0;
  const MAX_QA_TURNS = 10;

  function getLang(){ try { return document.getElementById("langSwitcher").value || "de"; } catch(_) { return "de"; } }

  const SAFE_FALLBACK = {
    de: "Dazu habe ich keine gesicherte Information. Ich kann dich gern mit unserem Team verbinden oder dir mit dem Konfigurator helfen.",
    en: "I don't have verified information on that. I can connect you with our team or help you proceed with the configurator."
  };

  // Call backend /ai/answer if available, otherwise null → chatbot.js will fallback to /chat
  async function tryAiEndpoint(question, lang){
    try {
      const res = await fetch(`/ai/answer`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ message: question, lang })
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && typeof data.text === "string" && data.text.trim()) {
        return { text: data.text.trim() };
      }
      return null;
    } catch(_) { return null; }
  }

  AIGuard.ask = async (question, lang) => {
    lang = lang || getLang();

    // stop after MAX_QA_TURNS → push to funnel timeline (summary+form)
    if (turns >= MAX_QA_TURNS) {
      const msg = (lang==="de")
        ? "Damit wir dich konkret beraten können, gib bitte noch deinen Zeitraum an — danach erfassen wir kurz deine Kontaktdaten."
        : "To help you concretely, please select your timeline — then we’ll just take your contact details.";
      // Force ask timeline if funnel active
      if (typeof window.askNext === "function" && window.Funnel?.state?.product) {
        appendMessage?.(msg, "bot");
        // ensure it will ask 'timeline' next
        if (window.Funnel.state.data.timeline === undefined) {
          window.askNext();
        }
      } else {
        appendMessage?.(msg, "bot");
      }
      return { text: "" }; // already handled in chat
    }

    // try RAG/AI endpoint
    const ai = await tryAiEndpoint(question, lang);

    turns += 1;

    if (ai && ai.text) return { text: ai.text };

    // fallback
    return { text: SAFE_FALLBACK[lang] || SAFE_FALLBACK.de };
  };

  // After bot answer → optionally continue funnel
  AIGuard.maybeContinueFunnel = () => {
    // No-op here; funnel proceeds based on askNext and user clicks
  };

  global.AIGuard = AIGuard;
})(window);
