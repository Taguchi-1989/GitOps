/**
 * FlowOps - Mermaid Viewer Component
 *
 * Mermaid図を表示するコンポーネント
 * クリックイベントをSVG DOM操作で実装
 */

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react';

interface MermaidViewerProps {
  content: string;
  onNodeClick?: (nodeId: string) => void;
  selectedNodeId?: string | null;
  className?: string;
}

/**
 * Mermaid 初期化 (ライト/ダークどちらでも線が視認できるようテーマ変数を明示)
 *
 * デフォルトテーマでは edge stroke が #333 のため、ダーク背景に溶ける。
 * themeVariables で lineColor / edgeLabelBackground / arrowheadColor を
 * 両モードで十分なコントラストになる値に固定する。
 */
const getMermaidTheme = () => {
  if (typeof document === 'undefined') return 'default' as const;
  return document.documentElement.classList.contains('dark') ? 'dark' : 'default';
};

const initMermaid = (mode: 'default' | 'dark') => {
  const isDark = mode === 'dark';
  mermaid.initialize({
    startOnLoad: false,
    theme: mode,
    securityLevel: 'strict',
    flowchart: {
      htmlLabels: false,
      curve: 'basis',
    },
    themeVariables: {
      // 線・矢印 — 背景に対し十分なコントラストを確保
      lineColor: isDark ? '#e5e7eb' : '#374151',
      // エッジラベル背景 — ノード/線と重なっても文字が読めるよう不透明指定
      edgeLabelBackground: isDark ? '#1f2937' : '#ffffff',
      // ノードのテキスト色 — 背景に対して明確に
      textColor: isDark ? '#f3f4f6' : '#111827',
      // ノード塗り/枠 — デフォルトの薄色だと暗背景で潰れるため上書き
      primaryColor: isDark ? '#374151' : '#eff6ff',
      primaryTextColor: isDark ? '#f9fafb' : '#1e3a8a',
      primaryBorderColor: isDark ? '#9ca3af' : '#3b82f6',
      // セカンダリ系 (diamond/parallelogram など)
      secondaryColor: isDark ? '#4b5563' : '#f3f4f6',
      tertiaryColor: isDark ? '#1f2937' : '#f9fafb',
    },
  });
};

initMermaid(getMermaidTheme());

export function MermaidViewer({
  content,
  onNodeClick,
  selectedNodeId,
  className = '',
}: MermaidViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isRendering, setIsRendering] = useState(false);
  const [themeMode, setThemeMode] = useState<'default' | 'dark'>(() => getMermaidTheme());

  // html.dark の付け外しを監視し、Mermaid を再初期化させる
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const sync = () => {
      const next = root.classList.contains('dark') ? 'dark' : 'default';
      setThemeMode(prev => (prev === next ? prev : next));
    };
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Mermaidレンダリング（レースコンディション対策付き）
  useEffect(() => {
    let cancelled = false;
    // テーマモードに合わせて再初期化してから描画
    initMermaid(themeMode);

    const renderDiagram = async () => {
      if (!content) return;

      setIsRendering(true);
      setError(null);

      try {
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { svg } = await mermaid.render(id, content);
        if (!cancelled) setSvgContent(svg);
      } catch (err) {
        if (!cancelled) {
          console.error('Mermaid render error:', err);
          setError(err instanceof Error ? err.message : 'ダイアグラムのレンダリングに失敗しました');
        }
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    };

    renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [content, themeMode]);

  /**
   * MermaidのDOM要素からノードIDを抽出
   * flowchart-{nodeId}-{index} 形式のidから元のnodeIdを復元
   */
  const extractNodeId = useCallback((element: Element): string | null => {
    // data-id属性を優先
    const dataId = element.getAttribute('data-id');
    if (dataId) return dataId;

    // id属性からflowchart-プレフィックスを除去してnodeIdを取得
    const id = element.id;
    if (!id) return null;

    const match = id.match(/^flowchart-(.+?)-\d+$/);
    return match ? match[1] : null;
  }, []);

  // ノードクリックハンドラーの設定
  useEffect(() => {
    if (!containerRef.current || !onNodeClick) return;

    const svg = containerRef.current.querySelector('svg');
    if (!svg) return;

    const handleClick = (event: Event) => {
      const target = event.target as Element;
      const nodeElement = target.closest('.node');

      if (nodeElement) {
        const nodeId = extractNodeId(nodeElement);
        if (nodeId) {
          onNodeClick(nodeId);
        }
      }
    };

    svg.addEventListener('click', handleClick);

    // ホバー効果を追加
    const nodes = svg.querySelectorAll('.node');
    nodes.forEach(node => {
      (node as HTMLElement).style.cursor = 'pointer';
    });

    return () => {
      svg.removeEventListener('click', handleClick);
    };
  }, [svgContent, onNodeClick, extractNodeId]);

  // 選択ノードのハイライト
  useEffect(() => {
    if (!containerRef.current) return;

    const svg = containerRef.current.querySelector('svg');
    if (!svg) return;

    const nodes = svg.querySelectorAll('.node');
    nodes.forEach(node => {
      const nodeId = extractNodeId(node);
      const isSelected = nodeId === selectedNodeId;
      (node as HTMLElement).style.outline = isSelected ? '3px solid #3b82f6' : '';
      (node as HTMLElement).style.outlineOffset = isSelected ? '2px' : '';
      (node as HTMLElement).style.borderRadius = isSelected ? '4px' : '';
    });
  }, [svgContent, selectedNodeId, extractNodeId]);

  // ズーム操作
  const handleZoomIn = useCallback(() => setZoom(z => Math.min(z + 0.25, 3)), []);
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(z - 0.25, 0.5)), []);
  const handleZoomReset = useCallback(() => setZoom(1), []);

  // SVGダウンロード
  const handleDownload = useCallback(() => {
    if (!svgContent) return;

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flow-diagram.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, [svgContent]);

  return (
    <div className={`relative ${className}`}>
      {/* Toolbar */}
      <div className="absolute top-2 right-2 z-10 flex gap-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-sm p-1">
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          title="縮小"
          aria-label="縮小"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="px-2 py-1 text-sm text-gray-600 dark:text-gray-400 min-w-[3rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          title="拡大"
          aria-label="拡大"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomReset}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          title="ズームリセット"
          aria-label="ズームリセット"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={handleDownload}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          title="SVGダウンロード"
          aria-label="SVGダウンロード"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div
        className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
        style={{ maxHeight: '70vh' }}
      >
        {isRendering && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}

        {error && (
          <div className="p-4 text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400">
            <strong>Render Error:</strong> {error}
            <pre className="mt-2 text-xs overflow-x-auto">{content}</pre>
          </div>
        )}

        {!isRendering && !error && svgContent && (
          <div
            ref={containerRef}
            className="mermaid p-4 flex items-center justify-center"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              transition: 'transform 0.2s ease',
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )}
      </div>
    </div>
  );
}
