/*
 * Filet de sécurité au démarrage (script classique, hors du code de l'application).
 * Si l'application n'a pas démarré après quelques secondes (par exemple un fichier
 * introuvable juste après une mise à jour), on cherche la dernière version, on l'active
 * si elle attend, puis la page est rechargée une seule fois, au lieu de rester blanche.
 */
(function () {
  var CLE = "carnet-foot-rechargee";
  function recharger() {
    try {
      sessionStorage.setItem(CLE, "1");
    } catch (e) {
      /* stockage indisponible */
    }
    location.reload();
  }
  setTimeout(function () {
    try {
      var app = document.getElementById("app");
      if (!app || app.getAttribute("data-demarree")) return;
      if (sessionStorage.getItem(CLE)) return;
    } catch (e) {
      return;
    }
    if (!("serviceWorker" in navigator)) return recharger();
    navigator.serviceWorker
      .getRegistration()
      .then(function (reg) {
        if (!reg) return;
        return reg.update().then(function () {
          var attente = reg.waiting || reg.installing;
          if (!attente) return;
          return new Promise(function (fini) {
            navigator.serviceWorker.addEventListener("controllerchange", fini);
            if (attente.state === "installed") attente.postMessage("activer-nouvelle-version");
            attente.addEventListener("statechange", function () {
              if (attente.state === "installed") attente.postMessage("activer-nouvelle-version");
              if (attente.state === "redundant") fini();
            });
            setTimeout(fini, 8000);
          });
        });
      })
      .catch(function () {})
      .then(recharger);
  }, 6000);
})();
