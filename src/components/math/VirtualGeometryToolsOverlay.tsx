import React from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { screenToWorld } from '../../engine/geometry';
import { getSafeMathViewport } from '../../engine/mathViewport';
import { BoardElement, ShapeElement, StrokeElement } from '../../types/board';
import { useI18n } from '../../i18n/useI18n';
import { RotateCw, X, Circle, Spline, LayoutGrid } from 'lucide-react';

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export const VirtualGeometryToolsOverlay: React.FC = () => {
  const { t } = useI18n();
  const virtualTools = useBoardStore((s) => s.virtualTools);
  const updateVirtualTool = useBoardStore((s) => s.updateVirtualTool);
  const toggleVirtualTool = useBoardStore((s) => s.toggleVirtualTool);
  const arrangeVirtualTools = useBoardStore((s) => s.arrangeVirtualTools);
  const hideAllVirtualTools = useBoardStore((s) => s.hideAllVirtualTools);
  const camera = useBoardStore((s) => s.camera);
  const isCalculatorOpen = useBoardStore((s) => s.isCalculatorOpen);
  const isCalculatorMinimized = useBoardStore((s) => s.isCalculatorMinimized);
  const boardType = useBoardStore((s) => s.boardType);
  const isMathPanelCollapsed = useBoardStore((s) => s.isMathPanelCollapsed);
  const pinnedProblem = useBoardStore((s) => s.pinnedProblem);
  const selectedIds = useBoardStore((s) => s.selectedIds);
  const addElementsBatch = useBoardStore((s) => s.addElementsBatch);
  const addToast = useBoardStore((s) => s.addToast);

  const { ruler, setSquare, protractor, compass } = virtualTools;
  const anyActive = ruler.active || setSquare.active || protractor.active || compass.active;
  if (!anyActive) return null;

  const safeRect = getSafeMathViewport({
    viewW: typeof window !== 'undefined' ? window.innerWidth : 1280,
    viewH: typeof window !== 'undefined' ? window.innerHeight : 800,
    isCalculatorOpen,
    isCalculatorMinimized,
    isMathPanelOpen: boardType === 'math',
    isMathPanelCollapsed,
    hasPinnedProblem: Boolean(pinnedProblem),
    hasContextualToolbar: selectedIds.length > 0,
  });

  const startDragPosition = (
    e: React.PointerEvent,
    initialX: number,
    initialY: number,
    onUpdate: (nx: number, ny: number) => void
  ) => {
    e.stopPropagation();
    const startWorld = screenToWorld(e.clientX, e.clientY, useBoardStore.getState().camera, {
      left: 0,
      top: 0,
    });
    const onMove = (ev: PointerEvent) => {
      const curWorld = screenToWorld(ev.clientX, ev.clientY, useBoardStore.getState().camera, {
        left: 0,
        top: 0,
      });
      onUpdate(initialX + (curWorld.x - startWorld.x), initialY + (curWorld.y - startWorld.y));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startRotate = (
    e: React.PointerEvent,
    pivotWorldX: number,
    pivotWorldY: number,
    onAngle: (angleRad: number) => void
  ) => {
    e.stopPropagation();
    const onMove = (ev: PointerEvent) => {
      const curWorld = screenToWorld(ev.clientX, ev.clientY, useBoardStore.getState().camera, {
        left: 0,
        top: 0,
      });
      let ang = Math.atan2(curWorld.y - pivotWorldY, curWorld.x - pivotWorldX);
      if (ev.shiftKey) {
        const snap = Math.PI / 12; // 15° snap
        ang = Math.round(ang / snap) * snap;
      }
      onAngle(ang);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startCompassRadiusDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    const onMove = (ev: PointerEvent) => {
      const state = useBoardStore.getState();
      const curWorld = screenToWorld(ev.clientX, ev.clientY, state.camera, { left: 0, top: 0 });
      const { cx, cy } = state.virtualTools.compass;
      const dist = Math.max(32, Math.min(340, Math.hypot(curWorld.x - cx, curWorld.y - cy)));
      const ang = Math.atan2(curWorld.y - cy, curWorld.x - cx);
      updateVirtualTool('compass', { radius: dist, angle: ang });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleCompassDraw = (arcDegrees: 360 | 180) => {
    const state = useBoardStore.getState();
    const { cx, cy, radius, angle } = state.virtualTools.compass;
    const maxZ = state.elements.reduce((m, el) => Math.max(m, el.zIndex || 0), 0);
    const groupId = uid('grp');

    if (arcDegrees === 360) {
      const circleEl: ShapeElement = {
        id: uid('el'),
        type: 'ellipse',
        x: cx - radius,
        y: cy - radius,
        width: radius * 2,
        height: radius * 2,
        color: state.color,
        fillColor: 'transparent',
        strokeWidth: Math.max(2, state.strokeWidth * 0.65),
        groupIds: [groupId],
        zIndex: maxZ + 1,
      };
      const centerDot: ShapeElement = {
        id: uid('el'),
        type: 'ellipse',
        x: cx - 3.5,
        y: cy - 3.5,
        width: 7,
        height: 7,
        color: state.color,
        fillColor: state.color,
        strokeWidth: 1.5,
        groupIds: [groupId],
        zIndex: maxZ + 2,
      };
      addElementsBatch([circleEl, centerDot], false);
      addToast(
        t(
          `Đã vẽ đường tròn bán kính R = ${(radius / 40).toFixed(1)} cm`,
          `Drew circle with radius R = ${(radius / 40).toFixed(1)} cm`
        ),
        'success'
      );
      return;
    }

    // 180° arc as smooth stroke
    const pts: [number, number, number][] = [];
    const steps = 48;
    for (let i = 0; i <= steps; i += 1) {
      const a = angle + (i / steps) * Math.PI;
      pts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a), 0.5]);
    }
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const arcEl: StrokeElement = {
      id: uid('el'),
      type: 'stroke',
      x: minX,
      y: minY,
      width: Math.max(1, Math.max(...xs) - minX),
      height: Math.max(1, Math.max(...ys) - minY),
      points: pts,
      color: state.color,
      strokeWidth: Math.max(2, state.strokeWidth * 0.65),
      zIndex: maxZ + 1,
    };
    addElementsBatch([arcEl as BoardElement], false);
    addToast(
      t(
        `Đã vẽ cung tròn 180° (R = ${(radius / 40).toFixed(1)} cm)`,
        `Drew 180° arc (R = ${(radius / 40).toFixed(1)} cm)`
      ),
      'success'
    );
  };

  return (
    <div
      data-testid="virtual-geometry-tools-overlay"
      className="pointer-events-none absolute inset-0 z-15 overflow-hidden select-none"
    >
      {/* Floating compact virtual geometry instrument manager at top of safe viewport */}
      <div
        data-testid="virtual-tools-floating-bar"
        style={{
          left: safeRect.centerX,
          top: Math.max(58, safeRect.top - 4),
        }}
        className="pointer-events-auto absolute -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/92 dark:bg-slate-900/92 backdrop-blur-md border border-indigo-200/80 dark:border-indigo-800/80 shadow-md text-[11px]"
      >
        <span className="font-semibold text-slate-600 dark:text-slate-300 px-1">
          {t('Dụng cụ hình học:', 'Drafting tools:')}
        </span>
        {ruler.active && (
          <button
            type="button"
            onClick={() => toggleVirtualTool('ruler')}
            title={t('Ẩn Thước kẻ', 'Hide ruler')}
            className="h-5 px-2 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 font-semibold inline-flex items-center gap-1 cursor-pointer hover:bg-amber-200/80"
          >
            <span>{t('Thước', 'Ruler')}</span>
            <X className="w-2.5 h-2.5" />
          </button>
        )}
        {setSquare.active && (
          <button
            type="button"
            onClick={() => toggleVirtualTool('setSquare')}
            title={t('Ẩn Ê-ke', 'Hide set square')}
            className="h-5 px-2 rounded-full bg-sky-100 dark:bg-sky-950/70 text-sky-900 dark:text-sky-300 font-semibold inline-flex items-center gap-1 cursor-pointer hover:bg-sky-200/80"
          >
            <span>{t('Ê-ke', 'Set square')}</span>
            <X className="w-2.5 h-2.5" />
          </button>
        )}
        {protractor.active && (
          <button
            type="button"
            onClick={() => toggleVirtualTool('protractor')}
            title={t('Ẩn Đo độ', 'Hide protractor')}
            className="h-5 px-2 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 font-semibold inline-flex items-center gap-1 cursor-pointer hover:bg-emerald-200/80"
          >
            <span>{t('Đo độ', 'Protractor')}</span>
            <X className="w-2.5 h-2.5" />
          </button>
        )}
        {compass.active && (
          <button
            type="button"
            onClick={() => toggleVirtualTool('compass')}
            title={t('Ẩn Compa', 'Hide compass')}
            className="h-5 px-2 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-300 font-semibold inline-flex items-center gap-1 cursor-pointer hover:bg-indigo-200/80"
          >
            <span>{t('Compa', 'Compass')}</span>
            <X className="w-2.5 h-2.5" />
          </button>
        )}
        <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
        <button
          type="button"
          data-testid="floating-arrange-virtual-tools-button"
          onClick={() => arrangeVirtualTools()}
          title={t(
            'Xếp gọn các thước & compa vào vùng trống để không đè lên nhau',
            'Arrange rulers & compass cleanly without overlap'
          )}
          className="h-5 px-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
        >
          <LayoutGrid className="w-2.5 h-2.5" />
          <span>{t('Xếp gọn', 'Arrange')}</span>
        </button>
        <button
          type="button"
          data-testid="floating-hide-all-virtual-tools-button"
          onClick={() => hideAllVirtualTools()}
          title={t('Ẩn toàn bộ dụng cụ hình học', 'Hide all drafting tools')}
          className="h-5 px-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-600 dark:text-slate-300 hover:text-rose-600 font-semibold cursor-pointer"
        >
          {t('Ẩn hết', 'Hide all')}
        </button>
      </div>

      {/* 1. VIRTUAL RULER (Thước kẻ có chia vạch cm/mm + hút nét bút vào cạnh thước) */}
      {ruler.active && (
        <div
          data-testid="virtual-ruler"
          style={{
            left: ruler.x * camera.zoom + camera.x,
            top: ruler.y * camera.zoom + camera.y,
            width: ruler.length * camera.zoom,
            height: ruler.height * camera.zoom,
            transform: `rotate(${ruler.angle}rad)`,
            transformOrigin: '0 0',
          }}
          onPointerDown={(e) =>
            startDragPosition(e, ruler.x, ruler.y, (nx, ny) =>
              updateVirtualTool('ruler', { x: nx, y: ny })
            )
          }
          className="pointer-events-auto absolute rounded-md bg-amber-100/80 dark:bg-amber-200/80 backdrop-blur-[2px] border border-amber-500/80 shadow-md cursor-grab active:cursor-grabbing text-slate-900"
        >
          {/* Metric Ticks along top measuring edge (1cm = 40 world px) */}
          <svg className="w-full h-full pointer-events-none" preserveAspectRatio="none">
            {Array.from({ length: Math.floor(ruler.length / 4) + 1 }, (_, i) => {
              const worldPx = i * 4;
              const screenX = worldPx * camera.zoom;
              const isCm = i % 10 === 0;
              const isHalfCm = i % 5 === 0 && !isCm;
              const tickH = isCm ? 15 : isHalfCm ? 10 : 6;
              return (
                <g key={i}>
                  <line
                    x1={screenX}
                    y1={0}
                    x2={screenX}
                    y2={tickH}
                    stroke="#334155"
                    strokeWidth={isCm ? 1.4 : 0.8}
                  />
                  {isCm && i > 0 && worldPx < ruler.length - 12 && (
                    <text
                      x={screenX - 3}
                      y={26}
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="600"
                      fill="#1e293b"
                    >
                      {i / 10}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Angle indicator + rotate + close controls */}
          <div className="absolute right-2 bottom-1.5 flex items-center gap-1.5">
            <span className="text-[10px] font-mono font-semibold text-amber-950/80 tabular-nums">
              {Math.round(((ruler.angle * 180) / Math.PI + 360) % 360)}° ·{' '}
              {t('Hút nét bút', 'Snap edge')}
            </span>
            <button
              type="button"
              aria-label={t('Xoay thước kẻ', 'Rotate ruler')}
              title={t('Kéo để xoay thước (giữ Shift xoay mỗi 15°)', 'Drag to rotate (hold Shift for 15° snap)')}
              onPointerDown={(e) =>
                startRotate(e, ruler.x, ruler.y, (ang) => updateVirtualTool('ruler', { angle: ang }))
              }
              className="w-5 h-5 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center cursor-ew-resize"
            >
              <RotateCw className="w-3 h-3" />
            </button>
            <button
              type="button"
              aria-label={t('Ẩn thước kẻ', 'Hide ruler')}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => toggleVirtualTool('ruler')}
              className="w-5 h-5 rounded-full bg-slate-800/80 hover:bg-slate-900 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 2. VIRTUAL SET SQUARE (Thước Ê-ke vuông góc 90° + hút nét bút) */}
      {setSquare.active && (
        <div
          data-testid="virtual-set-square"
          style={{
            left: setSquare.x * camera.zoom + camera.x,
            top: (setSquare.y - setSquare.legB) * camera.zoom + camera.y,
            width: setSquare.legA * camera.zoom,
            height: setSquare.legB * camera.zoom,
            transform: `rotate(${setSquare.angle}rad)`,
            transformOrigin: `0 ${setSquare.legB * camera.zoom}px`,
          }}
          className="pointer-events-none absolute"
        >
          <svg
            viewBox={`0 0 ${setSquare.legA} ${setSquare.legB}`}
            className="w-full h-full overflow-visible"
          >
            <polygon
              points={`0,${setSquare.legB} ${setSquare.legA},${setSquare.legB} 0,0`}
              fill="rgba(56, 189, 248, 0.24)"
              stroke="#0284c7"
              strokeWidth="2"
              className="pointer-events-auto cursor-grab active:cursor-grabbing"
              onPointerDown={(e) =>
                startDragPosition(e, setSquare.x, setSquare.y, (nx, ny) =>
                  updateVirtualTool('setSquare', { x: nx, y: ny })
                )
              }
            />
            {/* Inner cutout triangle */}
            <polygon
              points={`28,${setSquare.legB - 24} ${setSquare.legA - 68},${setSquare.legB - 24} 28,54`}
              fill="rgba(255,255,255,0.45)"
              stroke="#0284c7"
              strokeWidth="1"
              strokeOpacity="0.55"
            />
            {/* Right-angle marker */}
            <polyline
              points={`0,${setSquare.legB - 16} 16,${setSquare.legB - 16} 16,${setSquare.legB}`}
              fill="none"
              stroke="#0369a1"
              strokeWidth="1.5"
            />
          </svg>
          <div className="pointer-events-auto absolute left-2 bottom-2 flex items-center gap-1">
            <span className="text-[10px] font-mono font-bold text-sky-900 bg-white/80 px-1 rounded">
              90° · {Math.round(((setSquare.angle * 180) / Math.PI + 360) % 360)}°
            </span>
            <button
              type="button"
              aria-label={t('Xoay thước Ê-ke', 'Rotate set square')}
              onPointerDown={(e) =>
                startRotate(e, setSquare.x, setSquare.y, (ang) =>
                  updateVirtualTool('setSquare', { angle: ang })
                )
              }
              className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center cursor-ew-resize"
            >
              <RotateCw className="w-3 h-3" />
            </button>
            <button
              type="button"
              aria-label={t('Ẩn thước Ê-ke', 'Hide set square')}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => toggleVirtualTool('setSquare')}
              className="w-5 h-5 rounded-full bg-slate-800/80 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 3. VIRTUAL PROTRACTOR (Thước đo độ 180°) */}
      {protractor.active && (
        <div
          data-testid="virtual-protractor"
          style={{
            left: (protractor.x - protractor.radius) * camera.zoom + camera.x,
            top: (protractor.y - protractor.radius) * camera.zoom + camera.y,
            width: protractor.radius * 2 * camera.zoom,
            height: (protractor.radius + 26) * camera.zoom,
            transform: `rotate(${protractor.angle}rad)`,
            transformOrigin: `${protractor.radius * camera.zoom}px ${protractor.radius * camera.zoom}px`,
          }}
          className="pointer-events-none absolute"
        >
          <svg
            viewBox={`0 0 ${protractor.radius * 2} ${protractor.radius + 14}`}
            className="w-full h-full overflow-visible"
          >
            <path
              d={`M 0 ${protractor.radius} A ${protractor.radius} ${protractor.radius} 0 0 1 ${protractor.radius * 2} ${protractor.radius} Z`}
              fill="rgba(16, 185, 129, 0.16)"
              stroke="#059669"
              strokeWidth="2"
              className="pointer-events-auto cursor-grab active:cursor-grabbing"
              onPointerDown={(e) =>
                startDragPosition(e, protractor.x, protractor.y, (nx, ny) =>
                  updateVirtualTool('protractor', { x: nx, y: ny })
                )
              }
            />
            {Array.from({ length: 19 }, (_, idx) => {
              const deg = idx * 10;
              const rad = (deg * Math.PI) / 180;
              const cx = protractor.radius;
              const cy = protractor.radius;
              const x1 = cx + protractor.radius * Math.cos(rad);
              const y1 = cy - protractor.radius * Math.sin(rad);
              const x2 = cx + (protractor.radius - (deg % 30 === 0 ? 14 : 8)) * Math.cos(rad);
              const y2 = cy - (protractor.radius - (deg % 30 === 0 ? 14 : 8)) * Math.sin(rad);
              const tx = cx + (protractor.radius - 24) * Math.cos(rad);
              const ty = cy - (protractor.radius - 24) * Math.sin(rad);
              return (
                <g key={deg}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#047857" strokeWidth={deg % 30 === 0 ? 1.5 : 0.9} />
                  {deg % 30 === 0 && (
                    <text
                      x={tx}
                      y={ty + 3}
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="700"
                      textAnchor="middle"
                      fill="#065f46"
                    >
                      {deg}°
                    </text>
                  )}
                </g>
              );
            })}
            {/* Angle reading ray */}
            {(() => {
              const rad = (protractor.measureDeg * Math.PI) / 180;
              const cx = protractor.radius;
              const cy = protractor.radius;
              return (
                <line
                  x1={cx}
                  y1={cy}
                  x2={cx + protractor.radius * Math.cos(rad)}
                  y2={cy - protractor.radius * Math.sin(rad)}
                  stroke="#e11d48"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
              );
            })()}
            <circle cx={protractor.radius} cy={protractor.radius} r="3.5" fill="#059669" />
          </svg>
          <div className="pointer-events-auto absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 border border-emerald-300 dark:border-emerald-700 rounded-lg px-2 py-0.5 shadow-sm">
            <input
              type="range"
              min={0}
              max={180}
              step={1}
              aria-label={t('Đo góc thước đo độ', 'Protractor angle')}
              value={protractor.measureDeg}
              onPointerDown={(e) => e.stopPropagation()}
              onChange={(e) => updateVirtualTool('protractor', { measureDeg: Number(e.target.value) })}
              className="w-16 h-1.5 accent-emerald-600 cursor-pointer"
            />
            <span className="text-[10.5px] font-mono font-bold text-emerald-700 dark:text-emerald-300 tabular-nums w-8">
              {protractor.measureDeg}°
            </span>
            <button
              type="button"
              aria-label={t('Xoay thước đo độ', 'Rotate protractor')}
              onPointerDown={(e) =>
                startRotate(e, protractor.x, protractor.y, (ang) =>
                  updateVirtualTool('protractor', { angle: ang })
                )
              }
              className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center cursor-ew-resize"
            >
              <RotateCw className="w-2.5 h-2.5" />
            </button>
            <button
              type="button"
              aria-label={t('Ẩn thước đo độ', 'Hide protractor')}
              onClick={() => toggleVirtualTool('protractor')}
              className="w-4 h-4 rounded-full bg-slate-700 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      )}

      {/* 4. VIRTUAL COMPASS (Compa ảo vẽ đường tròn / cung tròn chuẩn xác) */}
      {compass.active && (
        (() => {
          const sx = compass.cx * camera.zoom + camera.x;
          const sy = compass.cy * camera.zoom + camera.y;
          const rScreen = compass.radius * camera.zoom;
          const tipX = sx + rScreen * Math.cos(compass.angle);
          const tipY = sy + rScreen * Math.sin(compass.angle);
          const radiusCm = (compass.radius / 40).toFixed(1);

          return (
            <div data-testid="virtual-compass" className="pointer-events-none absolute inset-0">
              {/* Preview circle + arm SVG */}
              <svg className="w-full h-full overflow-visible">
                <circle
                  cx={sx}
                  cy={sy}
                  r={rScreen}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                />
                <line
                  x1={sx}
                  y1={sy}
                  x2={tipX}
                  y2={tipY}
                  stroke="#4f46e5"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>

              {/* Draggable Center Pin O */}
              <div
                onPointerDown={(e) =>
                  startDragPosition(e, compass.cx, compass.cy, (nx, ny) =>
                    updateVirtualTool('compass', { cx: nx, cy: ny })
                  )
                }
                title={t('Kéo tâm Compa O', 'Drag compass center O')}
                style={{ left: sx, top: sy }}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-indigo-600 border-2 border-white shadow-md flex items-center justify-center text-[10px] font-bold text-white cursor-grab active:cursor-grabbing"
              >
                O
              </div>

              {/* Draggable Pencil Tip Handle */}
              <div
                onPointerDown={startCompassRadiusDrag}
                title={t('Kéo đầu chì để chỉnh bán kính R', 'Drag pencil tip to adjust radius R')}
                style={{ left: tipX, top: tipY }}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-rose-500 border-2 border-white shadow-md cursor-crosshair"
              />

              {/* Compact Action Bar anchored under center O */}
              <div
                style={{ left: sx, top: sy + 20 }}
                className="pointer-events-auto absolute -translate-x-1/2 flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 border border-indigo-200 dark:border-indigo-800 rounded-xl px-2 py-1 shadow-lg"
              >
                <span className="text-[11px] font-mono font-semibold text-indigo-700 dark:text-indigo-300 tabular-nums whitespace-nowrap">
                  R={radiusCm}cm
                </span>
                <button
                  type="button"
                  data-testid="compass-draw-circle-btn"
                  onClick={() => handleCompassDraw(360)}
                  className="h-6 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <Circle className="w-3 h-3" />
                  <span>{t('Vẽ tròn', 'Circle')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCompassDraw(180)}
                  className="h-6 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <Spline className="w-3 h-3" />
                  <span>{t('Cung 180°', '180° arc')}</span>
                </button>
                <button
                  type="button"
                  aria-label={t('Ẩn Compa', 'Hide compass')}
                  onClick={() => toggleVirtualTool('compass')}
                  className="w-5 h-5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
};
