import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { register } from 'node:module';
import ExcelJS from 'exceljs';
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, nextResolve) {
    if (['./registration-export', './registration-store', './yandex-disk'].includes(specifier)) return nextResolve(specifier + '.ts', context);
    return nextResolve(specifier, context);
  }
`), import.meta.url);
const { YandexDiskRegistrationExporter } = await import('../lib/yandex-disk.ts');
const token = 'test-private-token-12345';
const records = [{ id: '1', createdAt: '2026-10-27T09:00:00Z', name: '=literal', phone: '+79999999999', company: 'Компания', consent: true }];

test('Yandex replaces only the configured workbook, uploads literal XLSX and never forwards its token to the upload host', async () => {
  const calls = [];
  const exporter = new YandexDiskRegistrationExporter({ token, path: 'app:/Заявки фестиваля.xlsx' }, async (url, init) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) return Response.json({ href: 'https://uploader1.disk.yandex.net/upload?signature=secret', method: 'PUT' });
    return new Response(null, { status: 201 });
  });
  const result = await exporter.sync(records);
  const api = new URL(calls[0].url);
  assert.equal(api.origin, 'https://cloud-api.yandex.net');
  assert.equal(api.pathname, '/v1/disk/resources/upload');
  assert.equal(api.searchParams.get('path'), 'app:/Заявки фестиваля.xlsx');
  assert.equal(api.searchParams.get('overwrite'), 'true');
  assert.equal(calls[0].init.headers.Authorization, `OAuth ${token}`);
  assert.equal(calls[1].init.method, 'PUT');
  assert.equal(calls[1].init.headers.Authorization, undefined);
  assert.equal(calls[1].init.redirect, 'error');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(calls[1].init.body);
  assert.equal(workbook.worksheets[0].getCell('B2').value, '=literal');
  assert.equal(workbook.worksheets[0].getCell('C2').value, '+79999999999');
  assert.equal(result.total, 1);
  assert(!JSON.stringify(result).includes(token));
});

test('Yandex refuses untrusted signed upload URLs and paths before sending participant data', async () => {
  for (const href of ['http://uploader.disk.yandex.net/upload', 'https://attacker.test/upload', 'https://disk.yandex.net.attacker.test/upload', 'https://secret@uploader.disk.yandex.net/upload', 'https://uploader.disk.yandex.net:8443/upload']) {
    let calls = 0;
    const exporter = new YandexDiskRegistrationExporter({ token, path: 'app:/Заявки.xlsx' }, async () => { calls++; return Response.json({ href, method: 'PUT' }); });
    await assert.rejects(exporter.sync(records));
    assert.equal(calls, 1);
  }
  for (const path of ['https://attacker.test/data.xlsx', 'app:/../data.xlsx', 'app:/data.txt', 'app:/bad\u0000.xlsx', 'app:/']) {
    assert.throws(() => new YandexDiskRegistrationExporter({ token, path }));
  }
});

test('authorization and transport failures are sanitized; a retry writes a full current snapshot without duplicate rows', async () => {
  for (const status of [401, 403, 404, 409, 429, 507]) {
    const exporter = new YandexDiskRegistrationExporter({ token, path: 'app:/Заявки.xlsx' }, async () => new Response('secret detail ' + token, { status }));
    await assert.rejects(exporter.sync(records), error => !error.message.includes(token) && !error.message.includes('secret detail'));
  }
  const offline = new YandexDiskRegistrationExporter({ token, path: 'app:/Заявки.xlsx' }, async () => { throw Error('secret ' + token); });
  await assert.rejects(offline.sync(records), error => !error.message.includes(token));
  let saved;
  const retry = new YandexDiskRegistrationExporter({ token, path: 'app:/Заявки.xlsx' }, async (url, init) => {
    if (String(url).startsWith('https://cloud-api.yandex.net')) return Response.json({ href: 'https://uploader1.disk.yandex.net/upload', method: 'PUT' });
    saved = init.body;return new Response(null, { status: 201 });
  });
  await retry.sync(records);await retry.sync(records);
  const workbook = new ExcelJS.Workbook();await workbook.xlsx.load(saved);
  assert.equal(workbook.worksheets[0].rowCount, 2);
});


test('concurrent automatic syncs serialize snapshots and retain all local registrations on errors', async () => {
  const dir = await mkdtemp('/private/tmp/yandex-sync-');
  const previousFetch = globalThis.fetch;
  const envNames = ['REGISTRATIONS_DATA_DIR', 'YANDEX_DISK_OAUTH_TOKEN', 'YANDEX_DISK_OAUTH_TOKEN_FILE', 'YANDEX_DISK_PATH'];
  const previousEnv = Object.fromEntries(envNames.map(key => [key, process.env[key]]));
  let releaseFirst, firstUpload;
  const started = new Promise(resolve => { firstUpload = resolve; });
  const gate = new Promise(resolve => { releaseFirst = resolve; });
  let uploads = 0, active = 0, maxActive = 0, uploaded;
  try {
    process.env.REGISTRATIONS_DATA_DIR = dir;
    process.env.YANDEX_DISK_OAUTH_TOKEN = '';
    process.env.YANDEX_DISK_OAUTH_TOKEN_FILE = dir + '/token.txt';
    process.env.YANDEX_DISK_PATH = 'app:/Test.xlsx';
    await writeFile(dir + '/token.txt', token);
    const { addRegistration, readRegistrations } = await import('../lib/registration-store.ts');
    const { syncYandexRegistrations, yandexDiskStatus } = await import('../lib/registration-yandex-sync.ts');
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith('https://cloud-api.yandex.net')) return Response.json({ href: 'https://uploader1.disk.yandex.net/upload', method: 'PUT' });
      uploads++;active++;maxActive = Math.max(maxActive, active);
      if (uploads === 1) { firstUpload();await gate; }
      uploaded = init.body;active--;
      return new Response(null, { status: 201 });
    };
    const input = { requestId: randomUUID(), name: 'Первый участник', phone: '+79999999991', company: '', consent: true };
    await addRegistration(input);
    const first = syncYandexRegistrations();await started;
    await addRegistration({ ...input, requestId: randomUUID(), phone: '+79999999992' });
    const second = syncYandexRegistrations();assert.equal(second, first);
    releaseFirst();await second;
    assert.equal(uploads, 2);assert.equal(maxActive, 1);
    const workbook = new ExcelJS.Workbook();await workbook.xlsx.load(uploaded);
    assert.equal(workbook.worksheets[0].rowCount, 3);
    assert.equal(yandexDiskStatus().total, 2);
    globalThis.fetch = async () => { throw Error('secret detail ' + token); };
    await syncYandexRegistrations();
    assert.equal((await readRegistrations()).length, 2);
    assert(yandexDiskStatus().error);assert(!JSON.stringify(yandexDiskStatus()).includes(token));
    const file = await readFile(dir + '/registrations.json', 'utf8');
    assert.equal(JSON.parse(file).registrations.length, 2);
  } finally {
    releaseFirst?.();globalThis.fetch = previousFetch;
    for (const key of envNames) { if (previousEnv[key] === undefined) delete process.env[key];else process.env[key] = previousEnv[key]; }
    await rm(dir, { recursive: true, force: true });
  }
});
