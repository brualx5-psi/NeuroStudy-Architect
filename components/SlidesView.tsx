import React, { useState } from 'react';
import { Slide } from '../types';
import { ChevronRight, ChevronDown, Monitor } from './Icons';

interface SlidesViewProps {
  slides: Slide[];
}

export const SlidesView: React.FC<SlidesViewProps> = ({ slides }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) setCurrentSlide(currentSlide + 1);
  };

  const prevSlide = () => {
    if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
  };

  if (!slides || slides.length === 0) {
    return <div className="text-center p-8 text-gray-500">Nenhum slide gerado ainda.</div>;
  }

  const slide = slides[currentSlide];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Slide Display Area */}
      <div className="aspect-video bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col relative">
        {/* Slide Content */}
        <div className="flex-1 p-12 flex flex-col justify-center bg-gradient-to-br from-white to-slate-50">
          <h2 className="text-3xl font-bold text-slate-800 mb-8 border-b-4 border-indigo-500 pb-4 inline-block self-start">
            {slide.title}
          </h2>
          <ul className="space-y-4">
            {slide.bullets.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-3 text-xl text-slate-700">
                <span className="mt-2 w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                {bullet}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer info */}
        <div className="h-12 bg-slate-100 flex items-center justify-between px-6 text-sm text-slate-500 border-t border-gray-200">
          <span>NeuroStudy Architect</span>
          <span>{currentSlide + 1} / {slides.length}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <button 
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-medium"
        >
          Anterior
        </button>
        
        <div className="flex gap-2">
            {slides.map((_, idx) => (
                <button 
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`w-3 h-3 rounded-full transition-colors ${idx === currentSlide ? 'bg-indigo-600' : 'bg-gray-300'}`}
                />
            ))}
        </div>

        <button 
          onClick={nextSlide}
          disabled={currentSlide === slides.length - 1}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium"
        >
          Próximo
        </button>
      </div>

      {/* Speaker Notes */}
      <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-200">
        <h4 className="text-sm font-bold text-yellow-800 uppercase mb-2 flex items-center gap-2">
            <Monitor className="w-4 h-4" /> Notas do Apresentador
        </h4>
        <p className="text-yellow-900 leading-relaxed font-serif">
            {slide.speakerNotes}
        </p>
      </div>
    </div>
  );
};