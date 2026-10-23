import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';

// Mirror the bundler's extensionless TypeScript resolution in Node's native test runner.
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, nextResolve) {
    if (specifier === './speaker-store') return nextResolve(specifier + '.ts', context);
    return nextResolve(specifier, context);
  }
`), import.meta.url);
const { ProgramSpeakerStore, validateProgramSpeakerDocument } = await import('../lib/program-speaker-store.ts');

const photo = '/media/speakers/7bfe36fa-a37b-4bf8-9089-2d306a8a0b60.webp';
const speakers = [
  { id: 'panfilov', name: 'Changed name', photo },
  { id: 'goncharenko', name: 'Changed name', photo: '' },
];

test('program photos preserve the two canonical identities and accept only uploaded local photos', () => {
  const document = validateProgramSpeakerDocument({ revision: 'abc', speakers: [...speakers].reverse() });
  assert.deepEqual(document.speakers, [
    { id: 'panfilov', name: 'Максим Панфилов', photo },
    { id: 'goncharenko', name: 'Максим Гончаренко', photo: '' },
  ]);
  for (const invalid of [
    [], speakers.slice(0, 1), [...speakers, speakers[0]],
    [speakers[0], speakers[0]],
    [speakers[0], { ...speakers[1], id: 'other' }],
    [speakers[0], { ...speakers[1], photo: 'https://example.com/photo.webp' }],
    [speakers[0], { ...speakers[1], photo: '/media/speakers/../../secret.webp' }],
    [speakers[0], { ...speakers[1], photo: '/media/speakers/example.webp' }],
    [speakers[0], { ...speakers[1], photo: 123 }],
  ]) assert.throws(() => validateProgramSpeakerDocument({ revision: 'abc', speakers: invalid }));
  assert.throws(() => validateProgramSpeakerDocument({ revision: '', speakers }));
});

test('program store defaults to empty photos and persists atomically without touching other documents', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'program-speakers-'));
  try {
    const store = new ProgramSpeakerStore(directory);
    const original = await store.read();
    assert.deepEqual(original.speakers.map(({ id, photo }) => ({ id, photo })), [
      { id: 'panfilov', photo: '' }, { id: 'goncharenko', photo: '' },
    ]);
    const results = await Promise.allSettled([
      store.save({ revision: original.revision, speakers }),
      new ProgramSpeakerStore(directory).save({ revision: original.revision, speakers: speakers.map(item => ({ ...item, photo })) }),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
    const saved = await new ProgramSpeakerStore(directory).read();
    assert.equal(saved.speakers[0].photo, photo);
    assert.equal(saved.speakers[1].photo, '');
    assert.notEqual(saved.revision, original.revision);
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'program-speakers.json'), 'utf8')), saved);
    assert.deepEqual(await readdir(directory), ['program-speakers.json']);
    const cleared = await store.save({ ...saved, speakers: saved.speakers.map(item => ({ ...item, photo: '' })) });
    assert.deepEqual(cleared, original);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
