import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDynamicEraserState,
  eraseElementsInArea,
  eraseStrokeBySegment,
  isPointInSweptSquare,
  stepDynamicEraserState,
} from './eraserUtils.ts';
import { BoardElement, StrokeElement } from '../types/board.ts';

let seq = 0;
const nextId = () => `frag_${++seq}`;

function makeLineStroke(
  id: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  type: 'stroke' | 'highlighter' = 'stroke'
): StrokeElement {
  return {
    id,
    type,
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
    points: [
      [x0, y0, 0.5],
      [x1, y1, 0.5],
    ],
    color: '#1e293b',
    strokeWidth: 4,
    zIndex: 1,
  };
}

test('isPointInSweptSquare matches true square corners beyond circular radius', () => {
  // Corner (18, 18) is inside a 40x40 square (halfSize=20) centered at (0,0), even though hypot=25.45 > 20
  assert.equal(isPointInSweptSquare({ x: 18, y: 18 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 20), true);
  assert.equal(isPointInSweptSquare({ x: 21, y: 18 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 20), false);
  // Swept horizontal segment from x=0 to x=100 hits corner near end
  assert.equal(isPointInSweptSquare({ x: 118, y: -19 }, { x: 0, y: 0 }, { x: 100, y: 0 }, 20), true);
  assert.equal(isPointInSweptSquare({ x: 50, y: 25 }, { x: 0, y: 0 }, { x: 100, y: 0 }, 20), false);
});

test('stepDynamicEraserState grows substantially when shaken back-and-forth and decays when slow', () => {
  const baseSize = 24;
  let state = createDynamicEraserState(baseSize);

  // Slow gentle drag -> stays close to baseSize
  state = stepDynamicEraserState(state, { x: 100, y: 100 }, 1000, baseSize);
  state = stepDynamicEraserState(state, { x: 104, y: 100 }, 1050, baseSize);
  state = stepDynamicEraserState(state, { x: 108, y: 100 }, 1100, baseSize);
  assert.ok(state.currentSize <= baseSize + 2, `Expected gentle drag near baseSize, got ${state.currentSize}`);

  // Rapid back-and-forth shaking -> grows significantly (> 2x baseSize)
  let t = 1120;
  for (let i = 0; i < 12; i++) {
    const x = i % 2 === 0 ? 220 : 120;
    state = stepDynamicEraserState(state, { x, y: 100 }, t, baseSize);
    t += 30;
  }
  const peakSize = state.currentSize;
  assert.ok(peakSize >= baseSize * 2.2, `Expected shake peak >= ${baseSize * 2.2}, got ${peakSize}`);

  // Pause / slow down -> shrinks smoothly back toward baseSize
  for (let i = 0; i < 18; i++) {
    t += 80;
    state = stepDynamicEraserState(state, { x: 120 + i, y: 100 }, t, baseSize);
  }
  assert.ok(state.currentSize < peakSize * 0.75, `Expected size to decay from ${peakSize}, got ${state.currentSize}`);
});

test('eraseStrokeBySegment splits a long 2-point stroke cleanly into 2 fragments in the middle', () => {
  const stroke = makeLineStroke('s1', 0, 100, 300, 100);
  // Erase vertical swipe across x=150 with halfSize 20
  const res = eraseStrokeBySegment(stroke, { x: 150, y: 80 }, { x: 150, y: 120 }, 20, nextId);

  assert.equal(res.changed, true);
  assert.equal(res.fragments.length, 2);

  const [left, right] = res.fragments;
  assert.equal(left.id, 's1');
  assert.notEqual(right.id, 's1');
  assert.ok(left.x <= 1);
  assert.ok(left.x + left.width < 135, `Expected left end < 135, got ${left.x + left.width}`);
  assert.ok(right.x > 165, `Expected right start > 165, got ${right.x}`);
  assert.ok(right.x + right.width >= 299);
});

test('eraseStrokeBySegment removes entire stroke when fully covered by eraser swipe', () => {
  const stroke = makeLineStroke('s2', 100, 100, 140, 100);
  const res = eraseStrokeBySegment(stroke, { x: 90, y: 100 }, { x: 150, y: 100 }, 25, nextId);

  assert.equal(res.changed, true);
  assert.equal(res.fragments.length, 0);
});

test('eraseStrokeBySegment returns unchanged reference when eraser misses stroke', () => {
  const stroke = makeLineStroke('s3', 0, 0, 100, 0);
  const res = eraseStrokeBySegment(stroke, { x: 50, y: 80 }, { x: 80, y: 80 }, 15, nextId);

  assert.equal(res.changed, false);
  assert.equal(res.fragments[0], stroke);
});

test('eraseElementsInArea erases highlighter & pen partially while preserving locked strokes and rectangles', () => {
  const pen = makeLineStroke('pen1', 0, 50, 200, 50, 'stroke');
  const hl = makeLineStroke('hl1', 0, 50, 200, 50, 'highlighter');
  const lockedPen: StrokeElement = { ...makeLineStroke('locked1', 0, 50, 200, 50), isLocked: true };
  const rect: BoardElement = {
    id: 'rect1',
    type: 'rectangle',
    x: 50,
    y: 20,
    width: 100,
    height: 60,
    color: '#4f46e5',
    fillColor: 'transparent',
    strokeWidth: 3,
    zIndex: 4,
  };

  const result = eraseElementsInArea(
    [pen, hl, lockedPen, rect],
    { x: 100, y: 30 },
    { x: 100, y: 70 },
    18,
    nextId
  );

  assert.equal(result.changed, true);
  // pen -> 2 fragments, hl -> 2 fragments, lockedPen -> 1 untouched, rect -> 1 untouched => 6 total
  assert.equal(result.elements.length, 6);
  assert.ok(result.elements.some((e) => e.id === 'locked1'));
  assert.ok(result.elements.some((e) => e.id === 'rect1'));
});
