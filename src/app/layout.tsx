import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { MainLayout } from '@/components/ui/MainLayout';
import { ToastProvider } from '@/components/ui/Toast';

// Bootstrap (サーバーサイドでAuditLogリポジトリを初期化)
import '@/lib/bootstrap';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FlowOps - GitOps for Business',
  description: '業務フローをコード（YAML）として管理するGitOpsプラットフォーム',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <ToastProvider>
          <MainLayout>{children}</MainLayout>
        </ToastProvider>
      </body>
    </html>
  );
}
