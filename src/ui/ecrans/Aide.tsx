/**
 * Aide et tutoriel (phase 8) : explique chaque méthode et chaque chiffre affiché dans
 * l'application, en une phrase compréhensible sans jargon. Contenu statique, rien à charger.
 */
function Section({ titre, children }: { titre: string; children: unknown }) {
  return (
    <details className="repli">
      <summary>{titre}</summary>
      <div className="section">{children as never}</div>
    </details>
  );
}

export function Aide() {
  return (
    <>
      <div>
        <p className="aide">
          <a href="#/reglages">← Retour aux réglages</a>
        </p>
        <h1 tabIndex={-1}>Comment ça marche</h1>
        <p className="chapeau">Chaque méthode et chaque chiffre affiché, expliqué en une phrase. Touche une question pour la déplier.</p>
      </div>

      <section className="carte" aria-labelledby="titre-methodes-aide">
        <h2 id="titre-methodes-aide">Les trois méthodes</h2>

        <Section titre="Qu'est-ce que la méthode +1.5 ?">
          <p>
            Un pari en direct : tu regardes un match qui débute à 0-0, et vers la 15ᵉ-20ᵉ minute (si aucun but n'est encore tombé), tu paries
            « plus de 1,5 but » — c'est-à-dire qu'il y aura au moins 2 buts au total dans le match. L'idée : après 15-20 minutes sans but, la cote
            proposée est souvent plus intéressante qu'elle ne devrait l'être.
          </p>
        </Section>
        <Section titre="Qu'est-ce que la méthode +2.5 ?">
          <p>
            Un pari pris avant le match (pas en direct) : tu paries « plus de 2,5 buts », c'est-à-dire au moins 3 buts au total, sur des matchs
            choisis selon des critères (attaque/défense des équipes, championnat, contexte…).
          </p>
        </Section>
        <Section titre="Qu'est-ce que le Freebet ?">
          <p>
            Un bookmaker t'offre un pari gratuit (« freebet »). En le couvrant par un pari inverse chez un autre bookmaker (ou sur un exchange), tu
            peux transformer ce freebet en gain garanti, quel que soit le résultat du match. C'est la seule méthode de l'app dont le gain est
            garanti mathématiquement (si les deux paris sont acceptés aux cotes saisies).
          </p>
        </Section>
      </section>

      <section className="carte" aria-labelledby="titre-analyse-aide">
        <h2 id="titre-analyse-aide">Les chiffres de l'analyse des matchs</h2>

        <Section titre="Que veut dire « chances » ?">
          <p>La probabilité estimée que le marché se réalise (ex. « plus de 2,5 buts »), calculée à partir des statistiques des deux équipes.</p>
        </Section>
        <Section titre="Que veut dire « fourchette » ?">
          <p>
            L'estimation n'est jamais exacte : la fourchette donne l'intervalle dans lequel la vraie probabilité a environ 2 chances sur 3 de se
            trouver. Une fourchette large veut dire une estimation moins sûre.
          </p>
        </Section>
        <Section titre="Que veut dire « cote juste » et « cote minimale » ?">
          <p>
            La cote juste est celle qui correspondrait exactement à la probabilité estimée (sans marge pour le bookmaker). La cote minimale est
            plus prudente : c'est le bas de la fourchette, converti en cote — la cote à exiger au minimum pour se laisser une marge d'erreur.
          </p>
        </Section>
        <Section titre="Que veut dire « value » ?">
          <p>
            La différence en % entre la cote proposée par le bookmaker et la cote juste calculée. Une value positive veut dire que la cote paraît
            plus généreuse que ce que le modèle estime juste.
          </p>
        </Section>
        <Section titre="Que veut dire « risque » ?">
          <p>Un indice de 1 (prudent) à 5 (risqué), qui résume la fiabilité de l'estimation et l'écart avec la cote du bookmaker.</p>
        </Section>
        <Section titre="Que veut dire « fiabilité » ?">
          <p>
            Le score sur 8 indique combien d'informations utiles sont connues pour ce match (statistiques des équipes, absents, cotes…). Plus il
            est élevé, plus l'estimation peut être considérée comme fondée.
          </p>
        </Section>
      </section>

      <section className="carte" aria-labelledby="titre-live-aide">
        <h2 id="titre-live-aide">Les chiffres du Live (+1.5)</h2>
        <Section titre="Pourquoi la fenêtre 15ᵉ-20ᵉ minute ?">
          <p>
            C'est le moment où, statistiquement, la cote « plus de 1,5 but » reste intéressante alors que le risque d'un but déjà marqué
            commence à diminuer la valeur du pari si on attend trop.
          </p>
        </Section>
        <Section titre="Que veut dire « gain garanti » après un but ?">
          <p>
            Une fois un but marqué, ton pari « plus de 1,5 but » est presque gagné (il suffit d'1 but de plus, ou le match a déjà 1-1, 2-0…).
            Tu peux alors couvrir (pari inverse, exchange, cash-out) pour verrouiller un gain, quel que soit le score final.
          </p>
        </Section>
      </section>

      <section className="carte" aria-labelledby="titre-bankroll-aide">
        <h2 id="titre-bankroll-aide">Les chiffres de Mes paris et de la bankroll</h2>
        <Section titre="Que veut dire « ROI » ?">
          <p>Le retour sur investissement : tes gains, divisés par le total misé (hors freebets). Un ROI de 10 % veut dire 10 € gagnés pour 100 € misés.</p>
        </Section>
        <Section titre="Que veut dire « drawdown » ?">
          <p>La plus grande baisse de ta bankroll entre un sommet et le creux qui a suivi. Il donne une idée du pire passage traversé jusqu'ici.</p>
        </Section>
        <Section titre="Que veut dire « série » ?">
          <p>Le nombre de paris gagnés ou perdus d'affilée. Une série n'annonce rien sur le prochain pari : chaque pari reste indépendant.</p>
        </Section>
        <Section titre="Que veut dire « Kelly fractionné » ?">
          <p>
            Une formule qui calcule la mise idéale selon ton avantage estimé sur un pari (probabilité × cote). Le Kelly plein est agressif : un
            quart ou un demi-Kelly (réglable) mise moins pour lisser les variations de la bankroll.
          </p>
        </Section>
        <Section titre="Que veut dire « plafond » et pourquoi ce n'est jamais bloqué ?">
          <p>
            Un plafond par pari ou par jour, que tu choisis toi-même dans Réglages → Mises et objectifs. Le dépasser affiche juste un
            avertissement : la décision finale reste toujours la tienne.
          </p>
        </Section>
      </section>

      <section className="carte" aria-labelledby="titre-responsable-aide">
        <h2 id="titre-responsable-aide">Jeu responsable</h2>
        <p>
          Réglages → Jeu responsable te permet de poser un rappel (après une série de défaites ou un plafond du jour dépassé) et de te mettre en
          pause toi-même pour un temps choisi. Jouer comporte des risques : endettement, dépendance… Appelle le 09 74 75 13 13 (appel non
          surtaxé) ou va sur joueurs-info-service.fr.
        </p>
      </section>
    </>
  );
}
