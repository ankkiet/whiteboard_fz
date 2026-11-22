import { BoardElement, Rect } from '../types/board';
import { getSelectionRect, translateElement } from './geometry';

/**
 * Returns the effective outermost group ID for an element given an optional
 * currently isolated group (`editingGroupId`).
 *
 * `groupIds` is ordered innermost -> outermost (e.g. `['inner', 'outer']`).
 * - When `editingGroupId` is null, returns `groupIds[groupIds.length - 1]`.
 * - When `editingGroupId` is `'outer'`, returns the group just inside `'outer'`
 *   (`'inner'`), or `null` if the element is a direct child of `'outer'`.
 */
export function getEffectiveGroupId(
  el: Pick<BoardElement, 'groupIds'>,
  editingGroupId: string | null = null
): string | null {
  const groups = el.groupIds;
  if (!groups || groups.length === 0) return null;

  if (!editingGroupId) {
    return groups[groups.length - 1];
  }

  const editIdx = groups.indexOf(editingGroupId);
  if (editIdx === -1) {
    return groups[groups.length - 1];
  }
  return editIdx > 0 ? groups[editIdx - 1] : null;
}

export function getOutermostGroupId(el: Pick<BoardElement, 'groupIds'>): string | null {
  return getEffectiveGroupId(el, null);
}

export function getGroupMembers(elements: BoardElement[], groupId: string): BoardElement[] {
  return elements.filter((el) => el.groupIds?.includes(groupId));
}

export function isElementInGroup(el: Pick<BoardElement, 'groupIds'>, groupId: string): boolean {
  return Boolean(el.groupIds?.includes(groupId));
}

/**
 * Expands a list of element IDs so any element belonging to an effective group
 * brings along all siblings in that group, preserving element order.
 */
export function expandSelectionWithGroups(
  elements: BoardElement[],
  ids: string[],
  editingGroupId: string | null = null
): string[] {
  if (ids.length === 0) return [];
  const rawSet = new Set(ids);
  const activeGroups = new Set<string>();

  for (const el of elements) {
    if (!rawSet.has(el.id)) continue;
    const gid = getEffectiveGroupId(el, editingGroupId);
    if (gid) activeGroups.add(gid);
  }

  const expanded: string[] = [];
  for (const el of elements) {
    const gid = getEffectiveGroupId(el, editingGroupId);
    if (rawSet.has(el.id) || (gid && activeGroups.has(gid))) {
      expanded.push(el.id);
    }
  }
  return expanded;
}

/**
 * Returns the distinct top-level selectable units represented by `selectedIds`
 * (each unit is either a group's effective ID or an ungrouped element's own ID).
 */
export function getSelectedTopLevelUnits(
  elements: BoardElement[],
  selectedIds: string[],
  editingGroupId: string | null = null
): string[] {
  const idSet = new Set(selectedIds);
  const units = new Set<string>();
  for (const el of elements) {
    if (!idSet.has(el.id)) continue;
    const gid = getEffectiveGroupId(el, editingGroupId);
    units.add(gid ? `group:${gid}` : `el:${el.id}`);
  }
  return Array.from(units);
}

export interface SelectionGroupSummary {
  memberCount: number;
  distinctGroupIds: string[];
  isSingleGroup: boolean;
  canGroup: boolean;
  canUngroup: boolean;
}

export function getSelectedGroupSummary(
  elements: BoardElement[],
  selectedIds: string[],
  editingGroupId: string | null = null
): SelectionGroupSummary {
  const idSet = new Set(selectedIds);
  const selected = elements.filter((el) => idSet.has(el.id));
  const distinctGroups = new Set<string>();
  let anyGrouped = false;

  for (const el of selected) {
    const gid = getEffectiveGroupId(el, editingGroupId);
    if (gid) {
      distinctGroups.add(gid);
    }
    if (el.groupIds && el.groupIds.length > 0) {
      anyGrouped = true;
    }
  }

  const units = getSelectedTopLevelUnits(elements, selectedIds, editingGroupId);
  const distinctGroupIds = Array.from(distinctGroups);
  const isSingleGroup =
    selected.length >= 2 &&
    units.length === 1 &&
    distinctGroupIds.length === 1 &&
    selected.every((el) => getEffectiveGroupId(el, editingGroupId) === distinctGroupIds[0]);

  return {
    memberCount: selected.length,
    distinctGroupIds,
    isSingleGroup,
    canGroup: units.length >= 2,
    canUngroup: anyGrouped,
  };
}

