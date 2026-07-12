# Déploiement

Tout — le site statique (`index.html`, `styles.css`, `script.js`) et les
API (compteur de démos, formulaires) — tourne dans **un seul processus
Node** (`server.js`), donc **une seule app Easypanel** (`siteweb-animatiq`,
déjà en place).

## Ce qui roule où

| Route | Rôle |
|---|---|
| `GET /` | le site |
| `GET /api/counters`, `POST /api/counters/:slug/play` | compteur de parties jouées par démo |
| `POST /api/submit` | réception des formulaires (contact + demande de projet) |
| `GET /admin/counters` | page HTML de consultation des compteurs |
| `GET /admin/submissions` | page HTML de consultation des demandes reçues |

## Variables d'environnement à configurer sur Easypanel

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | port d'écoute — laisser vide/défaut, c'est le port que le nginx précédent utilisait et que Easypanel route déjà | `80` |
| `RESEND_API_KEY` | clé API Resend — sans elle, l'e-mail de notification est simplement désactivé (les demandes restent enregistrées dans `data/submissions.log` et visibles sur `/admin/submissions`) | — |
| `RESEND_FROM` | adresse d'envoi — doit être sur un domaine vérifié dans Resend, sinon utiliser l'adresse sandbox (qui ne livre qu'à l'e-mail du compte Resend) | `onboarding@resend.dev` |
| `RESEND_TO` | adresse qui reçoit les notifications | `gezto.app@gmail.com` |

Si une variable `OPENAI_API_KEY` traîne encore dans la config Easypanel
(de l'ancien assistant de qualification par chat, retiré depuis), elle est
inoffensive à laisser mais n'est plus utilisée nulle part — vous pouvez la
supprimer.

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
PORT=8080 npm start
# puis ouvrir http://localhost:8080
```
