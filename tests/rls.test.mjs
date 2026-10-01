import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const db = new PGlite()
const stub = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, email_confirmed_at timestamptz default now(), raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
alter table storage.objects enable row level security;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
grant select on auth.users to service_role;
grant all on storage.objects to authenticated;
`
await db.exec(stub)
const sql = fs.readFileSync('supabase/migrations/0001_schema.sql', 'utf8')
await db.exec(sql)
console.log('migration applied')

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + extra)) }

async function as(uid, role, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`)
  try { return await fn() } finally { await db.exec(`reset role;`) }
}
const q = (sql, p) => db.query(sql, p)
async function fails(fn) { try { await fn(); return false } catch (e) { return e.message } }

const A = (await q(`insert into auth.users(email) values ('a@x.com') returning id`)).rows[0].id
const B = (await q(`insert into auth.users(email) values ('b@y.com') returning id`)).rows[0].id
const M = (await q(`insert into auth.users(email) values ('m@x.com') returning id`)).rows[0].id

const orgA = await as(A, 'authenticated', async () => (await q(`select public.create_organization('Alpha Co','weekly') as id`)).rows[0].id)
const orgB = await as(B, 'authenticated', async () => (await q(`select public.create_organization('Beta Co','monthly') as id`)).rows[0].id)
ok('orgs created', !!orgA && !!orgB)

// seed data as owners
const stageA = await as(A, 'authenticated', async () => (await q(`select id from pipeline_stages where org_id=$1 and kind='won'`, [orgA])).rows[0].id)
const acctA = await as(A, 'authenticated', async () => (await q(`insert into accounts(org_id,name) values ($1,'Acme') returning id`, [orgA])).rows[0].id)
const oppA = await as(A, 'authenticated', async () => (await q(`insert into opportunities(org_id,account_id,name,amount,stage_id) values ($1,$2,'Big deal',5000,$3) returning id, status, closed_at, probability`, [orgA, acctA, stageA])).rows[0])
ok('stage drives status/closed_at/probability', oppA.status === 'won' && !!oppA.closed_at && oppA.probability === 100, JSON.stringify(oppA))
const acctB = await as(B, 'authenticated', async () => (await q(`insert into accounts(org_id,name) values ($1,'BetaCust') returning id`, [orgB])).rows[0].id)

// isolation
await as(A, 'authenticated', async () => {
  ok('A sees only own accounts', (await q(`select * from accounts`)).rows.length === 1)
  ok('A cannot see org B', (await q(`select * from organizations where id=$1`, [orgB])).rows.length === 0)
  ok('A cannot read B credits', (await q(`select * from credit_balances where org_id=$1`, [orgB])).rows.length === 0)
  ok('A cannot insert into org B', !!(await fails(() => q(`insert into accounts(org_id,name) values ($1,'evil')`, [orgB]))))
  ok('A cannot attach opp to B account (composite FK)', !!(await fails(() => q(`insert into opportunities(org_id,account_id,name) values ($1,$2,'x')`, [orgA, acctB]))))
  ok('A cannot update B rows', (await q(`update accounts set name='hax' where id=$1`, [acctB])).affectedRows === 0)
  ok('A cannot self-upgrade plan', !!(await fails(() => q(`update organizations set plan_id='pro' where id=$1`, [orgA]))))
  ok('A cannot edit credits', !!(await fails(() => q(`update credit_balances set allocated=999999 where org_id=$1`, [orgA]))))
  ok('A cannot call consume_credits', !!(await fails(() => q(`select public.consume_credits($1,$2,'x',1)`, [orgA, A]))))
  ok('A cannot add self to org B', !!(await fails(() => q(`insert into organization_members(org_id,user_id,role) values ($1,$2,'owner')`, [orgB, A]))))
  ok('A cannot forge activity log', !!(await fails(() => q(`insert into activity_logs(org_id,event) values ($1,'x')`, [orgA]))))
  ok('opp events recorded', (await q(`select * from opportunity_events`)).rows.length >= 1)
  ok('activity log visible', (await q(`select * from activity_logs`)).rows.length >= 1)
})

// anon sees nothing
await as(null, 'anon', async () => {
  ok('anon cannot read accounts', !!(await fails(() => q(`select * from accounts`))))
  ok('anon can read plans', (await q(`select * from plans`)).rows.length === 3)
})

