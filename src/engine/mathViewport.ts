import { Camera } from '../types/board';
import { VirtualGeometryToolsState } from './mathCurriculum';

export interface SafeViewportOptions {
  viewW: number;
  viewH: number;
  isMathPanelOpen: boolean;
  isMathPanelCollapsed?: boolean;
  isCalculatorOpen: boolean;
  isCalculatorMinimized?: boolean;
  calculatorX?: number;
  hasPinnedProblem?: boolean;
  isPinnedProblemCollapsed?: boolean;
  hasContextualToolbar?: boolean;
}

export interface SafeViewportRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * Computes the unobstructed canvas rectangle in screen pixels
 * when floating panels (MathPanel, Casio fx-580VN X, PinnedProblemBar, BottomDock) are open.
 */
export function getSafeMathViewport(opts: SafeViewportOptions): SafeViewportRect {
  const viewW = Math.max(360, opts.viewW || 1280);
  const viewH = Math.max(480, opts.viewH || 800);

  // Left inset: reserve space for Casio calculator if it is open on the left half of the screen
  let left = 16;
  if (opts.isCalculatorOpen && !opts.isCalculatorMinimized) {
    const calcX = opts.calculatorX ?? 16;
    const calcWidth = 316;
    // Only reserve left margin if the calculator sits on the left side and leaves enough room
    if (calcX < viewW * 0.45 && viewW >= 900) {
      left = Math.min(viewW * 0.38, Math.max(16, calcX + calcWidth + 14));
    }
  }

  // Right inset: reserve space for MathPanel (expanded = 324px + 16px margin, collapsed rail = 60px)
  let rightMargin = 16;
  if (opts.isMathPanelOpen) {
    if (opts.isMathPanelCollapsed) {
      rightMargin = 64;
    } else if (viewW >= 768) {
      rightMargin = Math.min(viewW * 0.38, 336);
    }
  }
  const right = Math.max(left + 200, viewW - rightMargin);

  // Top inset: TopLeftBar/TopRightBar (~60px) + PinnedProblemBar if present
  let top = 62;
  if (opts.hasPinnedProblem) {
    top = opts.isPinnedProblemCollapsed ? 104 : 168;
  }

  // Bottom inset: BottomDock (~64px) + ContextualToolbar (~52px if visible)
  const bottomMargin = opts.hasContextualToolbar ? 118 : 72;
  const bottom = Math.max(top + 180, viewH - bottomMargin);

  const width = Math.max(200, right - left);
  const height = Math.max(180, bottom - top);

  return {
    left: Math.round(left),
    top: Math.round(top),
    right: Math.round(right),
    bottom: Math.round(bottom),
    width: Math.round(width),
    height: Math.round(height),
    centerX: Math.round(left + width / 2),
    centerY: Math.round(top + height / 2),
  };
}

/**
 * Computes a world-coordinate insertion center inside the unobstructed safe viewport,
 * staggering consecutive insertions within compact bounds so they never land under side panels.
 */
export function computeSafeWorldCenter(
  camera: Camera,
  safeRect: SafeViewportRect,
  stepIndex = 0
): { x: number; y: number } {
  const maxDx = Math.min(105, Math.max(36, Math.round(safeRect.width * 0.16)));
  const maxDy = Math.min(75, Math.max(28, Math.round(safeRect.height * 0.15)));

  const offsets: [number, number][] = [
    [0, 0],
    [-maxDx, -maxDy],
    [maxDx, -maxDy],
    [-maxDx, maxDy],
    [maxDx, maxDy],
    [0, -maxDy],
    [0, maxDy],
  ];

  const [dx, dy] = offsets[Math.abs(stepIndex) % offsets.length];
  const screenX = safeRect.centerX + dx;
  const screenY = safeRect.centerY + dy;

  const zoom = camera.zoom || 1;
  return {
    x: (screenX - camera.x) / zoom,
    y: (screenY - camera.y) / zoom,
  };
}

/**
 * Computes non-overlapping world positions for all 4 virtual geometry instruments
 * so that turning on multiple instruments (Thước kẻ, Ê-ke, Thước đo độ, Compa)
 * arranges them neatly inside the unobstructed safe canvas area instead of piling on top of each other.
 */
export function computeVirtualToolSafePoses(
  virtualTools: VirtualGeometryToolsState,
  camera: Camera,
  safeRect: SafeViewportRect
): VirtualGeometryToolsState {
  const zoom = camera.zoom || 1;
  const cx = (safeRect.centerX - camera.x) / zoom;
  const cy = (safeRect.centerY - camera.y) / zoom;

  const activeKeys = (
    ['ruler', 'setSquare', 'protractor', 'compass'] as (keyof VirtualGeometryToolsState)[]
  ).filter((k) => virtualTools[k].active);

  const isMulti = activeKeys.length > 1;
  const spreadX = Math.min(140, Math.max(85, (safeRect.width / zoom) * 0.2));
  const spreadY = Math.min(115, Math.max(70, (safeRect.height / zoom) * 0.22));

  const rulerLen = virtualTools.ruler.length || 320;
  const rulerH = virtualTools.ruler.height || 48;
  const setSquareA = virtualTools.setSquare.legA || 190;

  return {
    ruler: {
      ...virtualTools.ruler,
      x: Math.round(cx - rulerLen / 2),
      y: Math.round(isMulti ? cy - spreadY * 1.45 - rulerH : cy - rulerH / 2),
      angle: 0,
    },
    setSquare: {
      ...virtualTools.setSquare,
      x: Math.round(isMulti ? cx - spreadX - setSquareA * 0.5 : cx - setSquareA / 2),
      y: Math.round(isMulti ? cy + spreadY + 42 : cy + 55),
      angle: 0,
    },
    protractor: {
      ...virtualTools.protractor,
      x: Math.round(isMulti ? cx + spreadX * 0.85 : cx),
      y: Math.round(isMulti ? cy + 12 : cy + 25),
      angle: 0,
    },
    compass: {
      ...virtualTools.compass,
      cx: Math.round(isMulti ? cx + spreadX * 0.85 : cx),
      cy: Math.round(isMulti ? cy + spreadY * 1.1 + 24 : cy),
    },
  };
}
