/**
 * FlowOps - Main Layout Component
 *
 * アプリケーション全体のレイアウト
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GitBranch, FileText, AlertCircle, Home, ClipboardList } from 'lucide-react';
import { WelcomeGuide, WelcomeGuideButton } from './WelcomeGuide';

interface MainLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'ダッシュボード', href: '/', icon: Home, description: 'プロジェクト概要' },
  { name: 'フロー', href: '/flows', icon: FileText, description: '業務フロー一覧' },
  { name: 'Issue', href: '/issues', icon: AlertCircle, description: '課題・改善の管理' },
];

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
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
