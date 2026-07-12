# Assistant de qualification (chat IA)

Petit serveur autonome (aucune dépendance, seulement Node.js ≥ 18 pour `fetch`
natif) qui sert de proxy entre le site et l'API OpenAI. Le site n'a jamais la
clé API — elle reste uniquement sur ce serveur.

Le modèle discute avec le visiteur (type d'événement, contexte, et ce que le
jeu doit mettre en avant : village, histoire, métier/industrie, bâtiment
historique, un mélange, ou libre), puis appelle une fonction `submit_summary`
pour renvoyer un résumé structuré une fois qu'il a assez d'informations.

## Lancer

```bash
cd chat-server
OPENAI_API_KEY=sk-... npm start
# ou directement : OPENAI_API_KEY=sk-... node server.js
```

Par défaut sur le port `4002` (modifiable via `PORT=xxxx`).
Modèle par défaut : `gpt-4o-mini` (modifiable via `OPENAI_MODEL`).

## Route

`POST /chat`

Corps de la requête :
```json
{
  "projectTitle": "Jeux Caves Ouvertes",
  "messages": [
    { "role": "user", "content": "C'est pour un festival de village." }
  ]
}
```

Réponse pendant la conversation :
```json
{ "done": false, "reply": "Super ! Ça se passe à quelle période de l'année ?" }
```

Réponse une fois la conversation conclue :
```json
{
  "done": true,
  "eventType": "festival",
  "concept": "village",
  "message": "Nous organisons un festival de village et aimerions..."
}
```

## Déploiement sur le VPS

**Option Docker (recommandée)** : un `docker-compose.yml` à la racine du repo
lance ce service avec les deux autres d'un coup — voir le README à la racine
du projet pour la configuration de `OPENAI_API_KEY` via `.env`.

**Option manuelle** : copier le dossier, lancer avec `pm2` ou un service
systemd, exposer via nginx/Caddy si besoin d'un domaine HTTPS, puis
renseigner l'URL publique et la clé API dans la config du site (`CHAT_API`
dans `script.js` — la clé `OPENAI_API_KEY`, elle, reste uniquement en
variable d'environnement sur le serveur, jamais dans le code).

## Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `OPENAI_API_KEY` | Clé API OpenAI (obligatoire) | — |
| `PORT` | Port d'écoute | `4002` |
| `OPENAI_MODEL` | Modèle utilisé | `gpt-4o-mini` |
| `ALLOWED_ORIGIN` | Origine(s) autorisée(s) à appeler l'API, séparées par des virgules (ex: `https://animatiq.ch`) | `*` (à changer en prod) |

## Protection contre les abus (déjà en place)

Chaque appel coûte de l'argent réel (usage OpenAI), donc ce serveur limite
volontairement plusieurs choses :

- **Rate limiting par IP** : 20 requêtes/heure. Au-delà, réponse `429`.
- **Taille du corps de requête plafonnée** (20 Ko) : rejette les payloads
  anormalement gros avant même de les parser (`413`).
- **Conversation plafonnée** : max 20 messages, 800 caractères par message,
  120 caractères pour le titre du projet (`400` sinon).
- **`max_tokens` sur la réponse OpenAI** (300) : borne le coût par appel.
- **Timeout de 20s** sur l'appel OpenAI pour ne pas laisser une requête
  traîner indéfiniment.
- **Prompt système strict** : l'assistant refuse explicitement tout
  changement de sujet, tentative de jailbreak ou détournement de son rôle
  (voir `SYSTEM_PROMPT` dans `server.js`).
- **CORS restreint** via `ALLOWED_ORIGIN` (mettre le vrai domaine en prod,
  ne pas laisser `*`).

### Ce qui reste à faire pour une protection complète

Ces mesures suffisent contre les abus automatisés basiques et bornent le
coût maximal en cas d'attaque. Pour une protection plus robuste :

- Ajouter un **CAPTCHA invisible** (Cloudflare Turnstile, gratuit) côté site
  avant d'autoriser le premier appel à `/chat` — bloque l'essentiel des bots
  qui n'exécutent pas de JavaScript complexe.
- Si le trafic devient important, remplacer le rate limiting en mémoire par
  quelque chose de partagé (Redis) si plusieurs instances tournent en
  parallèle — inutile tant qu'un seul processus suffit.
- Mettre une alerte de dépassement de budget côté OpenAI (leur dashboard le
  permet) comme filet de sécurité en dernier recours.
