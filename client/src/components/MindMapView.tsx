import React, { useState } from 'react';
import { StudyGuide } from '../types';
import { generateDiagram, isUsageLimitError } from '../services/geminiService';
import { PenTool, Zap, Download, RefreshCw } from './Icons';
import { LimitReason } from '../services/usageLimits';

interface MindMapViewProps {
  guide: StudyGuide;
  onUpdateGuide: (guide: StudyGuide) => void;
  onUsageLimit?: (reason: LimitReason) => void;
}

export const MindMapView: React.FC<MindMapViewProps> = ({ guide, onUpdateGuide, onUsageLimit }) => {
  const [loading, setLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setImageLoaded(false);
    try {
      // Build rich description from guide content
      const concepts = guide.coreConcepts?.map(c => c.concept).join(', ') || '';
      const description = `Tema: ${guide.subject}. Conceitos principais: ${concepts}. Visão geral: ${guide.overview?.slice(0, 200) || ''}`;

      const { url } = await generateDiagram(description);
      onUpdateGuide({ ...guide, diagramUrl: url });
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

  const handleDownload = async () => {
    if (!guide.diagramUrl) return;

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
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-purple-50/30 overflow-y-auto">
      <div className="max-w-5xl w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-8 min-h-[600px] flex flex-col">
        <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-xl shadow-lg shadow-purple-200">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Mapa Mental</h2>
              <p className="text-sm text-gray-500">Estrutura visual das conexões entre conceitos</p>
            </div>
          </div>
          {guide.diagramUrl && !loading && (
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-sm font-bold hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-slate-100 rounded-2xl border-2 border-dashed border-gray-200 p-8 relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="text-center">
                <RefreshCw className="w-16 h-16 text-purple-600 mx-auto mb-4 animate-spin" />
                <p className="text-purple-700 font-bold text-lg">Desenhando mapa mental...</p>
                <p className="text-gray-500 text-sm mt-2">Criando estrutura visual dos conceitos</p>
              </div>
            </div>
          )}

          {guide.diagramUrl ? (
            <div className="w-full h-full flex flex-col items-center">
              <img
                src={guide.diagramUrl}
                alt="Mapa Mental"
                className={`max-w-full max-h-[65vh] object-contain shadow-2xl rounded-xl bg-white p-4 transition-all duration-500 ${imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                  }`}
                onLoad={() => setImageLoaded(true)}
              />
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => window.open(guide.diagramUrl, '_blank')}
                  className="px-5 py-2.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Abrir em Nova Aba
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="px-5 py-2.5 bg-purple-50 border-2 border-purple-200 text-purple-700 rounded-xl text-sm font-bold hover:bg-purple-100 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regerar
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center max-w-md">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-indigo-400 rounded-full blur-xl opacity-30 animate-pulse"></div>
                <Zap className="w-20 h-20 text-purple-400 relative" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                Visualize as Conexões
              </h3>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Transforme seu estudo em um diagrama interativo que mostra as relações entre os conceitos principais de forma clara e memorável.
              </p>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-2xl hover:shadow-purple-300 transition-all shadow-lg shadow-purple-200 flex items-center gap-3 mx-auto disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <PenTool className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Gerar Mapa Mental
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
