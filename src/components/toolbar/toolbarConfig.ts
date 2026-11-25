import React from 'react';
import { BoardPattern, NotebookPaperSize, PenStyle, ToolType } from '../../types/board';
import { AppLanguage, getAppLanguage, tr } from '../../i18n';
import {
  ArrowUpRight,
  Circle,
  Eraser,
  Hand,
  Highlighter,
  Image as ImageIcon,
  MousePointer2,
  PenTool,
  Square,
  StickyNote,
  Type,
  Wand2,
} from 'lucide-react';

export interface ToolItem {
  id: ToolType;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
  group: number;
}

export function getTools(lang: AppLanguage = getAppLanguage()): ToolItem[] {
  return [
    { id: 'select', label: tr('Chọn', 'Select', lang), shortcut: 'V', icon: MousePointer2, group: 0 },
    { id: 'hand', label: tr('Kéo bảng', 'Pan canvas', lang), shortcut: 'H', icon: Hand, group: 0 },
    { id: 'pen', label: tr('Bút vẽ', 'Pen', lang), shortcut: 'P', icon: PenTool, group: 1 },
    { id: 'highlighter', label: tr('Bút dạ quang', 'Highlighter', lang), shortcut: 'M', icon: Highlighter, group: 1 },
    { id: 'eraser', label: tr('Tẩy', 'Eraser', lang), shortcut: 'E', icon: Eraser, group: 1 },
    { id: 'laser', label: tr('Bút tia laser', 'Laser pointer', lang), shortcut: 'L', icon: Wand2, group: 1 },
    { id: 'rectangle', label: tr('Hình chữ nhật', 'Rectangle', lang), shortcut: 'R', icon: Square, group: 2 },
    { id: 'ellipse', label: tr('Hình tròn', 'Ellipse', lang), shortcut: 'O', icon: Circle, group: 2 },
    { id: 'arrow', label: tr('Mũi tên', 'Arrow', lang), shortcut: 'A', icon: ArrowUpRight, group: 2 },
    { id: 'text', label: tr('Văn bản', 'Text', lang), shortcut: 'T', icon: Type, group: 3 },
    { id: 'sticky', label: tr('Ghi chú dán', 'Sticky note', lang), shortcut: 'S', icon: StickyNote, group: 3 },
    { id: 'image', label: tr('Chèn ảnh / tệp', 'Insert image / file', lang), shortcut: 'I', icon: ImageIcon, group: 3 },
  ];
}

export const TOOLS: ToolItem[] = getTools('vi');

export function getInkColors(lang: AppLanguage = getAppLanguage()) {
  return [
    { hex: '#1e293b', label: tr('Mực chuẩn', 'Standard ink', lang) },
    { hex: '#4f46e5', label: tr('Chàm', 'Indigo', lang) },
    { hex: '#2563eb', label: tr('Xanh dương', 'Blue', lang) },
    { hex: '#059669', label: tr('Xanh lá', 'Green', lang) },
    { hex: '#d97706', label: tr('Hổ phách', 'Amber', lang) },
    { hex: '#e11d48', label: tr('Đỏ hồng', 'Rose', lang) },
    { hex: '#7c3aed', label: tr('Tím', 'Purple', lang) },
    { hex: '#64748b', label: tr('Xám đá', 'Slate', lang) },
  ];
}

export const INK_COLORS = getInkColors('vi');

export function getHighlighterColors(lang: AppLanguage = getAppLanguage()) {
  return [
    { hex: '#fde047', label: tr('Vàng chanh', 'Yellow', lang) },
    { hex: '#86efac', label: tr('Xanh bạc hà', 'Mint green', lang) },
    { hex: '#7dd3fc', label: tr('Xanh trời', 'Sky blue', lang) },
    { hex: '#f9a8d4', label: tr('Hồng phấn', 'Pink', lang) },
    { hex: '#fdba74', label: tr('Cam nhạt', 'Light orange', lang) },
    { hex: '#c4b5fd', label: tr('Tím nhạt', 'Light purple', lang) },
  ];
}

export const HIGHLIGHTER_COLORS = getHighlighterColors('vi');

