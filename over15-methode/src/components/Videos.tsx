import './videos.css';

/**
 * Mini-vidéos animées (en boucle) qui montrent les gestes à faire.
 * Uniquement des animations de transform et d'opacité : fluides et légères.
 */

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="vid-phone">
      <div className="vid-notch" />
      <div className="vid-screen">{children}</div>
    </div>
  );
}

/** « Demander à Claude » : copier → coller dans Claude → copier sa réponse → coller ici. */
export function ClaudeVideo() {
  return (
    <div className="vid vid-claude" aria-label="Mini-vidéo : copier la demande, la coller dans Claude, copier sa réponse, la coller dans l'app">
      <Phone>
        {/* Scène 1 : notre app, bouton Copier */}
        <div className="vid-scene s1">
          <div className="vid-app-head">Outsiders</div>
          <div className="vid-btn green">📋 Copier la demande</div>
          <div className="vid-toast">Copié ✓</div>
          <span className="vid-finger f1">👆</span>
        </div>
        {/* Scène 2 : Claude, coller et envoyer */}
        <div className="vid-scene s2">
          <div className="vid-app-head claude">Claude</div>
          <div className="vid-msg me">Trouve les outsiders du jour…</div>
          <div className="vid-input">
            <span className="vid-paste">Coller</span>
            <span className="vid-send">↑</span>
          </div>
          <span className="vid-finger f2">👆</span>
        </div>
        {/* Scène 3 : Claude répond, on copie */}
        <div className="vid-scene s3">
          <div className="vid-app-head claude">Claude</div>
          <div className="vid-msg bot">
            <span className="vid-line w90" />
            <span className="vid-line w70" />
            <span className="vid-line w80" />
          </div>
          <div className="vid-copy">📄📄 Copier</div>
          <span className="vid-finger f3">👆</span>
        </div>
        {/* Scène 4 : retour dans l'app, coller → résultats */}
        <div className="vid-scene s4">
          <div className="vid-app-head">Outsiders</div>
          <div className="vid-btn green small">📥 Coller la réponse</div>
          <div className="vid-card ok">✅ Al Feiha · 8,40</div>
          <div className="vid-card no">❌ Angers · 6,20</div>
          <span className="vid-finger f4">👆</span>
        </div>
      </Phone>
      <div className="vid-captions">
        <span className="c1">1. Copie la demande</span>
        <span className="c2">2. Colle-la dans Claude</span>
        <span className="c3">3. Copie sa réponse</span>
        <span className="c4">4. Colle-la ici ✅</span>
      </div>
    </div>
  );
}

/** « Bonne affaire ou piège ? » : les deux barres, puis le verdict. */
export function ValueVideo() {
  return (
    <div className="vid vid-value" aria-label="Mini-vidéo : comparer la chance selon la cote et la vraie chance">
      <div className="vv-scene a">
        <div className="vv-odds">Cote 8,40</div>
        <div className="vv-row">
          <span>Chance selon la cote</span>
          <div className="vv-track">
            <div className="vv-bar grey" style={{ width: '48%' }} />
          </div>
          <b>12 %</b>
        </div>
        <div className="vv-row">
          <span>Vraie chance</span>
          <div className="vv-track">
            <div className="vv-bar green" style={{ width: '68%' }} />
          </div>
          <b className="pos">17 %</b>
        </div>
        <div className="vv-stamp ok">✅ BONNE AFFAIRE</div>
      </div>
      <div className="vv-scene b">
        <div className="vv-odds">Cote 8,40</div>
        <div className="vv-row">
          <span>Chance selon la cote</span>
          <div className="vv-track">
            <div className="vv-bar grey" style={{ width: '48%' }} />
          </div>
          <b>12 %</b>
        </div>
        <div className="vv-row">
          <span>Vraie chance</span>
          <div className="vv-track">
            <div className="vv-bar red" style={{ width: '32%' }} />
          </div>
          <b className="neg">8 %</b>
        </div>
        <div className="vv-stamp no">❌ PIÈGE</div>
      </div>
    </div>
  );
}

/** « Système de doubles » : 6 matchs, 2 gagnants → la multiplication des cotes. */
export function SystemVideo() {
  return (
    <div className="vid vid-sys" aria-label="Mini-vidéo : système de doubles, deux matchs gagnés">
      <div className="vs-grid">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <span key={i} className={`vs-chip ${i === 2 ? 'w1' : i === 5 ? 'w2' : ''}`}>
            Match {i}
          </span>
        ))}
      </div>
      <div className="vs-calc">
        <span className="vs-n">3,00</span>
        <span className="vs-x">×</span>
        <span className="vs-n">5,00</span>
        <span className="vs-x">=</span>
        <span className="vs-res">15</span>
      </div>
      <div className="vs-stamp">✅ Remboursé (15 doubles)</div>
    </div>
  );
}
