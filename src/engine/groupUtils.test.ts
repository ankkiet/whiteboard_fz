import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanupOrphanGroups,
  duplicateElementsPreservingGroups,
  expandSelectionWithGroups,
  getEffectiveGroupId,
  getSelectedGroupSummary,
  groupElements,
  ungroupElements,
} from './groupUtils';
import { BoardElement, ShapeElement, TextElement } from '../types/board';

function makeRect(id: string, x: number, y: number, groupIds?: string[]): ShapeElement {
  return {
    id,
    type: 'rectangle',
    x,
    y,
    width: 100,
    height: 80,
    color: '#4f46e5',
    strokeWidth: 3,
    zIndex: 1,
    ...(groupIds ? { groupIds } : {}),
  };
}

function makeText(id: string, x: number, y: number, groupIds?: string[]): TextElement {
  return {
    id,
    type: 'text',
    x,
    y,
    width: 140,
    height: 40,
    text: 'Hello',
    color: '#1e293b',
    fontSize: 18,
    zIndex: 2,
    ...(groupIds ? { groupIds } : {}),
  };
}

test('groupElements groups 2+ elements and prevents redundant re-grouping of the same single group', () => {
  const initial: BoardElement[] = [makeRect('a', 0, 0), makeRect('b', 150, 0), makeText('c', 320, 0)];

  // Single item cannot be grouped
  const singleAttempt = groupElements(initial, ['a'], 'grp_1');
  assert.equal(singleAttempt.changed, false);

  // Two items group cleanly
  const grouped = groupElements(initial, ['a', 'b'], 'grp_1');
  assert.equal(grouped.changed, true);
  assert.deepEqual(grouped.elements[0].groupIds, ['grp_1']);
  assert.deepEqual(grouped.elements[1].groupIds, ['grp_1']);
  assert.equal(grouped.elements[2].groupIds, undefined);

  // Trying to re-group the exact same single group is a no-op
  const redundant = groupElements(grouped.elements, ['a', 'b'], 'grp_2');
  assert.equal(redundant.changed, false);

  const summary = getSelectedGroupSummary(grouped.elements, ['a', 'b']);
  assert.equal(summary.isSingleGroup, true);
  assert.equal(summary.canGroup, false);
  assert.equal(summary.canUngroup, true);
  assert.equal(summary.memberCount, 2);
});

test('nested grouping and step-by-step ungrouping preserve inner groups', () => {
  const initial: BoardElement[] = [makeRect('a', 0, 0), makeRect('b', 120, 0), makeText('c', 260, 0)];

  const g1 = groupElements(initial, ['a', 'b'], 'grp_inner');
  // Selecting only 'a' + 'c' automatically expands to include 'b' before creating outer group
  const g2 = groupElements(g1.elements, ['a', 'c'], 'grp_outer');
  assert.equal(g2.changed, true);
  assert.deepEqual(g2.selectedIds, ['a', 'b', 'c']);
  assert.deepEqual(g2.elements[0].groupIds, ['grp_inner', 'grp_outer']);
  assert.deepEqual(g2.elements[1].groupIds, ['grp_inner', 'grp_outer']);
  assert.deepEqual(g2.elements[2].groupIds, ['grp_outer']);

  // First ungroup removes only grp_outer
  const u1 = ungroupElements(g2.elements, ['a', 'b', 'c']);
  assert.equal(u1.changed, true);
  assert.deepEqual(u1.elements[0].groupIds, ['grp_inner']);
  assert.deepEqual(u1.elements[1].groupIds, ['grp_inner']);
  assert.equal(u1.elements[2].groupIds, undefined);

  // Second ungroup dissolves grp_inner
  const u2 = ungroupElements(u1.elements, ['a', 'b']);
  assert.equal(u2.changed, true);
  assert.equal(u2.elements[0].groupIds, undefined);
  assert.equal(u2.elements[1].groupIds, undefined);
});

test('expandSelectionWithGroups expands whole group normally and supports editingGroupId isolation', () => {
  const elements: BoardElement[] = [
    makeRect('a', 0, 0, ['grp_inner', 'grp_outer']),
    makeRect('b', 120, 0, ['grp_inner', 'grp_outer']),
    makeText('c', 260, 0, ['grp_outer']),
    makeRect('d', 420, 0),
  ];

  // Clicking 'a' selects the entire outermost group (a, b, c)
  assert.deepEqual(expandSelectionWithGroups(elements, ['a']), ['a', 'b', 'c']);

  // When isolated inside grp_outer, clicking 'c' selects only 'c', clicking 'a' selects inner group (a, b)
  assert.equal(getEffectiveGroupId(elements[2], 'grp_outer'), null);
  assert.equal(getEffectiveGroupId(elements[0], 'grp_outer'), 'grp_inner');
  assert.deepEqual(expandSelectionWithGroups(elements, ['c'], 'grp_outer'), ['c']);
  assert.deepEqual(expandSelectionWithGroups(elements, ['a'], 'grp_outer'), ['a', 'b']);

  // When isolated inside grp_inner, clicking 'a' selects only 'a'
  assert.deepEqual(expandSelectionWithGroups(elements, ['a'], 'grp_inner'), ['a']);
});

test('cleanupOrphanGroups strips groupIds that fall below 2 members', () => {
  const surviving: BoardElement[] = [
    makeRect('a', 0, 0, ['grp_dead', 'grp_alive']),
    makeRect('b', 120, 0, ['grp_alive']),
    makeText('c', 260, 0, ['grp_lone']),
  ];

  const cleaned = cleanupOrphanGroups(surviving);
  assert.deepEqual(cleaned[0].groupIds, ['grp_alive']);
  assert.deepEqual(cleaned[1].groupIds, ['grp_alive']);
  assert.equal(cleaned[2].groupIds, undefined);
});

test('duplicateElementsPreservingGroups assigns fresh independent groupIds to copies', () => {
  const elements: BoardElement[] = [
    makeRect('a', 10, 20, ['grp_1']),
    makeText('b', 50, 60, ['grp_1']),
  ];

  let seq = 0;
  const { duplicated, newSelectedIds } = duplicateElementsPreservingGroups(
    elements,
    ['a', 'b'],
    (prefix) => `${prefix}_copy_${++seq}`,
    30,
    40
  );

  assert.equal(duplicated.length, 2);
  assert.equal(newSelectedIds.length, 2);
  assert.equal(duplicated[0].x, 40);
  assert.equal(duplicated[0].y, 60);
  assert.ok(duplicated[0].groupIds && duplicated[0].groupIds.length === 1);
  assert.equal(duplicated[0].groupIds[0], duplicated[1].groupIds?.[0]);
  assert.notEqual(duplicated[0].groupIds[0], 'grp_1');
});
