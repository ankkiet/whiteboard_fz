import { StateCreator } from 'zustand';
import { VirtualGeometryToolsState } from '../../engine/mathCurriculum';
import { computeVirtualToolSafePoses, getSafeMathViewport } from '../../engine/mathViewport';
import { BoardState, DEFAULT_VIRTUAL_TOOLS } from '../boardStoreTypes';

export type MathToolsSlice = Pick<
  BoardState,
  | 'mathGradeMode'
  | 'virtualTools'
  | 'isCalculatorOpen'
  | 'isCalculatorMinimized'
  | 'isMathPanelCollapsed'
  | 'pinnedProblem'
  | 'setMathGradeMode'
  | 'toggleVirtualTool'
  | 'updateVirtualTool'
  | 'arrangeVirtualTools'
  | 'hideAllVirtualTools'
  | 'setIsCalculatorOpen'
  | 'setIsCalculatorMinimized'
  | 'setIsMathPanelCollapsed'
  | 'setPinnedProblem'
>;

export const createMathToolsSlice: StateCreator<BoardState, [], [], MathToolsSlice> = (
  set,
  get
) => ({
  mathGradeMode: 'high',
  virtualTools: DEFAULT_VIRTUAL_TOOLS,
  isCalculatorOpen: false,
  isCalculatorMinimized: false,
  isMathPanelCollapsed: false,
  pinnedProblem: null,

  setMathGradeMode: (mathGradeMode) => {
    set({ mathGradeMode, hasUserEditedCurrentBoard: true });
    get().scheduleSave();
  },

  toggleVirtualTool: (tool) => {
    const {
      virtualTools,
      camera,
      isCalculatorOpen,
      isCalculatorMinimized,
      isMathPanelCollapsed,
      pinnedProblem,
    } = get();
    const currentlyActive = virtualTools[tool].active;

    if (currentlyActive) {
      set({
        virtualTools: {
          ...virtualTools,
          [tool]: { ...virtualTools[tool], active: false },
        },
      });
      return;
    }

    const viewW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const safeRect = getSafeMathViewport({
      viewW,
      viewH,
      isMathPanelOpen: true,
      isMathPanelCollapsed,
      isCalculatorOpen,
      isCalculatorMinimized,
      hasPinnedProblem: Boolean(pinnedProblem),
      isPinnedProblemCollapsed: Boolean(pinnedProblem?.collapsed),
    });

    const nextActiveTools: VirtualGeometryToolsState = {
      ...virtualTools,
      [tool]: { ...virtualTools[tool], active: true },
    };
    const posed = computeVirtualToolSafePoses(nextActiveTools, camera, safeRect);
    set({ virtualTools: posed });
  },

  updateVirtualTool: (tool, patch) => {
    set((state) => ({
      virtualTools: {
        ...state.virtualTools,
        [tool]: { ...state.virtualTools[tool], ...patch },
      },
    }));
  },

  arrangeVirtualTools: () => {
    const {
      virtualTools,
      camera,
      isCalculatorOpen,
      isCalculatorMinimized,
      isMathPanelCollapsed,
      pinnedProblem,
    } = get();
    const viewW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const safeRect = getSafeMathViewport({
      viewW,
      viewH,
      isMathPanelOpen: true,
      isMathPanelCollapsed,
      isCalculatorOpen,
      isCalculatorMinimized,
      hasPinnedProblem: Boolean(pinnedProblem),
      isPinnedProblemCollapsed: Boolean(pinnedProblem?.collapsed),
    });
    set({
      virtualTools: computeVirtualToolSafePoses(virtualTools, camera, safeRect),
    });
  },

  hideAllVirtualTools: () => {
    set((state) => ({
      virtualTools: {
        ruler: { ...state.virtualTools.ruler, active: false },
        setSquare: { ...state.virtualTools.setSquare, active: false },
        protractor: { ...state.virtualTools.protractor, active: false },
        compass: { ...state.virtualTools.compass, active: false },
      },
    }));
  },

  setIsCalculatorOpen: (isCalculatorOpen) =>
    set((state) => {
      const viewW = typeof window !== 'undefined' ? window.innerWidth : 1440;
      const autoCollapsePanel =
        isCalculatorOpen && viewW < 1180 ? true : state.isMathPanelCollapsed;
      return {
        isCalculatorOpen,
        isCalculatorMinimized: isCalculatorOpen ? false : state.isCalculatorMinimized,
        isMathPanelCollapsed: autoCollapsePanel,
      };
    }),
  setIsCalculatorMinimized: (isCalculatorMinimized) => set({ isCalculatorMinimized }),
  setIsMathPanelCollapsed: (isMathPanelCollapsed) => set({ isMathPanelCollapsed }),
  setPinnedProblem: (pinnedProblem) => set({ pinnedProblem }),
});
