This is the server-side code for ChessBox. 

It provides accounts for the [ChessBox desktop app](https://github.com/Harryt3nn/ChessBox): sign up / sign in, and linked Chess.com / Lichess usernames. Repertoires and games stay on the user's own machine; the server never sees them.

## Layout

```
chessbox-server/
├── apps/api/                 Fastify + tRPC API
│   ├── prisma/               schema.prisma and migrations
│   ├── src/
│   │   ├── index.ts          Fastify setup: CORS, body limit, global rate limit, headers
│   │   ├── env.ts            Reads and checks environment variables at startup
│   │   ├── trpc.ts           Context (session lookup), procedures, error formatting
│   │   ├── routers/          auth, connections, user
│   │   ├── auth/             password hashing
│   │   ├── security/         In-memory rate limiter and the per-action limits
│   │   └── generated/prisma  Generated Prisma client (npx prisma generate)
│   ├── dockerfile
│   └── .env.example
├── packages/shared/          zod input schemas + AppRouter type, used by API and desktop app
└── docker-compose.yml        api + postgres
```

## Configuration

Copy `apps/api/.env.example` to `apps/api/.env` and fill it in. `.env` is gitignored — never commit it.

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | yes | Password for the Postgres container |
| `JWT_SECRET` | yes | Signs session tokens. Use a long random value, e.g. `openssl rand -base64 48`. Changing it signs everyone out |
| `CORS_ORIGINS` | no | Comma-separated allowed origins. Default `http://localhost:3000,null` (Electron dev server and the packaged `file://` app) |
| `DATABASE_URL` | dev only | Only for `npm run dev` outside Docker; Compose builds its own |

The API refuses to start if `JWT_SECRET` or `DATABASE_URL` is missing.

## Running

Compose Image: docker compose --env-file ./apps/api/.env build api

Run Container: docker compose --env-file ./apps/api/.env up

Or both at once: `docker compose --env-file ./apps/api/.env up --build`

On start the API container runs `prisma migrate deploy`, so any new migrations are applied automatically. The container runs as the unprivileged `node` user with `NODE_ENV=production`.

Postgres is **not** published to the host or network — only the API container can reach it. For maintenance from the Pi itself, temporarily add `ports: ["127.0.0.1:5432:5432"]` to the `postgres` service.

### Local development

```bash
npm install
npm run dev          # tsx watch, reads apps/api/.env
```

This needs a reachable Postgres (`DATABASE_URL`). After changing `schema.prisma`, run `npx prisma migrate dev` from `apps/api` to create a migration, then `npx prisma generate`.

## API

All procedures are under `/trpc`. Inputs are validated with the zod schemas in `packages/shared`.

| Procedure | Access | Description |
|---|---|---|
| `auth.register` | public | Create account, return a session token |
| `auth.login` | public | Sign in with `username` and `password` |
| `auth.me` | signed in | Current user - never includes the password hash |
| `connections.connectLichess` | signed in | Check the Lichess account exists, then save it |
| `connections.connectChesscom` | signed in | Check the Chess.com account exists, then save it |
| `user.me` | signed in | Same safe fields as `auth.me` |

`GET /` returns `{ "ok": true }` as a health check.

## Security

- **Passwords:** Argon2id (64 MB memory, 3 iterations), 8–64 characters. Login takes the same time whether or not the account exists.
- **Sessions:** JWTs with a 3-day expiry. There is no server-side revocation; logging out deletes the token on that device.
- **Rate limits** (in memory, reset on restart):

  | Action | Limit |
  |---|---|
  | Any request | 300 / min per IP |
  | Link chess account | 10 / 15 min per user |
  | Batched calls | 10 per request |

- **Errors:** in production, internal errors return a generic message and no stack trace; validation errors return the first readable message.
- **Requests:** 64 KB body limit, CORS allow-list, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`.
- **Upstream calls:** chess usernames limited to `[A-Za-z0-9_-]`, URL-encoded, 8 s timeout.
- **Network:** reachable only over Tailscale. Traffic is HTTP inside the encrypted tunnel - add HTTPS before exposing the API any other way.