export function getStickyColors(lang: AppLanguage = getAppLanguage()) {
  return [
    { hex: '#fef08a', label: tr('Vàng nhạt', 'Light yellow', lang) },
    { hex: '#bbf7d0', label: tr('Xanh lá nhạt', 'Light green', lang) },
    { hex: '#bae6fd', label: tr('Xanh dương nhạt', 'Light blue', lang) },
    { hex: '#fbcfe8', label: tr('Hồng nhạt', 'Light pink', lang) },
    { hex: '#fed7aa', label: tr('Cam đào', 'Peach', lang) },
    { hex: '#e9d5ff', label: tr('Tím oải hương', 'Lavender', lang) },
  ];
}

export const STICKY_COLORS = getStickyColors('vi');

export function getStrokeWidths(lang: AppLanguage = getAppLanguage()) {
  return [
    { value: 2, label: tr('Mảnh', 'Thin', lang), dot: 4 },
    { value: 4, label: tr('Vừa', 'Medium', lang), dot: 7 },
    { value: 7, label: tr('Đậm', 'Thick', lang), dot: 10 },
    { value: 12, label: tr('Rất đậm', 'Extra thick', lang), dot: 14 },
  ];
}

export function getPenStyles(
  lang: AppLanguage = getAppLanguage()
): { id: PenStyle; label: string; desc: string }[] {
  return [
    {
      id: 'ballpoint',
      label: tr('Bút bi', 'Ballpoint', lang),
      desc: tr('Nét gọn đều, rõ chữ nhỏ', 'Crisp uniform ink for notes', lang),
    },
    {
      id: 'fountain',
      label: tr('Bút máy', 'Fountain', lang),
      desc: tr('Nét thanh đậm tự nhiên', 'Expressive thick & thin ink', lang),
    },
    {
      id: 'pencil',
      label: tr('Bút chì', 'Pencil', lang),
      desc: tr('Vân chì mộc trên giấy', 'Textured graphite feel', lang),
    },
    {
      id: 'brush',
      label: tr('Bút lông', 'Brush', lang),
      desc: tr('Cọ mềm vuốt nét đậm', 'Soft tapered brush strokes', lang),
    },
  ];
}

export const STROKE_WIDTHS = getStrokeWidths('vi');

export function getEraserSizes(lang: AppLanguage = getAppLanguage()) {
  return [
    { value: 14, label: tr('Nhỏ', 'Small', lang), dot: 6 },
    { value: 24, label: tr('Vừa', 'Medium', lang), dot: 10 },
    { value: 40, label: tr('Lớn', 'Large', lang), dot: 14 },
    { value: 64, label: tr('Rất lớn', 'Extra large', lang), dot: 18 },
  ];
}

export const ERASER_SIZES = getEraserSizes('vi');

export function getPatterns(lang: AppLanguage = getAppLanguage()): { id: BoardPattern; label: string }[] {
  return [
    { id: 'plain', label: tr('Trắng trơn', 'Blank', lang) },
    { id: 'grid', label: tr('Lưới ô ly', 'Square grid', lang) },
    { id: 'coordinate', label: tr('Trục tọa độ Oxy', 'Oxy coordinate axes', lang) },
    { id: 'isometric', label: tr('Lưới tam giác 3D', '3D isometric grid', lang) },
    { id: 'polar', label: tr('Lưới tọa độ cực', 'Polar grid', lang) },
    { id: 'dots', label: tr('Chấm bi', 'Dot grid', lang) },
    { id: 'lined', label: tr('Dòng kẻ', 'Lined', lang) },
  ];
}

export const PATTERNS: { id: BoardPattern; label: string }[] = getPatterns('vi');

export function getNotebookPaperOptions(
  lang: AppLanguage = getAppLanguage()
): { id: NotebookPaperSize; label: string; desc: string }[] {
  return [
    { id: 'a4', label: tr('Khổ A4', 'A4 size', lang), desc: '210 × 297 mm' },
    { id: 'a3', label: tr('Khổ A3', 'A3 size', lang), desc: '297 × 420 mm' },
    { id: 'b5', label: tr('Khổ B5', 'B5 size', lang), desc: '176 × 250 mm' },
    { id: 'letter', label: tr('Khổ Letter', 'Letter size', lang), desc: '216 × 279 mm' },
  ];
}

export const NOTEBOOK_PAPER_OPTIONS: { id: NotebookPaperSize; label: string; desc: string }[] =
  getNotebookPaperOptions('vi');
