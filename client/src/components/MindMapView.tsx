import React, { useState } from 'react';
import { StudyGuide } from '../types';
import { generateDiagram, isUsageLimitError } from '../services/geminiService';
import { PenTool, Zap } from './Icons';
import { LimitReason } from '../services/usageLimits';

interface MindMapViewProps {
  guide: StudyGuide;
  onUpdateGuide: (guide: StudyGuide) => void;
  onUsageLimit?: (reason: LimitReason) => void;
}

export const MindMapView: React.FC<MindMapViewProps> = ({ guide, onUpdateGuide, onUsageLimit }) => {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { url } = await generateDiagram(guide.title);
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

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50 overflow-y-auto">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-6 min-h-[500px] flex flex-col">
        <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Zap className="w-6 h-6"/></div>
            <div>
                <h2 className="text-xl font-bold text-gray-900">Mapa Mental</h2>
                <p className="text-sm text-gray-500">Estrutura visual do conteúdo</p>
            </div>
        </div>

        <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200 p-4 relative overflow-hidden">
            {guide.diagramUrl ? (
                <div className="w-full h-full flex flex-col items-center">
                    <img 
                        src={guide.diagramUrl} 
                        alt="Mapa Mental" 
                        className="max-w-full max-h-[60vh] object-contain shadow-lg rounded-lg bg-white" 
                    />
                    <div className="mt-4 flex gap-2">
                        <button onClick={() => window.open(guide.diagramUrl, '_blank')} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-50">Abrir Original</button>
                        <button onClick={handleGenerate} className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-bold hover:bg-purple-100">Regerar</button>
                    </div>
                </div>
            ) : (
                <div className="text-center">
                    <Zap className="w-16 h-16 text-gray-300 mx-auto mb-4"/>
                    <p className="text-gray-500 mb-6 max-w-sm mx-auto">Visualize as conexões entre os conceitos com um diagrama estruturado.</p>
                    <button 
                        onClick={handleGenerate} 
                        disabled={loading}
                        className="px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 flex items-center gap-2 mx-auto disabled:opacity-50"
                    >
                        {loading ? 'Desenhando...' : <><PenTool className="w-5 h-5"/> Gerar Mapa Mental</>}
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
