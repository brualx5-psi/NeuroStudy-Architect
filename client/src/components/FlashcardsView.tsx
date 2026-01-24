
import React, { useState, useEffect, useMemo } from 'react';
import { Flashcard, FlashcardDifficulty } from '../types';
import { Layers, ChevronRight, RefreshCw, Sparkles, Check, Target, Filter } from './Icons';

interface FlashcardsViewProps {
  cards: Flashcard[];
  onGenerate: () => void;
  onUpdateCards?: (cards: Flashcard[]) => void;
}

type FilterType = 'all' | FlashcardDifficulty;

const DIFFICULTY_CONFIG = {
  easy: { label: 'Fácil', color: 'emerald', emoji: '🟢', bgClass: 'from-emerald-500 to-green-600' },
  medium: { label: 'Médio', color: 'amber', emoji: '🟡', bgClass: 'from-amber-500 to-orange-500' },
  hard: { label: 'Difícil', color: 'rose', emoji: '🔴', bgClass: 'from-rose-500 to-red-600' },
  unrated: { label: 'Não Avaliado', color: 'gray', emoji: '⚪', bgClass: 'from-gray-400 to-gray-500' }
};

export const FlashcardsView: React.FC<FlashcardsViewProps> = ({ cards: initialCards, onGenerate, onUpdateCards }) => {
  // Ensure all cards have IDs
  const [cards, setCards] = useState<Flashcard[]>(() =>
    initialCards.map((card, idx) => ({
      ...card,
      id: card.id || `fc-${Date.now()}-${idx}`,
      difficulty: card.difficulty || 'unrated'
    }))
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Sync with parent when initialCards change
  useEffect(() => {
    if (initialCards.length !== cards.length) {
      setCards(initialCards.map((card, idx) => ({
        ...card,
        id: card.id || `fc-${Date.now()}-${idx}`,
        difficulty: card.difficulty || 'unrated'
      })));
      setCurrentIndex(0);
    }
  }, [initialCards]);

  // Filtered cards based on current filter
  const filteredCards = useMemo(() => {
    if (filter === 'all') return cards;
    return cards.filter(c => c.difficulty === filter);
  }, [cards, filter]);

  // Stats for progress
  const stats = useMemo(() => {
    const total = cards.length;
    const easy = cards.filter(c => c.difficulty === 'easy').length;
    const medium = cards.filter(c => c.difficulty === 'medium').length;
    const hard = cards.filter(c => c.difficulty === 'hard').length;
    const unrated = cards.filter(c => c.difficulty === 'unrated').length;
    const easyPercent = total > 0 ? Math.round((easy / total) * 100) : 0;
    return { total, easy, medium, hard, unrated, easyPercent };
  }, [cards]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === ' ') { e.preventDefault(); setIsFlipped(!isFlipped); }
      if (e.key === '1' && isFlipped) handleRate('hard');
      if (e.key === '2' && isFlipped) handleRate('medium');
      if (e.key === '3' && isFlipped) handleRate('easy');
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [currentIndex, isFlipped, filteredCards]);

  const handleRate = (difficulty: FlashcardDifficulty) => {
    const currentCard = filteredCards[currentIndex];
    if (!currentCard) return;

    const updatedCards = cards.map(c =>
      c.id === currentCard.id
        ? { ...c, difficulty, lastReviewedAt: Date.now() }
        : c
    );
    setCards(updatedCards);
    onUpdateCards?.(updatedCards);

    // Auto-advance after rating
    setTimeout(() => {
      setIsFlipped(false);
      setTimeout(() => {
        if (currentIndex < filteredCards.length - 1) {
          setCurrentIndex(currentIndex + 1);
        } else if (filteredCards.length > 1) {
          setCurrentIndex(0);
        }
      }, 200);
    }, 300);
  };

  const handleNext = () => {
    if (filteredCards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex(currentIndex < filteredCards.length - 1 ? currentIndex + 1 : 0);
    }, 200);
  };

  const handlePrev = () => {
    if (filteredCards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex(currentIndex > 0 ? currentIndex - 1 : filteredCards.length - 1);
    }, 200);
  };

  // Empty state
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

  // No cards in current filter
  if (filteredCards.length === 0) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-6 pb-12 animate-fade-in flex flex-col items-center px-4">
        <FilterBar
          filter={filter}
          setFilter={setFilter}
          stats={stats}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          onGenerate={onGenerate}
        />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Target className="w-16 h-16 text-gray-300 mb-4" />
          <h3 className="text-xl font-bold text-gray-600 mb-2">Nenhum cartão nesta categoria</h3>
          <p className="text-gray-500 mb-4">Todos os cartões "{DIFFICULTY_CONFIG[filter as FlashcardDifficulty]?.label}" já foram movidos.</p>
          <button
            onClick={() => setFilter('all')}
            className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-medium hover:bg-indigo-200 transition-all"
          >
            Ver todos os cartões
          </button>
        </div>
      </div>
    );
  }

  const card = filteredCards[currentIndex];
  const progress = ((currentIndex + 1) / filteredCards.length) * 100;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 pb-12 animate-fade-in flex flex-col items-center px-4">
      {/* Filter bar and progress */}
      <FilterBar
        filter={filter}
        setFilter={setFilter}
        stats={stats}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        onGenerate={onGenerate}
      />

      {/* Goal Progress */}
      <div className="w-full bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-emerald-700 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Meta: Todos em Fácil
          </span>
          <span className="text-lg font-bold text-emerald-600">{stats.easyPercent}%</span>
        </div>
        <div className="w-full bg-emerald-100 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-700 rounded-full"
            style={{ width: `${stats.easyPercent}%` }}
          />
        </div>
        <p className="text-xs text-emerald-600 mt-2">
          {stats.easy} de {stats.total} cartões dominados
          {stats.easyPercent === 100 && ' 🎉 Parabéns!'}
        </p>
      </div>

      {/* Progress bar for current filter */}
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500 rounded-full"
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
            {/* Difficulty badge */}
            {card.difficulty && card.difficulty !== 'unrated' && (
              <span className={`absolute top-6 right-6 text-xs font-bold px-2 py-1 rounded-full bg-${DIFFICULTY_CONFIG[card.difficulty].color}-100 text-${DIFFICULTY_CONFIG[card.difficulty].color}-700`}>
                {DIFFICULTY_CONFIG[card.difficulty].emoji} {DIFFICULTY_CONFIG[card.difficulty].label}
              </span>
            )}
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
            <p className="text-2xl font-semibold leading-relaxed drop-shadow-lg mb-16">{card.back}</p>

            {/* Rating buttons */}
            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); handleRate('hard'); }}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-rose-500 to-red-600 rounded-xl font-bold text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                <span className="text-lg">🔴</span>
                <span className="hidden sm:inline">Difícil</span>
                <kbd className="hidden sm:inline text-xs bg-white/20 px-1.5 py-0.5 rounded">1</kbd>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleRate('medium'); }}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl font-bold text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                <span className="text-lg">🟡</span>
                <span className="hidden sm:inline">Médio</span>
                <kbd className="hidden sm:inline text-xs bg-white/20 px-1.5 py-0.5 rounded">2</kbd>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleRate('easy'); }}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl font-bold text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                <span className="text-lg">🟢</span>
                <span className="hidden sm:inline">Fácil</span>
                <kbd className="hidden sm:inline text-xs bg-white/20 px-1.5 py-0.5 rounded">3</kbd>
              </button>
            </div>
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
          <span className="font-bold text-gray-700 text-lg">{currentIndex + 1}</span>
          <span className="text-gray-400 text-xs">de {filteredCards.length}</span>
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
        <kbd className="px-2 py-1 bg-gray-100 rounded text-gray-600 font-mono">←</kbd> <kbd className="px-2 py-1 bg-gray-100 rounded text-gray-600 font-mono">→</kbd> navegar • <kbd className="px-2 py-1 bg-gray-100 rounded text-gray-600 font-mono">Espaço</kbd> virar • <kbd className="px-2 py-1 bg-gray-100 rounded text-gray-600 font-mono">1</kbd><kbd className="px-2 py-1 bg-gray-100 rounded text-gray-600 font-mono">2</kbd><kbd className="px-2 py-1 bg-gray-100 rounded text-gray-600 font-mono">3</kbd> avaliar
      </p>
    </div>
  );
};

