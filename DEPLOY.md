# Déploiement des services backend

Le site lui-même (`index.html`, `styles.css`, `script.js`) est statique et se
déploie séparément (voir le `Dockerfile` à la racine, déjà en place sur
Easypanel).

Les **trois petits services backend** (`demo-counter-server/`,
`chat-server/`, `contact-server/`) sont conçus pour tourner ensemble, sur le
même VPS, via **une seule commande** grâce à `docker-compose.yml` — pas
besoin de trois installations séparées.

## Installation (une seule fois)

```bash
cp .env.example .env
# éditer .env : renseigner OPENAI_API_KEY et ALLOWED_ORIGIN (votre vrai domaine)

docker compose up --build -d
```

Ça construit et démarre les trois services d'un coup :

| Service | Port | Rôle |
|---|---|---|
| `demo-counter` | 4001 | compteur de parties jouées par démo |
| `chat` | 4002 | assistant IA de qualification de projet |
| `contact` | 4003 | réception des formulaires (contact + demande) |

## Après le premier démarrage

- `docker compose ps` — vérifier que les trois tournent.
- `docker compose logs -f` — suivre les logs des trois en même temps
  (`docker compose logs -f chat` pour un seul service).
- Sur Easypanel : si vous préférez la ressource "Compose" plutôt que trois
  "Application" séparées, pointez-la sur ce `docker-compose.yml` — sinon,
  chaque service peut aussi être déployé comme une "Application" Easypanel
  indépendante en utilisant le `Dockerfile` de son propre dossier (les deux
  approches fonctionnent, `docker-compose.yml` est juste le moyen le plus
  simple de tout lancer d'un coup sur un serveur unique).

## Mettre à jour le site après déploiement

Une fois les trois services en ligne avec leurs vraies URLs, il reste trois
lignes à modifier dans `script.js` (racine du site) :

```js
const DEMO_COUNTER_API = "https://votre-domaine.example:4001";
const CHAT_API = "https://votre-domaine.example:4002";
const CONTACT_API = "https://votre-domaine.example:4003";
```

(ou trois sous-domaines/chemins différents selon comment nginx/Caddy/Easypanel
route les ports — l'important est que chaque URL pointe vers le bon service).

## Redémarrer après une mise à jour du code

```bash
git pull
docker compose up --build -d
```

Les volumes Docker (`demo-counter-data`, `contact-data`) persistent les
données (`counters.json`, `submissions.log`) à travers les rebuilds — rien
n'est perdu.

## ⚠️ Non testé de bout en bout

Ce `docker-compose.yml` a été validé syntaxiquement (YAML valide, structure
conforme), mais je n'ai pas Docker sur cette machine pour lancer un vrai
`docker compose up --build` et confirmer que les trois images se construisent
et démarrent sans accroc. Premier lancement à faire avec un œil attentif sur
les logs.
