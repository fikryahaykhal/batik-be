# Batik Backend (Express + Prisma)

## Setup

1. Copy env:

```bash
cp .env.example .env
```

2. Generate Prisma client and sync DB:

```bash
npm run prisma:generate
npm run prisma:push
```

3. Seed sample user + products:

```bash
npm run prisma:seed
```

4. Start API:

```bash
npm run dev
```

## Default Login

- email: `user@batiknusa.id`
- password: `password123`

## Endpoints

- `GET /health`
- `GET /products`
- `POST /auth/login`
- `GET /auth/me` (Bearer token)
- `POST /checkout` (Bearer token)
