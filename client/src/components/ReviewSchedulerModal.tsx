import React, { useState } from 'react';
import { Calendar, Clock, CheckCircle, X, ChevronRight } from './Icons';

interface ReviewSchedulerModalProps {
  onClose: () => void;
  onSchedule: (date: number, openCalendar: boolean) => void;
  studyTitle?: string;
}

export const ReviewSchedulerModal: React.FC<ReviewSchedulerModalProps> = ({ onClose, onSchedule, studyTitle }) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [addToCalendar, setAddToCalendar] = useState(false);

  // Opções baseadas na Curva de Esquecimento de Ebbinghaus
  const strategies = [
    {
      label: 'Amanhã (24h)',
      days: 1,
      desc: 'Primeira revisão. Recupera ~100% da memória.',
      color: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
    },
    {
      label: 'Em 1 Semana (7 dias)',
      days: 7,
      desc: 'Segunda revisão. Consolidação neural.',
      color: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100'
    },
    {
      label: 'Em 2 Semanas (14 dias)',
      days: 14,
      desc: 'Terceira revisão. Fortalecimento de longo prazo.',
      color: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
    },
    {
      label: 'Em 1 Mês (30 dias)',
      days: 30,
      desc: 'Revisão final. Conhecimento cristalizado.',
      color: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
    },
  ];

  const handleConfirm = () => {
    if (selectedOption !== null) {
      const date = new Date();
      date.setDate(date.getDate() + selectedOption);
      onSchedule(date.getTime(), addToCalendar);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="bg-indigo-600 p-6 text-white text-center relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-md">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold">Agendar Revisão Espaçada</h3>
          <p className="text-indigo-100 text-xs mt-1 max-w-xs mx-auto">Baseado na Curva de Esquecimento. Escolha o próximo intervalo ideal para {studyTitle || 'este estudo'}.</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-3">
          {strategies.map((strategy) => (
            <button
              key={strategy.days}
              onClick={() => setSelectedOption(strategy.days)}
              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all group ${selectedOption === strategy.days ? 'border-indigo-600 ring-1 ring-indigo-200 shadow-md' : `border-transparent ${strategy.color}`}`}
            >
              <div className="flex items-center gap-3 text-left">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-white/60 font-bold text-sm shadow-sm`}>{strategy.days}d</div>
                <div>
                  <span className="block font-bold text-sm">{strategy.label}</span>
                  <span className="block text-[10px] opacity-80">{strategy.desc}</span>
                </div>
              </div>
              {selectedOption === strategy.days && <CheckCircle className="w-5 h-5 text-indigo-600 animate-in zoom-in" />}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex flex-col gap-3 bg-gray-50">

          {/* Toggle Calendar */}
          <div className="flex items-center justify-between px-2">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={addToCalendar}
                onChange={(e) => setAddToCalendar(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-all"
              />
              Abrir Google Agenda
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-500 font-bold text-sm hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
            <button
              onClick={handleConfirm}
              disabled={selectedOption === null}
              className="px-6 py-2 bg-indigo-600 text-white font-bold text-sm rounded-lg hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Confirmar Agendamento <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
