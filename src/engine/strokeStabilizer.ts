export interface StabilizerConfig {
  /** Minimum cutoff frequency (Hz) when moving slowly; higher = less smoothing */
  minCutoff: number;
  /** Speed coefficient; higher = less lag when moving fast */
  beta: number;
  /** Derivative cutoff frequency (Hz) */
  dCutoff: number;
  /** Whether to bypass spatial filtering (e.g., when snapping to ruler edge) */
  bypassSpatial?: boolean;
}

export interface RawPointerSample {
  x: number;
  y: number;
  pressure: number;
  pointerType: string;
  timestampMs: number;
  zoom: number;
}

export const PEN_STABILIZER_CONFIG: StabilizerConfig = {
  minCutoff: 2.8,
  beta: 0.048,
  dCutoff: 1.0,
};

export const HIGHLIGHTER_STABILIZER_CONFIG: StabilizerConfig = {
  minCutoff: 1.5,
  beta: 0.018,
  dCutoff: 1.0,
};

export function getStabilizerConfigForPenStyle(
  penStyle?: 'ballpoint' | 'fountain' | 'pencil' | 'brush',
  isHighlighter = false
): StabilizerConfig {
  if (isHighlighter) return HIGHLIGHTER_STABILIZER_CONFIG;
  switch (penStyle) {
    case 'ballpoint':
    case 'pencil':
      return { minCutoff: 3.1, beta: 0.052, dCutoff: 1.0 };
    case 'brush':
      return { minCutoff: 1.9, beta: 0.035, dCutoff: 1.0 };
    case 'fountain':
    default:
      return PEN_STABILIZER_CONFIG;
  }
}

function computeAlpha(cutoffHz: number, dtSec: number): number {
  const tau = 1 / (2 * Math.PI * Math.max(cutoffHz, 0.01));
  return 1 / (1 + tau / Math.max(dtSec, 0.001));
}

class LowPassFilter1D {
  private initialized = false;
  private yHat = 0;

  filter(value: number, alpha: number): number {
    if (!this.initialized) {
      this.initialized = true;
      this.yHat = value;
      return value;
    }
    this.yHat = alpha * value + (1 - alpha) * this.yHat;
    return this.yHat;
  }

  last(): number {
    return this.yHat;
  }

  hasValue(): boolean {
    return this.initialized;
  }

  reset(value?: number) {
    if (value === undefined) {
      this.initialized = false;
      this.yHat = 0;
    } else {
      this.initialized = true;
      this.yHat = value;
    }
  }
}

/**
 * Adaptive One Euro Filter + velocity-aware pressure smoother for natural digital ink.
 * Reduces hand tremor at low speeds while keeping high-speed handwriting lag-free
 * and preserving sharp corners on small diacritics and mathematical symbols.
 */
export class StrokeStabilizer {
  private config: StabilizerConfig;
  private xFilter = new LowPassFilter1D();
  private yFilter = new LowPassFilter1D();
  private dxFilter = new LowPassFilter1D();
  private dyFilter = new LowPassFilter1D();

  private lastTimestampMs = 0;
  private lastRawX = 0;
  private lastRawY = 0;
  private prevDirX = 0;
  private prevDirY = 0;
  private hasPrevDir = false;

  private hasRealPenPressure = false;
  private smoothedPressure = 0.5;
  private smoothedSpeedPxPerSec = 0;

  constructor(config: StabilizerConfig = PEN_STABILIZER_CONFIG) {
    this.config = config;
  }

  reset(config?: StabilizerConfig) {
    if (config) {
      this.config = config;
    }
    this.xFilter.reset();
    this.yFilter.reset();
    this.dxFilter.reset();
    this.dyFilter.reset();
    this.lastTimestampMs = 0;
    this.lastRawX = 0;
    this.lastRawY = 0;
    this.prevDirX = 0;
    this.prevDirY = 0;
    this.hasPrevDir = false;
    this.hasRealPenPressure = false;
    this.smoothedPressure = 0.5;
    this.smoothedSpeedPxPerSec = 0;
  }

  updateConfig(patch: Partial<StabilizerConfig>) {
    this.config = { ...this.config, ...patch };
  }

