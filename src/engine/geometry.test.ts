import test from 'node:test';
import assert from 'node:assert/strict';
import {
  screenToWorld,
  worldToScreen,
  zoomCameraAtPoint,
  getElementBounds,
  isPointInElement,
  doesSegmentHitElement,
  translateElement,
  computeResizedRect,
  resizeElementToRect,
  constrainShapeEndPoint,
  computeFitCamera,
  doesRectIntersectElement,
} from './geometry';
import { Camera, ShapeElement, StrokeElement } from '../types/board';

test('screenToWorld and worldToScreen are exact inverses across pan and zoom', () => {
  const camera: Camera = { x: 245.5, y: -112.25, zoom: 1.75 };
  const rect = { left: 16, top: 24 };
  const screenPt = { x: 640, y: 420 };

  const world = screenToWorld(screenPt.x, screenPt.y, camera, rect);
  const roundTrip = worldToScreen(world.x, world.y, camera, rect);

  assert.ok(Math.abs(roundTrip.x - screenPt.x) < 1e-9);
  assert.ok(Math.abs(roundTrip.y - screenPt.y) < 1e-9);
});

test('zoomCameraAtPoint keeps world coordinate under cursor fixed', () => {
  const camera: Camera = { x: -120, y: 80, zoom: 1.2 };
  const cursorX = 520;
  const cursorY = 340;

  const worldBefore = screenToWorld(cursorX, cursorY, camera, { left: 0, top: 0 });
  const zoomed = zoomCameraAtPoint(camera, 2.4, cursorX, cursorY);
  const worldAfter = screenToWorld(cursorX, cursorY, zoomed, { left: 0, top: 0 });

  assert.equal(zoomed.zoom, 2.4);
  assert.ok(Math.abs(worldAfter.x - worldBefore.x) < 1e-9);
  assert.ok(Math.abs(worldAfter.y - worldBefore.y) < 1e-9);
});

test('stroke translate and hit testing move all points consistently', () => {
  const stroke: StrokeElement = {
    id: 's1',
    type: 'stroke',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    points: [
      [10, 10, 0.5],
      [110, 110, 0.5],
    ],
    color: '#1e293b',
    strokeWidth: 4,
    zIndex: 1,
  };

  assert.equal(isPointInElement({ x: 60, y: 60 }, stroke), true);
  assert.equal(isPointInElement({ x: 10, y: 110 }, stroke), false);

  const moved = translateElement(stroke, 50, -20) as StrokeElement;
  assert.deepEqual(moved.points[0], [60, -10, 0.5]);
  assert.deepEqual(moved.points[1], [160, 90, 0.5]);
  assert.equal(isPointInElement({ x: 110, y: 40 }, moved), true);
  assert.equal(isPointInElement({ x: 60, y: 60 }, moved), false);
});

test('eraser segment intersection catches fast swipes across strokes and arrows', () => {
  const stroke: StrokeElement = {
    id: 's2',
    type: 'stroke',
    x: 0,
    y: 0,
    width: 0,
    height: 200,
    points: [
      [100, 0, 0.5],
      [100, 200, 0.5],
    ],
    color: '#4f46e5',
    strokeWidth: 3,
    zIndex: 1,
  };

  assert.equal(doesSegmentHitElement({ x: 20, y: 100 }, { x: 180, y: 100 }, stroke), true);
  assert.equal(doesSegmentHitElement({ x: 20, y: 250 }, { x: 180, y: 250 }, stroke), false);

  const arrow: ShapeElement = {
    id: 'a1',
    type: 'arrow',
    x: 0,
    y: 0,
    width: 200,
    height: 0,
    startPoint: { x: 0, y: 50 },
    endPoint: { x: 200, y: 50 },
    color: '#dc2626',
    strokeWidth: 3,
    zIndex: 2,
  };
  assert.equal(doesSegmentHitElement({ x: 100, y: 0 }, { x: 100, y: 100 }, arrow), true);
});

test('resize respects aspect ratio and scales stroke points accurately', () => {
  const initial = { x: 100, y: 100, width: 200, height: 100 };
  const resized = computeResizedRect(initial, 'se', 100, 10, true);
  assert.equal(resized.width, 300);
  assert.equal(resized.height, 150);

  const stroke: StrokeElement = {
    id: 's3',
    type: 'stroke',
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    points: [
      [100, 100, 0.5],
      [300, 200, 0.5],
    ],
    color: '#000',
    strokeWidth: 4,
    zIndex: 1,
  };
  const scaled = resizeElementToRect(stroke, initial, resized) as StrokeElement;
  assert.deepEqual(scaled.points[1], [400, 250, 0.5]);
});

test('Shift constraint produces perfect squares and 45-degree arrows', () => {
  const sq = constrainShapeEndPoint({ x: 0, y: 0 }, { x: 80, y: 30 }, 'rectangle', true);
  assert.deepEqual(sq, { x: 80, y: 80 });

  const diag = constrainShapeEndPoint({ x: 0, y: 0 }, { x: 100, y: 90 }, 'arrow', true);
  assert.ok(Math.abs(diag.x - diag.y) < 1e-6);
});

test('marquee selection and computeFitCamera center content in viewport', () => {
  const rectEl: ShapeElement = {
    id: 'r1',
    type: 'rectangle',
    x: 400,
    y: 300,
    width: 200,
    height: 100,
    color: '#4f46e5',
    strokeWidth: 3,
    zIndex: 1,
  };
  assert.equal(doesRectIntersectElement({ x: 350, y: 250, width: 100, height: 100 }, rectEl), true);
  assert.equal(doesRectIntersectElement({ x: 0, y: 0, width: 100, height: 100 }, rectEl), false);

  const bounds = getElementBounds(rectEl);
  assert.deepEqual(bounds, { minX: 400, minY: 300, maxX: 600, maxY: 400 });

  const fit = computeFitCamera([rectEl], 1440, 900);
  const centerScreen = worldToScreen(500, 350, fit);
  assert.ok(Math.abs(centerScreen.x - 720) < 1e-6);
  assert.ok(Math.abs(centerScreen.y - 450) < 1e-6);
});

test('resizeElementToRect scales grouped shapes proportionally without collapsing them', () => {
  const leftRect: ShapeElement = {
    id: 'g1',
    type: 'rectangle',
    x: 100,
    y: 100,
    width: 100,
    height: 100,
    color: '#4f46e5',
    strokeWidth: 3,
    groupIds: ['grp_a'],
    zIndex: 1,
  };
  const rightRect: ShapeElement = {
    id: 'g2',
    type: 'rectangle',
    x: 300,
    y: 100,
    width: 100,
    height: 100,
    color: '#e11d48',
    strokeWidth: 3,
    groupIds: ['grp_a'],
    zIndex: 2,
  };

  // Combined bounding box: x=100..400 (w=300), y=100..200 (h=100)
  const initialGroupRect = { x: 100, y: 100, width: 300, height: 100 };
  // Scale 2x horizontally and 1.5x vertically
  const nextGroupRect = { x: 100, y: 100, width: 600, height: 150 };

  const scaledLeft = resizeElementToRect(leftRect, initialGroupRect, nextGroupRect);
  const scaledRight = resizeElementToRect(rightRect, initialGroupRect, nextGroupRect);

  assert.equal(scaledLeft.x, 100);
  assert.equal(scaledLeft.width, 200);
  assert.equal(scaledLeft.height, 150);

  assert.equal(scaledRight.x, 500);
  assert.equal(scaledRight.width, 200);
  assert.equal(scaledRight.height, 150);
});