/**
 * Groups the selected elements under `newGroupId`.
 * Automatically expands partial group selections to keep existing sub-groups intact.
 */
export function groupElements(
  elements: BoardElement[],
  selectedIds: string[],
  newGroupId: string,
  editingGroupId: string | null = null
): { elements: BoardElement[]; selectedIds: string[]; changed: boolean } {
  const expandedIds = expandSelectionWithGroups(elements, selectedIds, editingGroupId);
  const units = getSelectedTopLevelUnits(elements, expandedIds, editingGroupId);

  if (units.length < 2) {
    return { elements, selectedIds, changed: false };
  }

  const targetSet = new Set(expandedIds);
  const nextElements = elements.map((el) => {
    if (!targetSet.has(el.id)) return el;
    const prevGroups = el.groupIds ? [...el.groupIds] : [];
    if (editingGroupId) {
      const editIdx = prevGroups.indexOf(editingGroupId);
      if (editIdx !== -1) {
        prevGroups.splice(editIdx, 0, newGroupId);
        return { ...el, groupIds: prevGroups };
      }
    }
    return { ...el, groupIds: [...prevGroups, newGroupId] };
  });

  return {
    elements: nextElements,
    selectedIds: expandedIds,
    changed: true,
  };
}

/**
 * Dissolves the outermost (or effective) group layer(s) of all selected elements,
 * preserving any inner nested groups.
 */
export function ungroupElements(
  elements: BoardElement[],
  selectedIds: string[],
  editingGroupId: string | null = null
): { elements: BoardElement[]; selectedIds: string[]; changed: boolean } {
  if (selectedIds.length === 0) {
    return { elements, selectedIds, changed: false };
  }

  const idSet = new Set(selectedIds);
  const groupsToDissolve = new Set<string>();

  for (const el of elements) {
    if (!idSet.has(el.id)) continue;
    const gid = getEffectiveGroupId(el, editingGroupId) ?? getOutermostGroupId(el);
    if (gid) groupsToDissolve.add(gid);
  }

  if (groupsToDissolve.size === 0) {
    return { elements, selectedIds, changed: false };
  }

  const affectedIds = new Set<string>(selectedIds);
  const nextElements = elements.map((el) => {
    if (!el.groupIds || el.groupIds.length === 0) return el;
    const hasDissolved = el.groupIds.some((gid) => groupsToDissolve.has(gid));
    if (!hasDissolved) return el;

    affectedIds.add(el.id);
    const remaining = el.groupIds.filter((gid) => !groupsToDissolve.has(gid));
    if (remaining.length === 0) {
      const copy = { ...el };
      delete copy.groupIds;
      return copy;
    }
    return { ...el, groupIds: remaining };
  });

  return {
    elements: nextElements,
    selectedIds: nextElements.filter((el) => affectedIds.has(el.id)).map((el) => el.id),
    changed: true,
  };
}

/**
 * Strips any group IDs that now have fewer than 2 surviving elements
 * (e.g., after deleting or erasing members of a group).
 */
