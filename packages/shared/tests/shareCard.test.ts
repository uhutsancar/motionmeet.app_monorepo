import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SHARE_CARD_SIZES,
  SHARE_CARD_TEMPLATES,
  buildShareCardSvg,
  formatShareDuration,
  workoutToShareCardData,
  type ShareCardWorkoutLike,
} from '../src/share/shareCard.js';
import { regionsForMuscles } from '../src/share/bodyFigure.js';

const exercise = (name: string, sets: number, muscleGroup?: string) => ({
  exerciseName: name,
  sets: Array.from({ length: sets }, () => ({})),
  equipment: 'barbell',
  muscleGroup,
});

const workout = (overrides: Partial<ShareCardWorkoutLike> = {}): ShareCardWorkoutLike => ({
  name: 'Chest',
  startTime: '2026-10-24T20:00:00.000Z',
  durationMinutes: 48,
  volumeKg: 360,
  totalSets: 4,
  exercises: [exercise('Bench press', 4, 'chest')],
  ...overrides,
});

test('every template renders at every size as a well-formed svg of that size', () => {
  const many = workoutToShareCardData(
    workout({ exercises: Array.from({ length: 14 }, (_, index) => exercise(`Movement ${index}`, 3, 'legs')) }),
    'someone',
  );
  for (const data of [many, workoutToShareCardData(workout(), 'someone')]) {
    for (const template of SHARE_CARD_TEMPLATES) {
      for (const size of Object.keys(SHARE_CARD_SIZES) as Array<keyof typeof SHARE_CARD_SIZES>) {
        const svg = buildShareCardSvg(data, template, size);
        const { width, height } = SHARE_CARD_SIZES[size];
        assert.match(svg, new RegExp(`^<svg [^>]*width="${width}" height="${height}"`));
        assert.ok(svg.trimEnd().endsWith('</svg>'));
        assert.doesNotMatch(svg, /NaN|undefined/, `${template}/${size}`);
      }
    }
  }
});

test('user text cannot break out of the svg', () => {
  const data = workoutToShareCardData(workout({ name: '<script>alert(1)</script> & "x"' }), 'a<b>');
  const svg = buildShareCardSvg(data, 'minimal', 'story');
  assert.doesNotMatch(svg, /<script>|<b>/);
  assert.match(svg, /&lt;script&gt;/);
});

test('a list that does not fit says how many more there were', () => {
  const data = workoutToShareCardData(
    workout({ exercises: Array.from({ length: 30 }, (_, index) => exercise(`Movement ${index}`, 2)) }),
    'someone',
  );
  assert.match(buildShareCardSvg(data, 'exercises', 'story'), /\+\d+ egzersiz daha/);
});

test('a session under a minute is not shown as zero minutes', () => {
  assert.equal(formatShareDuration(0.4), '<1 dk');
  assert.equal(formatShareDuration(78), '1 sa 18 dk');
  assert.equal(formatShareDuration(78, 'en-US'), '1 h 18 min');
});

test('missing time and zero volume are left off instead of printed as zeros', () => {
  const data = workoutToShareCardData(workout({ durationMinutes: 0, volumeKg: 0 }), 'someone');
  assert.deepEqual(data.stats.map((stat) => stat.key), ['sets']);
});

test('highlight features a real number, never a zero', () => {
  const data = workoutToShareCardData(workout({ durationMinutes: 0.2, volumeKg: 0 }), 'someone');
  const svg = buildShareCardSvg(data, 'highlight', 'story');
  assert.match(svg, />SÜRE</);
});

test('the card speaks the requested language', () => {
  const data = workoutToShareCardData(workout(), 'someone', undefined, 'en-US');
  assert.deepEqual(data.stats.map((stat) => stat.label), ['Time', 'Volume', 'Sets']);
  assert.match(data.subtitle ?? '', /October/);
});

test('muscle groups light their plates, and unknown codes light nothing', () => {
  assert.deepEqual([...regionsForMuscles(['chest'])], ['chest']);
  assert.deepEqual([...regionsForMuscles(['upper arms'])].sort(), ['biceps', 'triceps']);
  assert.deepEqual([...regionsForMuscles(['triceps'])], ['triceps']);
  assert.ok(regionsForMuscles(['legs']).has('hamstrings'));
  assert.equal(regionsForMuscles(['cardio', 'something-new', '']).size, 0);
});

test('a session with no known muscles draws no figure', () => {
  const data = workoutToShareCardData(workout({ exercises: [exercise('Run', 1, 'cardio')] }), 'someone');
  assert.doesNotMatch(buildShareCardSvg(data, 'summary', 'story'), /scale\(-1 1\)/);
});
