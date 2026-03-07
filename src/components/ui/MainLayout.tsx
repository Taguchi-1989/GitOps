/**
 * FlowOps - Main Layout Component
 *
 * アプリケーション全体のレイアウト
 */

'use client';

import React from 'react';
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
];

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const { isSimpleMode, toggleSimpleMode } = useSimpleMode();
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Welcome Guide (初回表示) */}
      <WelcomeGuide />

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-gray-900 text-white">
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
          <p className="px-3 mb-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg
                      transition-colors group
                      ${
                        isActive
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }
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
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800 space-y-2">
          {/* ダークモード トグル */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-800"
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
          {/* かんたんモード トグル */}
          <button
            type="button"
            onClick={toggleSimpleMode}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-800"
          >
            {isSimpleMode ? (
              <Eye className="w-4 h-4 text-blue-400" />
            ) : (
              <EyeOff className="w-4 h-4 text-gray-500" />
            )}
            <span className={isSimpleMode ? 'text-blue-400' : 'text-gray-400'}>かんたんモード</span>
            <div
              className={`ml-auto w-8 h-4 rounded-full transition-colors relative ${
                isSimpleMode ? 'bg-blue-500' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                  isSimpleMode ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>
          <WelcomeGuideButton />
          <div className="flex items-center gap-2 px-3 py-2 text-gray-500 text-xs">
            <ClipboardList className="w-3.5 h-3.5" />
            <span>GitOps for Business</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 min-h-screen">{children}</main>
    </div>
  );
}
