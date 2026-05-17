/**
 * FlowOps - Welcome Guide / Onboarding Modal
 *
 * 初回訪問時にFlowOpsの使い方をステップバイステップで説明する。
 *
 * アクセシビリティ:
 * - role="dialog" aria-modal="true"
 * - Escapeキーで閉じる
 * - 開いた時に最初のフォーカス可能要素へフォーカス移動
 * - 閉じた時は呼び出し元へフォーカスを戻す
 * - 矢印キー(←→)でステップ移動
 */

'use client';

import React, { useState, useEffect, useCallback, useRef, useId } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  FileText,
  AlertCircle,
  Play,
  Sparkles,
  GitMerge,
  Rocket,
  HelpCircle,
} from 'lucide-react';

const STORAGE_KEY = 'flowops-welcome-dismissed';

const steps = [
  {
    icon: Rocket,
    color: 'bg-blue-600',
    title: 'FlowOpsへようこそ',
    description: '業務フローをコード（YAML）として管理し、AIの力で改善するプラットフォームです。',
    details: [
      '業務フローを可視化して全体像を把握',
      '課題をIssueとして記録・追跡',
      'AIが改善提案を自動生成',
      'Git管理で変更履歴を完全追跡',
    ],
  },
  {
    icon: FileText,
    color: 'bg-indigo-600',
    title: 'Step 1: フローを確認する',
    description: 'サイドバーの「フロー」から、登録されている業務フローを閲覧できます。',
    details: [
      'フロー図（ダイアグラム）で全体像を把握',
      'ノード（フロー上のひとつのステップ）をクリックして詳細を確認',
      '各ステップの担当者・使用システムを確認',
    ],
  },
  {
    icon: AlertCircle,
    color: 'bg-red-600',
    title: 'Step 2: 課題を作成する',
    description: 'フローに改善点や問題を見つけたら、課題（Issue）として記録します。',
    details: [
      'フロー画面から直接、対象ノードを指定して作成',
      'または課題一覧の「新規作成」ボタンから',
      'タイトルと説明で課題の内容を記述',
    ],
  },
  {
    icon: Play,
    color: 'bg-blue-700',
    title: 'Step 3: 作業を開始する',
    description:
      '課題の詳細画面で「作業を開始」を押すと、変更を安全に試すための作業スペース（Gitブランチ）が自動作成されます。',
    details: [
      '変更は独立した作業スペースで管理され、本番に影響しません',
      'メインのフロー定義に影響しない',
      '作業スペース名は自動生成（cr/ISS-001-...）',
    ],
  },
  {
    icon: Sparkles,
    color: 'bg-purple-700',
    title: 'Step 4: AIで改善案を生成',
    description: '「AIで改善案を生成」ボタンを押すと、AIがフローの改善提案を作成します。',
    details: [
      'AIが課題の内容とフロー定義を分析',
      '具体的なYAML変更案を自動生成',
      '差分（Diff）プレビューで変更内容を確認',
      '納得できたら「適用」で変更を反映',
    ],
  },
  {
    icon: GitMerge,
    color: 'bg-green-700',
    title: 'Step 5: 確定して完了',
    description: '改善案を適用したら「マージ（統合）して完了」で、変更をメインに反映します。',
    details: [
      '変更内容がメインのフロー定義に反映',
      '課題は自動的に完了状態に',
      '全ての操作は監査ログに記録',
    ],
  },
];

interface WelcomeGuideContentProps {
  onClose: () => void;
  closeLabel: string;
}

function WelcomeGuideContent({ onClose, closeLabel }: WelcomeGuideContentProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const step = steps[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === steps.length - 1;

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onClose();
    }
  }, [currentStep, onClose]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  // 開いた時に「次へ」ボタンへフォーカス、閉じた時に元の位置へ戻す
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    nextButtonRef.current?.focus();
    return () => {
      previousFocusRef.current?.focus?.();
    };
  }, []);

  // Escape, 矢印キーでナビゲーション
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose]);

  // 背景スクロール停止
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Close button */}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="ガイドを閉じる"
          className="absolute top-3 right-3 z-10 inline-flex items-center justify-center w-10 h-10 rounded-lg text-white/80 hover:text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* Header */}
        <div className={`${step.color} px-8 pt-8 pb-6 flex-shrink-0`}>
          <div
            className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-4"
            aria-hidden="true"
          >
            <Icon className="w-7 h-7 text-white" />
          </div>
          <h2 id={titleId} className="text-2xl font-bold text-white">
            {step.title}
          </h2>
          <p id={descriptionId} className="mt-2 text-white text-sm leading-relaxed">
            {step.description}
          </p>
          <p className="mt-3 text-white/80 text-xs">
            ステップ {currentStep + 1} / {steps.length}
          </p>
        </div>

        {/* Content */}
        <div className="px-8 py-6 overflow-y-auto">
          <ul className="space-y-3">
            {step.details.map((detail, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-sm text-gray-800 dark:text-gray-200"
              >
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center text-xs font-semibold mt-0.5"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                {detail}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          {/* Step indicators */}
          <div className="flex gap-1.5" role="tablist" aria-label="ガイドのステップ">
            {steps.map((s, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === currentStep}
                aria-label={`ステップ ${i + 1}: ${s.title}`}
                onClick={() => setCurrentStep(i)}
                className={`h-2 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  i === currentStep
                    ? `${step.color} w-6`
                    : i < currentStep
                      ? 'bg-gray-400 dark:bg-gray-400 w-2'
                      : 'bg-gray-300 dark:bg-gray-500 w-2'
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center gap-1 px-4 py-2 min-h-11 text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                戻る
              </button>
            )}
            <button
              ref={nextButtonRef}
              type="button"
              onClick={handleNext}
              className={`flex items-center gap-1 px-5 py-2 min-h-11 text-sm font-medium text-white rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400 ${step.color} hover:opacity-90`}
            >
              {isLast ? closeLabel : '次へ'}
              {!isLast && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WelcomeGuide() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  }, []);

  if (!isOpen) return null;
  return <WelcomeGuideContent onClose={handleClose} closeLabel="はじめる" />;
}

/**
 * サイドバーのヘルプボタン - ウェルカムガイドを再表示
 */
export function WelcomeGuideButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2.5 min-h-11 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors w-full text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        aria-label="使い方ガイドを開く"
      >
        <HelpCircle className="w-4 h-4" aria-hidden="true" />
        <span>使い方ガイド</span>
      </button>
      {isOpen && <WelcomeGuideContent onClose={() => setIsOpen(false)} closeLabel="閉じる" />}
    </>
  );
}
