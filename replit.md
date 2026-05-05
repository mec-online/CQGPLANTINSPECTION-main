# CQG Plant Inspection

A mobile-first PWA for quarry plant inspections, work orders, breakdowns, and preventive maintenance scheduling — built for Cymru Quarry Group (CQG).

## Architecture

pnpm monorepo with two deployable artifacts:

- **`artifacts/api-server`** — Express 5 API (TypeScript, Drizzle ORM, PostgreSQL)
- **`artifacts/cqg-plant-inspection`** — Vite + React 19 frontend (Tailwind CSS v4, TanStack Query)

Shared libraries:

- **`lib/db`** — Drizzle ORM schema, pool, and migrations
- **`lib/api-spec`** — OpenAPI 3.1 spec + Orval codegen config
- **`lib/api-client-react`** — Generated React Query hooks
- **`lib/api-zod`** — Generated Zod validation schemas

## Getting Started

```bash
pnpm install
pnpm --filter @workspace/db run push   # push schema to PostgreSQL
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/cqg-plant-inspection run dev
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | Yes | Assigned per artifact by Replit |
| `JWT_SECRET` | Yes | Secret for signing auth tokens |
| `ANTHROPIC_API_KEY` | No | Enables AI-powered breakdown predictions |

## Database

PostgreSQL with Drizzle ORM. Schema is defined in `lib/db/src/schema/`.

Push schema changes: `pnpm --filter @workspace/db run push`

## Key Features

- Role-based access control (ADMIN, SITE_MANAGER, MAINTENANCE, OPERATOR, READONLY)
- Multi-site quarry management (5 plants)
- Template-based inspections with GPS-tagged answers
- Auto-generated work orders from failed inspection items
- Breakdown logging with AI-powered predictive analytics
- Preventive maintenance (PPM) scheduling
- QR code asset scanning
- Offline-first PWA with service worker background sync
- Image attachments with compression
