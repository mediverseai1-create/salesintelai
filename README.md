# SalesIntel AI

AI-native revenue intelligence for sales managers and RevOps. Next.js 16 · React 19 · TypeScript · Tailwind 4 · Supabase (Auth, Postgres + RLS, Storage) · Gemini.

## Setup
1. `npm install`
2. Create a Supabase project and run `supabase/migrations/0001_schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local` and fill it in (Supabase URL/keys, `GEMINI_API_KEY`, payment links).
4. In Supabase → Authentication → URL configuration, add `http://localhost:3000/auth/callback` (and your production URL) as redirect URLs.
5. `npm run dev` — visit `/setup` for a live configuration checklist.

## Scripts
- `npm run dev` / `npm run build` / `npm run lint` / `npm run typecheck`
- `npm test` — metrics-engine tests and a database test that applies the migration to an in-process Postgres and checks workspace isolation, roles and credits.

## How it works
- **Isolation**: every business table has `org_id` and RLS; roles (owner/admin/member) are enforced in SQL. Cross-workspace links are blocked by composite foreign keys.
- **Intelligence**: `src/lib/intel` computes metrics and the six findings deterministically from your records; Gemini (server-side only) narrates them. Rule-based Next Best Actions need no AI.
- **Credits**: spent atomically via a service-role-only SQL function and refunded if an AI call fails. Costs and plans live in `src/config/pricing.ts` (and the `plans` table).
- **Payments**: hosted payment links only (`STARTER_PAYMENT_LINK`, `PRO_PAYMENT_LINK`). Apply a plan after the provider confirms payment with `POST /api/billing/activate` (Bearer `BILLING_ADMIN_SECRET`).
- **Limits**: no email sending, no external lead database, audio ≤ 15 MB (inline to Gemini).
