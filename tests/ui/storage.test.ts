import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SAVE, loadSave, parseSave, writeSave } from '../../src/ui/storage.ts';

test('uses independent defaults for absent, corrupt and unsupported data', () => {
  for (const raw of [null, '{', 'null', '{}', '{"version":2}']) {
    const data = parseSave(raw);
    assert.deepEqual(data, DEFAULT_SAVE);
    data.preferences.muted = true;
    assert.equal(DEFAULT_SAVE.preferences.muted, false);
  }
});

test('validates high score and clamps volume', () => {
  assert.deepEqual(parseSave('{"version":1,"highScore":-9,"preferences":{"muted":"yes","volume":99}}'),
    { version: 1, highScore: 0, preferences: { muted: false, volume: 1 } });
  assert.equal(parseSave('{"version":1,"highScore":1200,"preferences":{"muted":true,"volume":0.2}}').highScore, 1200);
});

test('storage failures fall back without interrupting play', () => {
  const broken = { getItem(): string { throw Error('blocked'); }, setItem(): void { throw Error('blocked'); } };
  assert.deepEqual(loadSave(broken), DEFAULT_SAVE);
  assert.doesNotThrow(() => writeSave(DEFAULT_SAVE, broken));
});
