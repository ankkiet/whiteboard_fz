import React from 'react';
import { BoardPattern, NotebookPaperSize, ToolType } from '../../types/board';
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

export const TOOLS: ToolItem[] = [
  { id: 'select', label: 'Chọn', shortcut: 'V', icon: MousePointer2, group: 0 },
  { id: 'hand', label: 'Kéo bảng', shortcut: 'H', icon: Hand, group: 0 },
  { id: 'pen', label: 'Bút vẽ', shortcut: 'P', icon: PenTool, group: 1 },
  { id: 'highlighter', label: 'Bút dạ quang', shortcut: 'M', icon: Highlighter, group: 1 },
  { id: 'eraser', label: 'Tẩy', shortcut: 'E', icon: Eraser, group: 1 },
  { id: 'laser', label: 'Bút tia laser', shortcut: 'L', icon: Wand2, group: 1 },
  { id: 'rectangle', label: 'Hình chữ nhật', shortcut: 'R', icon: Square, group: 2 },
  { id: 'ellipse', label: 'Hình tròn', shortcut: 'O', icon: Circle, group: 2 },
  { id: 'arrow', label: 'Mũi tên', shortcut: 'A', icon: ArrowUpRight, group: 2 },
  { id: 'text', label: 'Văn bản', shortcut: 'T', icon: Type, group: 3 },
  { id: 'sticky', label: 'Ghi chú dán', shortcut: 'S', icon: StickyNote, group: 3 },
  { id: 'image', label: 'Chèn ảnh / tệp', shortcut: 'I', icon: ImageIcon, group: 3 },
];

export const INK_COLORS = [
  { hex: '#1e293b', label: 'Mực chuẩn' },
  { hex: '#4f46e5', label: 'Chàm' },
  { hex: '#2563eb', label: 'Xanh dương' },
  { hex: '#059669', label: 'Xanh lá' },
  { hex: '#d97706', label: 'Hổ phách' },
  { hex: '#e11d48', label: 'Đỏ hồng' },
  { hex: '#7c3aed', label: 'Tím' },
  { hex: '#64748b', label: 'Xám đá' },
];

export const HIGHLIGHTER_COLORS = [
  { hex: '#fde047', label: 'Vàng chanh' },
  { hex: '#86efac', label: 'Xanh bạc hà' },
  { hex: '#7dd3fc', label: 'Xanh trời' },
  { hex: '#f9a8d4', label: 'Hồng phấn' },
  { hex: '#fdba74', label: 'Cam nhạt' },
  { hex: '#c4b5fd', label: 'Tím nhạt' },
];

export const STICKY_COLORS = [
  { hex: '#fef08a', label: 'Vàng nhạt' },
  { hex: '#bbf7d0', label: 'Xanh lá nhạt' },
  { hex: '#bae6fd', label: 'Xanh dương nhạt' },
  { hex: '#fbcfe8', label: 'Hồng nhạt' },
  { hex: '#fed7aa', label: 'Cam đào' },
  { hex: '#e9d5ff', label: 'Tím oải hương' },
];

export const STROKE_WIDTHS = [
  { value: 2, label: 'Mảnh', dot: 4 },
  { value: 4, label: 'Vừa', dot: 7 },
  { value: 7, label: 'Đậm', dot: 10 },
  { value: 12, label: 'Rất đậm', dot: 14 },
];

export const ERASER_SIZES = [
  { value: 14, label: 'Nhỏ', dot: 6 },
  { value: 24, label: 'Vừa', dot: 10 },
  { value: 40, label: 'Lớn', dot: 14 },
  { value: 64, label: 'Rất lớn', dot: 18 },
];

export const PATTERNS: { id: BoardPattern; label: string }[] = [
  { id: 'plain', label: 'Trắng trơn' },
  { id: 'grid', label: 'Lưới ô ly' },
  { id: 'coordinate', label: 'Trục tọa độ Oxy' },
  { id: 'isometric', label: 'Lưới tam giác 3D' },
  { id: 'polar', label: 'Lưới tọa độ cực' },
  { id: 'dots', label: 'Chấm bi' },
  { id: 'lined', label: 'Dòng kẻ' },
];

export const NOTEBOOK_PAPER_OPTIONS: { id: NotebookPaperSize; label: string; desc: string }[] = [
  { id: 'a4', label: 'Khổ A4', desc: '210 × 297 mm' },
  { id: 'a3', label: 'Khổ A3', desc: '297 × 420 mm' },
  { id: 'b5', label: 'Khổ B5', desc: '176 × 250 mm' },
  { id: 'letter', label: 'Khổ Letter', desc: '216 × 279 mm' },
];
