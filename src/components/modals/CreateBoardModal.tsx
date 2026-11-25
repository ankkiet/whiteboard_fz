import React, { useEffect, useState } from 'react';
import { BoardPattern, BoardType, NotebookPaperSize } from '../../types/board';
import { getBoardTemplate, getBoardTemplates } from '../../engine/boardTemplates';
import {
  DEFAULT_NOTEBOOK_PAPER_STYLE,
  NotebookPaperStyle,
  getNotebookPaperStyles,
} from '../../engine/notebookEngine';
import { useI18n } from '../../i18n/useI18n';
import { BoardTemplatePreview } from '../home/BoardTemplatePreview';
import { AlertTriangle, Check, Plus, X } from 'lucide-react';

interface CreateBoardModalProps {
  isOpen: boolean;
  initialType?: BoardType;
  hasUnsavedLocalDraft: boolean;
  localDraftTitle: string;
  localDraftElementCount: number;
  onClose: () => void;
  onCreate: (options: {
    title: string;
    boardType: BoardType;
    boardPattern?: BoardPattern;
    notebookPaperSize?: NotebookPaperSize;
  }) => void;
}

export const CreateBoardModal: React.FC<CreateBoardModalProps> = ({
  isOpen,
  initialType = 'basic',
  hasUnsavedLocalDraft,
  localDraftTitle,
  localDraftElementCount,
  onClose,
  onCreate,
}) => {
  const { language, t } = useI18n();
  const [selectedType, setSelectedType] = useState<BoardType>(initialType);
  const [selectedPaperSize, setSelectedPaperSize] = useState<NotebookPaperSize>('a4');
  const [selectedPaperStyle, setSelectedPaperStyle] = useState<NotebookPaperStyle>(
    DEFAULT_NOTEBOOK_PAPER_STYLE
  );
  const [boardTitle, setBoardTitle] = useState<string>(
    getBoardTemplate(initialType, language).defaultTitle
  );
  const [didEditTitle, setDidEditTitle] = useState(false);

  const templates = getBoardTemplates(language);
  const paperStyles = getNotebookPaperStyles(language);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedType(initialType);
    setSelectedPaperSize('a4');
    setSelectedPaperStyle(DEFAULT_NOTEBOOK_PAPER_STYLE);
    setBoardTitle(getBoardTemplate(initialType, language).defaultTitle);
    setDidEditTitle(false);
  }, [isOpen, initialType, language]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectType = (type: BoardType) => {
    setSelectedType(type);
    if (!didEditTitle) {
      setBoardTitle(getBoardTemplate(type, language).defaultTitle);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fallbackTitle = getBoardTemplate(selectedType, language).defaultTitle;
    onCreate({
      title: boardTitle.trim() || fallbackTitle,
      boardType: selectedType,
      boardPattern: selectedType === 'notebook' ? selectedPaperStyle : undefined,
      notebookPaperSize: selectedType === 'notebook' ? selectedPaperSize : undefined,
    });
  };

  const paperSizes = [
    {
      id: 'a4' as const,
      label: t('Khổ A4', 'A4'),
      desc: t('210 × 297 mm (mặc định)', '210 × 297 mm (default)'),
    },
    {
      id: 'a3' as const,
      label: t('Khổ A3', 'A3'),
      desc: t('297 × 420 mm (khổ lớn)', '297 × 420 mm (large)'),
    },
    {
      id: 'b5' as const,
      label: t('Khổ B5', 'B5'),
      desc: t('176 × 250 mm (vở học sinh)', '176 × 250 mm (study notebook)'),
    },
    {
      id: 'letter' as const,
      label: t('Khổ Letter', 'Letter'),
      desc: t('216 × 279 mm (tiêu chuẩn)', '216 × 279 mm (US standard)'),
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-board-modal-title"
      data-testid="create-board-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h2
              id="create-board-modal-title"
              className="text-base font-medium text-slate-900 dark:text-slate-100"
            >
              {t('Tạo bảng trắng mới', 'Create new whiteboard')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t(
                'Chọn loại không gian phù hợp với mục đích học tập hoặc làm việc',
                'Choose a workspace template suited for your study or workflow'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Đóng hộp thoại tạo bảng mới', 'Close create board modal')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Board Type 2x2 Grid */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            role="radiogroup"
            aria-label={t('Loại bảng trắng', 'Board template type')}
          >
            {templates.map((tpl) => {
              const isSelected = selectedType === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  data-testid={`modal-template-${tpl.id}`}
                  onClick={() => handleSelectType(tpl.id)}
                  className={`text-left rounded-xl border overflow-hidden transition-colors duration-150 cursor-pointer flex flex-col ${
                    isSelected
                      ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="relative border-b border-slate-100 dark:border-slate-800">
                    <BoardTemplatePreview type={tpl.id} className="w-full h-24" />
                    {isSelected && (
                      <span
                        aria-hidden="true"
                        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center"
                      >
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {tpl.name}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {tpl.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Notebook Paper Size & Style Selection */}
          {selectedType === 'notebook' && (
            <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {t('Loại giấy viết', 'Paper style')}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t(
                      'Có thể đổi lại bất cứ lúc nào trên thanh công cụ',
                      'You can change this anytime from the toolbar'
                    )}
                  </span>
                </div>
                <div
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                  role="radiogroup"
                  aria-label={t('Loại giấy viết', 'Paper style')}
                >
                  {paperStyles.map((style) => {
                    const isStyleSelected = selectedPaperStyle === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        role="radio"
                        aria-checked={isStyleSelected}
                        data-testid={`notebook-style-${style.id}`}
                        onClick={() => setSelectedPaperStyle(style.id)}
                        className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                          isStyleSelected
                            ? 'border-indigo-600 dark:border-indigo-500 bg-white dark:bg-slate-900 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between gap-1">
                          <span>{style.label}</span>
                          {isStyleSelected && (
                            <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          )}
                        </div>
                        <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          {style.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-indigo-200/70 dark:border-indigo-900/50 pt-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {t('Khổ giấy vở ghi chú', 'Notebook paper size')}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t(
                      'Mặc định khổ A4, không gian trang liên tục',
                      'A4 default, continuous multi-page flow'
                    )}
                  </span>
                </div>
                <div
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                  role="radiogroup"
                  aria-label={t('Khổ giấy', 'Paper size')}
                >
                  {paperSizes.map((paper) => {
                    const isPaperSelected = selectedPaperSize === paper.id;
                    return (
                      <button
                        key={paper.id}
                        type="button"
                        role="radio"
                        aria-checked={isPaperSelected}
                        onClick={() => setSelectedPaperSize(paper.id)}
                        className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                          isPaperSelected
                            ? 'border-indigo-600 dark:border-indigo-500 bg-white dark:bg-slate-900 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                          <span>{paper.label}</span>
                          {isPaperSelected && (
                            <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                          )}
                        </div>
                        <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {paper.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Board Title Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="new-board-title-input"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              {t('Tên bảng trắng', 'Board name')}
            </label>
            <input
              id="new-board-title-input"
              data-testid="create-board-title-input"
              type="text"
              value={boardTitle}
              onChange={(e) => {
                setBoardTitle(e.target.value);
                setDidEditTitle(true);
              }}
              placeholder={t('Nhập tên bảng', 'Enter board name')}
              className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-none transition-colors"
            />
          </div>

          {/* Inline Notice when unlinked local draft exists */}
          {hasUnsavedLocalDraft && (
            <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200/80 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                {language === 'en'
                  ? `Current local draft ("${localDraftTitle || 'Untitled board'}" with ${localDraftElementCount} items) is not saved to Drive and will be replaced when creating a new board.`
                  : `Bản nháp cục bộ hiện tại (“${localDraftTitle || 'Bảng trắng mới'}” gồm ${localDraftElementCount} đối tượng) chưa lưu lên Drive và sẽ được thay thế khi tạo bảng mới.`}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {t('Hủy', 'Cancel')}
          </button>
          <button
            type="submit"
            data-testid="confirm-create-board-button"
            className="h-9 inline-flex items-center gap-1.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('Tạo bảng', 'Create board')}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
