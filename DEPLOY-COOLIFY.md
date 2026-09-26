# Déployer Dub (fork Nihiloweb) sur Coolify

Fork self-hébergé de [dubinc/dub](https://github.com/dubinc/dub) pour un MVP : liens courts, redirections, QR depuis l’UI.

Stack Docker : MySQL 8.0 + `ps-http-sim` (shim PlanetScale HTTP) + Redis + `serverless-redis-http` (shim Upstash REST). Tinybird / QStash / Stripe sont stubbés pour que `next build` et les redirects fonctionnent sans ces SaaS.

## Prérequis

- Coolify (ou Docker Compose) avec assez de RAM pour le build Next.js (~6–8 Go heap)
- Trois domaines DNS pointant vers Coolify : **app** + **short** + **partners** (tous vers le même service)
- Secrets générés (ne jamais committer `.env`)

## Étapes Coolify

1. **Nouvelle ressource** → Docker Compose depuis ce dépôt Git.
2. Fichier Compose : `docker-compose.yml` (racine).
3. Renseigner les variables d’environnement (voir `.env.example`).
4. **Build args** obligatoires (inlinés au build, pas seulement au runtime) :
   - `NEXT_PUBLIC_APP_DOMAIN` — hostname nu, ex. `dub.nihiloweb.com` (dashboard / API)
   - `NEXT_PUBLIC_APP_SHORT_DOMAIN` — hostname nu, ex. `link.nihiloweb.com` (liens courts)
   - `NEXT_PUBLIC_PARTNERS_DOMAIN` — hostname nu, ex. `go.nihiloweb.com` (Partner Program UI)
   - `DATABASE_URL` — dummy OK, ex. `mysql://root:build@db:3306/dub`
5. Domaines Coolify : exposer le service `dub` sur le port **3000** (app + short + partners → même service). Ne pas ajouter `go` comme Domain workspace — c’est un host partenaires, pas un short domain.
6. Déployer. Attendre le healthcheck `/api/health`.

### Carte domaines Nihiloweb

| Rôle | Hostname | Build arg |
|---|---|---|
| App / dashboard | `dub.nihiloweb.com` | `NEXT_PUBLIC_APP_DOMAIN` |
| Short links | `link.nihiloweb.com` | `NEXT_PUBLIC_APP_SHORT_DOMAIN` |
| Partner Program | `go.nihiloweb.com` | `NEXT_PUBLIC_PARTNERS_DOMAIN` |
| Assets MinIO | `assets.nihiloweb.com` | (runtime storage env only) |

Image GHCR (`docker-image.yml`) bake déjà ces trois `NEXT_PUBLIC_*`. Après rebuild/pull, Coolify doit router les trois hosts vers le service `dub:3000`.

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
3. Ajouter le domaine short dans l’UI (Settings → Domains) = `NEXT_PUBLIC_APP_SHORT_DOMAIN` (`link.nihiloweb.com`). Ne pas y ajouter le host partners (`go`).
4. Créer un short link → tester la redirection et le QR. Ouvrir `https://<NEXT_PUBLIC_PARTNERS_DOMAIN>` pour le Partner Program.

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
| `NEXT_PUBLIC_APP_*` / `NEXT_PUBLIC_PARTNERS_DOMAIN` | **build args**, hostnames nus (app / short / partners) |
| `ANALYTICS_SESSION_RATE_LIMIT` | req/s pour `/api/analytics` (session UI). Défaut **120** si non défini. Ne touche pas aux limites API key. |

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

## MinIO / uploads (self-host)

Compose uses `cgr.dev/chainguard/minio` (quay/Docker Hub MinIO pulls currently fail).

Coolify domain for the `minio` service: `https://assets.nihiloweb.com:9000`.

Required env:
- `STORAGE_ENDPOINT=https://assets.nihiloweb.com` (public; browsers PUT presigned URLs here)
- `STORAGE_BASE_URL=https://assets.nihiloweb.com/dub-public` (public object URLs include the bucket path)
- `STORAGE_PUBLIC_BUCKET=dub-public`, `STORAGE_PRIVATE_BUCKET=dub-private`
- `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` (= MinIO root user/pass)
- `MINIO_API_CORS_ALLOW_ORIGIN=https://dub.nihiloweb.com`

After first boot, create buckets + public-read policy (see ops notes / `mc`).

