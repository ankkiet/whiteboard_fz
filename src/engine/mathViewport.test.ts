import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSafeWorldCenter,
  computeVirtualToolSafePoses,
  getSafeMathViewport,
} from './mathViewport';
import { VirtualGeometryToolsState } from './mathCurriculum';

const SAMPLE_TOOLS: VirtualGeometryToolsState = {
  ruler: { active: true, x: 0, y: 0, angle: 0, length: 320, height: 48 },
  setSquare: { active: true, x: 0, y: 0, angle: 0, legA: 190, legB: 135 },
  protractor: { active: true, x: 0, y: 0, angle: 0, radius: 110, measureDeg: 60 },
  compass: { active: true, cx: 0, cy: 0, radius: 88, angle: -Math.PI / 6 },
};

describe('mathViewport spatial layout engine', () => {
  it('reserves both left calculator margin and right math panel margin when both are open', () => {
    const rect = getSafeMathViewport({
      viewW: 1440,
      viewH: 900,
      isMathPanelOpen: true,
      isMathPanelCollapsed: false,
      isCalculatorOpen: true,
      isCalculatorMinimized: false,
      calculatorX: 16,
      hasPinnedProblem: false,
      hasContextualToolbar: true,
    });

    assert.ok(rect.left >= 336, `Expected left margin >= 336, got ${rect.left}`);
    assert.ok(rect.right <= 1440 - 320, `Expected right bound <= 1120, got ${rect.right}`);
    assert.ok(rect.centerX > rect.left && rect.centerX < rect.right);
  });

  it('expands safe right bound when MathPanel is collapsed to compact rail', () => {
    const expanded = getSafeMathViewport({
      viewW: 1280,
      viewH: 800,
      isMathPanelOpen: true,
      isMathPanelCollapsed: false,
      isCalculatorOpen: false,
    });
    const collapsed = getSafeMathViewport({
      viewW: 1280,
      viewH: 800,
      isMathPanelOpen: true,
      isMathPanelCollapsed: true,
      isCalculatorOpen: false,
    });

    assert.ok(collapsed.width > expanded.width + 220);
  });

  it('keeps consecutive inserted elements inside the unobstructed safe viewport', () => {
    const safeRect = getSafeMathViewport({
      viewW: 1280,
      viewH: 800,
      isMathPanelOpen: true,
      isCalculatorOpen: true,
      calculatorX: 16,
    });
    const camera = { x: 640, y: 400, zoom: 1 };

    for (let step = 0; step < 7; step += 1) {
      const worldPt = computeSafeWorldCenter(camera, safeRect, step);
      const screenX = worldPt.x * camera.zoom + camera.x;
      const screenY = worldPt.y * camera.zoom + camera.y;
      assert.ok(
        screenX >= safeRect.left + 40 && screenX <= safeRect.right - 40,
        `Step ${step} screenX=${screenX} outside safe [${safeRect.left}, ${safeRect.right}]`
      );
      assert.ok(
        screenY >= safeRect.top + 30 && screenY <= safeRect.bottom - 30,
        `Step ${step} screenY=${screenY} outside safe [${safeRect.top}, ${safeRect.bottom}]`
      );
    }
  });

  it('separates all 4 active virtual geometry tools into distinct non-overlapping positions', () => {
    const safeRect = getSafeMathViewport({
      viewW: 1440,
      viewH: 900,
      isMathPanelOpen: true,
      isCalculatorOpen: true,
      calculatorX: 16,
    });
    const camera = { x: 720, y: 450, zoom: 1 };
    const posed = computeVirtualToolSafePoses(SAMPLE_TOOLS, camera, safeRect);

    // Ruler is placed in upper lane, SetSquare in lower-left, Protractor in upper-right, Compass in lower-right
    assert.ok(posed.ruler.y < posed.setSquare.y - 60);
    assert.ok(posed.setSquare.x < posed.compass.cx - 80);
    assert.ok(posed.protractor.y < posed.compass.cy - 40);
  });
});
