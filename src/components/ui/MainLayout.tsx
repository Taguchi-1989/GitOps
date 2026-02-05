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
  Settings, 
  Home,
  ClipboardList,
} from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Flows', href: '/flows', icon: FileText },
  { name: 'Issues', href: '/issues', icon: AlertCircle },
];

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-gray-900 text-white">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <GitBranch className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold">FlowOps</span>
        </div>

        {/* Navigation */}
        <nav className="px-4 py-6">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/' && pathname.startsWith(item.href));
              
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-lg
                      transition-colors
                      ${isActive
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <div className="flex items-center gap-2 px-3 py-2 text-gray-400 text-sm">
            <ClipboardList className="w-4 h-4" />
            <span>GitOps for Business</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
