import { BoardElement, BoardPattern, BoardType, ToolType } from '../types/board';

export interface BoardTemplateConfig {
  id: BoardType;
  name: string;
  shortName: string;
  defaultTitle: string;
  description: string;
  pattern: BoardPattern;
  defaultTool: ToolType;
  centerOriginCamera: boolean;
}

export const BOARD_TEMPLATES: BoardTemplateConfig[] = [
  {
    id: 'basic',
    name: 'Bảng trắng cơ bản',
    shortName: 'Cơ bản',
    defaultTitle: 'Bảng trắng mới',
    description: 'Khung vẽ vô tận nền ô ly nhẹ để viết tay, vẽ hình và ghi chú tự do',
    pattern: 'grid',
    defaultTool: 'pen',
    centerOriginCamera: false,
  },
  {
    id: 'math',
    name: 'Bảng trắng toán học',
    shortName: 'Toán học',
    defaultTitle: 'Bảng toán học mới',
    description: 'Nền ô ly gọn gàng kèm công cụ soạn công thức, dựng hình học và vẽ đồ thị',
    pattern: 'grid',
    defaultTool: 'pen',
    centerOriginCamera: true,
  },
  {
    id: 'notebook',
    name: 'Vở ghi chú dòng kẻ',
    shortName: 'Ghi chú',
    defaultTitle: 'Ghi chú mới',
    description: 'Nền dòng kẻ ngay ngắn, tối ưu cho ghi chép bài giảng và tóm tắt nội dung',
    pattern: 'lined',
    defaultTool: 'pen',
    centerOriginCamera: false,
  },
  {
    id: 'mindmap',
    name: 'Sơ đồ tư duy',
    shortName: 'Sơ đồ tư duy',
    defaultTitle: 'Sơ đồ tư duy mới',
    description: 'Nền chấm bi kèm khung chủ đề trung tâm và các nhánh gợi ý sẵn',
    pattern: 'dots',
    defaultTool: 'select',
    centerOriginCamera: true,
  },
];

export function getBoardTemplate(type: BoardType): BoardTemplateConfig {
  return BOARD_TEMPLATES.find((t) => t.id === type) || BOARD_TEMPLATES[0];
}

export function getBoardTypeLabel(type: BoardType): string {
  return getBoardTemplate(type).shortName;
}

export function normalizeBoardType(raw: unknown): BoardType {
  if (raw === 'math' || raw === 'notebook' || raw === 'mindmap' || raw === 'basic') {
    return raw;
  }
  return 'basic';
}

export function normalizeMathGradeMode(raw: unknown): 'primary' | 'middle' | 'high' {
  if (raw === 'primary' || raw === 'middle' || raw === 'high') {
    return raw;
  }
  return 'high';
}

export function normalizeBoardPattern(raw: unknown): BoardPattern {
  if (
    raw === 'plain' ||
    raw === 'grid' ||
    raw === 'dots' ||
    raw === 'lined' ||
    raw === 'coordinate' ||
    raw === 'isometric' ||
    raw === 'polar'
  ) {
    return raw;
  }
  return 'grid';
}

/**
 * Generates clean starter elements for structured templates (e.g. mindmap).
 * Basic, Math, and Notebook boards start with a clean canvas so the user can write immediately.
 */
export function buildStarterElementsForTemplate(
  type: BoardType,
  createId: (prefix: string) => string
): BoardElement[] {
  if (type !== 'mindmap') {
    return [];
  }

  let z = 0;
  const nextZ = () => {
    z += 1;
    return z;
  };

  const centerBoxId = createId('el');
  const centerTextId = createId('el');
  const centerGroupId = createId('grp');

  const branches: { x: number; y: number; color: string; title: string; anchorEnd: { x: number; y: number }; anchorStart: { x: number; y: number } }[] = [
    {
      x: 240,
      y: -150,
      color: '#2563eb',
      title: 'Ý tưởng chính 1',
      anchorStart: { x: 110, y: -22 },
      anchorEnd: { x: 236, y: -116 },
    },
    {
      x: 240,
      y: 78,
      color: '#059669',
      title: 'Ý tưởng chính 2',
      anchorStart: { x: 110, y: 22 },
      anchorEnd: { x: 236, y: 112 },
    },
    {
      x: -420,
      y: -36,
      color: '#d97706',
      title: 'Ghi chú & bước làm',
      anchorStart: { x: -110, y: 0 },
      anchorEnd: { x: -236, y: 0 },
    },
  ];

  const elements: BoardElement[] = [
    {
      id: centerBoxId,
      type: 'rectangle',
      x: -110,
      y: -44,
      width: 220,
      height: 88,
      color: '#4f46e5',
      fillColor: '#4f46e51c',
      strokeWidth: 3,
      groupIds: [centerGroupId],
      zIndex: nextZ(),
    },
    {
      id: centerTextId,
      type: 'text',
      x: -88,
      y: -16,
      width: 176,
      height: 36,
      text: 'Chủ đề trung tâm',
      color: '#4f46e5',
      fontSize: 20,
      groupIds: [centerGroupId],
      zIndex: nextZ(),
    },
  ];

  for (const branch of branches) {
    const branchGroupId = createId('grp');
    elements.push(
      {
        id: createId('el'),
        type: 'arrow',
        x: Math.min(branch.anchorStart.x, branch.anchorEnd.x),
        y: Math.min(branch.anchorStart.y, branch.anchorEnd.y),
        width: Math.abs(branch.anchorEnd.x - branch.anchorStart.x),
        height: Math.abs(branch.anchorEnd.y - branch.anchorStart.y),
        startPoint: branch.anchorStart,
        endPoint: branch.anchorEnd,
        color: branch.color,
        strokeWidth: 2.5,
        zIndex: nextZ(),
      },
      {
        id: createId('el'),
        type: 'rectangle',
        x: branch.x,
        y: branch.y,
        width: 180,
        height: 72,
        color: branch.color,
        fillColor: `${branch.color}18`,
        strokeWidth: 2.5,
        groupIds: [branchGroupId],
        zIndex: nextZ(),
      },
      {
        id: createId('el'),
        type: 'text',
        x: branch.x + 18,
        y: branch.y + 22,
        width: 148,
        height: 32,
        text: branch.title,
        color: branch.color,
        fontSize: 16,
        groupIds: [branchGroupId],
        zIndex: nextZ(),
      }
    );
  }

  return elements;
}
