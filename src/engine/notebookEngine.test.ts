import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampNotebookCamera,
  clampPointToNotebookMargins,
  computeTotalNotebookPages,
  DEFAULT_NOTEBOOK_PAPER_SIZE,
  DEFAULT_NOTEBOOK_PAPER_STYLE,
  getNotebookConfig,
  getNotebookContentPageIndices,
  getNotebookFitCamera,
  getNotebookMargins,
  getNotebookPageBounds,
  isPointInsideNotebookMargins,
  NOTEBOOK_PAPER_CONFIGS,
  NOTEBOOK_PAPER_STYLES,
  normalizeNotebookPaperSize,
  normalizeNotebookPaperStyle,
} from './notebookEngine';
import { BoardElement } from '../types/board';

describe('notebookEngine — paper configurations and normalization', () => {
  it('defines A4 as default with compact left margin for wider writing space', () => {
    assert.equal(DEFAULT_NOTEBOOK_PAPER_SIZE, 'a4');
    const a4 = getNotebookConfig('a4');
    assert.equal(a4.id, 'a4');
    assert.equal(a4.width, 800);
    assert.equal(a4.height, 1132);
    assert.equal(a4.marginLeft, 36);
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

  it('supports notebook paper styles including ruled and square grid (ô ly)', () => {
    assert.equal(DEFAULT_NOTEBOOK_PAPER_STYLE, 'lined');
    const styleIds = NOTEBOOK_PAPER_STYLES.map((s) => s.id);
    assert.ok(styleIds.includes('lined'));
    assert.ok(styleIds.includes('grid'));
    assert.equal(normalizeNotebookPaperStyle('lined'), 'lined');
    assert.equal(normalizeNotebookPaperStyle('grid'), 'grid');
    assert.equal(normalizeNotebookPaperStyle('dots'), 'dots');
    assert.equal(normalizeNotebookPaperStyle('plain'), 'plain');
    assert.equal(normalizeNotebookPaperStyle('coordinate'), 'lined');
    assert.equal(normalizeNotebookPaperStyle(undefined), 'lined');
  });

  it('provides valid configs for A3, B5, and Letter with compact left margins', () => {
    const a3 = NOTEBOOK_PAPER_CONFIGS.a3;
    const b5 = NOTEBOOK_PAPER_CONFIGS.b5;
    const letter = NOTEBOOK_PAPER_CONFIGS.letter;

    assert.equal(a3.width, 1132);
    assert.equal(a3.height, 1600);
    assert.equal(a3.marginLeft, 48);
    assert.equal(b5.width, 700);
    assert.equal(b5.height, 994);
    assert.equal(b5.marginLeft, 32);
    assert.equal(letter.width, 800);
    assert.equal(letter.height, 1035);
    assert.equal(letter.marginLeft, 36);
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
    assert.equal(margins0.left, 36);
    assert.equal(margins0.right, 800 - 36); // 764
    assert.equal(margins0.top, 56);
    assert.equal(margins0.bottom, 1132 - 48); // 1084
    assert.equal(margins0.contentWidth, 764 - 36);

    const margins1 = getNotebookMargins(1, config);
    assert.equal(margins1.left, 36);
    assert.equal(margins1.right, 764);
    assert.equal(margins1.top, 1132 + 56);
    assert.equal(margins1.bottom, 2264 - 48);
  });

  it('clamps points to strictly stay within left and right margins', () => {
    // Point too far left (in the gutter or off-paper)
    const tooFarLeft = clampPointToNotebookMargins({ x: 10, y: 100 }, config);
    assert.equal(tooFarLeft.x, 36);
    assert.equal(tooFarLeft.y, 100);

    // Negative X
    const negativeX = clampPointToNotebookMargins({ x: -50, y: 200 }, config);
    assert.equal(negativeX.x, 36);

    // Point previously blocked by 72px margin is now writable
    const widerLeft = clampPointToNotebookMargins({ x: 50, y: 100 }, config);
    assert.equal(widerLeft.x, 50);

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
    assert.equal(isPointInsideNotebookMargins({ x: 50, y: 100 }, config), true); // now inside (> 36)
    assert.equal(isPointInsideNotebookMargins({ x: 20, y: 100 }, config), false); // left of 36
    assert.equal(isPointInsideNotebookMargins({ x: 780, y: 100 }, config), false); // right of 764
    assert.equal(isPointInsideNotebookMargins({ x: 200, y: 20 }, config), false); // above 56
  });
});

describe('notebookEngine — content page detection for PDF export', () => {
  const config = getNotebookConfig('a4'); // height = 1132

  it('returns empty array when notebook has no elements', () => {
    assert.deepEqual(getNotebookContentPageIndices([], config), []);
  });

  it('returns only page 0 when writing is confined to page 1 (never adds trailing blank page)', () => {
    const strokeOnPage1: BoardElement = {
      id: 's1',
      type: 'stroke',
      x: 50,
      y: 120,
      width: 200,
      height: 100,
      points: [
        [50, 120, 0.5],
        [250, 1130, 0.5], // very close to bottom of page 1 (1132), must not leak to page 2
      ],
      color: '#1e293b',
      strokeWidth: 6,
      zIndex: 1,
    };
    assert.deepEqual(getNotebookContentPageIndices([strokeOnPage1], config), [0]);
  });

  it('skips completely blank intermediate pages and ignores empty text or strokes', () => {
    const elements: BoardElement[] = [
      {
        id: 't1',
        type: 'text',
        x: 60,
        y: 100,
        width: 200,
        height: 40,
        text: 'Trang 1 có chữ',
        color: '#1e293b',
        fontSize: 18,
        zIndex: 1,
      },
      {
        id: 'empty_t2',
        type: 'text',
        x: 60,
        y: 1300, // page 2 (index 1)
        width: 200,
        height: 40,
        text: '   ',
        color: '#1e293b',
        fontSize: 18,
        zIndex: 2,
      },
      {
        id: 'empty_s2',
        type: 'stroke',
        x: 60,
        y: 1400, // page 2 (index 1)
        width: 0,
        height: 0,
        points: [],
        color: '#1e293b',
        strokeWidth: 4,
        zIndex: 3,
      },
      {
        id: 's3',
        type: 'stroke',
        x: 60,
        y: 2400, // page 3 (index 2: 2264..3396)
        width: 100,
        height: 50,
        points: [
          [60, 2400, 0.5],
          [160, 2450, 0.5],
        ],
        color: '#1e293b',
        strokeWidth: 4,
        zIndex: 4,
      },
    ];
    assert.deepEqual(getNotebookContentPageIndices(elements, config), [0, 2]);
  });

  it('includes both pages when an element spans across a page divider', () => {
    const spanningRect: BoardElement = {
      id: 'r1',
      type: 'rectangle',
      x: 100,
      y: 1050,
      width: 200,
      height: 200, // 1050..1250 spans page 0 and page 1
      color: '#1e293b',
      strokeWidth: 2,
      zIndex: 1,
    };
    assert.deepEqual(getNotebookContentPageIndices([spanningRect], config), [0, 1]);
  });

  it('does not spill onto next page when element ends exactly at page boundary', () => {
    const exactBoundaryRect: BoardElement = {
      id: 'r2',
      type: 'rectangle',
      x: 100,
      y: 900,
      width: 200,
      height: 232, // ends at exactly 1132
      color: '#1e293b',
      strokeWidth: 2,
      zIndex: 1,
    };
    assert.deepEqual(getNotebookContentPageIndices([exactBoundaryRect], config), [0]);
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
