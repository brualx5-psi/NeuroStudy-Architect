import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  ReactFlowProvider,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  ConnectionLineType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { StudyGuide } from '../types';
import { generateDiagram, isUsageLimitError } from '../services/geminiService';
import { PenTool, Zap, Download, RefreshCw, ZoomIn, ZoomOut, Maximize } from './Icons';
import { LimitReason } from '../services/usageLimits';
import { parseMermaidToFlow, getLayoutedElements } from './MindMapUtils';
import { MindMapNode } from './MindMapNode';

interface MindMapViewProps {
  guide: StudyGuide;
  onUpdateGuide: (guide: StudyGuide) => void;
  onUsageLimit?: (reason: LimitReason) => void;
}

const nodeTypes = {
  mindMap: MindMapNode,
};

const MindMapContent: React.FC<MindMapViewProps> = ({ guide, onUpdateGuide, onUsageLimit }) => {
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Inicializa grafo se houver código
  useEffect(() => {
    if (guide.diagramCode) {
      const { nodes: initialNodes, edges: initialEdges } = parseMermaidToFlow(guide.diagramCode);
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    }
  }, [guide.diagramCode]);

  const handleGenerate = async () => {
    setLoading(true);
    setImageLoaded(false);
    try {
      // Build rich description from guide content
      const concepts = guide.coreConcepts?.map(c => c.concept).slice(0, 6) || [];
      const overview = (guide.overview || '').replace(/\s+/g, ' ').slice(0, 240);
      const description = JSON.stringify({
        subject: guide.subject,
        concepts,
        overview
      });

      // Backend retorna { code, url }
      // O 'code' é o código Mermaid que vamos parsear
      const { url, code } = await generateDiagram(description);

      // Salva ambos. Se code falhar, temos url como backup
      onUpdateGuide({ ...guide, diagramUrl: url, diagramCode: code });

    } catch (e) {
      if (isUsageLimitError(e)) {
        onUsageLimit?.(e.reason as LimitReason);
      } else {
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  };

  const onInit = useCallback((reactFlowInstance: any) => {
    // Fit view on init
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2 }), 50);
  }, []);

  const handleDownloadImage = async () => {
    // Se estiver usando modo interativo, idealmente usaríamos html-to-image
    // Simplificação: Se tiver URL de imagem gerada pelo backend, baixa ela (alta qualidade)
    // Se não, alerta que só screenshot (React Flow export é complexo sem lib extra)

    if (guide.diagramUrl) {
      try {
        const response = await fetch(guide.diagramUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mapa-mental-${guide.subject.toLowerCase().replace(/\s/g, '-')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Download failed:', error);
        alert('Erro ao baixar imagem original.');
      }
    } else {
      alert('Modo interativo: Para baixar, use a captura de tela do seu dispositivo por enquanto (Recurso de exportação HD em breve).');
    }
  };

  // Only show interactive mode if we were able to parse nodes from Mermaid.
  const showInteractive = !!guide.diagramCode && nodes.length > 0;
  const showStatic = !showInteractive && !!guide.diagramUrl;
  const showEmpty = !showInteractive && !showStatic;

  return (
    <div className="h-full flex flex-col items-center justify-center p-4 md:p-8 bg-gradient-to-br from-slate-50 to-purple-50/30 overflow-hidden">
      <div className="w-full h-full max-w-[1600px] bg-white rounded-2xl shadow-lg border border-gray-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-xl shadow-lg shadow-purple-200">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Mapa Mental Interativo</h2>
              <p className="text-sm text-gray-500">Visualização orgânica para melhor fixação</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 rounded-lg text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Gerando...' : 'Regerar'}
            </button>
            {(showInteractive || showStatic) && (
              <button
                onClick={handleDownloadImage}
                className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-md"
              >
                <Download className="w-4 h-4" />
                Baixar
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 relative bg-slate-50 overflow-hidden">

          {showInteractive && (
            <div className="absolute inset-0 z-0">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                connectionLineType={ConnectionLineType.SmoothStep}
                fitView
                onInit={onInit}
                attributionPosition="bottom-right"
                minZoom={0.1}
              >
                <Background color="#e2e8f0" gap={20} size={1} />
                <Controls showInteractive={false} className="bg-white border border-gray-200 shadow-md rounded-lg p-1" />
              </ReactFlow>

              <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur px-4 py-2 rounded-lg text-xs text-gray-500 border border-gray-200 shadow-sm pointer-events-none">
                Dica: Arraste para navegar • Scroll para zoom
              </div>
            </div>
          )}

          {showStatic && !loading && (
            <div className="w-full h-full flex items-center justify-center p-8">
              <img
                src={guide.diagramUrl}
                alt="Mapa Mental Estático"
                className={`max-w-full max-h-full object-contain shadow-2xl rounded-xl transition-all duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setImageLoaded(true)}
              />
            </div>
          )}

          {showEmpty && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-white/50 backdrop-blur-sm z-10">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-indigo-400 rounded-full blur-xl opacity-30 animate-pulse"></div>
                <Zap className="w-20 h-20 text-purple-400 relative" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                Visualize as Conexões
              </h3>
              <p className="text-gray-600 mb-8 leading-relaxed max-w-md">
                Gere um mapa mental interativo com cores vibrantes e foco visual para facilitar a memorização.
              </p>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-2xl hover:shadow-purple-300 transition-all shadow-lg shadow-purple-200 flex items-center gap-3 group"
              >
                <PenTool className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Gerar Mapa Mental
              </button>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
              <RefreshCw className="w-12 h-12 text-purple-600 animate-spin mb-4" />
              <p className="text-purple-900 font-bold text-lg">Desenhando conexões neurais...</p>
              <p className="text-purple-600/70 text-sm">Criando estrutura otimizada para foco</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Wrapper necessário para usar ReactFlow hooks
export const MindMapView: React.FC<MindMapViewProps> = (props) => (
  <ReactFlowProvider>
    <MindMapContent {...props} />
  </ReactFlowProvider>
);