  process(sample: RawPointerSample): [number, number, number] {
    const { x, y, pressure, pointerType, timestampMs } = sample;
    const zoom = Math.max(sample.zoom, 0.05);

    if (!this.xFilter.hasValue()) {
      this.xFilter.reset(x);
      this.yFilter.reset(y);
      this.dxFilter.reset(0);
      this.dyFilter.reset(0);
      this.lastTimestampMs = timestampMs;
      this.lastRawX = x;
      this.lastRawY = y;

      const isRealPen = pointerType === 'pen' && pressure > 0 && pressure !== 0.5;
      if (isRealPen) {
        this.hasRealPenPressure = true;
        this.smoothedPressure = mapSoftPenPressure(pressure);
      } else {
        // Gentle initial contact pressure for mouse/touch so stroke entry isn't bloated
        this.smoothedPressure = 0.52;
      }
      return [x, y, this.smoothedPressure];
    }

    const rawDtMs = timestampMs - this.lastTimestampMs;
    // Clamp dt to [2ms, 100ms] so coalesced events and pauses behave deterministically
    const dtSec = Math.max(0.002, Math.min(rawDtMs / 1000, 0.1));
    this.lastTimestampMs = timestampMs;

    const rawDxWorld = x - this.lastRawX;
    const rawDyWorld = y - this.lastRawY;
    const rawDistWorld = Math.hypot(rawDxWorld, rawDyWorld);
    this.lastRawX = x;
    this.lastRawY = y;

    const screenDist = rawDistWorld * zoom;
    const instantSpeedScreen = screenDist / dtSec;
    this.smoothedSpeedPxPerSec =
      0.35 * instantSpeedScreen + 0.65 * this.smoothedSpeedPxPerSec;

    // Detect sharp direction change so corners aren't overly rounded
    let cornerBoost = 1;
    if (screenDist > 1.2) {
      const dirX = rawDxWorld / rawDistWorld;
      const dirY = rawDyWorld / rawDistWorld;
      if (this.hasPrevDir) {
        const dot = this.prevDirX * dirX + this.prevDirY * dirY;
        if (dot < 0.35) {
          // Sharp turn (corner or acute hook): boost cutoff briefly to lock to vertex
          cornerBoost = 2.8;
        }
      }
      this.prevDirX = dirX;
      this.prevDirY = dirY;
      this.hasPrevDir = true;
    }

    let outX = x;
    let outY = y;

    if (!this.config.bypassSpatial) {
      const dxPerSec = rawDxWorld / dtSec;
      const dyPerSec = rawDyWorld / dtSec;
      const dAlpha = computeAlpha(this.config.dCutoff, dtSec);
      const edx = this.dxFilter.filter(dxPerSec, dAlpha);
      const edy = this.dyFilter.filter(dyPerSec, dAlpha);
      // Scale world derivative by zoom so cutoff adapts consistently to screen hand speed
      const speedScreen = Math.hypot(edx, edy) * zoom;
      const cutoff =
        this.config.minCutoff * cornerBoost + this.config.beta * speedScreen;
      const alpha = computeAlpha(cutoff, dtSec);
      outX = this.xFilter.filter(x, alpha);
      outY = this.yFilter.filter(y, alpha);
    } else {
      this.xFilter.reset(x);
      this.yFilter.reset(y);
    }

    const outPressure = this.computePressure(pressure, pointerType);
    return [outX, outY, outPressure];
  }

  private computePressure(rawPressure: number, pointerType: string): number {
    if (pointerType === 'pen') {
      if (rawPressure > 0 && rawPressure !== 0.5) {
        this.hasRealPenPressure = true;
      }
      if (this.hasRealPenPressure) {
        const mapped = rawPressure > 0 ? mapSoftPenPressure(rawPressure) : this.smoothedPressure;
        this.smoothedPressure = 0.48 * mapped + 0.52 * this.smoothedPressure;
        return this.smoothedPressure;
      }
    }

    // Smooth velocity-to-pressure curve for mouse, trackpad, touch, or flat-pressure stylus:
    // Slower strokes = slightly heavier ink (~0.74), fast sweeps = leaner (~0.28)
    const speedNorm = Math.min(Math.max((this.smoothedSpeedPxPerSec - 60) / 1100, 0), 1);
    const targetPressure = 0.74 - 0.46 * Math.pow(speedNorm, 0.78);
    this.smoothedPressure = 0.28 * targetPressure + 0.72 * this.smoothedPressure;
    return this.smoothedPressure;
  }
}

/**
 * Ergonomic pen pressure response curve:
 * Light contact (0.01..0.15) still produces solid, clearly visible ink (~0.24..0.42)
 * without forcing the user to press hard on the tablet/screen.
 */
function mapSoftPenPressure(p: number): number {
  if (!Number.isFinite(p)) return 0.5;
  const clamped = Math.max(0, Math.min(1, p));
  return 0.22 + 0.78 * Math.pow(clamped, 0.72);
}
