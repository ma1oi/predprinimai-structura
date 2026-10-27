import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import { readJsonBody } from '../lib/admin-auth.ts';

register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, nextResolve) {
    if (['./speaker-store', './program-agenda'].includes(specifier)) return nextResolve(specifier + '.ts', context);
    return nextResolve(specifier, context);
  }
`), import.meta.url);
const { ProgramSpeakerStore, validateProgramSpeakerDocument } = await import('../lib/program-speaker-store.ts');
const photo = '/media/speakers/7bfe36fa-a37b-4bf8-9089-2d306a8a0b60.webp';
const ids = ['registration', 'opening', 'business-session', 'effectiveness', 'success', 'coffee-break', 'ai-battle', 'ai-workshop', 'panfilov', 'internet-law', 'goncharenko', 'closing'];
const presenter = (id = 'person') => ({ id, name: '', job: '', photo: '' });
const entries = () => ids.map(id => ({ id, title: 'Событие ' + id, time: '12:00–13:00', description: '', presenters: [] }));

test('the bounded program request supports the advertised 100 full-length Cyrillic entries', async () => {
  const speakers = Array.from({ length: 100 }, (_, i) => ({ ...entries()[0], id: `event-${i}`, title: 'Т'.repeat(300), description: 'Я'.repeat(2000), presenters: Array.from({ length: 20 }, (_, j) => ({ id: `speaker-${j}`, name: 'Н'.repeat(120), job: 'Д'.repeat(300), photo })) }));
  const body = JSON.stringify({ revision: 'test', speakers });
  const request = new Request('http://localhost/api/admin/program-speakers', { method: 'PUT', headers: { 'content-type': 'application/json' }, body });
  const parsed = await readJsonBody(request, 4 * 1024 * 1024);
  assert.equal(validateProgramSpeakerDocument(parsed).speakers.length, 100);
});

test('agenda accepts additions, deletion, explicit ordering and independent speaker fields', () => {
  const speakers = entries();
  speakers[2] = { ...speakers[2], presenters: [{ id: 'anna', name: ' Анна Смирнова ', job: ' Предприниматель ', photo }] };
  const document = validateProgramSpeakerDocument({ revision: 'abc', speakers });
  assert.deepEqual(document.speakers.map(s => s.id), ids);
  assert.deepEqual(document.speakers[2], { ...speakers[2], presenters: [{ id: 'anna', name: 'Анна Смирнова', job: 'Предприниматель', photo }] });
  for (const patch of [
    { name: 'я'.repeat(121) }, { job: 'я'.repeat(301) }, { name: 'bad\u0000name' },
    { job: 'bad\u0000job' }, { name: '' }, { name: 123 }, { job: null },
    { photo: 'https://example.com/photo.webp' }, { photo: '/media/speakers/../../secret.webp' },
    { photo: '/media/speakers/example.webp' }, { photo: 123 }, { id: '../other' },
  ]) {
    const invalid = speakers.map((item, i) => i === 2 ? { ...item, presenters: [{ ...item.presenters[0], ...patch }] } : item);
    assert.throws(() => validateProgramSpeakerDocument({ revision: 'abc', speakers: invalid }));
  }
  for (const patch of [
    { id: '../other' }, { title: '' }, { title: 'x'.repeat(301) }, { description: 'x'.repeat(2001) },
    { time: '25:00–26:00' }, { time: '13:00–12:00' }, { time: '12:00–12:00' }, { time: '12:00' },
    { presenters: null }, { presenters: [presenter(), presenter()] },
    { presenters: Array.from({ length: 21 }, (_, i) => presenter('person-' + i)) },
  ]) assert.throws(() => validateProgramSpeakerDocument({ revision: 'abc', speakers: [{ ...speakers[2], ...patch }] }));
  for (const invalid of [[...speakers, speakers[0]], speakers.map((s, i) => i === 1 ? speakers[0] : s), Array.from({ length: 101 }, (_, i) => ({ ...speakers[0], id: 'event-' + i }))]) {
    assert.throws(() => validateProgramSpeakerDocument({ revision: 'abc', speakers: invalid }));
  }
  assert.throws(() => validateProgramSpeakerDocument({ revision: '', speakers }));
  const changed = [{ ...speakers[0], id: 'new-event', time: '09:00-09:30' }, speakers[2]];
  assert.deepEqual(validateProgramSpeakerDocument({ revision: 'a', speakers: changed }).speakers.map(s => s.id), ['new-event', 'business-session']);
  assert.deepEqual(validateProgramSpeakerDocument({ revision: 'a', speakers: [] }).speakers, []);
});

test('legacy two-speaker storage migrates in memory retaining photos and known descriptions', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'program-legacy-'));
  try {
    const file = path.join(dir, 'program-speakers.json');
    const legacy = JSON.stringify({ speakers: [
      { id: 'panfilov', name: 'Максим Панфилов', photo },
      { id: 'goncharenko', name: 'Максим Гончаренко', photo: '' },
    ], revision: 'old' });
    await writeFile(file, legacy);
    const migrated = await new ProgramSpeakerStore(dir).read();
    assert.equal(migrated.speakers.length, 12);
    const panfilov = migrated.speakers.find(s => s.id === 'panfilov');
    assert.equal(panfilov.presenters[0].photo, photo);
    assert.equal(panfilov.presenters[0].name, 'Максим Панфилов');
    assert.match(panfilov.presenters[0].job, /panfilov.digital/);
    assert.equal(migrated.speakers.find(s => s.id === 'business-session').presenters[0].name, 'Имя');
    assert.equal(await readFile(file, 'utf8'), legacy);
    await new ProgramSpeakerStore(dir).save(migrated);
    assert.equal(JSON.parse(await readFile(file, 'utf8')).speakers.length, 12);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('program speakers persist all fields and reject stale concurrent saves without touching other documents', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'program-speakers-'));
  try {
    const store = new ProgramSpeakerStore(dir);
    const original = await store.read();
    assert.deepEqual(original.speakers.map(s => s.id), ids);
    const speakers = original.speakers.map(s => s.id === 'business-session' ? { ...s, presenters: [{ id: 'anna', name: 'Анна Смирнова', job: 'Основатель', photo }] } : s);
    const results = await Promise.allSettled([
      store.save({ revision: original.revision, speakers }),
      new ProgramSpeakerStore(dir).save({ revision: original.revision, speakers: entries() }),
    ]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
    const saved = await new ProgramSpeakerStore(dir).read();
    assert.deepEqual(saved.speakers.find(s => s.id === 'business-session'), speakers[2]);
    assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'program-speakers.json'), 'utf8')), saved);
    assert.deepEqual(await readdir(dir), ['program-speakers.json']);
    assert.deepEqual((await store.save({ ...saved, speakers: entries() })).speakers, entries());
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('invalid legacy or damaged files cannot be silently replaced by a save', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'program-damaged-'));
  try {
    const file = path.join(dir, 'program-speakers.json');
    for (const content of ['{bad', JSON.stringify({ speakers: [{ id: 'panfilov', photo: '' }, { id: 'panfilov', photo: '' }] })]) {
      await writeFile(file, content);
      await assert.rejects(new ProgramSpeakerStore(dir).save({ revision: 'old', speakers: entries() }));
      assert.equal(await readFile(file, 'utf8'), content);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

 test('legacy per-event speaker records preserve all edited content when gaining agenda fields', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'program-all-legacy-'));
  try {
    const legacy = entries().map(({ id }) => ({ id, name: '', job: '', photo: '' }));
    legacy[2] = { ...legacy[2], name: 'Анна', job: 'Основатель', photo };
    const raw = JSON.stringify({ speakers: legacy });
    await writeFile(path.join(dir, 'program-speakers.json'), raw);
    const store = new ProgramSpeakerStore(dir);
    const doc = await store.read();
    assert.equal(doc.speakers[2].presenters[0].name, 'Анна');
    assert.equal(doc.speakers[2].presenters[0].photo, photo);
    assert.match(doc.speakers[2].title, /Бизнес/);
    assert.equal(await readFile(store.filename, 'utf8'), raw);
    const changed = [doc.speakers[2], { ...doc.speakers[0], id: 'new', title: 'Новый пункт', time: '18:00–19:00' }];
    const saved = await store.save({ revision: doc.revision, speakers: changed });
    assert.deepEqual((await new ProgramSpeakerStore(dir).read()).speakers, changed);
    await store.save({ revision: saved.revision, speakers: [] });
    assert.deepEqual((await store.read()).speakers, []);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('multiple speakers keep identity, order and independent photos across saves and legacy full agenda migration', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'program-multi-'));
  try {
    const legacy = [{ id: 'custom', title: 'Лекция', time: '10:00–11:00', description: 'Описание', name: 'Первый спикер', job: 'Основатель', photo }];
    const raw = JSON.stringify({ speakers: legacy });
    await writeFile(path.join(dir, 'program-speakers.json'), raw);
    const store = new ProgramSpeakerStore(dir);
    const original = await store.read();
    assert.equal(original.speakers[0].presenters.length, 1);
    assert.equal(original.speakers[0].presenters[0].photo, photo);
    assert.equal(await readFile(store.filename, 'utf8'), raw);
    assert.equal((await store.read()).revision, original.revision);
    const first = original.speakers[0].presenters[0];
    const speakers = [{ ...original.speakers[0], presenters: [first, { id: 'second', name: 'Второй спикер', job: 'Директор', photo: '' }] }];
    const saved = await store.save({ revision: original.revision, speakers });
    assert.deepEqual((await new ProgramSpeakerStore(dir).read()).speakers, speakers);
    const shortened = await store.save({ revision: saved.revision, speakers: [{ ...speakers[0], presenters: [speakers[0].presenters[1]] }] });
    assert.equal(shortened.speakers[0].presenters[0].name, 'Второй спикер');
    assert.deepEqual((await store.save({ revision: shortened.revision, speakers: [{ ...speakers[0], presenters: [] }] })).speakers[0].presenters, []);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
