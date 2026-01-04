import React, { useState } from 'react';
import { StudyGuide } from '../types';
import { generateTool, isUsageLimitError } from '../services/geminiService';
import { Globe } from './Icons';
import { LimitReason } from '../services/usageLimits';

interface ConnectionsViewProps {
  guide: StudyGuide;
  onUpdateGuide: (guide: StudyGuide) => void;
  onUsageLimit?: (reason: LimitReason) => void;
}

export const ConnectionsView: React.FC<ConnectionsViewProps> = ({ guide, onUpdateGuide, onUsageLimit }) => {
  const [loading, setLoading] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [customInput, setCustomInput] = useState('');

  const domains = ["Biologia", "História", "Tecnologia", "Filosofia", "Arte", "Negócios", "Psicologia", "Cinema"];

  const handleGenerate = async () => {
    const domain = customInput.trim() || selectedDomain;
    if (!domain) {
      alert("Por favor, selecione ou digite uma área para conectar.");
      return;
    }

    setLoading(true);
    try {
      const content = await generateTool('interdisciplinary', guide.title, JSON.stringify(guide.coreConcepts), domain);

      const currentTools = guide.tools || {};
      onUpdateGuide({
        ...guide,
        tools: { ...currentTools, interdisciplinary: content }
      });
    } catch (e) {
      if (isUsageLimitError(e)) {
        onUsageLimit?.(e.reason as LimitReason);
        return;
      }
      console.error(e);
      alert("Erro ao gerar conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col items-center p-8 bg-slate-50 overflow-y-auto">
      <div className="max-w-3xl w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Globe className="w-8 h-8" /></div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Conexões Interdisciplinares</h2>
            <p className="text-gray-500">Conecte "{guide.subject}" com outras áreas do conhecimento.</p>
          </div>
        </div>

        {guide.tools?.interdisciplinary ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6">
            <div className="prose prose-blue max-w-none bg-blue-50/50 p-6 rounded-2xl border border-blue-100 text-slate-700 leading-relaxed text-lg">
              {guide.tools.interdisciplinary.split('\n').map((line, i) => (
                <p key={i} className="mb-2">{line}</p>
              ))}
            </div>

            <div className="pt-6 border-t border-gray-100">
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Gerar nova conexão com outra área:</p>
              {/* Reusa a UI de seleção abaixo */}
              <div className="flex flex-wrap gap-2 mb-4">
                {domains.map(d => (
                  <button
                    key={d}
                    onClick={() => { setSelectedDomain(d); setCustomInput(''); }}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${selectedDomain === d ? 'bg-blue-600 text-white shadow-md transform scale-105' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ou digite: Futebol, Culinária, Marvel..."
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={customInput}
                  onChange={(e) => { setCustomInput(e.target.value); setSelectedDomain(''); }}
                />
                <button
                  onClick={handleGenerate}
                  disabled={loading || (!selectedDomain && !customInput)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? 'Gerando...' : 'Gerar Nova'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-6 text-lg">Escolha uma "lente" diferente para enxergar este conteúdo:</p>

            <div className="flex flex-wrap justify-center gap-3 mb-8 max-w-2xl mx-auto">
              {domains.map(d => (
                <button
                  key={d}
                  onClick={() => { setSelectedDomain(d); setCustomInput(''); }}
                  className={`px-5 py-3 rounded-2xl text-sm font-bold transition-all border-2 ${selectedDomain === d ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-lg transform -translate-y-1' : 'bg-white border-gray-100 text-gray-500 hover:border-blue-200 hover:text-blue-600'}`}
                >
                  {d}
                </button>
              ))}
            </div>

            <div className="max-w-md mx-auto relative mb-8">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-gray-200 -z-10"></div>
              <span className="bg-white px-4 text-gray-400 text-sm font-medium">OU PERSONALIZADO</span>
            </div>

            <div className="max-w-lg mx-auto flex gap-3 mb-8">
              <input
                type="text"
                placeholder="Ex: Star Wars, Jardinagem, Política..."
                className="flex-1 px-5 py-4 rounded-xl border-2 border-gray-200 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none text-lg transition-all"
                value={customInput}
                onChange={(e) => { setCustomInput(e.target.value); setSelectedDomain(''); }}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || (!selectedDomain && !customInput)}
              className="w-full max-w-sm py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-extrabold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-xl shadow-blue-200 disabled:opacity-50 disabled:shadow-none transform hover:-translate-y-1"
            >
              {loading ? 'Conectando Neuralmente...' : 'Criar Conexão Inusitada 🧠'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
