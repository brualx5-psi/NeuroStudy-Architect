import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';

const compiled = await transform(readFileSync('client/src/services/studyPersistence.ts', 'utf8'), { loader: 'ts', format: 'esm' });
const { StudyPersistence, readLocalCopies, importAsCopies } = await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString('base64')}`);
const empty = () => ({ studies: [], folders: [] });
const snapshot = title => ({ studies: [{ id: 'study', folderId: 'folder', title, sources: [] }], folders: [{ id: 'folder', name: 'Pasta' }] });
class MemoryStorage {
  map = new Map();
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.get(key) ?? null; }
  setItem(key, value) { this.map.set(key, value); }
}
const deferred = () => { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function server(initial = snapshot('Original')) {
  let data = structuredClone(initial), revision = 0;
  const calls = [];
  return {
    calls,
    load: async () => structuredClone({ ...data, revision }),
    save: async (user, next, expected) => {
      calls.push({ user, next, expected });
      if (expected !== revision) throw new Error('Conflito de versão');
      data = structuredClone(next); return ++revision;
    },
  };
}

test('não salva antes da leitura, nem quando a leitura falha', async () => {
  const cloud = server(), storage = new MemoryStorage();
  cloud.load = async () => { throw new Error('offline'); };
  const session = new StudyPersistence('a', cloud, storage, 'tab');
  assert.equal((await session.save(empty())).cloudSaved, false);
  await assert.rejects(session.load(), /offline/);
  await session.save(empty());
  assert.equal(cloud.calls.length, 0);
  assert.equal(storage.length, 0);
});

test('troca de conta invalida carregamentos e gravações enfileiradas', async () => {
  const loading = deferred(), saving = deferred(), cloud = server();
  cloud.load = () => loading.promise;
  const old = new StudyPersistence('a', cloud, new MemoryStorage(), 'tab');
  const pendingLoad = old.load(); old.dispose(); loading.resolve({ ...snapshot('a'), revision: 0 });
  await assert.rejects(pendingLoad, /encerrada/);
  const backend = server();
  backend.save = (...args) => { backend.calls.push(args); return saving.promise; };
  const session = new StudyPersistence('a', backend, new MemoryStorage(), 'tab');
  await session.load();
  const first = session.save(snapshot('primeiro'));
  await Promise.resolve();
  const second = session.save(snapshot('segundo'));
  session.dispose(); saving.resolve(1);
  await first; await second;
  assert.equal(backend.calls.length, 1);
  assert.equal(backend.calls[0][0], 'a');
});

test('duas abas não sobrescrevem a versão mais recente; cópias ficam separadas', async () => {
  const cloud = server(), storage = new MemoryStorage();
  const a = new StudyPersistence('a', cloud, storage, 'one'), b = new StudyPersistence('a', cloud, storage, 'two');
  await Promise.all([a.load(), b.load()]);
  assert.equal((await a.save(snapshot('primeira aba'))).cloudSaved, true);
  assert.equal((await b.save(snapshot('segunda aba'))).cloudSaved, false);
  assert.equal((await cloud.load()).studies[0].title, 'primeira aba');
  const calls = cloud.calls.length;
  await b.save(empty());
  assert.equal(cloud.calls.length, calls, 'conflito bloqueia novas gravações');
  assert.equal(readLocalCopies(storage, 'a').length, 2);
  assert.equal(readLocalCopies(storage, 'b').length, 0);
});

test('backup compartilhado e inválido não migram automaticamente nem quebram leitura', async () => {
  const storage = new MemoryStorage(), cloud = server();
  storage.setItem('neurostudy_data', JSON.stringify(snapshot('legado')));
  storage.setItem('neurostudy_data:a:broken', '{invalid');
  const before = storage.getItem('neurostudy_data');
  await new StudyPersistence('a', cloud, storage, 'new').load();
  assert.equal(cloud.calls.length, 0);
  assert.equal(storage.getItem('neurostudy_data'), before);
  assert.equal(readLocalCopies(storage, 'a')[0].unclaimed, true);
});

test('serializa gravações e resposta antiga não apaga edição local mais recente', async () => {
  const storage = new MemoryStorage(), cloud = server(), saving = deferred();
  const originalSave = cloud.save;
  cloud.save = async (...args) => { await saving.promise; return originalSave(...args); };
  const session = new StudyPersistence('a', cloud, storage, 'tab');
  await session.load();
  const first = session.save(snapshot('primeiro'));
  const second = session.save(snapshot('segundo'));
  saving.resolve();
  await first; await second;
  assert.deepEqual(cloud.calls.map(call => call.expected), [0, 1]);
  assert.equal(readLocalCopies(storage, 'a')[0].studies[0].title, 'segundo');
  assert.equal((await cloud.load()).studies[0].title, 'segundo');
});

test('falha de armazenamento e resposta ambígua nunca indicam sucesso falso', async () => {
  const storage = new MemoryStorage(), cloud = server();
  storage.setItem('neurostudy_data:a:old', JSON.stringify({ ...snapshot('backup'), userId: 'a' }));
  storage.setItem = () => { throw new Error('quota'); };
  cloud.save = async () => { cloud.calls.push('save'); throw new Error('timeout'); };
  const session = new StudyPersistence('a', cloud, storage, 'tab'); await session.load();
  const result = await session.save(snapshot('novo'));
  assert.equal(result.localSaved, false); assert.equal(result.cloudSaved, false);
  await session.save(empty()); assert.equal(cloud.calls.length, 1);
  assert.equal(readLocalCopies(storage, 'a')[0].studies[0].title, 'backup');
});

test('restauração acrescenta cópias e remapeia pastas sem mudar o original', () => {
  let id = 0;
  const current = snapshot('Atual'), recovered = snapshot('Antigo');
  const result = importAsCopies(current, recovered, () => `copy-${++id}`);
  assert.equal(result.studies.length, 2);
  assert.equal(result.studies[0].title, 'Atual');
  assert.notEqual(result.studies[0].id, result.studies[1].id);
  assert.equal(result.studies[1].folderId, result.folders[1].id);
  assert.equal(current.studies.length, 1);
});

test('Postgres: RLS, versões, histórico, perfil e exclusão', async () => {
  const db = new PGlite();
  const a = '00000000-0000-0000-0000-000000000001', b = '00000000-0000-0000-0000-000000000002';
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role', true) $$;
      grant usage on schema auth, public to authenticated, anon, service_role;
      grant execute on all functions in schema auth to authenticated, anon, service_role;
      insert into auth.users values ('${a}'), ('${b}');
      create table public.user_data(user_id uuid primary key references auth.users(id), content jsonb default '{}', updated_at timestamptz default now());
      grant all on public.user_data to authenticated, service_role;
      alter table public.user_data enable row level security;
      create policy broad_legacy on public.user_data for all using (auth.role() = 'authenticated');
      insert into public.user_data(user_id, content) values ('${a}', '{"studies":[{"id":"original"}],"folders":[],"profile":{"name":"A"}}'), ('${b}', '{"studies":[],"folders":[]}');
    `);
    await db.exec(readFileSync('supabase/migrations/20261020225405_protect_study_persistence.sql', 'utf8'));
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${a}'; set request.jwt.claim.role = 'authenticated';`);
    assert.equal((await db.query('select * from public.user_data')).rows.length, 1, 'broad legacy policy is constrained');
    assert.equal((await db.query('select * from public.study_history')).rows.length, 1);
    await assert.rejects(db.query('select public.save_study_snapshot($1, 0, $2, $3)', [b, '[]', '[]']), /Unauthorized/);
    await assert.rejects(db.exec(`update public.user_data set content = '{"studies":[],"folders":[]}' where user_id = '${a}'`), /version conflict/);
    const save = (revision, studies) => db.query('select public.save_study_snapshot($1, $2, $3, $4) as revision', [a, revision, JSON.stringify(studies), '[]']);
    assert.equal((await save(0, [{ id: 'new' }])).rows[0].revision, 1);
    await assert.rejects(save(0, []), /version conflict/);
    await db.query('select public.save_user_profile($1, $2)', [a, JSON.stringify({ name: 'Novo perfil' })]);
    let row = (await db.query('select * from public.user_data')).rows[0];
    assert.equal(row.content.studies[0].id, 'new'); assert.equal(row.study_revision, 1);
    assert.equal(row.content.profile.name, 'Novo perfil');
    await save(1, []);
    const history = (await db.query('select * from public.study_history order by revision')).rows;
    assert.equal(history[0].content.studies[0].id, 'original');
    assert.equal(history[1].content.studies[0].id, 'new');
    await assert.rejects(db.exec('delete from public.study_history'), /permission denied/);
    await db.exec('delete from public.user_data');
    assert.equal((await db.query('select * from public.user_data')).rows.length, 1);
    await assert.rejects(save(2, [{ id: 'duplicate' }, { id: 'duplicate' }]), /duplicate/);
    for (let revision = 2; revision < 55; revision++) await save(revision, [{ id: `study-${revision}` }]);
    assert.equal((await db.query('select count(*)::int as count from public.study_history')).rows[0].count, 50);
    await db.exec(`reset role; set role service_role; set request.jwt.claim.role = 'service_role';`);
    assert.equal((await db.query('select public.save_study_snapshot($1, 0, $2, $3) as revision', [b, '[{"id":"extension"}]', '[]'])).rows[0].revision, 1);
  } finally { await db.close(); }
});
