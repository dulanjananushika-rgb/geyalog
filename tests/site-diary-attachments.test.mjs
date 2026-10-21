import assert from 'node:assert/strict';
import test from 'node:test';
import { siteDiarySchema } from '../src/lib/site-diary-validation.ts';

test('site diary requires valid date, weather, and work completed summary', () => {
  const valid = {
    diaryDate: '2026-10-21',
    weather: 'sunny',
    workCompleted: 'Foundation rebar inspection completed. Concrete batch 1 poured.',
    issuesOrDelays: '',
    workersCount: 6,
    visitors: 'Engineer checked footing depths',
  };
  assert.equal(siteDiarySchema.safeParse(valid).success, true);
  assert.equal(siteDiarySchema.safeParse({ ...valid, diaryDate: 'bad-date' }).success, false);
  assert.equal(siteDiarySchema.safeParse({ ...valid, weather: 'snowy' }).success, false);
  assert.equal(siteDiarySchema.safeParse({ ...valid, workCompleted: '' }).success, false);
  assert.equal(siteDiarySchema.safeParse({ ...valid, workersCount: -1 }).success, false);
});

test('site diary allows optional weather delays and visitors', () => {
  const minimal = {
    diaryDate: '2026-10-21',
    weather: 'rainy',
    workCompleted: 'Indoor plastering and conduit wiring.',
  };
  const parsed = siteDiarySchema.safeParse(minimal);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.workersCount, 0);
  }
});
