/* Google Analytics con Consent Mode v2: nada se mide hasta que el visitante acepta. */
(function () {
  var GA_ID = "G-XXXXXXXXXX"; // <- reemplazar por el Measurement ID
  var KEY = "analytics_consent";

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }

  gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });

  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
  document.head.appendChild(s);
  gtag("js", new Date());
  gtag("config", GA_ID);

  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function apply(v) {
    gtag("consent", "update", { analytics_storage: v === "granted" ? "granted" : "denied" });
  }

  function hide() {
    var b = document.getElementById("cookie-banner");
    if (b) b.remove();
  }

  function choose(v) {
    write(v);
    apply(v);
    hide();
  }

  function show() {
    if (document.getElementById("cookie-banner")) return;
    var st = document.createElement("style");
    st.textContent =
      "#cookie-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:560px;margin:0 auto;" +
      "background:#141B24;color:#EFF3F7;border:1px solid rgba(150,170,190,.2);border-radius:12px;padding:16px 18px;" +
      "font:14px/1.5 Inter,system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.5)}" +
      "#cookie-banner p{margin:0 0 12px}#cookie-banner a{color:#1DA1FF}" +
      "#cookie-banner .cb-row{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}" +
      "#cookie-banner button{font:600 14px Inter,system-ui,sans-serif;border-radius:8px;padding:9px 16px;cursor:pointer;" +
      "border:1px solid rgba(150,170,190,.3);background:transparent;color:#EFF3F7}" +
      "#cookie-banner button.cb-ok{background:#FF7A22;border-color:#FF7A22;color:#0A0E13}";
    document.head.appendChild(st);
    var b = document.createElement("div");
    b.id = "cookie-banner";
    b.setAttribute("role", "dialog");
    b.setAttribute("aria-label", "Preferencias de cookies");
    b.innerHTML =
      "<p>Usamos Google Analytics para medir las visitas al sitio. Solo se activa si lo aceptas. " +
      'Más detalles en la <a href="/privacy#analytics">política de privacidad</a>.</p>' +
      '<div class="cb-row"><button type="button" class="cb-no">Rechazar</button>' +
      '<button type="button" class="cb-ok">Aceptar</button></div>';
    document.body.appendChild(b);
    b.querySelector(".cb-ok").onclick = function () { choose("granted"); };
    b.querySelector(".cb-no").onclick = function () { choose("denied"); };
  }

  var saved = read();
  if (saved) apply(saved);

  document.addEventListener("DOMContentLoaded", function () {
    if (!saved) show();
    document.querySelectorAll("[data-cookie-prefs]").forEach(function (el) {
      el.addEventListener("click", function (e) { e.preventDefault(); show(); });
    });
  });
})();
