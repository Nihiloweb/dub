# Déployer Dub (fork Nihiloweb) sur Coolify

Fork self-hébergé de [dubinc/dub](https://github.com/dubinc/dub) pour un MVP : liens courts, redirections, QR depuis l’UI.

Stack Docker : MySQL 8.0 + `ps-http-sim` (shim PlanetScale HTTP) + Redis + `serverless-redis-http` (shim Upstash REST). Tinybird / QStash / Stripe sont stubbés pour que `next build` et les redirects fonctionnent sans ces SaaS.

## Prérequis

- Coolify (ou Docker Compose) avec assez de RAM pour le build Next.js (~6–8 Go heap)
- Deux domaines DNS pointant vers Coolify : **app** + **short**
- Secrets générés (ne jamais committer `.env`)

## Étapes Coolify

1. **Nouvelle ressource** → Docker Compose depuis ce dépôt Git.
2. Fichier Compose : `docker-compose.yml` (racine).
3. Renseigner les variables d’environnement (voir `.env.example`).
4. **Build args** obligatoires (inlinés au build, pas seulement au runtime) :
   - `NEXT_PUBLIC_APP_DOMAIN` — hostname nu, ex. `app.example.com`
   - `NEXT_PUBLIC_APP_SHORT_DOMAIN` — hostname nu, ex. `go.example.com`
   - `DATABASE_URL` — dummy OK, ex. `mysql://root:build@db:3306/dub`
5. Domaines Coolify : exposer le service `dub` sur le port **3000** (app + short host → même service).
6. Déployer. Attendre le healthcheck `/api/health`.

En local : `cp .env.example .env`, puis `docker compose up --build` (utilise `docker-compose.override.yml` pour builder depuis les sources).

## Après le premier boot : Prisma

Le build n’applique pas le schéma. Une fois le stack healthy :

```bash
docker compose exec dub \
  sh -c "cd /app/apps/web && pnpm prisma db push --schema=./prisma/schema"
```

Sans cette étape → erreurs « table does not exist ».

## Connexion & premier lien

1. Ouvrir `https://<NEXT_PUBLIC_APP_DOMAIN>` → register / login (Google ou email selon env).
2. Créer un workspace.
3. Ajouter le domaine short dans l’UI (Settings → Domains) = `NEXT_PUBLIC_APP_SHORT_DOMAIN`.
4. Créer un short link → tester la redirection et le QR.

## Plan self-hosté (enterprise, sans Stripe)

Les nouveaux workspaces sont créés en plan `enterprise` avec limites illimitées (`INFINITY_NUMBER` = 1e9). L’étape onboarding `/onboarding/plan` est ignorée.

Pour un workspace déjà existant resté en `free` :

```sql
UPDATE Project
SET plan = 'enterprise',
    planTier = 1,
    usageLimit = 1000000000,
    linksLimit = 1000000000,
    domainsLimit = 1000000000,
    tagsLimit = 1000000000,
    foldersLimit = 1000000000,
    groupsLimit = 1000000000,
    usersLimit = 1000000000,
    aiLimit = 1000000000,
    payoutsLimit = 1000000000,
    partnersLimit = 1000000000,
    networkInvitesLimit = 1000000000,
    partnerTagsLimit = 1000000000,
    conversionEnabled = 1,
    webhookEnabled = 1
WHERE slug = 'votre-workspace-slug';
```

Redémarrer `dub` ensuite (cache workspace). Marquer l’onboarding terminé dans Redis si besoin :
`SET onboarding-step:<userId> completed EX 86400`

## Variables importantes

| Variable | Notes |
|---|---|
| `NEXTAUTH_URL` | `https://…` pour cookies `__Secure-` |
| `NEXTAUTH_SECRET` / `ENCRYPTION_KEY` | secrets 32 bytes base64 |
| `DB_ROOT_PASSWORD` | non vide (requis par ps-http-sim) |
| `DATABASE_URL` | `mysql://root:…@db:3306/dub` |
| `PLANETSCALE_DATABASE_URL` | `http://root:…@planetscale-proxy:3900/dub` |
| `UPSTASH_REDIS_REST_*` | URL → `http://serverless-redis-http:80`, token = secret inventé |
| `NEXT_PUBLIC_APP_*` | **build args**, hostnames nus |

MySQL **8.0** (pas 8.4) : `mysql_native_password` nécessaire pour `ps-http-sim`.

## MVP stubbé

- **Tinybird** : analytics clics désactivées si pas de `TINYBIRD_API_KEY` (`NoopTinybird` + guard `record-click`).
- **QStash / Stripe** : placeholders ; pas de billing ni jobs Upstash Workflow en prod MVP.
- **Minio** : optionnel (avatars / OG). Les QR UI fonctionnent sans.

## Ports

| Service | Port |
|---|---|
| App Dub | **3000** |
| MySQL | 3306 (interne) |
| ps-http-sim | 3900 (interne) |
| MinIO API / console | 9000 / 9001 (si activé) |

## Licence

AGPL-3.0 — upstream [dubinc/dub](https://github.com/dubinc/dub). Ce fork ajoute le déploiement Coolify Docker Compose.

## MinIO image (self-host)

Coolify builds `dub-minio:local` from `docker/minio/Dockerfile`, which `FROM dub-minio-base:local`.
On the VPS, once (or after pruning images):

```bash
docker tag quay.io/minio/minio:latest dub-minio-base:local
# or: docker tag minio/minio:latest dub-minio-base:local
```

Do not change the Dockerfile to a remote MinIO tag — quay.io currently returns 401 on pull.
