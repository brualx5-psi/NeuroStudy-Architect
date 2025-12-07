
import React, { useState } from 'react';
import { Flashcard } from '../types';
import { Layers, ChevronRight, ChevronDown, RefreshCw } from './Icons';

interface FlashcardsViewProps {
  cards: Flashcard[];
  onGenerate: () => void;
}

export const FlashcardsView: React.FC<FlashcardsViewProps> = ({ cards, onGenerate }) => {
  const [currentCard, setCurrentCard] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!cards || cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <Layers className="w-16 h-16 text-gray-200 mb-4" />
        <h3 className="text-xl font-bold text-gray-700 mb-2">Flashcards</h3>
        <p className="text-gray-500 mb-6 max-w-md">
          Pratique a recuperação ativa com cartões de memorização.
        </p>
        <button 
          onClick={onGenerate}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700"
        >
          Gerar Flashcards
        </button>
      </div>
    );
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFlipped(false);
    setTimeout(() => {
        if (currentCard < cards.length - 1) setCurrentCard(currentCard + 1);
        else setCurrentCard(0); // Loop back
    }, 200);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFlipped(false);
    setTimeout(() => {
        if (currentCard > 0) setCurrentCard(currentCard - 1);
        else setCurrentCard(cards.length - 1);
    }, 200);
  };

  const card = cards[currentCard];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 pb-12 animate-fade-in flex flex-col items-center">
      
      <div className="flex justify-between w-full items-center">
        <h2 className="font-bold text-gray-700 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500"/> 
            Flashcards ({currentCard + 1}/{cards.length})
        </h2>
        <button onClick={onGenerate} className="text-xs flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors">
            <RefreshCw className="w-3 h-3"/> Regerar
        </button>
      </div>

      {/* Card Container */}
      <div 
        className="relative w-full aspect-[3/2] cursor-pointer group [perspective:1000px]"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={`relative w-full h-full duration-500 [transform-style:preserve-3d] transition-transform ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
            
            {/* FRONT */}
            <div className="absolute inset-0 [backface-visibility:hidden] bg-white rounded-2xl shadow-xl border-2 border-indigo-50 flex flex-col items-center justify-center p-8 text-center hover:border-indigo-200 transition-colors overflow-y-auto">
                <span className="absolute top-4 left-4 text-xs font-bold text-indigo-400 uppercase tracking-widest">Frente</span>
                <p className="text-2xl font-bold text-gray-800 leading-relaxed">
                    {card.front}
                </p>
                <span className="absolute bottom-4 text-xs text-gray-400 animate-pulse">Clique para virar</span>
            </div>

            {/* BACK */}
            <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-indigo-600 rounded-2xl shadow-xl flex flex-col items-center justify-center p-8 text-center text-white overflow-y-auto">
                <span className="absolute top-4 left-4 text-xs font-bold text-indigo-200 uppercase tracking-widest">Verso</span>
                <p className="text-xl font-medium leading-relaxed">
                    {card.back}
                </p>
            </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-8">
        <button 
            onClick={handlePrev}
            className="p-4 rounded-full bg-white shadow hover:bg-gray-50 text-gray-600 transition-transform active:scale-95"
        >
            <ChevronRight className="w-6 h-6 rotate-180" />
        </button>

        <span className="text-sm font-bold text-gray-400">
            {currentCard + 1} de {cards.length}
        </span>

        <button 
            onClick={handleNext}
            className="p-4 rounded-full bg-indigo-600 shadow-lg shadow-indigo-200 hover:bg-indigo-700 text-white transition-transform active:scale-95"
        >
            <ChevronRight className="w-6 h-6" />
        </button>
      </div>

    </div>
  );
};
