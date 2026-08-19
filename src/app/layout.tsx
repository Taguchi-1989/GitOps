import type { Metadata } from 'next';
import './globals.css';
import { SessionProvider } from 'next-auth/react';
import { MainLayout } from '@/components/ui/MainLayout';
import { ToastProvider } from '@/components/ui/Toast';
import { DisplayModeProvider } from '@/lib/simple-mode-context';
import { ThemeProvider } from '@/lib/theme-context';

export const metadata: Metadata = {
  title: 'FlowOps - GitOps for Business',
  description: '業務フローをコード（YAML）として管理するGitOpsプラットフォーム',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="font-sans">
        <SessionProvider>
          <ThemeProvider>
            <ToastProvider>
              <DisplayModeProvider>
                <MainLayout>{children}</MainLayout>
              </DisplayModeProvider>
            </ToastProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
