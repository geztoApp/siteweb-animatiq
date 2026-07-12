# Déploiement

Tout — le site statique (`index.html`, `styles.css`, `script.js`) et les
trois API (compteur de démos, chat IA, formulaires) — tourne dans **un seul
processus Node** (`server.js`), donc **une seule app Easypanel**
(`siteweb-animatiq`, déjà en place).

## Ce qui roule où

| Route | Rôle |
|---|---|
| `GET /` | le site |
| `GET /api/counters`, `POST /api/counters/:slug/play` | compteur de parties jouées par démo |
| `POST /api/chat` | assistant IA de qualification de projet |
| `POST /api/submit` | réception des formulaires (contact + demande de projet) |
| `GET /admin/counters` | page HTML de consultation des compteurs |
| `GET /admin/submissions` | page HTML de consultation des demandes reçues |

## Variables d'environnement à configurer sur Easypanel

| Variable | Rôle | Défaut |
|---|---|---|
| `OPENAI_API_KEY` | clé API OpenAI, nécessaire pour `/api/chat` | — |
| `OPENAI_MODEL` | modèle utilisé | `gpt-4o-mini` |
| `PORT` | port d'écoute (Easypanel le fixe généralement lui-même) | `8080` |

Sans `OPENAI_API_KEY`, tout le reste du site fonctionne normalement — seul
le chat de qualification répond par une erreur (le visiteur peut alors
utiliser "Passer directement au formulaire").

## Déployer / mettre à jour

Easypanel reconstruit l'image à partir du `Dockerfile` à la racine à chaque
push sur `main` (ou déclenchement manuel du build) — rien à faire côté VPS
au-delà de configurer les variables d'environnement ci-dessus une fois.

## Persistance des données

`data/counters.json` et `data/submissions.log` vivent dans le dossier
`data/` à la racine du conteneur — pensez à monter un **volume persistant**
Easypanel sur `/app/data` pour que ces fichiers survivent aux redéploiements
(sinon ils repartent de zéro à chaque rebuild).

`submissions.log` contient des données personnelles (noms, e-mails,
messages, adresses IP) — il n'est jamais commité (voir `.gitignore`) et ne
vit que sur le volume du VPS.

## Tester en local

```bash
npm install
OPENAI_API_KEY=sk-... npm start
# puis ouvrir http://localhost:8080
```

## ⚠️ Non testé de bout en bout

Docker n'est pas installé sur la machine où ce serveur a été écrit, donc je
n'ai pas pu lancer un vrai `docker build`/`docker run` pour confirmer que
l'image se construit et démarre sans accroc. Le code a été relu et
validé syntaxiquement (`node --check`) ; premier déploiement à surveiller
avec les logs Easypanel ouverts.
