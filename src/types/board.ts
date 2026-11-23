export type ToolType =
  | 'select'
  | 'hand'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'rectangle'
  | 'ellipse'
  | 'arrow'
  | 'text'
  | 'sticky'
  | 'image'
  | 'laser';

export type EraserMode = 'stroke' | 'area';

export type BoardType = 'basic' | 'math' | 'notebook' | 'mindmap';

export type NotebookPaperSize = 'a4' | 'a3' | 'b5' | 'letter';

export interface NotebookPageConfig {
  id: NotebookPaperSize;
  name: string;
  label: string;
  width: number;
  height: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  lineSpacing: number;
}

export type MathGradeMode = 'primary' | 'middle' | 'high';

export type BoardPattern =
  | 'plain'
  | 'grid'
  | 'dots'
  | 'lined'
  | 'coordinate'
  | 'isometric'
  | 'polar';

export type ElementType =
  | 'stroke'
  | 'highlighter'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'text'
  | 'formula'
  | 'reveal'
  | 'sticky'
  | 'image'
  | 'file-card';

export type FileCategory = 'pdf' | 'word' | 'sheet' | 'slide' | 'text' | 'other';

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  isLocked?: boolean;
  /** Group hierarchy ordered from innermost group ID to outermost group ID */
  groupIds?: string[];
  zIndex: number;
}

export interface StrokeElement extends BaseElement {
  type: 'stroke' | 'highlighter';
  points: [number, number, number][]; // world [x, y, pressure]
  color: string;
  strokeWidth: number;
}

export interface ShapeElement extends BaseElement {
  type: 'rectangle' | 'ellipse' | 'line' | 'arrow';
  color: string;
  strokeWidth: number;
  fillColor?: string;
  dashed?: boolean;
  /** Optional pie-wedge angles (radians) when type === 'ellipse' */
  sectorStartAngle?: number;
  sectorEndAngle?: number;
  /** For arrow/line: explicit start & end points in world coords */
  startPoint?: Point;
  endPoint?: Point;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  color: string;
  fontSize: number;
}

export interface FormulaElement extends BaseElement {
  type: 'formula';
  latex: string;
  color: string;
  fontSize: number;
}

export interface RevealElement extends BaseElement {
  type: 'reveal';
  label?: string;
  revealed: boolean;
  color: string;
}

export interface StickyElement extends BaseElement {
  type: 'sticky';
  text: string;
  color: string; // background color
  fontSize: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  assetId: string;
  fileName?: string;
  naturalWidth?: number;
  naturalHeight?: number;
}

export interface FileCardElement extends BaseElement {
  type: 'file-card';
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileCategory: FileCategory;
  assetId: string;
  pageCount?: number;
  previewText?: string;
}

export type BoardElement =
  | StrokeElement
  | ShapeElement
  | TextElement
  | FormulaElement
  | RevealElement
  | StickyElement
  | ImageElement
  | FileCardElement;

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface LaserPoint {
  x: number; // world x
  y: number; // world y
  timestamp: number;
  strokeId: number;
}

export interface ToastMessage {
  id: string;
  text: string;
  variant?: 'info' | 'success' | 'error';
}
