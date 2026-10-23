import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { RegistrationStore, validateRegistrationInput } from '../lib/registration-store.ts';
import { buildRegistrationWorkbook, registrationExportFilename } from '../lib/registration-export.ts';

const input = (values = {}) => ({ requestId: randomUUID(), name: ' Анна Иванова ', phone: '+7 (999) 123-45-67', company: ' Компания ', consent: true, ...values });

test('registration validation normalizes fields and rejects malformed or unconsented submissions', () => {
  const valid = input();
  assert.deepEqual(validateRegistrationInput({ ...valid, id: 'untrusted', createdAt: 'untrusted' }), {
    ...valid, name: 'Анна Иванова', phone: '+79991234567', company: 'Компания',
  });
  for (const phone of ['8 (999) 123-45-67', '9991234567', '+7 999 123 45 67']) {
    assert.equal(validateRegistrationInput(input({ phone })).phone, '+79991234567');
  }
  for (const values of [
    { name: ' ' }, { name: 'Я' }, { name: 'x'.repeat(121) }, { name: 'Name\nOther' },
    { phone: '7999abc1234567' }, { phone: '12345' }, { phone: '+1234567890123456' },
    { phone: '++79991234567' }, { phone: '+7\n9991234567' },
    { company: 'x'.repeat(201) }, { company: 5 }, { consent: false }, { consent: 'true' },
    { requestId: 'not-a-uuid' }, { requestId: undefined },
  ]) assert.throws(() => validateRegistrationInput(input(values)), error => error.status === 400);
});

test('registrations survive a new store and retries or equivalent phone formats cannot create extra records', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'registrations-store-'));
  try {
    const store = new RegistrationStore(directory);
    assert.deepEqual(await store.read(), []);
    const submission = input();
    const first = await store.add(submission);
    assert.equal(first.duplicate, false);
    assert.match(first.registration.id, /^[0-9a-f-]{36}$/);
    assert.equal(new Date(first.registration.createdAt).toISOString(), first.registration.createdAt);
    assert.deepEqual(await store.add(submission), { ...first, duplicate: true });
    assert.equal((await store.add(input({ phone: '8 (999) 123-45-67', name: 'Другой' }))).duplicate, true);
    await assert.rejects(store.add({ ...submission, company: 'Изменено' }), error => error.status === 409);
    const records = await new RegistrationStore(directory).read();
    assert.equal(records.length, 1);
    assert.equal(records[0].name, 'Анна Иванова');
    assert.equal(records[0].company, 'Компания');
    assert.equal(JSON.parse(await readFile(path.join(directory, 'registrations.json'), 'utf8')).registrations.length, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('concurrent appends from separate store instances retain every registration and deduplicate concurrent retries', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'registrations-concurrent-'));
  try {
    const stores = [new RegistrationStore(directory), new RegistrationStore(directory)];
    const submissions = Array.from({ length: 20 }, (_, index) => input({ phone: `+7999123${String(index).padStart(4, '0')}` }));
    await Promise.all(submissions.flatMap((submission, index) => [stores[index % 2].add(submission), stores[(index + 1) % 2].add(submission)]));
    const records = await stores[0].read();
    assert.equal(records.length, 20);
    assert.equal(new Set(records.map(record => record.requestId)).size, 20);
    assert.deepEqual(records.map(record => record.createdAt), records.map(record => record.createdAt).sort().reverse());
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('corrupt or structurally invalid registration files are never replaced by a new submission', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'registrations-corrupt-'));
  try {
    const filename = path.join(directory, 'registrations.json');
    const store = new RegistrationStore(directory);
    for (const invalid of ['{broken', '{}', '{"registrations":[{"name":"Анна"}]}']) {
      await writeFile(filename, invalid);
      await assert.rejects(store.read());
      await assert.rejects(store.add(input()));
      assert.equal(await readFile(filename, 'utf8'), invalid);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a full registration store still accepts safe retries but rejects new records without changing disk', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'registrations-capacity-'));
  try {
    const records = Array.from({ length: 20_000 }, (_, index) => ({
      ...input({ name: 'Анна', company: '', phone: `+7999${String(index).padStart(7, '0')}` }),
      id: randomUUID(), createdAt: '2026-10-21T10:00:00.000Z',
    }));
    const content = JSON.stringify({ registrations: records });
    const filename = path.join(directory, 'registrations.json');
    await writeFile(filename, content);
    const store = new RegistrationStore(directory);
    assert.equal((await store.add(records[0])).duplicate, true);
    await assert.rejects(store.add(input()), error => error.status === 503);
    assert.equal(await readFile(filename, 'utf8'), content);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('XLSX round trip preserves literal user content, international phone strings and Moscow dates', async () => {
  const registration = {
    id: randomUUID(), requestId: randomUUID(), name: '=1+1', phone: '+79991234567',
    company: '@SUM(1,2)', consent: true, createdAt: '2026-10-21T22:05:06.000Z',
  };
  const bytes = await buildRegistrationWorkbook([registration]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  assert.equal(workbook.worksheets.length, 1);
  const sheet = workbook.getWorksheet('Заявки');
  assert.deepEqual(sheet.getRow(1).values.slice(1), ['Дата регистрации (МСК)', 'Имя', 'Телефон', 'Компания или вуз', 'Согласие']);
  assert.deepEqual(sheet.getRow(2).values.slice(1), ['22.10.2026, 01:05:06', '=1+1', '+79991234567', '@SUM(1,2)', 'Да']);
  for (const column of [2, 3, 4]) {
    assert.equal(sheet.getCell(2, column).type, ExcelJS.ValueType.String);
    assert.equal(sheet.getCell(2, column).formula, undefined);
  }
  assert.equal(sheet.views[0].state, 'frozen');
  assert.equal(sheet.views[0].ySplit, 1);
  assert.equal(sheet.autoFilter, 'A1:E2');
  assert.equal(sheet.getCell('A1').font.bold, true);
  assert.equal(registrationExportFilename(new Date('2026-10-21T22:05:06.000Z')), 'registrations-2026-10-22.xlsx');
});
