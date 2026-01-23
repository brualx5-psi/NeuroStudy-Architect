
import React, { useState, useEffect } from 'react';
import { Flashcard } from '../types';
import { Layers, ChevronRight, RefreshCw, Sparkles } from './Icons';

interface FlashcardsViewProps {
  cards: Flashcard[];
  onGenerate: () => void;
}

export const FlashcardsView: React.FC<FlashcardsViewProps> = ({ cards, onGenerate }) => {
  const [currentCard, setCurrentCard] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === ' ') { e.preventDefault(); setIsFlipped(!isFlipped); }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [currentCard, isFlipped]);

  if (!cards || cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in px-4">
        <div className="relative inline-block mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full blur-2xl opacity-30 animate-pulse"></div>
          <Layers className="w-24 h-24 text-indigo-400 relative" />
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-3">Flashcards de Memorização</h3>
        <p className="text-gray-600 mb-8 max-w-md leading-relaxed">
          Pratique recuperação ativa com cartões otimizados para Spaced Repetition. Perfeito para fixar conceitos-chave.
        </p>
        <button
          onClick={onGenerate}
          className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-2xl hover:shadow-purple-300 transition-all shadow-lg shadow-indigo-200 flex items-center gap-3 group"
        >
          <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" />
          Gerar Flashcards
        </button>
      </div>
    );
  }

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCard(currentCard < cards.length - 1 ? currentCard + 1 : 0);
    }, 200);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCard(currentCard > 0 ? currentCard - 1 : cards.length - 1);
    }, 200);
  };

  const card = cards[currentCard];
  const progress = ((currentCard + 1) / cards.length) * 100;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 pb-12 animate-fade-in flex flex-col items-center px-4">
      {/* Header with progress */}
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-lg shadow-lg shadow-indigo-200">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800 text-lg">Flashcards</h2>
            <p className="text-xs text-gray-500">{currentCard + 1} de {cards.length}</p>
          </div>
        </div>
        <button
          onClick={onGenerate}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 rounded-lg text-sm font-bold transition-all shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Regerar
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500 rounded-full shadow-lg shadow-purple-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Card with 3D flip */}
      <div
        className="relative w-full aspect-[3/2] cursor-pointer group [perspective:1500px]"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={`relative w-full h-full duration-700 [transform-style:preserve-3d] transition-transform ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
          {/* Front */}
          <div className="absolute inset-0 [backface-visibility:hidden] bg-gradient-to-br from-white via-white to-indigo-50 rounded-3xl shadow-2xl border border-indigo-100 flex flex-col items-center justify-center p-10 text-center hover:shadow-indigo-200 transition-all overflow-y-auto">
            <span className="absolute top-6 left-6 text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
              Frente
            </span>
            <p className="text-3xl font-bold text-gray-900 leading-relaxed">{card.front}</p>
            <span className="absolute bottom-6 text-sm text-gray-400 font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4 animate-pulse" />
              Clique para revelar
            </span>
          </div>

          {/* Back */}
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-10 text-center text-white overflow-y-auto">
            <span className="absolute top-6 left-6 text-xs font-bold text-indigo-200 uppercase tracking-wider flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              Verso
            </span>
            <p className="text-2xl font-semibold leading-relaxed drop-shadow-lg">{card.back}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-8 justify-center">
        <button
          onClick={handlePrev}
          className="p-4 rounded-full bg-white border-2 border-gray-200 shadow-lg hover:bg-gray-50 hover:border-gray-300 text-gray-600 transition-all active:scale-95 group"
        >
          <ChevronRight className="w-6 h-6 group-hover:-translate-x-1 transition-transform rotate-180" />
        </button>

        <div className="flex flex-col items-center text-sm">
          <span className="font-bold text-gray-700 text-lg">{currentCard + 1}</span>
          <span className="text-gray-400 text-xs">de {cards.length}</span>
        </div>

        <button
          onClick={handleNext}
          className="p-4 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 shadow-xl shadow-indigo-300 hover:shadow-2xl hover:shadow-purple-400 text-white transition-all active:scale-95 group"
        >
          <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Keyboard hint */}
      <p className="text-xs text-gray-400 text-center">
        Use <kbd className="px-2 py-1 bg-gray-100 rounded text-gray-600 font-mono">←</kbd> <kbd className="px-2 py-1 bg-gray-100 rounded text-gray-600 font-mono">→</kbd> ou <kbd className="px-2 py-1 bg-gray-100 rounded text-gray-600 font-mono">Espaço</kbd> para navegar
      </p>
    </div>
  );
};
