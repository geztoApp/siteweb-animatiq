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

1. Copier ce dossier sur le VPS (`rsync` ou `git clone` du repo).
2. `npm start` derrière un gestionnaire de process (`pm2 start server.js` ou un
   service systemd) pour qu'il redémarre automatiquement.
3. Exposer le port via nginx/Caddy en reverse proxy si besoin d'un vrai nom de
   domaine + HTTPS.
4. Mettre à jour `DEMO_COUNTER_API` dans `script.js` (racine du site) avec
   l'URL publique du serveur.

`counters.json` est ignoré par git — il est créé automatiquement au premier
lancement et vit uniquement sur le serveur.
