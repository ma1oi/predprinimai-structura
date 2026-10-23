import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { SpeakerStore, validateSpeakerDocument } from '../lib/speaker-store.ts';
import { authenticateRequest, createSessionCookie, enforceSameOrigin, verifyPassword, readJsonBody } from '../lib/admin-auth.ts';

const speaker = { id: 'test', name: ' Test ', job: '', topic: '', time: '', photo: '', color: 'lime', art: 'blue', published: true };

test('speaker validation rejects remote photos, duplicate IDs and invalid fields', () => {
  assert.equal(validateSpeakerDocument({ revision: 'abc', speakers: [speaker] }).speakers[0].name, 'Test');
  for (const invalid of [
    { ...speaker, photo: 'https://example.com/photo.jpg' },
    { ...speaker, photo: '/media/speakers/../../secret.webp' },
    { ...speaker, name: ' ' },
    { ...speaker, published: 'true' },
    { ...speaker, color: 'red' },
    { ...speaker, name: 'x'.repeat(121) },
    { ...speaker, topic: 'x'.repeat(301) },
  ]) assert.throws(() => validateSpeakerDocument({ revision: 'abc', speakers: [invalid] }));
  assert.throws(() => validateSpeakerDocument({ revision: 'abc', speakers: [speaker, speaker] }));
  assert.throws(() => validateSpeakerDocument({ revision: 'abc', speakers: Array.from({ length: 101 }, (_, index) => ({ ...speaker, id: String(index) })) }));
});

test('store persists documents, filters drafts and rejects stale concurrent edits', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'speakers-store-'));
  try {
    const store = new SpeakerStore(directory);
    const original = await store.read();
    const results = await Promise.allSettled([
      store.save({ revision: original.revision, speakers: [speaker] }),
      store.save({ revision: original.revision, speakers: [{ ...speaker, name: 'Other' }] }),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const failure = results.find(result => result.status === 'rejected');
    assert.equal(failure.reason.status, 409);
    const saved = await new SpeakerStore(directory).read();
    assert.equal(saved.speakers[0].name, 'Test');
    assert.notEqual(saved.revision, original.revision);
    assert.equal(JSON.parse(await readFile(path.join(directory, 'speakers.json'), 'utf8')).speakers[0].name, 'Test');
    await store.save({ ...saved, speakers: [{ ...speaker, published: false }] });
    assert.deepEqual(await store.published(), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('auth denies missing setup, compares passwords, verifies signed expiring host-only cookies', () => {
  process.env.ADMIN_PASSWORD = 'test-private-password';
  delete process.env.ADMIN_SESSION_SECRET;
  assert.equal(verifyPassword('test-private-password'), true);
  assert.equal(verifyPassword('wrong'), false);
  const request = new Request('http://localhost:3000/api/admin/session');
  const cookie = createSessionCookie(request);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.doesNotMatch(cookie, /Domain=/);
  const authenticated = new Request(request, { headers: { cookie: cookie.split(';')[0] } });
  assert.equal(authenticateRequest(authenticated), true);
  const tampered = new Request(request, { headers: { cookie: cookie.split(';')[0] + 'x' } });
  assert.equal(authenticateRequest(tampered), false);
  const originalNow = Date.now;
  try {
    Date.now = () => originalNow() + 13 * 60 * 60 * 1000;
    assert.equal(authenticateRequest(authenticated), false);
  } finally { Date.now = originalNow; }
  process.env.ADMIN_PASSWORD = 'changed-password';
  assert.equal(authenticateRequest(authenticated), false);
  delete process.env.ADMIN_PASSWORD;
  assert.equal(authenticateRequest(authenticated), false);
});

test('mutations enforce exact origin and JSON bodies are bounded even without content-length', async () => {
  assert.doesNotThrow(() => enforceSameOrigin(new Request('http://localhost:3000/api/admin/session', { headers: { origin: 'http://localhost:3000' } })));
  for (const headers of [{}, { origin: 'https://attacker.example' }, { origin: 'null' }, { origin: 'http://localhost:3000', 'sec-fetch-site': 'cross-site' }]) {
    assert.throws(() => enforceSameOrigin(new Request('http://localhost:3000/api/admin/session', { headers })), error => error.status === 403);
  }
  await assert.rejects(readJsonBody(new Request('http://localhost:3000', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'x'.repeat(300_000) }) })), error => error.status === 413);
});
