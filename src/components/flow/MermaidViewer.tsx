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
  className?: string;
}

// Mermaid初期化
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
  },
});

export function MermaidViewer({ content, onNodeClick, className = '' }: MermaidViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isRendering, setIsRendering] = useState(false);

  // Mermaidレンダリング
  useEffect(() => {
    const renderDiagram = async () => {
      if (!content) return;
      
      setIsRendering(true);
      setError(null);
      
      try {
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, content);
        setSvgContent(svg);
      } catch (err) {
        console.error('Mermaid render error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      } finally {
        setIsRendering(false);
      }
    };

    renderDiagram();
  }, [content]);

  // ノードクリックハンドラーの設定
  useEffect(() => {
    if (!containerRef.current || !onNodeClick) return;

    const svg = containerRef.current.querySelector('svg');
    if (!svg) return;

    const handleClick = (event: Event) => {
      const target = event.target as Element;
      
      // ノード要素を探す（.nodeクラスまたは親要素）
      let nodeElement = target.closest('.node');
      
      if (nodeElement) {
        // data-id または id からノードIDを抽出
        const nodeId = nodeElement.getAttribute('data-id') 
          || nodeElement.id?.replace('flowchart-', '')?.split('-')[0];
        
        if (nodeId) {
          onNodeClick(nodeId);
        }
      }
    };

    // クリックイベントを追加
    svg.addEventListener('click', handleClick);

    // ホバー効果を追加
    const nodes = svg.querySelectorAll('.node');
    nodes.forEach(node => {
      (node as HTMLElement).style.cursor = 'pointer';
      node.addEventListener('mouseenter', () => {
        (node as HTMLElement).style.filter = 'brightness(1.1)';
      });
      node.addEventListener('mouseleave', () => {
        (node as HTMLElement).style.filter = '';
      });
    });

    return () => {
      svg.removeEventListener('click', handleClick);
    };
  }, [svgContent, onNodeClick]);

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
      <div className="absolute top-2 right-2 z-10 flex gap-1 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm p-1">
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="px-2 py-1 text-sm text-gray-600 min-w-[3rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomReset}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          title="Reset Zoom"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={handleDownload}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          title="Download SVG"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div 
        className="overflow-auto border border-gray-200 rounded-lg bg-white"
        style={{ maxHeight: '70vh' }}
      >
        {isRendering && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}
        
        {error && (
          <div className="p-4 text-red-600 bg-red-50">
            <strong>Render Error:</strong> {error}
            <pre className="mt-2 text-xs overflow-x-auto">{content}</pre>
          </div>
        )}
        
        {!isRendering && !error && svgContent && (
          <div
            ref={containerRef}
            className="p-4 flex items-center justify-center"
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
