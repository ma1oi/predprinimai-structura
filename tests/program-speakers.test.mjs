import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, nextResolve) {
    if (['./speaker-store', './program-agenda'].includes(specifier)) return nextResolve(specifier + '.ts', context);
    return nextResolve(specifier, context);
  }
`), import.meta.url);
const { ProgramSpeakerStore, validateProgramSpeakerDocument } = await import('../lib/program-speaker-store.ts');
const photo = '/media/speakers/7bfe36fa-a37b-4bf8-9089-2d306a8a0b60.webp';
const ids = ['registration', 'opening', 'business-session', 'effectiveness', 'success', 'coffee-break', 'ai-battle', 'ai-workshop', 'panfilov', 'internet-law', 'goncharenko', 'closing'];
const entries = () => ids.map(id => ({ id, name: '', job: '', photo: '' }));

test('every program item accepts editable speaker text/photo and validates all slots without changing their order', () => {
  const speakers = entries();
  speakers[2] = { ...speakers[2], name: ' Анна Смирнова ', job: ' Предприниматель ', photo };
  const document = validateProgramSpeakerDocument({ revision: 'abc', speakers: [...speakers].reverse() });
  assert.deepEqual(document.speakers.map(s => s.id), ids);
  assert.deepEqual(document.speakers[2], { id: 'business-session', name: 'Анна Смирнова', job: 'Предприниматель', photo });
  for (const patch of [
    { name: 'я'.repeat(121) }, { job: 'я'.repeat(301) }, { name: 'bad\u0000name' },
    { job: 'bad\u0000job' }, { name: '' }, { name: 123 }, { job: null },
    { photo: 'https://example.com/photo.webp' }, { photo: '/media/speakers/../../secret.webp' },
    { photo: '/media/speakers/example.webp' }, { photo: 123 }, { id: 'other' },
  ]) {
    const invalid = speakers.map((item, i) => i === 2 ? { ...item, ...patch } : item);
    assert.throws(() => validateProgramSpeakerDocument({ revision: 'abc', speakers: invalid }));
  }
  for (const invalid of [[], speakers.slice(1), [...speakers, speakers[0]], speakers.map((s, i) => i === 1 ? speakers[0] : s)]) {
    assert.throws(() => validateProgramSpeakerDocument({ revision: 'abc', speakers: invalid }));
  }
  assert.throws(() => validateProgramSpeakerDocument({ revision: '', speakers }));
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
    assert.equal(panfilov.photo, photo);
    assert.equal(panfilov.name, 'Максим Панфилов');
    assert.match(panfilov.job, /panfilov.digital/);
    assert.equal(migrated.speakers.find(s => s.id === 'business-session').name, 'Имя');
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
    const speakers = original.speakers.map(s => s.id === 'business-session' ? { ...s, name: 'Анна Смирнова', job: 'Основатель', photo } : s);
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
