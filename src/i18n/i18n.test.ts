import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAppLanguage,
  normalizeAppLanguage,
  setAppLanguageState,
  tr,
} from './index';
import {
  buildStarterElementsForTemplate,
  getBoardTemplates,
  getBoardTypeLabel,
  isDefaultBoardTitle,
} from '../engine/boardTemplates';
import { getNotebookConfig, getNotebookPaperStyles } from '../engine/notebookEngine';
import { getInkColors, getTools } from '../components/toolbar/toolbarConfig';
import { getLatexKeypadByGrade, getMathGradeModes } from '../engine/mathCurriculum';
import { getExactTrigInfo } from '../engine/mathEngine';
import { formatTrigValueToLatex } from '../engine/mathDisplay';
import {
  evaluateCasioVerify,
  solveCasioLinearSystemFull,
  solveCubicInequality,
  solveLinearSystem4x4,
  solveQuarticEquation,
} from '../engine/casio580Engine';
import { formatDriveErrorMessage } from '../services/googleDriveUtils';
import { parseAuthBridgeToken } from '../services/authBridge';

function withLanguage<T>(lang: 'vi' | 'en', fn: () => T): T {
  const prev = getAppLanguage();
  setAppLanguageState(lang);
  try {
    return fn();
  } finally {
    setAppLanguageState(prev);
  }
}

test('normalizeAppLanguage defaults to vi and switches reactively via setAppLanguageState', () => {
  assert.equal(normalizeAppLanguage(undefined), 'vi');
  assert.equal(normalizeAppLanguage('fr'), 'vi');
  assert.equal(normalizeAppLanguage('en'), 'en');
  assert.equal(getAppLanguage(), 'vi');

  withLanguage('en', () => {
    assert.equal(getAppLanguage(), 'en');
    assert.equal(tr('Xin chào', 'Hello'), 'Hello');
  });

  assert.equal(getAppLanguage(), 'vi');
  assert.equal(tr('Xin chào', 'Hello'), 'Xin chào');
});

test('boardTemplates and notebookEngine localize template names, starter mindmap, and paper configs', () => {
  const enTemplates = getBoardTemplates('en');
  assert.equal(enTemplates.length, 4);
  assert.equal(enTemplates[0].name, 'Basic whiteboard');
  assert.equal(getBoardTypeLabel('math', 'en'), 'Math');
  assert.equal(getBoardTypeLabel('math', 'vi'), 'Toán học');
  assert.equal(isDefaultBoardTitle('Untitled board'), true);
  assert.equal(isDefaultBoardTitle('Bảng trắng mới'), true);

  let seq = 0;
  const starter = buildStarterElementsForTemplate('mindmap', (p) => `${p}_${++seq}`, 'en');
  const textContent = starter
    .filter((el): el is Extract<typeof el, { type: 'text' }> => el.type === 'text')
    .map((el) => el.text);
  assert.ok(textContent.length > 0);
  assert.equal(textContent.some((t) => /[àáảãạăằắẳẵặâầấẩẫậđ]/i.test(t)), false);

  const a4En = getNotebookConfig('a4', 'en');
  assert.equal(a4En.label, 'A4');
  const stylesEn = getNotebookPaperStyles('en');
  assert.equal(stylesEn[0].label, 'Ruled paper');
});

test('toolbarConfig and mathCurriculum localize toolbars, grades, keypads, and trig labels', () => {
  const toolsEn = getTools('en');
  assert.equal(toolsEn.find((t) => t.id === 'pen')?.label, 'Pen');
  assert.equal(toolsEn.find((t) => t.id === 'eraser')?.label, 'Eraser');

  const colorsEn = getInkColors('en');
  assert.equal(colorsEn[0].label, 'Standard ink');

  const gradesEn = getMathGradeModes('en');
  assert.equal(gradesEn[0].label, 'Primary');
  assert.equal(gradesEn[0].range, 'Grades 1–5');

  const keypadEn = getLatexKeypadByGrade('en');
  assert.equal(keypadEn.primary[0].title, 'Add');

  const trig90En = getExactTrigInfo(90, 'en');
  assert.equal(trig90En.tanLabel, 'Undef');
  assert.equal(formatTrigValueToLatex(trig90En.tanLabel), '\\text{Undef}');
});

test('casio580Engine and services respect English language setting without breaking Vietnamese default', () => {
  assert.equal(solveLinearSystem4x4([]).summaryLatex, '\\text{Dữ liệu không hợp lệ}');

  withLanguage('en', () => {
    assert.equal(solveLinearSystem4x4([]).summaryLatex, '\\text{Invalid input data}');
    assert.equal(solveQuarticEquation(1, 0, 1, 0, 1).summaryLatex, '\\text{No real roots}');
    assert.equal(solveCubicInequality(1, 0, 0, 1, '>').summaryLatex.includes('hoặc'), false);

    const verify = evaluateCasioVerify('2+2', '=', '4', {
      angleUnit: 'D',
      ans: 0,
      preAns: 0,
      vars: {},
    });
    assert.ok(verify);
    assert.equal(verify.summaryLatex.includes('TRUE'), true);
    assert.equal(verify.summaryLatex.includes('Đúng'), false);

    const sysNone = solveCasioLinearSystemFull([
      [1, 1, 1],
      [1, 1, 2],
    ]);
    assert.equal(sysNone.kind, 'none');
    assert.equal(sysNone.message, 'No solution');

    const driveErr = formatDriveErrorMessage('');
    assert.equal(driveErr.message, 'Could not connect to Google Drive. Please try again.');

    assert.throws(
      () => parseAuthBridgeToken(''),
      /Please enter or paste the connection code from your browser\./
    );
    assert.throws(
      () => parseAuthBridgeToken('BTTM-' + btoa(JSON.stringify({ user: { email: 'a@b.c' } }))),
      /Bridge token is missing the Google Drive access token\./
    );
  });
});
