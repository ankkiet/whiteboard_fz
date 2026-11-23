import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampNotebookCamera,
  clampPointToNotebookMargins,
  computeTotalNotebookPages,
  DEFAULT_NOTEBOOK_PAPER_SIZE,
  getNotebookConfig,
  getNotebookFitCamera,
  getNotebookMargins,
  getNotebookPageBounds,
  isPointInsideNotebookMargins,
  NOTEBOOK_PAPER_CONFIGS,
  normalizeNotebookPaperSize,
} from './notebookEngine';
import { BoardElement } from '../types/board';

describe('notebookEngine — paper configurations and normalization', () => {
  it('defines A4 as default with standard dimensions and margins', () => {
    assert.equal(DEFAULT_NOTEBOOK_PAPER_SIZE, 'a4');
    const a4 = getNotebookConfig('a4');
    assert.equal(a4.id, 'a4');
    assert.equal(a4.width, 800);
    assert.equal(a4.height, 1132);
    assert.equal(a4.marginLeft, 72);
    assert.equal(a4.marginRight, 36);
    assert.equal(a4.marginTop, 56);
    assert.equal(a4.marginBottom, 48);
    assert.equal(a4.lineSpacing, 32);
  });

  it('normalizes paper sizes safely with fallback to A4', () => {
    assert.equal(normalizeNotebookPaperSize('a4'), 'a4');
    assert.equal(normalizeNotebookPaperSize('a3'), 'a3');
    assert.equal(normalizeNotebookPaperSize('b5'), 'b5');
    assert.equal(normalizeNotebookPaperSize('letter'), 'letter');
    assert.equal(normalizeNotebookPaperSize('invalid'), 'a4');
    assert.equal(normalizeNotebookPaperSize(undefined), 'a4');
  });

  it('provides valid configs for A3, B5, and Letter', () => {
    const a3 = NOTEBOOK_PAPER_CONFIGS.a3;
    const b5 = NOTEBOOK_PAPER_CONFIGS.b5;
    const letter = NOTEBOOK_PAPER_CONFIGS.letter;

    assert.equal(a3.width, 1132);
    assert.equal(a3.height, 1600);
    assert.equal(b5.width, 700);
    assert.equal(b5.height, 994);
    assert.equal(letter.width, 800);
    assert.equal(letter.height, 1035);
  });
});

describe('notebookEngine — page bounds and margin calculations', () => {
  const config = getNotebookConfig('a4');

  it('computes continuous sequential page bounds separated vertically', () => {
    const page0 = getNotebookPageBounds(0, config);
    assert.deepEqual(page0, { x: 0, y: 0, width: 800, height: 1132 });

    const page1 = getNotebookPageBounds(1, config);
    assert.deepEqual(page1, { x: 0, y: 1132, width: 800, height: 1132 });

    const page2 = getNotebookPageBounds(2, config);
    assert.deepEqual(page2, { x: 0, y: 2264, width: 800, height: 1132 });
  });

  it('computes margins and content areas for any page index', () => {
    const margins0 = getNotebookMargins(0, config);
    assert.equal(margins0.left, 72);
    assert.equal(margins0.right, 800 - 36); // 764
    assert.equal(margins0.top, 56);
    assert.equal(margins0.bottom, 1132 - 48); // 1084
    assert.equal(margins0.contentWidth, 764 - 72);

    const margins1 = getNotebookMargins(1, config);
    assert.equal(margins1.left, 72);
    assert.equal(margins1.right, 764);
    assert.equal(margins1.top, 1132 + 56);
    assert.equal(margins1.bottom, 2264 - 48);
  });

  it('clamps points to strictly stay within left and right margins', () => {
    // Point too far left (in the gutter or off-paper)
    const tooFarLeft = clampPointToNotebookMargins({ x: 10, y: 100 }, config);
    assert.equal(tooFarLeft.x, 72);
    assert.equal(tooFarLeft.y, 100);

    // Negative X
    const negativeX = clampPointToNotebookMargins({ x: -50, y: 200 }, config);
    assert.equal(negativeX.x, 72);

    // Point too far right (past right margin rule)
    const tooFarRight = clampPointToNotebookMargins({ x: 790, y: 300 }, config);
    assert.equal(tooFarRight.x, 764);
    assert.equal(tooFarRight.y, 300);

    // Point above top margin
    const tooFarUp = clampPointToNotebookMargins({ x: 200, y: 10 }, config);
    assert.equal(tooFarUp.x, 200);
    assert.equal(tooFarUp.y, 56);

    // Point safely inside
    const inside = clampPointToNotebookMargins({ x: 300, y: 250 }, config);
    assert.equal(inside.x, 300);
    assert.equal(inside.y, 250);
  });

  it('checks margin boundary membership accurately', () => {
    assert.equal(isPointInsideNotebookMargins({ x: 200, y: 100 }, config), true);
    assert.equal(isPointInsideNotebookMargins({ x: 50, y: 100 }, config), false); // left of 72
    assert.equal(isPointInsideNotebookMargins({ x: 780, y: 100 }, config), false); // right of 764
    assert.equal(isPointInsideNotebookMargins({ x: 200, y: 20 }, config), false); // above 56
  });
});

describe('notebookEngine — camera navigation constraints and page counts', () => {
  const config = getNotebookConfig('a4');

  it('calculates total pages dynamically based on viewport and elements', () => {
    const emptyElements: BoardElement[] = [];
    const camera = { x: 0, y: 0, zoom: 1 };
    const pages = computeTotalNotebookPages(emptyElements, camera, 800, config);
    assert.ok(pages >= 2);

    // When an element is at y = 2500, pages extend past it
    const deepElement: BoardElement = {
      id: 'el_1',
      type: 'text',
      x: 100,
      y: 2500,
      width: 200,
      height: 40,
      zIndex: 1,
      text: 'Note at bottom',
      color: '#000',
      fontSize: 16,
    };
    const extendedPages = computeTotalNotebookPages([deepElement], camera, 800, config);
    assert.ok(extendedPages >= 3);
    assert.ok(extendedPages * config.height > 2500);
  });

  it('centers camera X automatically when page width fits in viewport', () => {
    const viewport = { width: 1200, height: 800 };
    const camera = { x: 0, y: 0, zoom: 1 };
    const clamped = clampNotebookCamera(camera, viewport, config, 3);

    // For width 800 and viewport 1200, centered X = (1200 - 800) / 2 = 200
    assert.equal(clamped.x, 200);
    assert.equal(clamped.zoom, 1);
  });

  it('prevents scrolling way above page 1', () => {
    const viewport = { width: 1200, height: 800 };
    const camera = { x: 200, y: 500, zoom: 1 }; // trying to pan 500px down (viewing top negative void)
    const clamped = clampNotebookCamera(camera, viewport, config, 3);
    assert.ok(clamped.y <= 48);
  });

  it('computes safe fit camera that fits page width nicely with padding', () => {
    const viewport = { width: 1000, height: 800 };
    const fitCam = getNotebookFitCamera(viewport, config);
    assert.ok(fitCam.zoom > 0.5 && fitCam.zoom < 1.5);
    assert.ok(fitCam.x >= 0);
  });
});
