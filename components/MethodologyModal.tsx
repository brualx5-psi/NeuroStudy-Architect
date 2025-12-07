
import React, { useState } from 'react';
import { X, BrainCircuit, Activity, Rocket, BatteryCharging, CheckCircle, Brain, Target, PenTool, Eye, Sparkles, BookOpen, RefreshCw, GraduationCap, Layers, HelpCircle } from './Icons';

interface MethodologyModalProps {
  onClose: () => void;
}

export const MethodologyModal: React.FC<MethodologyModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'science' | 'howto' | 'modes'>('science');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
        
        {/* Header */}
        <div className="bg-indigo-900 text-white p-6 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <BrainCircuit className="w-8 h-8 text-indigo-300" />
              O Método NeuroStudy
            </h2>
            <p className="text-indigo-200 text-sm mt-1">Advance Organizer + Active Learning + Recuperação Espaçada</p>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 shrink-0">
          <button 
            onClick={() => setActiveTab('science')}
            className={`flex-1 py-4 font-bold text-sm uppercase tracking-wider transition-colors border-b-4 ${activeTab === 'science' ? 'border-indigo-600 text-indigo-800 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            🧠 A Ciência por Trás
          </button>
          <button 
            onClick={() => setActiveTab('howto')}
            className={`flex-1 py-4 font-bold text-sm uppercase tracking-wider transition-colors border-b-4 ${activeTab === 'howto' ? 'border-indigo-600 text-indigo-800 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            🎓 Como Usar o Guia
          </button>
          <button 
            onClick={() => setActiveTab('modes')}
            className={`flex-1 py-4 font-bold text-sm uppercase tracking-wider transition-colors border-b-4 ${activeTab === 'modes' ? 'border-indigo-600 text-indigo-800 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            ⚡ Modos & Níveis
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 font-sans text-gray-700 leading-relaxed scroll-smooth">
          
          {/* TAB: A CIÊNCIA */}
          {activeTab === 'science' && (
            <div className="space-y-8 max-w-3xl mx-auto animate-fade-in">
              <div className="prose prose-indigo max-w-none">
                <p className="text-lg text-gray-600">
                  O método tradicional de estudo (escuta passiva) é falho. O NeuroStudy usa neurociência para transformar o estudo em um processo ativo.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-red-100 shadow-sm">
                 <h3 className="font-bold text-red-700 text-lg mb-3 flex items-center gap-2">
                    <Target className="w-5 h-5" /> Princípio de Pareto (80/20)
                  </h3>
                  <p className="text-sm mb-2 font-semibold">Por que isso é fundamental?</p>
                  <p className="text-sm text-gray-700">
                    Vilfredo Pareto descobriu que 80% dos resultados vêm de 20% das causas. Nos estudos, isso significa que <strong>apenas 20% do conteúdo da aula vai garantir 80% da sua nota</strong> ou aprendizado real. O resto é "palha" (exemplos repetitivos, histórias laterais, pausas).
                  </p>
                  <p className="text-sm text-gray-700 mt-2">
                    O NeuroStudy filtra o conteúdo para te entregar esses 20% de ouro nos "Conceitos Core", economizando sua energia cognitiva.
                  </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
                  <h3 className="font-bold text-indigo-900 text-lg mb-3 flex items-center gap-2">
                    <Brain className="w-5 h-5" /> 1. Advance Organizer
                  </h3>
                  <p className="text-sm mb-4">
                    Prepara as "pastas mentais" do cérebro antes do conteúdo chegar (Schema Theory). Reduz a ansiedade e aumenta o foco.
                  </p>
                </div>

                <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100">
                  <h3 className="font-bold text-emerald-900 text-lg mb-3 flex items-center gap-2">
                    <Activity className="w-5 h-5" /> 2. Active Learning
                  </h3>
                  <p className="text-sm mb-4">
                    Aprender = Agir. Pausar, escrever à mão e responder perguntas ativa a memória muito mais que apenas ler (Retrieval Practice).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: COMO USAR */}
          {activeTab === 'howto' && (
            <div className="space-y-12 max-w-3xl mx-auto animate-fade-in">
              
              {/* PASSO 1: ANTES */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                   <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 border-2 border-indigo-200 flex items-center justify-center font-bold text-xl">1</div>
                   <div className="h-full w-0.5 bg-gray-200 my-2"></div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-indigo-900 mb-2">Antes: O Mapa Prévio</h3>
                  <p className="text-gray-600 mb-4 text-sm">Antes de dar play, leia a <strong>Visão Geral</strong> e os <strong>Conceitos Core</strong>. Isso cria a estrutura mental para o conteúdo se fixar.</p>
                  
                  <div className="bg-indigo-50 p-3 rounded border border-indigo-100 shadow-sm flex items-center gap-3">
                     <BookOpen className="w-5 h-5 text-indigo-600" />
                     <span className="text-sm">Você não estuda mais "no escuro". Você já sabe o que é importante.</span>
                  </div>
                </div>
              </div>

              {/* PASSO 2: DURANTE */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                   <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xl">2</div>
                   <div className="h-full w-0.5 bg-gray-200 my-2"></div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Durante: A Jornada Ativa</h3>
                  <p className="text-gray-600 mb-4 text-sm">Siga os Checkpoints um por um. Não tente consumir tudo de uma vez.</p>
                  
                  <div className="grid gap-3">
                    <div className="flex items-center gap-3 bg-white p-3 rounded border border-gray-100 shadow-sm">
                       <Eye className="w-5 h-5 text-blue-500" />
                       <span className="text-sm"><strong>a) Leia a MISSÃO:</strong> Saiba exatamente o que procurar no trecho.</span>
                    </div>
                    <div className="flex items-center gap-3 bg-white p-3 rounded border border-gray-100 shadow-sm">
                       <div className="font-black text-orange-500 text-lg px-1">⏸️</div>
                       <span className="text-sm"><strong>b) Chegou no ponto? PAUSE!</strong> A mágica acontece na pausa.</span>
                    </div>
                    <div className="flex items-center gap-3 bg-white p-3 rounded border border-gray-100 shadow-sm">
                       <PenTool className="w-5 h-5 text-gray-600" />
                       <span className="text-sm"><strong>c) Ação:</strong> Copie o texto de "Anotar Exatamente Isso" à mão.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PASSO 3: DEPOIS */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                   <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 border-2 border-emerald-200 flex items-center justify-center font-bold text-xl">3</div>
                   <div className="h-full w-0.5 bg-transparent my-2"></div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-emerald-900 mb-2">Depois: Consolidação</h3>
                  <p className="text-gray-600 mb-4 text-sm">Para transferir da memória curta para a longa.</p>
                  
                  <div className="grid gap-3">
                    <div className="flex items-center gap-3 bg-white p-3 rounded border border-gray-100 shadow-sm">
                       <RefreshCw className="w-5 h-5 text-emerald-600" />
                       <span className="text-sm"><strong>Revisão Imediata:</strong> Leia suas anotações em voz alta assim que acabar.</span>
                    </div>
                    <div className="flex items-center gap-3 bg-white p-3 rounded border border-gray-100 shadow-sm">
                       <CheckCircle className="w-5 h-5 text-purple-600" />
                       <span className="text-sm"><strong>Quiz & Cards:</strong> Use as ferramentas de revisão ativa geradas.</span>
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-gray-100 my-4" />

              {/* INSIGHT CEREBRAL (MOVIDO PARA O FINAL) */}
              <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-200">
                  <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-yellow-500" /> Ferramenta Extra: Insight Cerebral
                  </h3>
                  <p className="text-sm text-gray-700 mb-4">
                    Ao lado de cada Conceito Core, você verá um botão de cérebro. Use-o quando travar:
                  </p>
                  
                  <div className="grid gap-3">
                      <div className="bg-white p-3 rounded border border-indigo-100">
                        <strong className="text-indigo-700 block mb-1 text-sm">👶 Explicar como p/ 5 anos</strong>
                        <p className="text-xs text-gray-600">
                          Remove jargões e simplifica a ideia ao máximo (Técnica Feynman).
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded border border-indigo-100">
                        <strong className="text-indigo-700 block mb-1 text-sm">🌍 Exemplo Real</strong>
                        <p className="text-xs text-gray-600">
                          Cria um cenário prático do dia a dia para conectar a teoria com a realidade.
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded border border-indigo-100">
                        <strong className="text-indigo-700 block mb-1 text-sm">🧠 Mnemônico</strong>
                        <p className="text-xs text-gray-600">
                          Gera rimas ou acrônimos para ajudar a decorar listas difíceis.
                        </p>
                      </div>
                  </div>
              </div>

            </div>
          )}

          {/* TAB: MODOS & NÍVEIS */}
          {activeTab === 'modes' && (
            <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">
              
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 p-4 border-b border-gray-200">
                   <h3 className="font-bold text-lg text-gray-900">Modos de Estudo</h3>
                   <p className="text-sm text-gray-500">Adapte o NeuroStudy à sua energia e tempo disponível.</p>
                </div>
                
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Sobrevivência */}
                    <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                        <div className="flex items-start gap-3">
                            <div className="bg-white text-green-600 p-2 rounded-lg shadow-sm border border-green-100 shrink-0">
                                <BatteryCharging className="w-6 h-6"/>
                            </div>
                            <div>
                                <h4 className="font-bold text-green-900 mb-1">Sobrevivência</h4>
                                <p className="text-xs text-green-800 leading-relaxed">
                                    Para dias de pouca energia. Foca apenas no Pareto 80/20 absoluto.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Normal */}
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                        <div className="flex items-start gap-3">
                            <div className="bg-white text-blue-600 p-2 rounded-lg shadow-sm border border-blue-100 shrink-0">
                                <Activity className="w-6 h-6"/>
                            </div>
                            <div>
                                <h4 className="font-bold text-blue-900 mb-1">Normal</h4>
                                <p className="text-xs text-blue-800 leading-relaxed">
                                    O equilíbrio ideal. Blocos médios e mistura saudável de teoria e prática.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Turbo */}
                    <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                         <div className="flex items-start gap-3">
                            <div className="bg-white text-purple-600 p-2 rounded-lg shadow-sm border border-purple-100 shrink-0">
                                <Rocket className="w-6 h-6"/>
                            </div>
                            <div>
                                <h4 className="font-bold text-purple-900 mb-1">Turbo</h4>
                                <p className="text-xs text-purple-800 leading-relaxed">
                                    Extraia 100% do conteúdo. Checkpoints frequentes e granularidade alta.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
              </div>

              {/* SECTION: PROVÃO DA PASTA */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl shadow-sm border border-purple-100 overflow-hidden">
                <div className="p-6 flex items-start gap-4">
                    <div className="bg-white text-purple-600 p-3 rounded-xl shadow-md border border-purple-100 shrink-0">
                        <GraduationCap className="w-8 h-8"/>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-purple-900 mb-2">Recurso Avançado: Provão da Pasta</h3>
                        <p className="text-sm text-purple-800 mb-3">
                            Precisa consolidar um módulo inteiro? O recurso de "Provão" pega <strong>todos os roteiros de uma pasta</strong> e cria um super simulado.
                        </p>
                        <ul className="text-xs text-purple-700 space-y-1 list-disc list-inside bg-white/50 p-3 rounded-lg">
                            <li>Combina conceitos de múltiplas aulas.</li>
                            <li>Gera de 20 a 30 questões integradas.</li>
                            <li>Ideal para semanas de prova ou fechamento de ciclos.</li>
                        </ul>
                    </div>
                </div>
              </div>

              {/* SECTION: QUIZ & FLASHCARDS */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 p-4 border-b border-gray-200">
                   <h3 className="font-bold text-lg text-gray-900">Ferramentas de Revisão</h3>
                </div>
                <div className="p-6 grid gap-6">
                    <div>
                        <h4 className="font-bold text-sm text-gray-800 mb-2 flex items-center gap-2"><HelpCircle className="w-4 h-4 text-indigo-500"/> Níveis do Quiz</h4>
                        <div className="grid gap-2">
                            <div className="flex items-center gap-4">
                                <span className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-bold uppercase w-20 text-center">Fácil</span>
                                <p className="text-xs text-gray-600">Memória direta. Definições, listas e conceitos óbvios. Para ganhar confiança.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="px-3 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded text-xs font-bold uppercase w-20 text-center">Médio</span>
                                <p className="text-xs text-gray-600">Compreensão e aplicação. Explicar com próprias palavras ou dar exemplos práticos.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded text-xs font-bold uppercase w-20 text-center">Difícil</span>
                                <p className="text-xs text-gray-600">Análise e integração. Relacionar conceitos diferentes, criticar ou discutir implicações.</p>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                        <h4 className="font-bold text-sm text-gray-800 mb-2 flex items-center gap-2"><Layers className="w-4 h-4 text-indigo-500"/> Flashcards</h4>
                        <p className="text-sm text-gray-600 mb-2">
                            Cartões de memorização com Frente (Pergunta) e Verso (Resposta).
                        </p>
                        <ul className="text-xs text-gray-500 list-disc list-inside">
                            <li>Use para decorar termos, datas e definições exatas.</li>
                            <li>Tente responder antes de virar o cartão (Active Recall).</li>
                        </ul>
                    </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-6 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors">
            Entendi, vamos estudar!
          </button>
        </div>
      </div>
    </div>
  );
};
