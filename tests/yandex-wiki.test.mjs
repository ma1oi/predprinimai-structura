import assert from 'node:assert/strict';
import test from 'node:test';
import { register } from 'node:module';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, nextResolve) {
    if (['./registration-store', './yandex-wiki'].includes(specifier)) return nextResolve(specifier + '.ts', context);
    return nextResolve(specifier, context);
  }
`), import.meta.url);
const { YandexWikiRegistrationExporter } = await import('../lib/yandex-wiki.ts');
const config = { token: 'private-test-wiki-token', orgId: '123456', orgType: '360', gridId: '7bfe36fa-a37b-4bf8-9089-2d306a8a0b60' };
const slugs = ['registration-id', 'registered-at', 'name', 'phone', 'company', 'consent'];
const columns = () => slugs.map(slug => ({ slug, title: slug, type: 'string', format: 'plain', required: slug === 'registration-id' }));
const record = (n = 1) => ({ id: `12345678-1234-4234-8234-${String(n).padStart(12, '0')}`, createdAt: '2026-10-27T09:00:00.000Z', requestId: randomUUID(), name: '=literal', phone: '+79999999999', company: 'Компания', consent: true });
function wiki({ empty = false } = {}) {
  const state = { columns: empty ? [] : columns(), rows: [], revision: '1', calls: [] };
  const fetch = async (url, init) => {
    state.calls.push({ url: String(url), init });
    assert.equal(new URL(url).origin, 'https://api.wiki.yandex.net');assert.equal(new URL(url).search, '');
    assert.equal(init.headers.Authorization, `OAuth ${config.token}`);
    assert.equal(init.headers['X-Org-Id'], config.orgId);
    assert.equal(init.redirect, 'error');
    if (init.method === 'GET') return Response.json({ id: config.gridId, structure: { columns: state.columns }, rows: state.rows, revision: state.revision });
    const body = JSON.parse(init.body);
    assert.equal(body.revision, state.revision);
    if (url.endsWith('/columns')) { state.columns = body.columns; state.revision = String(+state.revision + 1); return Response.json({ revision: state.revision }); }
    assert(url.endsWith('/rows'));assert.equal(body.position, state.rows.length);
    const results = body.rows.map((values, i) => ({ id: String(state.rows.length + i + 1), row: state.columns.map(c => values[c.slug] ?? null) }));
    state.rows.push(...results);state.revision = String(+state.revision + 1);
    return Response.json({ revision: state.revision, results });
  };
  return { state, fetch };
}

test('Wiki initializes a blank grid and appends literal rows; retries preserve existing rows and never update or delete them', async () => {
  const fake = wiki({ empty: true });
  const exporter = new YandexWikiRegistrationExporter(config, fake.fetch);
  const first = await exporter.sync([record()]);assert.equal(first.total, 1);assert.equal(first.added, 1);
  const append = fake.state.calls.find(c => c.url.endsWith('/rows'));
  const row = JSON.parse(append.init.body).rows[0];assert.equal(row.name, '=literal');assert.equal(row.phone, '+79999999999');assert.match(row['registered-at'], /12:00:00/);
  const old = structuredClone(fake.state.rows[0]);
  fake.state.columns.push({ slug: 'note', type: 'string', format: 'plain', required: false });
  fake.state.rows[0].row[2] = 'Исправлено в Вики';fake.state.rows[0].row.push('Не терять');
  const preserved = structuredClone(fake.state.rows[0]);
  const second = await exporter.sync([record(), record(2)]);assert.equal(second.added, 1);
  assert.deepEqual(fake.state.rows[0], preserved);assert.equal(fake.state.rows[1].row[0], record(2).id);
  const count = fake.state.calls.filter(c => c.init.method === 'POST').length;
  assert.equal((await exporter.sync([record(), record(2)])).added, 0);
  assert.equal(fake.state.calls.filter(c => c.init.method === 'POST').length, count);
  assert(fake.state.calls.every(c => ['GET', 'POST'].includes(c.init.method)));assert.notDeepEqual(old, preserved);
});

test('Wiki refuses incompatible or malformed grids instead of rebuilding participant data', async () => {
  for (const change of [
    state => { state.columns = [];state.rows = [{ id: 'manual', row: ['keep'] }]; },
    state => { state.columns[3].type = 'number'; },
    state => { state.columns[2].format = 'yfm'; },
    state => { state.columns.push({ slug: 'note', type: 'string', required: true }); },
    state => { state.columns.push(state.columns[0]); },
    state => { state.rows = [{ id: 'x', row: [record().id] }, { id: 'y', row: [record().id] }]; },
    state => { state.revision = ''; },
  ]) {
    const fake = wiki();change(fake.state);await assert.rejects(new YandexWikiRegistrationExporter(config, fake.fetch).sync([record()]));
    assert(fake.state.calls.every(c => c.init.method === 'GET'));
  }
});

test('Wiki recovers committed network failures and revision conflicts by re-reading IDs without duplicate rows', async () => {
  for (const mode of ['network', 'conflict']) {
    const fake = wiki();let changed = false;
    const fetch = async (url, init) => {
      if (url.endsWith('/rows') && !changed) {
        changed = true;
        await fake.fetch(url, init);
        if (mode === 'network') throw Error('private ' + config.token);
        return new Response('private ' + config.token, { status: 409 });
      }
      return fake.fetch(url, init);
    };
    assert.equal((await new YandexWikiRegistrationExporter(config, fetch).sync([record()])).total, 1);
    assert.equal(fake.state.rows.length, 1);assert.equal(fake.state.calls.filter(c => c.url.endsWith('/rows')).length, 1);
  }
});

test('Wiki batches new rows and verifies the final IDs before reporting success', async () => {
  const fake = wiki();const records = Array.from({ length: 205 }, (_, i) => record(i + 1));
  assert.equal((await new YandexWikiRegistrationExporter(config, fake.fetch).sync(records)).total, 205);
  const writes = fake.state.calls.filter(c => c.url.endsWith('/rows'));assert.equal(writes.length, 3);
  assert(writes.every(c => JSON.parse(c.init.body).rows.length <= 100));assert.equal(new Set(fake.state.rows.map(r => r.row[0])).size, 205);
});

test('Wiki validates configuration and sanitizes authorization/server errors', async () => {
  for (const patch of [{ token: 'bad\r\ntoken' }, { orgId: 'x\r\ny' }, { orgType: 'unknown' }, { gridId: '../secret' }]) assert.throws(() => new YandexWikiRegistrationExporter({ ...config, ...patch }));
  for (const status of [401, 403, 404, 429, 500]) {
    await assert.rejects(new YandexWikiRegistrationExporter(config, async () => new Response(config.token, { status, headers: { 'Retry-After': '0' } })).sync([record()]), e => !e.message.includes(config.token));
  }
  let header;
  await new YandexWikiRegistrationExporter({ ...config, orgType: 'cloud' }, async (url, init) => {
    header = init.headers;
    return Response.json({ structure: { columns: columns() }, rows: [], revision: '1' });
  }).sync([]);
  assert.equal(header['X-Cloud-Org-Id'], config.orgId);assert.equal(header['X-Org-Id'], undefined);
});

test('Wiki automatic sync coalesces submissions, retains the local backlog on failure and never uses Disk credentials', async () => {
  const dir = await mkdtemp('/private/tmp/wiki-sync-');const previousFetch = globalThis.fetch;
  const keys = ['REGISTRATIONS_DATA_DIR', 'YANDEX_WIKI_OAUTH_TOKEN', 'YANDEX_WIKI_OAUTH_TOKEN_FILE', 'YANDEX_WIKI_ORG_ID', 'YANDEX_WIKI_ORG_TYPE', 'YANDEX_WIKI_GRID_ID', 'YANDEX_WIKI_PAGE_URL'];
  const previousEnv = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  let release, started;const ready = new Promise(r => { started = r; });const gate = new Promise(r => { release = r; });
  try {
    process.env.REGISTRATIONS_DATA_DIR = dir;process.env.YANDEX_WIKI_OAUTH_TOKEN = '';process.env.YANDEX_WIKI_OAUTH_TOKEN_FILE = dir + '/wiki-token.txt';
    process.env.YANDEX_WIKI_ORG_ID = config.orgId;process.env.YANDEX_WIKI_ORG_TYPE = config.orgType;process.env.YANDEX_WIKI_GRID_ID = config.gridId;process.env.YANDEX_WIKI_PAGE_URL = 'https://evil.test/';
    await writeFile(dir + '/wiki-token.txt', config.token);
    const { addRegistration, readRegistrations } = await import('../lib/registration-store.ts');
    const { syncYandexWikiRegistrations, yandexWikiStatus } = await import('../lib/registration-wiki-sync.ts');
    const fake = wiki();let first = true;
    globalThis.fetch = async (url, init) => { if (url.endsWith('/rows') && first) { first = false;started();await gate; }return fake.fetch(url, init); };
    const input = { requestId: randomUUID(), name: 'Первый участник', phone: '+79999999991', company: '', consent: true };await addRegistration(input);
    const one = syncYandexWikiRegistrations();await ready;
    await addRegistration({ ...input, requestId: randomUUID(), phone: '+79999999992' });const two = syncYandexWikiRegistrations();assert.equal(two, one);release();await two;
    assert.equal(fake.state.rows.length, 2);assert.equal(yandexWikiStatus().total, 2);assert.equal(yandexWikiStatus().url, null);
    globalThis.fetch = async () => { throw Error(config.token); };await syncYandexWikiRegistrations();
    assert(yandexWikiStatus().error);assert(!JSON.stringify(yandexWikiStatus()).includes(config.token));assert.equal((await readRegistrations()).length, 2);
    assert.equal(JSON.parse(await readFile(dir + '/registrations.json', 'utf8')).registrations.length, 2);
    delete process.env.YANDEX_WIKI_ORG_ID;assert.equal(yandexWikiStatus().configured, false);
  } finally { release?.();globalThis.fetch = previousFetch;for (const k of keys) { if (previousEnv[k] === undefined) delete process.env[k];else process.env[k] = previousEnv[k]; }await rm(dir, { recursive: true, force: true }); }
});


test('Wiki respects transient rate limits and verifies existing IDs instead of appending twice', async () => {
  const fake = wiki();let limited = true;
  const exporter = new YandexWikiRegistrationExporter(config, async (url, init) => {
    if (limited) { limited = false;return new Response('', { status: 429, headers: { 'Retry-After': '0' } }); }
    return fake.fetch(url, init);
  });
  assert.equal((await exporter.sync([record()])).total, 1);
  assert.equal(fake.state.rows.length, 1);
});
