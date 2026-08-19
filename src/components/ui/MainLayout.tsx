/**
 * FlowOps - Main Layout Component
 *
 * アプリケーション全体のレイアウト
 */

'use client';

import React, { useCallback, useMemo, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  GitBranch,
  FileText,
  AlertCircle,
  Home,
  ClipboardList,
  ClipboardCheck,
  ScrollText,
  Eye,
  EyeOff,
  Sun,
  Moon,
  BrainCircuit,
  Network,
  Workflow,
  LogOut,
  User,
  ChevronDown,
  ChevronRight,
  Settings2,
  BookOpen,
} from 'lucide-react';
import { WelcomeGuide, WelcomeGuideButton } from './WelcomeGuide';
import { GlobalSearch } from './GlobalSearch';
import { useDisplayMode } from '@/lib/simple-mode-context';
import { useTheme } from '@/lib/theme-context';
import { ADVANCED_NAV_GROUP_LABEL, NAV_LABELS } from '@/lib/ui-labels';

interface MainLayoutProps {
  children: React.ReactNode;
}

const ADVANCED_NAV_STORAGE_KEY = 'flowops-advanced-nav-open';
const ADVANCED_NAV_CHANGE_EVENT = 'flowops-advanced-nav-change';

/** 「管理・専門ツール」を開いたままにするか（利用者の記憶した設定） */
function getAdvancedNavPref(): boolean {
  try {
    return localStorage.getItem(ADVANCED_NAV_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function subscribeAdvancedNav(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener(ADVANCED_NAV_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(ADVANCED_NAV_CHANGE_EVENT, callback);
  };
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  description: string;
}

/** 誰もが使う基本メニュー */
const navigation: NavItem[] = [
  { name: NAV_LABELS.dashboard, href: '/', icon: Home, description: 'プロジェクト概要' },
  { name: NAV_LABELS.flows, href: '/flows', icon: FileText, description: '業務フロー一覧' },
  {
    name: NAV_LABELS.issues,
    href: '/issues',
    icon: AlertCircle,
    description: '困りごとと改善の管理',
  },
  {
    name: NAV_LABELS.approvals,
    href: '/approvals',
    icon: ClipboardCheck,
    description: '判断が必要な一覧',
  },
  { name: NAV_LABELS.help, href: '/help', icon: BookOpen, description: '使い方と用語集' },
];

/** 管理者・専門家向け（デフォルトは折りたたみ） */
const advancedNavigation: NavItem[] = [
  {
    name: NAV_LABELS.audit,
    href: '/audit',
    icon: ScrollText,
    description: '操作履歴・監査レポート',
  },
  {
    name: NAV_LABELS.aims,
    href: '/aims',
    icon: BrainCircuit,
    description: '過去資料・複数AIレビュー',
  },
  { name: NAV_LABELS.dexpi, href: '/dexpi', icon: Network, description: 'P&IDデータの変換・出力' },
  { name: NAV_LABELS.bpmn, href: '/bpmn', icon: Workflow, description: '業務プロセスの変換・出力' },
];

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const { isTechMode, toggleTechMode } = useDisplayMode();
  const { isDark, toggleTheme } = useTheme();
  const { data: session } = useSession();

  const isAdvancedActive = useMemo(
    () => advancedNavigation.some(item => pathname.startsWith(item.href)),
    [pathname]
  );
  // 開閉状態は localStorage に記憶する（初期値は閉じた状態）。
  // 現在ページが配下のときは記憶に関わらず開く。
  const advancedNavPref = useSyncExternalStore(
    subscribeAdvancedNav,
    getAdvancedNavPref,
    () => false
  );
  const isAdvancedOpen = advancedNavPref || isAdvancedActive;

  // 配下ページを表示中は「常に開」で固定する。閉じられると現在地のリンクが消えて
  // 迷子になるため、トグルは無効化して理由を title で示す。
  const isAdvancedLocked = isAdvancedActive;

  const toggleAdvanced = useCallback(() => {
    if (isAdvancedActive) return;
    const next = !getAdvancedNavPref();
    try {
      localStorage.setItem(ADVANCED_NAV_STORAGE_KEY, String(next));
      window.dispatchEvent(new Event(ADVANCED_NAV_CHANGE_EVENT));
    } catch {
      // localStorage unavailable
    }
  }, [isAdvancedActive]);

  const renderNavItem = (item: NavItem) => {
    const isActive =
      pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

    return (
      <li key={item.name}>
        <Link
          href={item.href}
          aria-current={isActive ? 'page' : undefined}
          className={`
            flex items-center gap-3 px-3 py-2.5 rounded-lg
            transition-colors group
            ${isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
          `}
        >
          <item.icon className="w-5 h-5" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">{item.name}</span>
            <span
              className={`text-xs ${isActive ? 'text-gray-400' : 'text-gray-600 group-hover:text-gray-400'}`}
            >
              {item.description}
            </span>
          </div>
        </Link>
      </li>
    );
  };

  // ログイン画面はアプリのシェル（サイドバー）を出さない
  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 md:flex">
      {/* Welcome Guide (初回表示) */}
      <WelcomeGuide />

      {/* Sidebar */}
      <aside className="bg-gray-900 text-white md:fixed md:inset-y-0 md:left-0 md:w-64 md:overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold">FlowOps</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-4 py-6">
          {/* 横断検索（Ctrl+K でも開く） */}
          <div className="mb-4">
            <GlobalSearch />
          </div>

          <p className="px-3 mb-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
            メニュー
          </p>
          <ul className="space-y-1">{navigation.map(renderNavItem)}</ul>

          {/* 管理・専門ツール（デフォルト折りたたみ） */}
          <div className="mt-4 border-t border-gray-800 pt-4">
            <button
              type="button"
              onClick={toggleAdvanced}
              aria-expanded={isAdvancedOpen}
              disabled={isAdvancedLocked}
              title={
                isAdvancedLocked
                  ? 'このグループのページを表示中のため開いたままになります'
                  : undefined
              }
              className="flex min-h-11 w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 transition-colors hover:bg-gray-800 hover:text-white disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-gray-400"
            >
              <Settings2 className="w-4 h-4" />
              <span className="font-medium">{ADVANCED_NAV_GROUP_LABEL}</span>
              {isAdvancedLocked ? null : isAdvancedOpen ? (
                <ChevronDown className="w-4 h-4 ml-auto" />
              ) : (
                <ChevronRight className="w-4 h-4 ml-auto" />
              )}
            </button>
            {isAdvancedOpen && (
              <ul className="mt-1 space-y-1">{advancedNavigation.map(renderNavItem)}</ul>
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-800 p-4 space-y-2 md:absolute md:bottom-0 md:left-0 md:right-0">
          {/* ダークモード トグル */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex min-h-11 items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-800"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-yellow-400" />
            ) : (
              <Moon className="w-4 h-4 text-gray-500" />
            )}
            <span className={isDark ? 'text-yellow-400' : 'text-gray-400'}>ダークモード</span>
            <div
              className={`ml-auto w-8 h-4 rounded-full transition-colors relative ${
                isDark ? 'bg-yellow-500' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                  isDark ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>
          {/* 詳細モード トグル（ONで技術情報を表示） */}
          <button
            type="button"
            onClick={toggleTechMode}
            title="技術情報を表示"
            className="flex min-h-11 items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-800"
          >
            {isTechMode ? (
              <Eye className="w-4 h-4 text-blue-400" />
            ) : (
              <EyeOff className="w-4 h-4 text-gray-500" />
            )}
            <span className="flex flex-col items-start">
              <span className={isTechMode ? 'text-blue-400 font-medium' : 'text-gray-400'}>
                詳細モード
              </span>
              <span className="text-xs text-gray-600">技術情報を表示</span>
            </span>
            <div
              className={`ml-auto w-8 h-4 rounded-full transition-colors relative ${
                isTechMode ? 'bg-blue-500' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                  isTechMode ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>
          <WelcomeGuideButton />
          {/* ログイン中のユーザーとログアウト */}
          {session?.user && (
            <div className="border-t border-gray-800 pt-2 space-y-1">
              <div className="flex items-center gap-2 px-3 py-1.5 text-gray-400 text-xs">
                <User className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{session.user.name || session.user.email}</span>
              </div>
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: '/login' })}
                className="flex min-h-11 items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
              >
                <LogOut className="w-4 h-4" />
                <span>ログアウト</span>
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2 text-gray-500 text-xs">
            <ClipboardList className="w-3.5 h-3.5" />
            <span>GitOps for Business</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="min-h-screen w-full md:ml-64">{children}</main>
    </div>
  );
}
