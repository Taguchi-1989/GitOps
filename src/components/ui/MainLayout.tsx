/**
 * FlowOps - Main Layout
 * モバイル: ハンバーガーDrawer / デスクトップ: 固定サイドバー
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GitBranch,
  FileText,
  AlertCircle,
  Home,
  ClipboardList,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';
import { WelcomeGuide, WelcomeGuideButton } from './WelcomeGuide';
import { useSimpleMode } from '@/lib/simple-mode-context';
import { useTheme } from '@/lib/theme-context';

interface MainLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'ダッシュボード', href: '/', icon: Home, description: 'プロジェクト概要' },
  { name: 'フロー', href: '/flows', icon: FileText, description: '業務フロー一覧' },
  { name: '課題', href: '/issues', icon: AlertCircle, description: '課題・改善の管理' },
  { name: '監査ログ', href: '/audit', icon: ShieldCheck, description: '操作履歴・エビデンス' },
];

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const { isSimpleMode, toggleSimpleMode } = useSimpleMode();
  const { isDark, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobileMenuOpen]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <a href="#main-content" className="skip-link">
        メインコンテンツへスキップ
      </a>

      <WelcomeGuide />

      <header
        className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 bg-gray-900 text-white shadow"
        role="banner"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <GitBranch className="w-5 h-5" aria-hidden="true" />
          </div>
          <span className="text-lg font-bold">FlowOps</span>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="inline-flex items-center justify-center w-11 h-11 rounded-lg hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label="メニューを開く"
          aria-expanded={isMobileMenuOpen}
          aria-controls="main-navigation"
        >
          <Menu className="w-6 h-6" aria-hidden="true" />
        </button>
      </header>

      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="main-navigation"
        className={`
          fixed inset-y-0 left-0 w-64 bg-gray-900 text-white z-40
          transform transition-transform duration-200 ease-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
        aria-label="メインナビゲーション"
      >
        <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <GitBranch className="w-5 h-5" aria-hidden="true" />
            </div>
            <span className="text-lg font-bold">FlowOps</span>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label="メニューを閉じる"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="px-4 py-6" aria-label="主要セクション">
          <p className="px-3 mb-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
            メニュー
          </p>
          <ul className="space-y-1">
            {navigation.map(item => {
              const isActive =
                pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg
                      transition-colors group min-h-11
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
                      ${
                        isActive
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5" aria-hidden="true" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span
                        className={`text-xs ${isActive ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-300'}`}
                      >
                        {item.description}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800 space-y-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-pressed={isDark}
            aria-label={isDark ? 'ダークモードを無効にする' : 'ダークモードを有効にする'}
            className="flex items-center gap-2 w-full px-3 py-2.5 min-h-11 rounded-lg text-sm transition-colors hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-yellow-400" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4 text-gray-400" aria-hidden="true" />
            )}
            <span className={isDark ? 'text-yellow-400' : 'text-gray-300'}>ダークモード</span>
            <span
              className={`ml-auto w-9 h-5 rounded-full transition-colors relative ${
                isDark ? 'bg-yellow-500' : 'bg-gray-600'
              }`}
              aria-hidden="true"
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  isDark ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>
          <button
            type="button"
            onClick={toggleSimpleMode}
            aria-pressed={isSimpleMode}
            aria-label={isSimpleMode ? 'かんたんモードを無効にする' : 'かんたんモードを有効にする'}
            className="flex items-center gap-2 w-full px-3 py-2.5 min-h-11 rounded-lg text-sm transition-colors hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {isSimpleMode ? (
              <Eye className="w-4 h-4 text-blue-400" aria-hidden="true" />
            ) : (
              <EyeOff className="w-4 h-4 text-gray-400" aria-hidden="true" />
            )}
            <span className={isSimpleMode ? 'text-blue-400' : 'text-gray-300'}>かんたんモード</span>
            <span
              className={`ml-auto w-9 h-5 rounded-full transition-colors relative ${
                isSimpleMode ? 'bg-blue-500' : 'bg-gray-600'
              }`}
              aria-hidden="true"
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  isSimpleMode ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>
          <WelcomeGuideButton />
          <div className="flex items-center gap-2 px-3 py-2 text-gray-400 text-xs">
            <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />
            <span>GitOps for Business</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main id="main-content" className="md:ml-64 min-h-screen" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