// invites + roles
await as(A, 'authenticated', async () => {
  await q(`insert into organization_invites(org_id,email,role) values ($1,'m@x.com','member')`, [orgA])
  ok('owner can invite', true)
})
const joined = await as(M, 'authenticated', async () => (await q(`select public.accept_pending_invites() as n`)).rows[0].n)
ok('invite accepted -> joined', joined === 1)
await as(M, 'authenticated', async () => {
  ok('member sees org A accounts', (await q(`select * from accounts`)).rows.length === 1)
  ok('member cannot delete accounts', (await q(`delete from accounts where id=$1`, [acctA])).affectedRows === 0)
  ok('member can create actions', !!(await q(`insert into actions(org_id,title) values ($1,'Call them') returning id`, [orgA])).rows[0].id)
  ok('member cannot update org settings', (await q(`update organizations set cadence='daily' where id=$1`, [orgA])).affectedRows === 0)
  ok('member cannot invite', !!(await fails(() => q(`insert into organization_invites(org_id,email,role) values ($1,'z@z.com','member')`, [orgA]))))
  ok('member cannot change roles', !!(await fails(() => q(`select public.set_member_role($1,$2,'admin')`, [orgA, M]))))
  ok('member cannot import', !!(await fails(() => q(`insert into imports(org_id,entity,filename) values ($1,'accounts','x.csv')`, [orgA]))))
  ok('member cannot change stages', (await q(`delete from pipeline_stages where org_id=$1`, [orgA])).affectedRows === 0)
})
await as(A, 'authenticated', async () => {
  await q(`select public.set_member_role($1,$2,'admin')`, [orgA, M])
  ok('owner promotes to admin', true)
})
await as(M, 'authenticated', async () => {
  ok('admin can update cadence', (await q(`update organizations set cadence='daily' where id=$1`, [orgA])).affectedRows === 1)
  ok('admin can import', !!(await q(`insert into imports(org_id,entity,filename) values ($1,'accounts','x.csv') returning id`, [orgA])).rows[0].id)
  ok('admin cannot invite admins', !!(await fails(() => q(`insert into organization_invites(org_id,email,role) values ($1,'q@q.com','admin')`, [orgA]))))
  ok('admin cannot remove owner', !!(await fails(() => q(`select public.remove_member($1,$2)`, [orgA, A]))))
  ok('admin cannot change roles', !!(await fails(() => q(`select public.set_member_role($1,$2,'member')`, [orgA, M]))))
  ok('admin cannot touch other org', !!(await fails(() => q(`select public.refresh_credits($1)`, [orgB]))))
})

// credits (service role)
await as(A, 'service_role', async () => {
  const r = (await q(`select public.consume_credits($1,$2,'briefing',50) as r`, [orgA, A])).rows[0].r
  ok('consume ok', r.ok === true && r.remaining === 150, JSON.stringify(r))
  const r2 = (await q(`select public.consume_credits($1,$2,'briefing',500) as r`, [orgA, A])).rows[0].r
  ok('insufficient blocked', r2.ok === false && r2.reason === 'insufficient')
  await q(`select public.refund_credits($1,$2,'briefing',50)`, [orgA, A])
  const b = (await q(`select allocated, used from credit_balances where org_id=$1`, [orgA])).rows[0]
  ok('refund restores', b.used === 0 && b.allocated === 200, JSON.stringify(b))
  await q(`select public.set_org_plan($1,'starter')`, [orgA])
  ok('plan change allocates', (await q(`select allocated from credit_balances where org_id=$1`, [orgA])).rows[0].allocated === 4000)
  // period rollover
  await q(`update credit_balances set period_end = now() - interval '40 days', used = 100 where org_id=$1`, [orgA])
  const r3 = (await q(`select public.consume_credits($1,$2,'q',5) as r`, [orgA, A])).rows[0].r
  const bb = (await q(`select used, period_end > now() as future from credit_balances where org_id=$1`, [orgA])).rows[0]
  ok('period rollover resets', r3.ok && bb.used === 5 && bb.future, JSON.stringify(bb))
})

// delete cascade + audit on delete works
await as(A, 'authenticated', async () => {
  await q(`delete from opportunities where id=$1`, [oppA.id])
  ok('owner can delete opportunity (audit trigger ok)', true)
  await q(`delete from accounts where id=$1`, [acctA])
  ok('owner can delete account', true)
  const m = (await q(`select * from profiles`)).rows.length
  ok('profiles visible to co-members', m === 2, String(m))
})

// storage policies
await as(A, 'authenticated', async () => {
  ok('A can upload to own conversations path', !!(await q(`insert into storage.objects(bucket_id,name) values ('conversations', $1 || '/a.mp3') returning id`, [orgA])).rows[0].id)
  ok('A cannot upload to B path', !!(await fails(() => q(`insert into storage.objects(bucket_id,name) values ('conversations', $1 || '/a.mp3')`, [orgB]))))
  ok('bad path rejected', !!(await fails(() => q(`insert into storage.objects(bucket_id,name) values ('conversations', 'junk/a.mp3')`))))
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
