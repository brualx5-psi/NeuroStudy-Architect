import React, { useEffect, useState } from 'react';
import { InputType, StudyMode } from '../types';
import { Brain, Sparkles, Activity, Search, FileText, Layers, CheckCircle, BookOpen } from './Icons';

interface ProcessingStatusProps {
  step: 'idle' | 'analyzing' | 'transcribing' | 'generating' | 'slides' | 'quiz' | 'flashcards' | 'diagram' | 'complete';
  type?: 'guide' | 'slides' | 'quiz' | 'flashcards';
  size?: 'normal' | 'large'; // Novo: Permite controlar o tamanho
  mode?: StudyMode;
  isBook?: boolean;
}

// DICAS BASEADAS EM EVIDÊNCIA (PBE)
const TIPS = [
  "🧠 Prática Intercalada (Interleaving): Misturar tipos de problemas melhora a identificação de padrões mais do que estudar em blocos repetitivos.",
  "🗣️ Efeito de Teste (Retrieval Practice): O esforço de tentar lembrar uma resposta fortalece as conexões neurais muito mais do que reler o texto.",
  "🎨 Codificação Dupla: O cérebro processa informações visuais e verbais por canais diferentes. Usar ambos dobra a chance de retenção.",
  "❓ Elaboração Interrogativa: Perguntar 'Por que isso é verdade?' e buscar a resposta cria ganchos mentais profundos.",
  "💤 Consolidação do Sono: O sono REM processa memórias emocionais e complexas, enquanto o sono profundo consolida fatos declarativos.",
  "🍅 Atenção Focada: O cérebro humano só sustenta atenção plena por cerca de 20 a 25 minutos antes de precisar de um 'reset' (Pomodoro).",
  "💧 Hidratação Cognitiva: Uma desidratação de apenas 2% já reduz significativamente a atenção sustentada e a memória de trabalho.",
  "🏃 BDNF e Exercício: Atividades aeróbicas liberam BDNF, uma proteína que atua como 'fertilizante' para o crescimento de novos neurônios.",
  "🔄 Repetição Espaçada: Revisar conteúdo prestes a ser esquecido é o momento mais eficiente para garantir a memória de longo prazo."
];

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ step, type = 'guide', size = 'normal', mode, isBook }) => {
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    // Random tip on mount
    setTipIndex(Math.floor(Math.random() * TIPS.length));

    // Simulated progress based on step
    let targetProgress = 0;
    let speed = 100;

    switch (step) {
      case 'analyzing': targetProgress = 30; speed = 200; break;
      case 'transcribing': targetProgress = 40; speed = 300; break;
      case 'generating': targetProgress = 85; speed = 150; break;
      case 'slides': targetProgress = 90; speed = 100; break;
      case 'quiz': targetProgress = 90; speed = 100; break;
      case 'flashcards': targetProgress = 90; speed = 100; break;
      case 'complete': targetProgress = 100; speed = 50; break;
      default: targetProgress = 10;
    }

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= targetProgress) return prev;
        return Math.min(prev + Math.random() * 2, targetProgress);
      });
    }, speed);

    return () => clearInterval(interval);
  }, [step]);

  const getStepInfo = () => {
    const isPareto = mode === StudyMode.PARETO;

    switch (step) {
      case 'analyzing':
        if (isBook) return { icon: <BookOpen className={size === 'large' ? "w-16 h-16 text-orange-500 animate-bounce" : "w-8 h-8 text-orange-500 animate-bounce"} />, title: "Analisando Obra Literária...", desc: "Identificando estrutura de capítulos e tese central." };
        return isPareto
          ? { icon: <Search className={size === 'large' ? "w-16 h-16 text-red-500 animate-bounce" : "w-8 h-8 text-red-500 animate-bounce"} />, title: "Extraindo a Essência (80/20)...", desc: "Identificando o cerne vital e filtrando o ruído trivial." }
          : { icon: <Search className={size === 'large' ? "w-16 h-16 text-indigo-500 animate-bounce" : "w-8 h-8 text-indigo-500 animate-bounce"} />, title: "Analisando Estrutura Cognitiva...", desc: "Identificando conceitos chave e padrões hierárquicos." };

      case 'transcribing': return { icon: <FileText className={size === 'large' ? "w-16 h-16 text-blue-500 animate-pulse" : "w-8 h-8 text-blue-500 animate-pulse"} />, title: "Processando Mídia...", desc: "Convertendo conteúdo em texto processável." };

      case 'generating':
        if (isBook) return { icon: <Brain className={size === 'large' ? "w-16 h-16 text-orange-500 animate-pulse" : "w-8 h-8 text-orange-500 animate-pulse"} />, title: "Sintetizando Capítulos...", desc: "Criando resumos detalhados e extraindo lições práticas." };
        return isPareto
          ? { icon: <Brain className={size === 'large' ? "w-16 h-16 text-red-500 animate-pulse" : "w-8 h-8 text-red-500 animate-pulse"} />, title: "Sintetizando Resumo Executivo...", desc: "Focando estritamente nos 20% do conteúdo que geram 80% do valor." }
          : { icon: <Brain className={size === 'large' ? "w-16 h-16 text-purple-500 animate-pulse" : "w-8 h-8 text-purple-500 animate-pulse"} />, title: "Sintetizando Conhecimento...", desc: "Aplicando filtros de Pareto (80/20) e criando checkpoints de aprendizado." };

      case 'slides': return { icon: <Activity className={size === 'large' ? "w-16 h-16 text-orange-500 animate-spin" : "w-8 h-8 text-orange-500 animate-spin"} />, title: "Diagramando Slides...", desc: "Estruturando apresentação visual e notas do orador." };
      case 'quiz': return { icon: <CheckCircle className={size === 'large' ? "w-16 h-16 text-green-500 animate-bounce" : "w-8 h-8 text-green-500 animate-bounce"} />, title: "Formulando Questões...", desc: "Criando desafios de recuperação ativa baseados no conteúdo." };
      case 'flashcards': return { icon: <Layers className={size === 'large' ? "w-16 h-16 text-pink-500 animate-pulse" : "w-8 h-8 text-pink-500 animate-pulse"} />, title: "Criando Flashcards...", desc: "Gerando pares de memorização frente/verso para espaçamento." };
      default: return { icon: <Sparkles className={size === 'large' ? "w-16 h-16 text-gray-400" : "w-8 h-8 text-gray-400"} />, title: "Iniciando Processo...", desc: "Preparando ambiente de estudo." };
    }
  };

  const info = getStepInfo();
  const isLarge = size === 'large';

  return (
    <div className={`flex flex-col items-center justify-center p-8 w-full mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 animate-in fade-in zoom-in duration-500 ${isLarge ? 'max-w-2xl py-20' : 'max-w-lg'}`}>

      {/* Icon Wrapper */}
      <div className={`relative ${isLarge ? 'mb-10' : 'mb-6'}`}>
        <div className="absolute inset-0 bg-indigo-100 rounded-full scale-150 opacity-20 animate-ping"></div>
        <div className={`bg-indigo-50 rounded-full relative z-10 ${isLarge ? 'p-8' : 'p-4'}`}>
          {info.icon}
        </div>
      </div>

      {/* Text Info */}
      <h3 className={`${isLarge ? 'text-3xl' : 'text-xl'} font-bold text-gray-800 mb-2 text-center`}>{info.title}</h3>
      <p className={`text-gray-500 text-center mb-8 ${isLarge ? 'text-lg max-w-md' : 'text-sm max-w-xs'}`}>{info.desc}</p>

      {/* Progress Bar */}
      <div className={`w-full bg-gray-100 rounded-full overflow-hidden relative ${isLarge ? 'h-4 mb-10' : 'h-3 mb-6'}`}>
        <div
          className={`bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full transition-all duration-300 ease-out animate-shimmer bg-[length:200%_100%] ${isLarge ? 'h-4' : 'h-3'}`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {/* Neuro Tip (PBE) */}
      <div className={`bg-indigo-50/50 border border-indigo-100 rounded-xl w-full text-center flex flex-col items-center justify-center ${isLarge ? 'p-6 min-h-[120px]' : 'p-3'}`}>
        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Ciência do Aprendizado
        </span>
        <p className={`${isLarge ? 'text-base' : 'text-xs'} text-indigo-900 font-medium italic leading-relaxed`}>
          "{TIPS[tipIndex]}"
        </p>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite linear;
        }
      `}</style>
    </div>
  );
};