# Compteur des démos

Petit serveur autonome (aucune dépendance, seulement Node.js) qui compte les
lancements de chaque démo jouable du site — un compteur par jeu, stocké dans
un simple fichier `counters.json`.

## Lancer

```bash
cd demo-counter-server
npm start
# ou directement : node server.js
```

Par défaut sur le port `4001` (modifiable via `PORT=xxxx npm start`).

## Routes

- `GET /` — page HTML simple listant les compteurs (à consulter de temps en temps)
- `GET /counters` — les compteurs en JSON
- `POST /counters/<slug>/play` — incrémente le compteur du jeu `<slug>`
  (`caves-ouvertes`, `chasse-aux-bonbons`, `escalade-1602`)

## Déploiement sur le VPS

**Option Docker (recommandée)** : un `docker-compose.yml` à la racine du repo
lance ce service avec les deux autres (`chat-server`, `contact-server`)
d'un coup — voir le README à la racine du projet.

**Option manuelle** :
1. Copier ce dossier sur le VPS (`rsync` ou `git clone` du repo).
2. `npm start` derrière un gestionnaire de process (`pm2 start server.js` ou un
   service systemd) pour qu'il redémarre automatiquement.
3. Exposer le port via nginx/Caddy en reverse proxy si besoin d'un vrai nom de
   domaine + HTTPS.
4. Mettre à jour `DEMO_COUNTER_API` dans `script.js` (racine du site) avec
   l'URL publique du serveur.

`counters.json` (dans `data/`) est ignoré par git — il est créé
automatiquement au premier lancement et vit uniquement sur le serveur (ou
dans le volume Docker `demo-counter-data`).

## Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | Port d'écoute | `4001` |
| `ALLOWED_ORIGIN` | Origine(s) autorisée(s), séparées par des virgules | `*` (à changer en prod) |

## Protection contre les abus

Pas de coût direct ici (pas d'API payante), mais un compteur public reste
une donnée qu'on ne veut pas voir falsifiée par un script :

- **Rate limiting par IP** sur `POST /counters/<slug>/play` : 30
  requêtes/heure. Au-delà, réponse `429`.
- **Slug validé** contre une liste fixe de jeux connus (`404` sinon) — pas
  d'écriture arbitraire possible.
- **CORS restreint** via `ALLOWED_ORIGIN` (mettre le vrai domaine en prod).