// Subcomponent: Filter Bar
interface FilterBarProps {
  filter: FilterType;
  setFilter: (f: FilterType) => void;
  stats: { total: number; easy: number; medium: number; hard: number; unrated: number; easyPercent: number };
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  onGenerate: () => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ filter, setFilter, stats, showFilters, setShowFilters, onGenerate }) => (
  <div className="w-full space-y-3">
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-lg shadow-lg shadow-indigo-200">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-gray-800 text-lg">Flashcards</h2>
          <p className="text-xs text-gray-500">{stats.total} cartões</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${showFilters ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          <Filter className="w-4 h-4" />
          Filtros
        </button>
        <button
          onClick={onGenerate}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 rounded-lg text-sm font-bold transition-all shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Regerar
        </button>
      </div>
    </div>

    {/* Filter pills */}
    {showFilters && (
      <div className="flex flex-wrap gap-2 animate-fade-in">
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')} count={stats.total}>
          Todos
        </FilterPill>
        <FilterPill active={filter === 'easy'} onClick={() => setFilter('easy')} count={stats.easy} color="emerald">
          🟢 Fácil
        </FilterPill>
        <FilterPill active={filter === 'medium'} onClick={() => setFilter('medium')} count={stats.medium} color="amber">
          🟡 Médio
        </FilterPill>
        <FilterPill active={filter === 'hard'} onClick={() => setFilter('hard')} count={stats.hard} color="rose">
          🔴 Difícil
        </FilterPill>
        <FilterPill active={filter === 'unrated'} onClick={() => setFilter('unrated')} count={stats.unrated} color="gray">
          ⚪ Não Avaliados
        </FilterPill>
      </div>
    )}
  </div>
);

// Subcomponent: Filter Pill
interface FilterPillProps {
  active: boolean;
  onClick: () => void;
  count: number;
  color?: string;
  children: React.ReactNode;
}

const FilterPill: React.FC<FilterPillProps> = ({ active, onClick, count, color = 'indigo', children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${active
        ? `bg-${color}-100 text-${color}-700 ring-2 ring-${color}-300`
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
  >
    {children}
    <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? `bg-${color}-200` : 'bg-gray-200'}`}>
      {count}
    </span>
  </button>
);