export function cleanupOrphanGroups(elements: BoardElement[]): BoardElement[] {
  const counts = new Map<string, number>();
  for (const el of elements) {
    if (!el.groupIds) continue;
    for (const gid of el.groupIds) {
      counts.set(gid, (counts.get(gid) || 0) + 1);
    }
  }

  let hasOrphans = false;
  for (const count of counts.values()) {
    if (count < 2) {
      hasOrphans = true;
      break;
    }
  }
  if (!hasOrphans) return elements;

  return elements.map((el) => {
    if (!el.groupIds || el.groupIds.length === 0) return el;
    const valid = el.groupIds.filter((gid) => (counts.get(gid) || 0) >= 2);
    if (valid.length === el.groupIds.length) return el;
    if (valid.length === 0) {
      const copy = { ...el };
      delete copy.groupIds;
      return copy;
    }
    return { ...el, groupIds: valid };
  });
}

/**
 * Duplicates the selected elements while remapping their groupIds to fresh IDs
 * so duplicated groups remain grouped independently of the original group.
 */
export function duplicateElementsPreservingGroups(
  elements: BoardElement[],
  selectedIds: string[],
  createId: (prefix: string) => string,
  offsetX = 24,
  offsetY = 24
): { duplicated: BoardElement[]; newSelectedIds: string[] } {
  const selectedSet = new Set(selectedIds);
  if (selectedSet.size === 0) {
    return { duplicated: [], newSelectedIds: [] };
  }

  let maxZ = elements.reduce((max, el) => Math.max(max, el.zIndex || 0), 0);
  const groupIdMap = new Map<string, string>();
  const duplicated: BoardElement[] = [];
  const newSelectedIds: string[] = [];

  // Count how many selected items share each groupId so partial copies don't create 1-item groups
  const selectedGroupCounts = new Map<string, number>();
  for (const el of elements) {
    if (!selectedSet.has(el.id) || !el.groupIds) continue;
    for (const gid of el.groupIds) {
      selectedGroupCounts.set(gid, (selectedGroupCounts.get(gid) || 0) + 1);
    }
  }

  for (const el of elements) {
    if (!selectedSet.has(el.id)) continue;
    maxZ += 1;
    const newId = createId('el');
    const shifted = translateElement(el, offsetX, offsetY);

    let mappedGroupIds: string[] | undefined;
    if (el.groupIds && el.groupIds.length > 0) {
      const nextGroups: string[] = [];
      for (const gid of el.groupIds) {
        if ((selectedGroupCounts.get(gid) || 0) < 2) continue;
        let mapped = groupIdMap.get(gid);
        if (!mapped) {
          mapped = createId('grp');
          groupIdMap.set(gid, mapped);
        }
        nextGroups.push(mapped);
      }
      if (nextGroups.length > 0) {
        mappedGroupIds = nextGroups;
      }
    }

    const copy: BoardElement = {
      ...shifted,
      id: newId,
      isLocked: false,
      zIndex: maxZ,
    };
    if (mappedGroupIds) {
      copy.groupIds = mappedGroupIds;
    } else {
      delete copy.groupIds;
    }

    duplicated.push(copy);
    newSelectedIds.push(newId);
  }

  return { duplicated, newSelectedIds };
}

/**
 * Computes bounding boxes for each distinct effective group represented in `selectedIds`,
 * used to render subtle inner group outlines in the selection overlay.
 */
export function getSelectedGroupRects(
  elements: BoardElement[],
  selectedIds: string[],
  editingGroupId: string | null = null
): { groupId: string; rect: Rect }[] {
  const idSet = new Set(selectedIds);
  const byGroup = new Map<string, string[]>();

  for (const el of elements) {
    if (!idSet.has(el.id)) continue;
    const gid = getEffectiveGroupId(el, editingGroupId);
    if (!gid) continue;
    const list = byGroup.get(gid) || [];
    list.push(el.id);
    byGroup.set(gid, list);
  }

  const result: { groupId: string; rect: Rect }[] = [];
  for (const [groupId, memberIds] of byGroup.entries()) {
    if (memberIds.length < 2) continue;
    const rect = getSelectionRect(elements, memberIds);
    if (rect) {
      result.push({ groupId, rect });
    }
  }
  return result;
}
