import { AppLanguage, getAppLanguage, tr } from '../i18n';
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

interface BoardTemplateLocalizedDef {
  id: BoardType;
  name: { vi: string; en: string };
  shortName: { vi: string; en: string };
  defaultTitle: { vi: string; en: string };
  description: { vi: string; en: string };
  pattern: BoardPattern;
  defaultTool: ToolType;
  centerOriginCamera: boolean;
}

const BOARD_TEMPLATE_DEFS: BoardTemplateLocalizedDef[] = [
  {
    id: 'basic',
    name: { vi: 'Bảng trắng cơ bản', en: 'Basic whiteboard' },
    shortName: { vi: 'Cơ bản', en: 'Basic' },
    defaultTitle: { vi: 'Bảng trắng mới', en: 'Untitled board' },
    description: {
      vi: 'Khung vẽ vô tận nền ô ly nhẹ để viết tay, vẽ hình và ghi chú tự do',
      en: 'Infinite grid canvas for handwriting, sketching shapes, and freeform notes',
    },
    pattern: 'grid',
    defaultTool: 'pen',
    centerOriginCamera: false,
  },
  {
    id: 'math',
    name: { vi: 'Bảng trắng toán học', en: 'Math whiteboard' },
    shortName: { vi: 'Toán học', en: 'Math' },
    defaultTitle: { vi: 'Bảng toán học mới', en: 'Untitled math board' },
    description: {
      vi: 'Nền ô ly gọn gàng kèm công cụ soạn công thức, dựng hình học và vẽ đồ thị',
      en: 'Clean grid canvas with formula editor, geometry tools, and function graphing',
    },
    pattern: 'grid',
    defaultTool: 'pen',
    centerOriginCamera: true,
  },
  {
    id: 'notebook',
    name: { vi: 'Vở ghi chú dòng kẻ', en: 'Ruled notebook' },
    shortName: { vi: 'Ghi chú', en: 'Notebook' },
    defaultTitle: { vi: 'Ghi chú mới', en: 'Untitled notebook' },
    description: {
      vi: 'Nền dòng kẻ ngay ngắn, tối ưu cho ghi chép bài giảng và tóm tắt nội dung',
      en: 'Structured lined pages optimized for lecture notes and study summaries',
    },
    pattern: 'lined',
    defaultTool: 'pen',
    centerOriginCamera: false,
  },
  {
    id: 'mindmap',
    name: { vi: 'Sơ đồ tư duy', en: 'Mind map' },
    shortName: { vi: 'Sơ đồ tư duy', en: 'Mind map' },
    defaultTitle: { vi: 'Sơ đồ tư duy mới', en: 'Untitled mind map' },
    description: {
      vi: 'Nền chấm bi kèm khung chủ đề trung tâm và các nhánh gợi ý sẵn',
      en: 'Dotted canvas with a central topic node and starter branches ready to edit',
    },
    pattern: 'dots',
    defaultTool: 'select',
    centerOriginCamera: true,
  },
];

export function getBoardTemplates(lang: AppLanguage = getAppLanguage()): BoardTemplateConfig[] {
  return BOARD_TEMPLATE_DEFS.map((def) => ({
    id: def.id,
    name: def.name[lang],
    shortName: def.shortName[lang],
    defaultTitle: def.defaultTitle[lang],
    description: def.description[lang],
    pattern: def.pattern,
    defaultTool: def.defaultTool,
    centerOriginCamera: def.centerOriginCamera,
  }));
}

export const BOARD_TEMPLATES: BoardTemplateConfig[] = getBoardTemplates('vi');

export function getBoardTemplate(
  type: BoardType,
  lang: AppLanguage = getAppLanguage()
): BoardTemplateConfig {
  const templates = getBoardTemplates(lang);
  return templates.find((t) => t.id === type) || templates[0];
}

export function getBoardTypeLabel(
  type: BoardType,
  lang: AppLanguage = getAppLanguage()
): string {
  return getBoardTemplate(type, lang).shortName;
}

export function isDefaultBoardTitle(title: string): boolean {
  const trimmed = title.trim();
  return BOARD_TEMPLATE_DEFS.some(
    (def) => def.defaultTitle.vi === trimmed || def.defaultTitle.en === trimmed
  );
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
  createId: (prefix: string) => string,
  lang: AppLanguage = getAppLanguage()
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
      title: tr('Ý tưởng chính 1', 'Main idea 1', lang),
      anchorStart: { x: 110, y: -22 },
      anchorEnd: { x: 236, y: -116 },
    },
    {
      x: 240,
      y: 78,
      color: '#059669',
      title: tr('Ý tưởng chính 2', 'Main idea 2', lang),
      anchorStart: { x: 110, y: 22 },
      anchorEnd: { x: 236, y: 112 },
    },
    {
      x: -420,
      y: -36,
      color: '#d97706',
      title: tr('Ghi chú & bước làm', 'Notes & next steps', lang),
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
      text: tr('Chủ đề trung tâm', 'Central topic', lang),
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
