import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import {
  computeBoardExportBounds,
  computeOptimalExportDimensions,
  MAX_EXPORT_DIMENSION,
  MAX_EXPORT_PIXELS,
} from './exportUtils.ts';
import { BoardElement } from '../types/board.ts';

test('computeBoardExportBounds returns default 1280x720 + padding for empty board', () => {
  const b = computeBoardExportBounds([], 64);
  assert.equal(b.width, 1280 + 128);
  assert.equal(b.height, 720 + 128);
});

test('computeBoardExportBounds wraps multiple elements tightly with padding', () => {
  const elements: BoardElement[] = [
    {
      id: 'r1',
      type: 'rectangle',
      x: 100,
      y: 200,
      width: 300,
      height: 150,
      color: '#1e293b',
      fillColor: 'transparent',
      strokeWidth: 3,
      zIndex: 1,
    },
    {
      id: 'r2',
      type: 'rectangle',
      x: 700,
      y: 500,
      width: 200,
      height: 100,
      color: '#1e293b',
      fillColor: 'transparent',
      strokeWidth: 3,
      zIndex: 2,
    },
  ];
  const b = computeBoardExportBounds(elements, 64);
  assert.equal(b.minX, 100);
  assert.equal(b.minY, 200);
  assert.equal(b.maxX, 900);
  assert.equal(b.maxY, 600);
  assert.equal(b.width, 800 + 128);
  assert.equal(b.height, 400 + 128);
});

test('computeOptimalExportDimensions preserves full 4x scale on standard boards', () => {
  const dims = computeOptimalExportDimensions(1408, 848, 4);
  assert.equal(dims.effectiveScale, 4);
  assert.equal(dims.pixelWidth, 5632);
  assert.equal(dims.pixelHeight, 3392);
  assert.equal(dims.wasClamped, false);
});

test('computeOptimalExportDimensions smoothly clamps huge boards without dropping straight to 1x', () => {
  // 5000 x 2000 world board at requested 4x would be 20000 x 8000 (exceeds 12000 edge & 64MP area)
  const dims = computeOptimalExportDimensions(5000, 2000, 4);
  assert.equal(dims.wasClamped, true);
  assert.ok(dims.pixelWidth <= MAX_EXPORT_DIMENSION);
  assert.ok(dims.pixelHeight <= MAX_EXPORT_DIMENSION);
  assert.ok(dims.pixelWidth * dims.pixelHeight <= MAX_EXPORT_PIXELS + 20000);
  // Effective scale should still be well above 2x (around 2.4x), not 1x!
  assert.ok(dims.effectiveScale > 2.3);
});

test('jsPDF generates valid single-page and multi-page PDF documents', () => {
  // Single page fit
  const docFit = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: [800, 600],
    compress: true,
  });
  docFit.setProperties({ title: 'Test Board' });
  const fitBlob = docFit.output('blob');
  assert.ok(fitBlob.size > 500, `Expected PDF blob size > 500, got ${fitBlob.size}`);

  // Multi-page A4
  const docA4 = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });
  docA4.addPage('a4', 'portrait');
  docA4.addPage('a4', 'portrait');
  const a4Blob = docA4.output('blob');
  assert.ok(a4Blob.size > fitBlob.size, 'Multi-page PDF should have larger size than single page');
});
