
import React, { useState, useEffect } from 'react';
import { QuizQuestion } from '../types';
import { CheckCircle, HelpCircle, FileText, RefreshCw, Trash, Mic, Settings, Play, X, Activity } from './Icons';

interface QuizViewProps {
  questions: QuizQuestion[];
  onGenerate: (config: {quantity: number, difficulty: 'easy' | 'medium' | 'hard' | 'mixed'}) => void;
  onClear: () => void;
}

export const QuizView: React.FC<QuizViewProps> = ({ questions, onGenerate, onClear }) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checkedState, setCheckedState] = useState<Record<string, boolean>>({}); // For immediate green/red feedback
  const [showExplanation, setShowExplanation] = useState<Record<string, boolean>>({}); // For revealing explanation
  
  // Configuration State
  const [quantity, setQuantity] = useState(6);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed');

  // Speech Recognition State
  const [listeningId, setListeningId] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<Record<string, string | null>>({});

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex.toString() }));
  };

  const handleTextAnswer = (questionId: string, text: string) => {
      setAnswers(prev => ({ ...prev, [questionId]: text }));
  }

  const handleCheckAnswer = (questionId: string) => {
    setCheckedState(prev => ({ ...prev, [questionId]: true }));
  };

  const toggleExplanation = (questionId: string) => {
    setShowExplanation(prev => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  const handleRetryQuestion = (questionId: string) => {
    // Reset state only for this question
    const newAnswers = { ...answers };
    delete newAnswers[questionId];
    setAnswers(newAnswers);

    const newChecked = { ...checkedState };
    delete newChecked[questionId];
    setCheckedState(newChecked);

    const newExplanation = { ...showExplanation };
    delete newExplanation[questionId];
    setShowExplanation(newExplanation);
  };

  const handleSpeechInput = (questionId: string) => {
      // Clear previous errors
      setSpeechError(prev => ({ ...prev, [questionId]: null }));

      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
          setSpeechError(prev => ({ ...prev, [questionId]: "Navegador não suportado." }));
          return;
      }

      try {
          const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          const recognition = new SpeechRecognition();
          
          recognition.lang = 'pt-BR';
          recognition.continuous = false;
          recognition.interimResults = false;

          recognition.onstart = () => {
              setListeningId(questionId);
          };

          recognition.onend = () => {
              setListeningId(null);
          };

          recognition.onresult = (event: any) => {
              const transcript = event.results[0][0].transcript;
              setAnswers(prev => {
                  const current = prev[questionId] || '';
                  return { ...prev, [questionId]: current + (current ? ' ' : '') + transcript };
              });
          };

          recognition.onerror = (event: any) => {
              setListeningId(null);
              let msg = "Erro ao capturar áudio.";
              
              if (event.error === 'not-allowed') {
                  msg = "Permissão negada. Clique no ícone de cadeado/câmera na barra de endereço para permitir o microfone.";
              } else if (event.error === 'no-speech') {
                  msg = "Nenhuma fala detectada. Tente novamente.";
              } else if (event.error === 'network') {
                  msg = "Erro de rede. Verifique sua conexão.";
              }

              setSpeechError(prev => ({ ...prev, [questionId]: msg }));
              
              // Clear error after 5 seconds
              setTimeout(() => {
                  setSpeechError(prev => ({ ...prev, [questionId]: null }));
              }, 6000);
          };

          recognition.start();
      } catch (e) {
          console.error("Speech init error:", e);
          setSpeechError(prev => ({ ...prev, [questionId]: "Erro ao iniciar microfone." }));
      }
  };

  const getDifficultyBadge = (diff: 'easy' | 'medium' | 'hard') => {
    switch (diff) {
      case 'easy': return <span className="text-xs px-2 py-0.5 rounded border border-green-200 bg-green-50 text-green-700 font-bold uppercase tracking-wider">Fácil</span>;
      case 'medium': return <span className="text-xs px-2 py-0.5 rounded border border-yellow-200 bg-yellow-50 text-yellow-700 font-bold uppercase tracking-wider">Médio</span>;
      case 'hard': return <span className="text-xs px-2 py-0.5 rounded border border-red-200 bg-red-50 text-red-700 font-bold uppercase tracking-wider">Difícil</span>;
      default: return null;
    }
  };

  // --- CONFIGURATION VIEW (If no questions) ---
  if (!questions || questions.length === 0) {
    return (
        <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center animate-fade-in">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Settings className="w-8 h-8"/>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Configurar Quiz</h2>
            <p className="text-gray-500 mb-8">Personalize sua sessão de revisão ativa.</p>

            <div className="space-y-6 text-left">
                {/* Quantity */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Quantidade de Questões</label>
                    <div className="flex flex-wrap gap-3">
                        {[3, 6, 10, 20, 30].map(n => (
                            <button
                                key={n}
                                onClick={() => setQuantity(n)}
                                className={`flex-1 py-2 px-3 rounded-lg border font-medium transition-all ${quantity === n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Difficulty */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Nível de Dificuldade</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setDifficulty('mixed')} className={`py-2 px-4 rounded-lg border font-medium transition-all ${difficulty === 'mixed' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>🔀 Misto</button>
                        <button onClick={() => setDifficulty('easy')} className={`py-2 px-4 rounded-lg border font-medium transition-all ${difficulty === 'easy' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>🟢 Fácil</button>
                        <button onClick={() => setDifficulty('medium')} className={`py-2 px-4 rounded-lg border font-medium transition-all ${difficulty === 'medium' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>🟡 Médio</button>
                        <button onClick={() => setDifficulty('hard')} className={`py-2 px-4 rounded-lg border font-medium transition-all ${difficulty === 'hard' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>🔴 Difícil</button>
                    </div>
                </div>

                <button 
                    onClick={() => onGenerate({ quantity, difficulty })}
                    className="w-full py-4 mt-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-transform active:scale-[0.99] flex items-center justify-center gap-2"
                >
                    <Play className="w-5 h-5" /> Gerar Quiz Agora
                </button>
            </div>
        </div>
    );
  }

  // --- QUIZ VIEW ---
  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 pb-12 animate-fade-in">
      
      {/* Header Actions */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
         <h2 className="font-bold text-gray-700 flex items-center gap-2">
             <FileText className="w-5 h-5 text-indigo-500"/> 
             Quiz ({questions.length} questões)
         </h2>
         <div className="flex gap-2">
             <button onClick={() => onGenerate({ quantity, difficulty })} className="text-xs flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors" title="Regerar com mesmas configs">
                 <RefreshCw className="w-3 h-3"/> Regerar
             </button>
             <button onClick={onClear} className="text-xs flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-medium transition-colors" title="Limpar Quiz">
                 <Trash className="w-3 h-3"/> Limpar
             </button>
         </div>
      </div>

      {questions.map((q, index) => {
        const isAnswered = answers[q.id] !== undefined;
        const isChecked = checkedState[q.id];
        const isRevealed = showExplanation[q.id];
        const errorMsg = speechError[q.id];

        // Determine if correct based on type
        let isUserCorrect = false;
        if (isChecked) {
             if (q.type === 'multiple_choice') {
                 isUserCorrect = answers[q.id] === q.correctAnswer;
             } else {
                 // For open questions, simple length check or fuzzy logic (not perfect here without AI check)
                 // For now, assume manual self-check or just mark green if filled. 
                 // Ideally this would be an AI check. We will assume 'neutral' or let user decide?
                 // Current logic: Just turn green if they checked, as Open Ended needs AI validation ideally.
                 // Let's keep it blue/neutral unless we implement AI grading.
                 isUserCorrect = true; 
             }
        }

        // --- CONTAINER STYLING LOGIC ---
        // If checked and Correct: Greenish border/bg
        // If checked and Wrong: Red border/bg (Whole square as requested)
        // Default: White/Gray
        let containerClass = "bg-white rounded-xl paper-shadow border transition-all overflow-hidden ";
        if (isChecked && q.type === 'multiple_choice') {
            if (isUserCorrect) {
                 containerClass += "border-green-300 bg-green-50/30";
            } else {
                 containerClass += "border-red-300 bg-red-50/30";
            }
        } else {
            containerClass += "border-gray-100";
        }

        return (
          <div key={q.id} className={containerClass}>
            <div className={`p-4 border-b flex justify-between items-center ${isChecked && !isUserCorrect ? 'border-red-200 bg-red-50' : isChecked && isUserCorrect ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center gap-3">
                 <span className={`font-bold text-sm ${isChecked && !isUserCorrect ? 'text-red-700' : isChecked && isUserCorrect ? 'text-green-700' : 'text-gray-500'}`}>QUESTÃO {index + 1}</span>
                 {getDifficultyBadge(q.difficulty)}
              </div>
              <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${q.type === 'multiple_choice' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                {q.type === 'multiple_choice' ? 'Múltipla Escolha' : 'Dissertativa'}
              </span>
            </div>

            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">{q.question}</h3>

              {q.type === 'multiple_choice' && q.options && (
                <div className="space-y-3">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = answers[q.id] === optIdx.toString();
                    const isCorrectOption = q.correctAnswer === optIdx.toString();
                    
                    let btnClass = "w-full text-left p-4 rounded-lg border-2 transition-all relative ";
                    
                    if (isChecked) {
                        // Feedback Mode
                        if (isSelected && isCorrectOption) {
                             // User selected correct -> GREEN
                             btnClass += "border-green-500 bg-green-100 text-green-900 shadow-sm"; 
                        } else if (isSelected && !isCorrectOption) {
                             // User selected wrong -> RED
                             btnClass += "border-red-500 bg-red-100 text-red-900 shadow-sm";
                        } else if (!isSelected && isCorrectOption) {
                             // This is the correct option, but user didn't pick it -> Just show outline or keep neutral to let user find out via explanation?
                             // Request says "highlight only correct answer in green". 
                             // But usually you show the right answer if they missed it.
                             // Request specific: "Caso ela erre... quadrado fica vermelho".
                             // Let's keep this neutral/gray so only the user's error is highlighted red, or correct is green.
                             // Standard UX: Show correct answer if missed.
                             btnClass += "border-gray-200 opacity-50"; 
                        } else {
                             // Other wrong options
                             btnClass += "border-gray-100 text-gray-400 opacity-30"; 
                        }
                    } else {
                        // Selection Mode
                        if (isSelected) btnClass += "border-indigo-500 bg-indigo-50 text-indigo-900";
                        else btnClass += "border-gray-200 hover:border-indigo-300 hover:bg-gray-50";
                    }

                    return (
                      <button
                        key={optIdx}
                        onClick={() => !isChecked && handleSelectOption(q.id, optIdx)}
                        className={btnClass}
                        disabled={isChecked}
                      >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${isSelected || (isChecked && isSelected && isCorrectOption) ? 'border-transparent bg-current text-white' : 'border-gray-300 text-gray-400'}`}>
                                    {String.fromCharCode(65 + optIdx)}
                                </span>
                                {opt}
                            </div>
                            
                            {isChecked && isSelected && isCorrectOption && (
                                <div className="flex items-center gap-2 text-green-700 font-bold text-sm">
                                    <CheckCircle className="w-5 h-5" />
                                    <span>Correta!</span>
                                </div>
                            )}
                            
                            {isChecked && isSelected && !isCorrectOption && (
                                <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                                    <X className="w-5 h-5" />
                                    <span>Incorreta</span>
                                </div>
                            )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === 'open' && (
                <div className="relative">
                    <textarea 
                        className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[100px] ${isChecked ? 'bg-gray-50 text-gray-700' : 'bg-white border-gray-300'}`}
                        placeholder="Escreva sua resposta aqui..."
                        value={answers[q.id] || ''}
                        onChange={(e) => handleTextAnswer(q.id, e.target.value)}
                        disabled={isChecked}
                    />
                    {!isChecked && (
                        <button 
                            onClick={() => handleSpeechInput(q.id)}
                            className={`absolute bottom-3 right-3 p-2 rounded-full shadow-sm transition-all ${listeningId === q.id ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-600'}`}
                            title="Falar Resposta (Requer microfone)"
                        >
                            <Mic className="w-5 h-5" />
                        </button>
                    )}
                    {listeningId === q.id && <span className="absolute bottom-3 right-12 text-xs text-red-500 font-bold animate-pulse">Ouvindo...</span>}
                    
                    {/* Error Message for Speech */}
                    {errorMsg && (
                        <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 animate-in fade-in slide-in-from-top-1">
                            ⚠️ {errorMsg}
                        </div>
                    )}
                </div>
              )}

              {/* Action Bar */}
              <div className="mt-6 flex justify-end gap-3">
                {!isChecked ? (
                     <button
                        onClick={() => handleCheckAnswer(q.id)}
                        disabled={!isAnswered}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-200"
                     >
                        Verificar Resposta
                     </button>
                ) : (
                    <>
                        {/* Redo Button for wrong answers */}
                        {!isUserCorrect && (
                            <button
                                onClick={() => handleRetryQuestion(q.id)}
                                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-50 flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Tentar Novamente
                            </button>
                        )}

                        {!isRevealed ? (
                            <button
                                onClick={() => toggleExplanation(q.id)}
                                className={`${isUserCorrect ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-600 hover:bg-gray-700'} text-white px-6 py-2 rounded-lg font-bold shadow-md transition-colors`}
                            >
                                Ver Explicação / Gabarito
                            </button>
                        ) : null}
                    </>
                )}
              </div>
                
              {/* Explanation Area */}
              {isRevealed && (
                 <div className="mt-4 w-full bg-emerald-50 border border-emerald-200 rounded-lg p-4 animate-fade-in text-left">
                    <div className="flex items-start gap-3">
                        <HelpCircle className="w-5 h-5 text-emerald-600 mt-1 shrink-0" />
                        <div>
                            <p className="font-bold text-emerald-800 text-sm uppercase mb-1">Explicação / Gabarito</p>
                            <p className="text-emerald-900 leading-relaxed">
                                {q.type === 'open' && <span className="block font-bold mb-2 p-2 bg-white/50 rounded border border-emerald-100">💡 Resposta Esperada: "{q.correctAnswer}"</span>}
                                {q.explanation}
                            </p>
                        </div>
                    </div>
                </div>
              )}

            </div>
          </div>
        );
      })}
    </div>
  );
};
