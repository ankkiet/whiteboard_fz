import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_TEMPLATES,
  buildStarterElementsForTemplate,
  getBoardTemplate,
  getBoardTypeLabel,
  normalizeBoardPattern,
  normalizeBoardType,
  normalizeMathGradeMode,
} from './boardTemplates';

function makeSequentialId() {
  let n = 0;
  return (prefix: string) => {
    n += 1;
    return `${prefix}_${n}`;
  };
}

describe('boardTemplates — template lookup and normalization', () => {
  it('defines 4 distinct board templates with unique IDs and valid patterns', () => {
    assert.equal(BOARD_TEMPLATES.length, 4);
    const ids = new Set(BOARD_TEMPLATES.map((t) => t.id));
    assert.equal(ids.size, 4);

    assert.equal(getBoardTemplate('math').pattern, 'grid');
    assert.equal(getBoardTemplate('math').centerOriginCamera, true);
    assert.equal(getBoardTemplate('notebook').pattern, 'lined');
    assert.equal(getBoardTemplate('mindmap').pattern, 'dots');
    assert.equal(getBoardTemplate('basic').pattern, 'grid');
  });

  it('normalizes unknown board types, patterns, and grade modes safely for backwards compatibility', () => {
    assert.equal(normalizeBoardType('math'), 'math');
    assert.equal(normalizeBoardType('mindmap'), 'mindmap');
    assert.equal(normalizeBoardType(undefined), 'basic');
    assert.equal(normalizeBoardType('legacy-unknown'), 'basic');

    assert.equal(normalizeBoardPattern('coordinate'), 'coordinate');
    assert.equal(normalizeBoardPattern('isometric'), 'isometric');
    assert.equal(normalizeBoardPattern('polar'), 'polar');
    assert.equal(normalizeBoardPattern('lined'), 'lined');
    assert.equal(normalizeBoardPattern('unknown'), 'grid');
    assert.equal(normalizeMathGradeMode('primary'), 'primary');
    assert.equal(normalizeMathGradeMode('middle'), 'middle');
    assert.equal(normalizeMathGradeMode('high'), 'high');
    assert.equal(normalizeMathGradeMode('invalid'), 'high');
    assert.equal(getBoardTypeLabel('math'), 'Toán học');
  });

  it('generates clean empty canvas for basic, math, and notebook; grouped starter nodes for mindmap', () => {
    assert.equal(buildStarterElementsForTemplate('basic', makeSequentialId()).length, 0);
    assert.equal(buildStarterElementsForTemplate('math', makeSequentialId()).length, 0);
    assert.equal(buildStarterElementsForTemplate('notebook', makeSequentialId()).length, 0);

    const mindmapEls = buildStarterElementsForTemplate('mindmap', makeSequentialId());
    assert.ok(mindmapEls.length >= 11);
    const rects = mindmapEls.filter((el) => el.type === 'rectangle');
    const texts = mindmapEls.filter((el) => el.type === 'text');
    const arrows = mindmapEls.filter((el) => el.type === 'arrow');
    assert.equal(rects.length, 4);
    assert.equal(texts.length, 4);
    assert.equal(arrows.length, 3);
    // Each node rectangle + label pair shares a groupId
    assert.ok(rects.every((r) => r.groupIds && r.groupIds.length === 1));
  });
});
