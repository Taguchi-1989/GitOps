import type { Metadata } from 'next';
import './globals.css';
import { MainLayout } from '@/components/ui/MainLayout';
import { ToastProvider } from '@/components/ui/Toast';
import { SimpleModeProvider } from '@/lib/simple-mode-context';
import { ThemeProvider } from '@/lib/theme-context';

export const metadata: Metadata = {
  title: 'FlowOps - GitOps for Business',
  description: '業務フローをコード（YAML）として管理するGitOpsプラットフォーム',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="font-sans">
        <ThemeProvider>
          <ToastProvider>
            <SimpleModeProvider>
              <MainLayout>{children}</MainLayout>
            </SimpleModeProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
