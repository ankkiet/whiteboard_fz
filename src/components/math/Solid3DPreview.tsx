import React, { useMemo, useRef, useState } from 'react';
import {
  Solid3DType,
  buildSolid3DSnapshotElements,
  getSolid3DCatalog,
  projectSolid3D,
} from '../../engine/mathEngine';
import { useBoardStore } from '../../store/useBoardStore';
import { useI18n } from '../../i18n/useI18n';
import { Camera, RotateCcw } from 'lucide-react';

interface Solid3DPreviewProps {
  onSnapshotInserted?: () => void;
  getWorldCenter: () => { x: number; y: number };
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export const Solid3DPreview: React.FC<Solid3DPreviewProps> = ({
  onSnapshotInserted,
  getWorldCenter,
}) => {
  const { language, t } = useI18n();
  const addElementsBatch = useBoardStore((s) => s.addElementsBatch);
  const addToast = useBoardStore((s) => s.addToast);
  const isDarkMode = useBoardStore((s) => s.isDarkMode);

  const [solidType, setSolidType] = useState<Solid3DType>('square-pyramid');
  const [yaw, setYaw] = useState(0.58);
  const [pitch, setPitch] = useState(0.36);
  const [unfold, setUnfold] = useState(0);
  const [px, setPx] = useState('2');
  const [py, setPy] = useState('3');
  const [pz, setPz] = useState('2');

  const dragRef = useRef<{ startX: number; startY: number; yaw0: number; pitch0: number } | null>(
    null
  );

  const catalog = useMemo(() => getSolid3DCatalog(language), [language]);
  const currentDef = useMemo(
    () => catalog.find((s) => s.id === solidType) || catalog[0],
    [catalog, solidType]
  );

  const oxyzPoint = useMemo(() => {
    if (solidType !== 'oxyz') return undefined;
    const x = Number(px);
    const y = Number(py);
    const z = Number(pz);
    return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? { x, y, z } : undefined;
  }, [solidType, px, py, pz]);

  const projected = useMemo(
    () => projectSolid3D(solidType, yaw, pitch, 64, currentDef.supportsUnfold ? unfold : 0, oxyzPoint),
    [solidType, yaw, pitch, unfold, currentDef.supportsUnfold, oxyzPoint, language]
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, yaw0: yaw, pitch0: pitch };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setYaw(dragRef.current.yaw0 + dx * 0.012);
    setPitch(Math.max(-1.25, Math.min(1.25, dragRef.current.pitch0 + dy * 0.012)));
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleSnapshotToCanvas = () => {
    const state = useBoardStore.getState();
    const center = getWorldCenter();
    const maxZ = state.elements.reduce((m, el) => Math.max(m, el.zIndex || 0), 0);
    const els = buildSolid3DSnapshotElements({
      solidType,
      yaw,
      pitch,
      unfoldProgress: currentDef.supportsUnfold ? unfold : 0,
      oxyzPoint,
      center,
      color: state.color,
      startZIndex: maxZ,
      createId: uid,
    });
    addElementsBatch(els, true);
    addToast(
      t(
        `Đã chụp "${currentDef.label}" sang nét 2D (tự động nét đứt)`,
        `Inserted 2D projection of "${currentDef.label}" (auto dashed hidden edges)`
      ),
      'success'
    );
    onSnapshotInserted?.();
  };

  const strokeInk = isDarkMode ? '#e2e8f0' : '#1e293b';

  return (
    <div data-testid="solid-3d-preview" className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="solid-3d-select" className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          {t('Khối 3D & Oxyz (Kéo để xoay 360°)', '3D solids & Oxyz (Drag to rotate 360°)')}
        </label>
        <button
          type="button"
          onClick={() => {
            setYaw(0.58);
            setPitch(0.36);
            setUnfold(0);
          }}
          title={t('Đặt lại góc nhìn', 'Reset view')}
          aria-label={t('Đặt lại góc nhìn 3D', 'Reset 3D view')}
          className="text-[11px] text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{t('Đặt lại', 'Reset')}</span>
        </button>
      </div>

      <select
        id="solid-3d-select"
        data-testid="solid-3d-select"
        value={solidType}
        onChange={(e) => {
          setSolidType(e.target.value as Solid3DType);
          setUnfold(0);
        }}
        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 cursor-pointer"
      >
        {catalog.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>

      {/* Live 360° Interactive SVG Stage */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/90 overflow-hidden">
        <svg
          viewBox="-140 -105 280 210"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-44 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          {projected.edges.map((edge, idx) => (
            <line
              key={idx}
              x1={edge.from.x}
              y1={edge.from.y}
              x2={edge.to.x}
              y2={edge.to.y}
              stroke={edge.color || strokeInk}
              strokeWidth={edge.dashed ? 1.5 : 2.1}
              strokeDasharray={edge.dashed ? '5 4' : undefined}
              strokeOpacity={edge.dashed ? 0.65 : 1}
              strokeLinecap="round"
            />
          ))}
          {projected.labels.map((lbl, idx) => (
            <text
              key={idx}
              x={lbl.pos.x}
              y={lbl.pos.y + 10}
              fontSize="11"
              fontWeight="700"
              fill={lbl.color || (isDarkMode ? '#a5b4fc' : '#4338ca')}
            >
              {lbl.text}
            </text>
          ))}
        </svg>
      </div>

      {/* Unfolding Net Slider */}
      {currentDef.supportsUnfold && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>{t('Trải hình phẳng (Unfolding Net)', 'Unfolding net')}</span>
            <span className="font-mono font-semibold tabular-nums">{Math.round(unfold * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            aria-label={t('Thanh trượt trải hình phẳng 3D', '3D unfolding net slider')}
            value={unfold}
            onChange={(e) => setUnfold(Number(e.target.value))}
            className="w-full h-1.5 accent-indigo-600 cursor-pointer"
          />
        </div>
      )}

      {/* Oxyz Point Coordinate Inputs */}
      {solidType === 'oxyz' && (
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: 'x =', val: px, set: setPx },
            { label: 'y =', val: py, set: setPy },
            { label: 'z =', val: pz, set: setPz },
          ].map((axis) => (
            <label key={axis.label} className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 h-7">
              <span className="text-[11px] font-mono text-slate-500">{axis.label}</span>
              <input
                type="number"
                step="0.5"
                value={axis.val}
                onChange={(e) => axis.set(e.target.value)}
                className="w-full min-w-0 bg-transparent text-xs font-mono tabular-nums outline-none"
              />
            </label>
          ))}
        </div>
      )}

      <button
        type="button"
        data-testid="snapshot-3d-to-canvas-button"
        onClick={handleSnapshotToCanvas}
        className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer"
      >
        <Camera className="w-3.5 h-3.5" />
        <span>{t('Chụp sang 2D lên bảng (tự động nét đứt)', 'Capture 2D to board (auto dashed edges)')}</span>
      </button>
    </div>
  );
};
