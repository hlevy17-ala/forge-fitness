# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **File upload**: multer (multipart/form-data)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Artifacts

### Workout Tracker (`artifacts/workout-tracker`)
- React + Vite frontend at `/`
- Personal fitness tracking dashboard called "Forge Journal"
- Tabs: Movements (exercise progress in lbs), Systemic (muscle group progress in lbs), Biometrics, Nutrition (calorie tracking), Import (CSV upload)
- Note: CSV weight data is stored in kg internally; all chart displays convert to lbs (× 2.20462)

### API Server (`artifacts/api-server`)
- Express 5 backend at `/api`
- Routes: `/api/workouts/upload`, `/api/workouts/by-exercise`, `/api/workouts/by-muscle-group`, `/api/workouts/exercises`, `/api/body-metrics`, `/api/calorie-logs`

## Database Schema

### workout_sets
- id, date (date), exercise (text), reps (integer), weight_kg (numeric)
- Unique constraint on (date, exercise, reps, weight_kg) to prevent duplicate CSV uploads

### body_metrics
- id, date (date, unique), weight_lbs (numeric nullable), waist_inches (numeric nullable)

### calorie_logs
- id, date (date, unique), calories_consumed (integer nullable), calories_burned (integer nullable)
- Upsert by date; deficit = calories_burned - calories_consumed

## Exercise → Muscle Group Mapping

| Exercise | Muscle Group |
|---|---|
| Machine Bench Press, Machine Fly | Chest |
| Lat Pulldown, Machine Row, Seated Back Extension | Back |
| Machine Shoulder Press, Machine Rear Delt Fly | Shoulders |
| Machine Tricep Dip | Triceps |
| Machine Bicep Curl | Biceps |
| Machine Leg Press, Calf Raise, Machine Hip Adductor, Machine Hip Abductor, Air Squats | Legs |
| Crunches, Dead Bug | Core |

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
