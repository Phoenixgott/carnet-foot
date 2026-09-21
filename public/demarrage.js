/*
 * Filet de sécurité au démarrage (script classique, hors du code de l'application).
 * Si l'application n'a pas démarré après quelques secondes (par exemple un fichier
 * introuvable juste après une mise à jour), la page est rechargée une seule fois :
 * elle repart alors sur la version à jour, au lieu de rester blanche.
 */
(function () {
  var CLE = "carnet-foot-rechargee";
  setTimeout(function () {
    try {
      var app = document.getElementById("app");
      if (!app || app.getAttribute("data-demarree")) return;
      if (sessionStorage.getItem(CLE)) return;
      sessionStorage.setItem(CLE, "1");
      location.reload();
    } catch (e) {
      /* stockage indisponible : on ne fait rien */
    }
  }, 6000);
})();
