/**
 * FlowOps - Welcome Guide / Onboarding Modal
 *
 * 初回訪問時にFlowOpsの使い方をステップバイステップで説明する
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
    color: 'bg-blue-500',
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
    color: 'bg-indigo-500',
    title: 'Step 1: フローを確認する',
    description: 'サイドバーの「Flows」から、登録されている業務フローを閲覧できます。',
    details: [
      'フロー図（ダイアグラム）で全体像を把握',
      'ノードをクリックして詳細を確認',
      '各ステップの担当者・使用システムを確認',
    ],
  },
  {
    icon: AlertCircle,
    color: 'bg-red-500',
    title: 'Step 2: Issueを作成する',
    description: 'フローに改善点や問題を見つけたら、Issueとして記録します。',
    details: [
      'フロー画面から直接、対象ノードを指定して作成',
      'またはIssue一覧の「新規作成」ボタンから',
      'タイトルと説明で課題の内容を記述',
    ],
  },
  {
    icon: Play,
    color: 'bg-blue-600',
    title: 'Step 3: 作業を開始する',
    description: 'Issue詳細画面で「作業を開始」を押すと、Gitブランチが自動作成されます。',
    details: [
      '変更は独立したブランチで安全に管理',
      'メインのフロー定義に影響しない',
      'ブランチ名は自動生成（cr/ISS-001-...）',
    ],
  },
  {
    icon: Sparkles,
    color: 'bg-purple-600',
    title: 'Step 4: AIで改善案を生成',
    description: '「AIで改善案を生成」ボタンを押すと、LLMがフローの改善提案を作成します。',
    details: [
      'AIがIssueの内容とフロー定義を分析',
      '具体的なYAML変更案を自動生成',
      'Diff（差分）プレビューで変更内容を確認',
      '納得できたら「適用」で変更をコミット',
    ],
  },
  {
    icon: GitMerge,
    color: 'bg-green-600',
    title: 'Step 5: マージして完了',
    description: '改善案を適用したら「マージして完了」で、変更をメインブランチに統合します。',
    details: [
      '変更内容がメインのフロー定義に反映',
      'Issueは自動的にクローズ',
      '全ての操作は監査ログに記録',
    ],
  },
];

export function WelcomeGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

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

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (!isOpen) return null;

  const step = steps[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with colored bar */}
        <div className={`${step.color} px-8 pt-8 pb-6`}>
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-4">
            <Icon className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">{step.title}</h2>
          <p className="mt-2 text-white/90 text-sm leading-relaxed">{step.description}</p>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          <ul className="space-y-3">
            {step.details.map((detail, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center text-xs font-medium mt-0.5">
                  {i + 1}
                </span>
                {detail}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="px-8 pb-6 flex items-center justify-between">
          {/* Step indicators */}
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentStep
                    ? `${step.color} w-6`
                    : i < currentStep
                      ? 'bg-gray-400 dark:bg-gray-500'
                      : 'bg-gray-200 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                戻る
              </button>
            )}
            <button
              onClick={handleNext}
              className={`flex items-center gap-1 px-5 py-2 text-sm text-white rounded-lg transition-colors ${step.color} hover:opacity-90`}
            >
              {isLast ? 'はじめる' : '次へ'}
              {!isLast && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * サイドバーのヘルプボタン - ウェルカムガイドを再表示
 */
export function WelcomeGuideButton() {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsOpen(true);
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors w-full text-sm"
        title="使い方ガイドを表示"
      >
        <HelpCircle className="w-4 h-4" />
        <span>使い方ガイド</span>
      </button>
      {isOpen && <WelcomeGuideReopen onClose={() => setIsOpen(false)} />}
    </>
  );
}

function WelcomeGuideReopen({ onClose }: { onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const step = steps[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 z-10"
        >
          <X className="w-5 h-5" />
        </button>
        <div className={`${step.color} px-8 pt-8 pb-6`}>
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-4">
            <Icon className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">{step.title}</h2>
          <p className="mt-2 text-white/90 text-sm leading-relaxed">{step.description}</p>
        </div>
        <div className="px-8 py-6">
          <ul className="space-y-3">
            {step.details.map((detail, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center text-xs font-medium mt-0.5">
                  {i + 1}
                </span>
                {detail}
              </li>
            ))}
          </ul>
        </div>
        <div className="px-8 pb-6 flex items-center justify-between">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentStep
                    ? `${step.color} w-6`
                    : i < currentStep
                      ? 'bg-gray-400 dark:bg-gray-500'
                      : 'bg-gray-200 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                戻る
              </button>
            )}
            <button
              onClick={handleNext}
              className={`flex items-center gap-1 px-5 py-2 text-sm text-white rounded-lg transition-colors ${step.color} hover:opacity-90`}
            >
              {isLast ? '閉じる' : '次へ'}
              {!isLast && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
