# Réception des formulaires (contact + demande de projet)

Petit serveur autonome (aucune dépendance, seulement Node.js) qui reçoit les
deux formulaires du site — le formulaire de contact principal et le
formulaire de demande de projet (dans la modale des Réalisations) — et les
enregistre dans un simple fichier `submissions.log` (une ligne JSON par
demande).

Pas d'envoi d'e-mail pour l'instant : la façon la plus simple de commencer
est de consulter la page `/` de temps en temps, comme pour le compteur de
démos.

## Lancer

```bash
cd contact-server
npm start
# ou directement : node server.js
```

Par défaut sur le port `4003` (modifiable via `PORT=xxxx`).

## Routes

- `GET /` — page HTML listant les 100 dernières demandes reçues
- `POST /submit` — enregistre une nouvelle demande

Corps de la requête `/submit` :
```json
{
  "name": "Jeanne Dupont",
  "email": "jeanne@exemple.ch",
  "eventType": "festival",
  "message": "Nous organisons...",
  "source": "contact"
}
```
`eventType` est optionnel (vide pour le formulaire de contact principal,
rempli pour une demande de projet). `source` distingue l'origine (`contact`
ou `request:<nom du projet>`).

## Déploiement sur le VPS

**Option Docker (recommandée)** : un `docker-compose.yml` à la racine du repo
lance ce service avec les deux autres d'un coup — voir le README à la racine
du projet.

**Option manuelle** : même logique que les deux autres serveurs
(`demo-counter-server/`, `chat-server/`) : copier le dossier, lancer avec
`pm2` ou un service systemd, exposer via nginx/Caddy si besoin d'un domaine
HTTPS, puis renseigner l'URL publique dans `CONTACT_API` (`script.js`,
racine du site).

## Vie privée

`submissions.log` contient des données personnelles (noms, e-mails,
messages, adresses IP) — il est ignoré par git et ne doit jamais être
commité ni partagé. Il vit uniquement sur le VPS.

## Protection contre les abus

- **Rate limiting par IP** : 10 requêtes/heure sur `/submit`.
- **Corps de requête limité** à 10 Ko (`413` sinon).
- **Validation stricte** de tous les champs (longueur, format d'e-mail,
  `eventType` restreint à une liste connue) — `400` sinon.
- **Honeypot et délai minimum re-vérifiés côté serveur** (pas seulement
  côté site) : un bot qui ignore le JavaScript du site et poste directement
  ici est quand même filtré. Une tentative détectée reçoit un `200` silencieux
  — jamais d'indice qu'elle a été bloquée — mais rien n'est enregistré.
- **Champs assainis** (retours à la ligne retirés du nom/e-mail) pour éviter
  toute injection d'en-têtes si un envoi d'e-mail est ajouté plus tard.
- **CORS restreint** via `ALLOWED_ORIGIN` (mettre le vrai domaine en prod).

### Pour aller plus loin

Si vous voulez un vrai e-mail à chaque demande plutôt que de consulter la
page manuellement, il faudra un serveur SMTP que vous contrôlez (le vôtre,
ou un compte e-mail existant) — je peux ajouter l'envoi via `nodemailer`
dès que vous avez ces identifiants.
