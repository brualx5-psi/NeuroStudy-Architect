import React, { useState, useMemo } from 'react';
import { QuizQuestion } from '../types';
import { evaluateOpenAnswer, isUsageLimitError } from '../services/geminiService';
import { CheckCircle, HelpCircle, FileText, RefreshCw, Trash, Mic, Settings, Play, GradCap, AlertTriangle, Eye, EyeOff, Bot, Target, Lightbulb, Activity } from './Icons';
import { LimitReason } from '../services/usageLimits';

interface QuizViewProps {
  questions: QuizQuestion[];
  onGenerate: (config: { quantity: number, difficulty: 'easy' | 'medium' | 'hard' | 'mixed', distribution?: { mc: number, open: number } }) => void;
  onClear: () => void;
  onUsageLimit?: (reason: LimitReason) => void;
}

export const QuizView: React.FC<QuizViewProps> = ({ questions, onGenerate, onClear, onUsageLimit }) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checkedState, setCheckedState] = useState<Record<string, boolean>>({});
  const [showExplanation, setShowExplanation] = useState<Record<string, boolean>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});
  const [showResults, setShowResults] = useState(false);

  // Estados de Configuração
  const [quantity, setQuantity] = useState(6);
  const [distMode, setDistMode] = useState<'auto' | 'custom'>('auto');
  const [mcCount, setMcCount] = useState(3);
  const [openCount, setOpenCount] = useState(3);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed');

  const [listeningId, setListeningId] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<Record<string, string | null>>({});

  // Estados de Avaliação AI
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<Record<string, { status: 'correct' | 'partial' | 'wrong', feedback: string }>>({});

  // Performance Analysis
  const performanceStats = useMemo(() => {
    if (!questions || questions.length === 0) return null;

    const answered = Object.keys(checkedState).filter(id => checkedState[id]);
    const total = questions.length;
    const answeredCount = answered.length;

    let correct = 0;
    let partial = 0;
    let wrong = 0;

    const byDifficulty: Record<string, { correct: number; total: number }> = {
      easy: { correct: 0, total: 0 },
      medium: { correct: 0, total: 0 },
      hard: { correct: 0, total: 0 }
    };

    const byType: Record<string, { correct: number; total: number }> = {
      multiple_choice: { correct: 0, total: 0 },
      open: { correct: 0, total: 0 }
    };

    const wrongTopics: Array<{ question: string; topic: string; difficulty: string }> = [];

    for (const q of questions) {
      if (!checkedState[q.id]) continue;

      byDifficulty[q.difficulty].total++;
      byType[q.type].total++;

      let isCorrect = false;

      if (q.type === 'multiple_choice') {
        isCorrect = answers[q.id] === String(Number(q.correctAnswer));
      } else {
        const evalStatus = evaluations[q.id]?.status;
        isCorrect = evalStatus === 'correct';
        if (evalStatus === 'partial') partial++;
      }

      if (isCorrect) {
        correct++;
        byDifficulty[q.difficulty].correct++;
        byType[q.type].correct++;
      } else {
        wrong++;
        // Extract topic from question for recommendations
        const topicMatch = q.question.match(/(?:sobre|acerca de|relacionado a|conceito de)\s+(.+?)(?:\?|\.|\,|$)/i);
        const topic = topicMatch?.[1] || q.question.slice(0, 50) + '...';
        wrongTopics.push({
          question: q.question,
          topic,
          difficulty: q.difficulty
        });
      }
    }

    const percentage = answeredCount > 0 ? Math.round((correct / answeredCount) * 100) : 0;
    const isComplete = answeredCount === total;

    return {
      total,
      answeredCount,
      correct,
      partial,
      wrong,
      percentage,
      isComplete,
      byDifficulty,
      byType,
      wrongTopics
    };
  }, [questions, checkedState, answers, evaluations]);

  const handleSelectOption = (questionId: string, optionIndex: number) => { setAnswers(prev => ({ ...prev, [questionId]: optionIndex.toString() })); };
  const handleTextAnswer = (questionId: string, text: string) => { setAnswers(prev => ({ ...prev, [questionId]: text })); }
  const handleCheckAnswer = (questionId: string) => { setCheckedState(prev => ({ ...prev, [questionId]: true })); };
  const toggleExplanation = (questionId: string) => { setShowExplanation(prev => ({ ...prev, [questionId]: !prev[questionId] })); };
  const toggleReveal = (questionId: string) => { setRevealedAnswers(prev => ({ ...prev, [questionId]: !prev[questionId] })); };

  const handleRetryQuestion = (questionId: string) => {
    const newAnswers = { ...answers }; delete newAnswers[questionId]; setAnswers(newAnswers);
    const newChecked = { ...checkedState }; delete newChecked[questionId]; setCheckedState(newChecked);
    const newExplanation = { ...showExplanation }; delete newExplanation[questionId]; setShowExplanation(newExplanation);
    const newRevealed = { ...revealedAnswers }; delete newRevealed[questionId]; setRevealedAnswers(newRevealed);
    const newEvals = { ...evaluations }; delete newEvals[questionId]; setEvaluations(newEvals);
  };

  const handleSpeechInput = (questionId: string) => {
    setSpeechError(prev => ({ ...prev, [questionId]: null }));
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { setSpeechError(prev => ({ ...prev, [questionId]: "Navegador não suportado." })); return; }
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onstart = () => { setListeningId(questionId); };
      recognition.onend = () => { setListeningId(null); };
      recognition.onresult = (event: any) => { const transcript = event.results[0][0].transcript; setAnswers(prev => { const current = prev[questionId] || ''; return { ...prev, [questionId]: current + (current ? ' ' : '') + transcript }; }); };
      recognition.onerror = (event: any) => { setListeningId(null); setSpeechError(prev => ({ ...prev, [questionId]: "Erro ao capturar áudio." })); setTimeout(() => { setSpeechError(prev => ({ ...prev, [questionId]: null })); }, 6000); };
      recognition.start();
    } catch (e) { console.error("Speech init error:", e); setSpeechError(prev => ({ ...prev, [questionId]: "Erro ao iniciar microfone." })); }
  };

  const handleAiEvaluation = async (q: QuizQuestion) => {
    const userAnswer = answers[q.id];
    if (!userAnswer) return;
    setEvaluatingId(q.id);
    try {
      const result = await evaluateOpenAnswer(q.question, userAnswer, q.explanation || "Verifique a compreensão.");
      setEvaluations(prev => ({ ...prev, [q.id]: result }));
      setCheckedState(prev => ({ ...prev, [q.id]: true }));
    } catch (error) {
      if (isUsageLimitError(error)) {
        onUsageLimit?.(error.reason as LimitReason);
        return;
      }
      alert("Erro na avaliação IA.");
    } finally {
      setEvaluatingId(null);
    }
  };

  React.useEffect(() => {
    if (distMode === 'auto') {
      setMcCount(Math.ceil(quantity / 2));
      setOpenCount(Math.floor(quantity / 2));
    }
  }, [quantity, distMode]);

  // Auto-show results when quiz is complete
  React.useEffect(() => {
    if (performanceStats?.isComplete && !showResults) {
      setShowResults(true);
    }
  }, [performanceStats?.isComplete]);

  const getDifficultyBadge = (diff: 'easy' | 'medium' | 'hard') => {
    switch (diff) {
      case 'easy': return <span className="text-xs px-2 py-0.5 rounded border border-green-200 bg-green-50 text-green-700 font-bold uppercase tracking-wider">Fácil</span>;
      case 'medium': return <span className="text-xs px-2 py-0.5 rounded border border-yellow-200 bg-yellow-50 text-yellow-700 font-bold uppercase tracking-wider">Médio</span>;
      case 'hard': return <span className="text-xs px-2 py-0.5 rounded border border-red-200 bg-red-50 text-red-700 font-bold uppercase tracking-wider">Difícil</span>;
      default: return null;
    }
  };

  const getScoreEmoji = (percentage: number) => {
    if (percentage >= 90) return '🏆';
    if (percentage >= 70) return '🎉';
    if (percentage >= 50) return '👍';
    if (percentage >= 30) return '💪';
    return '📚';
  };

  const getScoreMessage = (percentage: number) => {
    if (percentage >= 90) return 'Excelente! Você dominou o conteúdo!';
    if (percentage >= 70) return 'Muito bom! Continue assim!';
    if (percentage >= 50) return 'Bom progresso! Revise os erros.';
    if (percentage >= 30) return 'Continue estudando, você está melhorando!';
    return 'Hora de revisar o material. Não desista!';
  };

  if (!questions || questions.length === 0) {
    return (
      <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center animate-fade-in">
        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6"><Settings className="w-8 h-8" /></div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Configurar Quiz</h2>
        <p className="text-gray-500 mb-8">Personalize sua sessão de revisão ativa.</p>
        <div className="space-y-6 text-left">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Quantidade de Questões</label>
            <div className="flex gap-3 mb-3">
              {[3, 6, 9, 12].map(n => (
                <button key={n} onClick={() => setQuantity(n)} className={`flex-1 py-3 px-3 rounded-lg border font-medium transition-all ${quantity === n ? 'bg-indigo-50 text-indigo-700 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <label className="text-sm font-bold text-gray-700">Distribuição de Tipos</label>
              <div className="flex bg-white rounded-lg p-1 border border-gray-200">
                <button onClick={() => setDistMode('auto')} className={`text-xs font-bold px-3 py-1 rounded transition-colors ${distMode === 'auto' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-900'}`}>Auto (50/50)</button>
                <button onClick={() => setDistMode('custom')} className={`text-xs font-bold px-3 py-1 rounded transition-colors ${distMode === 'custom' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-900'}`}>Manual</button>
              </div>
            </div>

            {distMode === 'custom' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-bold text-blue-600 uppercase mb-1 block">Alternativa</span>
                  <input type="number" min="0" max={quantity} value={mcCount} onChange={(e) => { const v = parseInt(e.target.value) || 0; setMcCount(v); setOpenCount(Math.max(0, quantity - v)); }} className="w-full p-2 border border-gray-300 rounded-lg text-center font-bold text-lg" />
                </div>
                <div>
                  <span className="text-xs font-bold text-purple-600 uppercase mb-1 block">Dissertativas</span>
                  <input type="number" min="0" max={quantity} value={openCount} onChange={(e) => { const v = parseInt(e.target.value) || 0; setOpenCount(v); setMcCount(Math.max(0, quantity - v)); }} className="w-full p-2 border border-gray-300 rounded-lg text-center font-bold text-lg" />
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="flex-1 bg-blue-100 p-2 rounded-lg text-center"><span className="block text-blue-700 font-bold text-lg">{mcCount}</span><span className="text-[10px] text-blue-500 uppercase font-bold">Alternativa</span></div>
                <div className="flex-1 bg-purple-100 p-2 rounded-lg text-center"><span className="block text-purple-700 font-bold text-lg">{openCount}</span><span className="text-[10px] text-purple-500 uppercase font-bold">Dissertativas</span></div>
              </div>
            )}
            {(mcCount + openCount !== quantity) && <p className="text-xs text-red-500 mt-2 font-bold text-center">A soma deve ser igual a {quantity}!</p>}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Nível de Dificuldade</label>
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => setDifficulty('mixed')} className={`py-2 rounded-lg border text-xs font-bold transition-all ${difficulty === 'mixed' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>🔀 Misto</button>
              <button onClick={() => setDifficulty('easy')} className={`py-2 rounded-lg border text-xs font-bold transition-all ${difficulty === 'easy' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'}`}>Fácil</button>
              <button onClick={() => setDifficulty('medium')} className={`py-2 rounded-lg border text-xs font-bold transition-all ${difficulty === 'medium' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-gray-600 border-gray-200'}`}>Médio</button>
              <button onClick={() => setDifficulty('hard')} className={`py-2 rounded-lg border text-xs font-bold transition-all ${difficulty === 'hard' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200'}`}>Difícil</button>
            </div>
          </div>

          <button onClick={() => onGenerate({ quantity, difficulty, distribution: { mc: mcCount, open: openCount } })} disabled={mcCount + openCount !== quantity} className="w-full py-4 mt-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-transform active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <Play className="w-5 h-5" />
            Gerar Quiz Personalizado
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 pb-12 animate-fade-in">
      {/* Results Dashboard - Shows when quiz is complete */}
      {showResults && performanceStats && (
        <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl border border-indigo-200 shadow-lg overflow-hidden animate-in slide-in-from-top-4">
          <div className="p-6 border-b border-indigo-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl shadow-lg">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">Resultado do Quiz</h3>
                  <p className="text-sm text-gray-500">{performanceStats.answeredCount} de {performanceStats.total} questões respondidas</p>
                </div>
              </div>
              <button onClick={() => setShowResults(false)} className="text-gray-400 hover:text-gray-600 text-sm font-medium">
                Minimizar
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Score */}
            <div className="text-center">
              <div className="text-6xl mb-2">{getScoreEmoji(performanceStats.percentage)}</div>
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                {performanceStats.percentage}%
              </div>
              <p className="text-gray-600 font-medium mt-2">{getScoreMessage(performanceStats.percentage)}</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-green-100">
                <div className="text-2xl font-bold text-green-600">{performanceStats.correct}</div>
                <div className="text-xs text-green-700 font-medium uppercase">Corretas</div>
              </div>
              {performanceStats.partial > 0 && (
                <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-yellow-100">
                  <div className="text-2xl font-bold text-yellow-600">{performanceStats.partial}</div>
                  <div className="text-xs text-yellow-700 font-medium uppercase">Parciais</div>
                </div>
              )}
              <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-red-100">
                <div className="text-2xl font-bold text-red-600">{performanceStats.wrong}</div>
                <div className="text-xs text-red-700 font-medium uppercase">Incorretas</div>
              </div>
            </div>

            {/* Performance by Difficulty */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <h4 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-500" />
                Desempenho por Dificuldade
              </h4>
              <div className="space-y-2">
                {(['easy', 'medium', 'hard'] as const).map(diff => {
                  const data = performanceStats.byDifficulty[diff];
                  if (data.total === 0) return null;
                  const pct = Math.round((data.correct / data.total) * 100);
                  const colors = {
                    easy: { bg: 'bg-green-100', fill: 'bg-green-500', text: 'text-green-700' },
                    medium: { bg: 'bg-yellow-100', fill: 'bg-yellow-500', text: 'text-yellow-700' },
                    hard: { bg: 'bg-red-100', fill: 'bg-red-500', text: 'text-red-700' }
                  };
                  return (
                    <div key={diff} className="flex items-center gap-3">
                      <span className={`text-xs font-bold uppercase w-16 ${colors[diff].text}`}>
                        {diff === 'easy' ? 'Fácil' : diff === 'medium' ? 'Médio' : 'Difícil'}
                      </span>
                      <div className={`flex-1 h-2 rounded-full ${colors[diff].bg}`}>
                        <div className={`h-full rounded-full ${colors[diff].fill} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-600 w-12 text-right">{data.correct}/{data.total}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recommendations */}
            {performanceStats.wrongTopics.length > 0 && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
                <h4 className="font-bold text-amber-800 text-sm mb-3 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Recomendações de Estudo
                </h4>
                <p className="text-sm text-amber-700 mb-3">
                  Com base nos seus erros, recomendamos revisar:
                </p>
                <ul className="space-y-2">
                  {performanceStats.wrongTopics.slice(0, 5).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-amber-900">
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span className="flex-1">{item.question.length > 80 ? item.question.slice(0, 80) + '...' : item.question}</span>
                      {getDifficultyBadge(item.difficulty as 'easy' | 'medium' | 'hard')}
                    </li>
                  ))}
                </ul>
                {performanceStats.wrongTopics.length > 5 && (
                  <p className="text-xs text-amber-600 mt-2">
                    +{performanceStats.wrongTopics.length - 5} outros tópicos para revisar
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClear}
                className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Novo Quiz
              </button>
              <button
                onClick={() => setShowResults(false)}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Ver Questões
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {performanceStats && !showResults && (
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-gray-700">Progresso</span>
            <span className="text-sm text-gray-500">{performanceStats.answeredCount}/{performanceStats.total} respondidas</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500"
              style={{ width: `${(performanceStats.answeredCount / performanceStats.total) * 100}%` }}
            />
          </div>
          {performanceStats.isComplete && (
            <button
              onClick={() => setShowResults(true)}
              className="w-full mt-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-bold text-sm hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Ver Resultado Final
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="font-bold text-gray-700 flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-500" /> Quiz ({questions.length} questões)</h2>
        <div className="flex gap-2">
          <button onClick={() => onGenerate({ quantity, difficulty, distribution: { mc: mcCount, open: openCount } })} className="text-xs flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors" title="Regerar"><RefreshCw className="w-3 h-3" /> Regerar</button>
          <button onClick={onClear} className="text-xs flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-medium transition-colors" title="Limpar"><Trash className="w-3 h-3" /> Limpar</button>
        </div>
      </div>

      {/* Questions */}
      {questions.map((q, index) => {
        const isAnswered = answers[q.id] !== undefined;
        const isChecked = checkedState[q.id];
        const isRevealed = revealedAnswers[q.id];
        const evaluation = evaluations[q.id];

        let containerClass = "bg-white rounded-xl paper-shadow border transition-all overflow-hidden ";

        if (isChecked) {
          if (q.type === 'multiple_choice') {
            const isUserCorrect = answers[q.id] === String(Number(q.correctAnswer));
            if (isUserCorrect) containerClass += "border-green-300 bg-green-50/30";
            else containerClass += "border-red-300 bg-red-50/30";
          } else {
            if (evaluation?.status === 'correct') containerClass += "border-green-300 bg-green-50/30";
            else if (evaluation?.status === 'partial') containerClass += "border-yellow-300 bg-yellow-50/30";
            else if (evaluation?.status === 'wrong') containerClass += "border-red-300 bg-red-50/30";
            else containerClass += "border-gray-200";
          }
        } else {
          containerClass += "border-gray-100";
        }

        return (
          <div key={q.id} className={containerClass}>
            <div className={`p-4 border-b flex justify-between items-center ${isChecked ? 'bg-gray-50/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-3"><span className="font-bold text-sm text-gray-500">QUESTÃO {index + 1}</span>{getDifficultyBadge(q.difficulty)}</div>
              <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${q.type === 'multiple_choice' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{q.type === 'multiple_choice' ? 'Alternativa' : 'Dissertativa'}</span>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">{q.question}</h3>

              {q.type === 'multiple_choice' && q.options && (
                <div className="space-y-3">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = answers[q.id] === optIdx.toString();
                    const isCorrectOption = Number(q.correctAnswer) === optIdx;

                    let btnClass = "w-full text-left p-4 rounded-lg border-2 transition-all relative ";

                    if (isChecked) {
                      if (isSelected && isCorrectOption) {
                        btnClass += "border-green-500 bg-green-100 text-green-900 shadow-sm";
                      } else if (isSelected && !isCorrectOption) {
                        btnClass += "border-red-500 bg-red-100 text-red-900 shadow-sm";
                      } else if (isRevealed && isCorrectOption) {
                        btnClass += "border-green-500 border-dashed bg-green-50 text-green-900";
                      } else {
                        btnClass += "border-gray-200 opacity-50";
                      }
                    } else {
                      if (isSelected) btnClass += "border-indigo-500 bg-indigo-50 text-indigo-900";
                      else btnClass += "border-gray-200 hover:border-indigo-300 hover:bg-gray-50";
                    }

                    return (
                      <button key={optIdx} onClick={() => !isChecked && handleSelectOption(q.id, optIdx)} className={btnClass} disabled={isChecked}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3"><span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${isSelected || (isChecked && isSelected && isCorrectOption) ? 'border-transparent bg-current text-white' : 'border-gray-300 text-gray-400'}`}>{String.fromCharCode(65 + optIdx)}</span>{opt}</div>
                          {isChecked && isSelected && isCorrectOption && (<div className="flex items-center gap-2 text-green-700 font-bold text-sm"><CheckCircle className="w-5 h-5" /><span>Correta!</span></div>)}
                          {isChecked && isSelected && !isCorrectOption && (<div className="flex items-center gap-2 text-red-700 font-bold text-sm"><AlertTriangle className="w-5 h-5" /><span>Incorreta</span></div>)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === 'open' && (
                <div className="space-y-4">
                  <div className="relative">
                    <textarea className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[120px] ${isChecked ? 'bg-gray-50 text-gray-800' : 'bg-white border-gray-300'}`} placeholder="Escreva sua resposta aqui..." value={answers[q.id] || ''} onChange={(e) => handleTextAnswer(q.id, e.target.value)} disabled={isChecked && evaluation?.status !== undefined} />
                    {!isChecked && (<button onClick={() => handleSpeechInput(q.id)} className={`absolute bottom-3 right-3 p-2 rounded-full shadow-sm transition-all ${listeningId === q.id ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-600'}`} title="Falar Resposta"><Mic className="w-5 h-5" /></button>)}
                  </div>
                  {evaluation && (
                    <div className={`p-4 rounded-xl border flex items-start gap-3 ${evaluation.status === 'correct' ? 'bg-green-50 border-green-200' : evaluation.status === 'partial' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
                      {evaluation.status === 'correct' && <CheckCircle className="w-6 h-6 text-green-600 mt-1" />}
                      {evaluation.status === 'partial' && <AlertTriangle className="w-6 h-6 text-yellow-600 mt-1" />}
                      {evaluation.status === 'wrong' && <AlertTriangle className="w-6 h-6 text-red-600 mt-1" />}
                      <div>
                        <h4 className={`font-bold ${evaluation.status === 'correct' ? 'text-green-800' : evaluation.status === 'partial' ? 'text-yellow-800' : 'text-red-800'}`}>
                          {evaluation.status === 'correct' ? 'Excelente! Resposta Correta' : evaluation.status === 'partial' ? 'Quase lá! Resposta Parcial' : 'Resposta Incorreta'}
                        </h4>
                        <p className="text-sm mt-1 text-gray-700">{evaluation.feedback}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                {!isChecked ? (
                  q.type === 'open' ? (
                    <button onClick={() => handleAiEvaluation(q)} disabled={!isAnswered || evaluatingId === q.id} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                      {evaluatingId === q.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                      {evaluatingId === q.id ? 'Avaliando...' : 'Avaliar'}
                    </button>
                  ) : (
                    <button onClick={() => handleCheckAnswer(q.id)} disabled={!isAnswered} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-md">Verificar Resposta</button>
                  )
                ) : (
                  <>
                    {!isUserCorrect(q.id) && <button onClick={() => handleRetryQuestion(q.id)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-50 flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Tentar Novamente</button>}

                    {q.type === 'multiple_choice' && !isRevealed && !isAnswerCorrect(q) && (
                      <button onClick={() => toggleReveal(q.id)} className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-4 py-2 rounded-lg font-bold hover:bg-yellow-100 flex items-center gap-2">
                        <Eye className="w-4 h-4" /> Ver Resposta Correta
                      </button>
                    )}

                    <button onClick={() => toggleExplanation(q.id)} className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-lg font-bold transition-colors">
                      {showExplanation[q.id] ? 'Ocultar Explicação' : 'Ver Explicação Completa'}
                    </button>
                  </>
                )}
              </div>

              {showExplanation[q.id] && (
                <div className="mt-4 w-full bg-slate-50 border border-slate-200 rounded-lg p-4 animate-fade-in text-left">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="w-5 h-5 text-slate-500 mt-1 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-700 text-sm uppercase mb-1">Explicação Detalhada</p>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{q.explanation}</p>
                      {q.type === 'open' && (
                        <div className="mt-3 p-3 bg-white border border-slate-200 rounded text-sm text-slate-600">
                          <strong className="block text-slate-800 mb-1">Gabarito Sugerido:</strong>
                          {(q as any).correctAnswer}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

        function isUserCorrect(qid: string) {
          if (q.type === 'multiple_choice') return answers[qid] === String(Number(q.correctAnswer));
          return evaluation?.status === 'correct';
        }
        function isAnswerCorrect(question: QuizQuestion) {
          if (question.type === 'multiple_choice') return answers[question.id] === String(Number(question.correctAnswer));
          return evaluations[question.id]?.status === 'correct';
        }
      })}
    </div>
  );
};
