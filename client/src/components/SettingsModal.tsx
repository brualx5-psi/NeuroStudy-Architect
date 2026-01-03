import React, { useEffect, useState } from 'react';
import { Settings, X, Globe, Crown, HelpCircle } from './Icons';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { LABELS } from '../services/userProfileService';
import { PreferredSource } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TabKey;
}

type TabKey = 'search' | 'productivity' | 'appearance' | 'notifications' | 'account';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, initialTab }) => {
  const { settings, updateSettings } = useSettings();
  const { isPaid, planLabel, limits, usage } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab || 'search');
  const [defaultSource, setDefaultSource] = useState<PreferredSource>('auto');
  const [preferPtEnHint, setPreferPtEnHint] = useState(true);
  const [focusArea, setFocusArea] = useState('Geral');
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [autoStartBreak, setAutoStartBreak] = useState(false);
  const [showPomodoro, setShowPomodoro] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [reviewReminders, setReviewReminders] = useState(false);
  const [pomodoroAlerts, setPomodoroAlerts] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>(typeof Notification !== 'undefined' ? Notification.permission : 'default');

  const focusRecommendations: Record<string, { focus: number; break: number; autoStartBreak: boolean; label: string }> = {
    'Concurso': { focus: 50, break: 10, autoStartBreak: false, label: 'Ciclos longos para provas extensas' },
    'Residência': { focus: 50, break: 10, autoStartBreak: false, label: 'Carga alta, pausas moderadas' },
    'Pós-graduação': { focus: 45, break: 10, autoStartBreak: false, label: 'Leitura densa, intervalos curtos' },
    'Graduação': { focus: 30, break: 5, autoStartBreak: false, label: 'Sessões equilibradas' },
    'Geral': { focus: 25, break: 5, autoStartBreak: false, label: 'Pomodoro clássico' },
    'Outro': { focus: 30, break: 5, autoStartBreak: false, label: 'Sugestão padrão' }
  };

  const applyFocusRecommendation = () => {
    const rec = focusRecommendations[focusArea] || focusRecommendations['Geral'];
    setFocusMinutes(rec.focus);
    setBreakMinutes(rec.break);
    setAutoStartBreak(rec.autoStartBreak);
  };

  useEffect(() => {
    if (!isOpen) return;
    if (initialTab) setActiveTab(initialTab);
    setDefaultSource(settings.search.defaultSource);
    setPreferPtEnHint(settings.search.preferPtEnHint);
    setFocusArea(settings.focusArea || 'Geral');
    setFocusMinutes(settings.pomodoro.focusMinutes);
    setBreakMinutes(settings.pomodoro.breakMinutes);
    setAutoStartBreak(settings.pomodoro.autoStartBreak);
    setShowPomodoro(settings.pomodoro.showWidget);
    setTheme(settings.theme);
    setReviewReminders(settings.notifications.reviewReminders);
    setPomodoroAlerts(settings.notifications.pomodoroAlerts);
    setSoundEnabled(settings.notifications.soundEnabled);
    setPermission(typeof Notification !== 'undefined' ? Notification.permission : 'default');
  }, [isOpen, initialTab, settings.search.defaultSource, settings.search.preferPtEnHint, settings.focusArea, settings.pomodoro, settings.theme, settings.notifications]);

  if (!isOpen) return null;

  const handleSave = () => {
    updateSettings({
      search: {
        defaultSource,
        preferPtEnHint
      },
      focusArea,
      pomodoro: {
        focusMinutes,
        breakMinutes,
        autoStartBreak,
        showWidget: showPomodoro
      },
      theme,
      notifications: {
        reviewReminders,
        pomodoroAlerts,
        soundEnabled
      }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">Configurações</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">Pesquisa, Produtividade e Aparência</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-gray-100 dark:border-slate-700 px-4">
          {[
            { key: 'search', label: 'Pesquisa' },
            { key: 'productivity', label: 'Produtividade' },
            { key: 'appearance', label: 'Aparência' },
            { key: 'notifications', label: 'Notificações' },
            { key: 'account', label: 'Conta/Plano' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`px-4 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === tab.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {activeTab === 'search' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-gray-800 mb-2">Fonte padrão</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['auto', 'pubmed', 'openalex', 'grounding'] as PreferredSource[]).map(source => (
                    <label
                      key={source}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${defaultSource === source ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'}`}
                    >
                      <input
                        type="radio"
                        name="default-source"
                        checked={defaultSource === source}
                        onChange={() => setDefaultSource(source)}
                        className="text-indigo-600"
                      />
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-gray-800">{LABELS.preferredSource[source]}</span>
                        <span className="text-xs text-gray-500">
                          {source === 'auto' && 'Escolhe a melhor fonte para você'}
                          {source === 'pubmed' && 'Saúde e medicina (PubMed)'}
                          {source === 'openalex' && 'Artigos acadêmicos gerais'}
                          {source === 'grounding' && 'Busca web com IA'}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="font-bold text-sm text-gray-800">Sugerir busca em EN (PT→EN)</p>
                    <p className="text-xs text-gray-500">Mais resultados e qualidade nos termos em inglês.</p>
                  </div>
                </div>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferPtEnHint}
                    onChange={(e) => setPreferPtEnHint(e.target.checked)}
                    className="sr-only"
                  />
                  <span className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${preferPtEnHint ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                    <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${preferPtEnHint ? 'translate-x-4' : ''}`}></span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'productivity' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700">
                  <p className="text-sm font-bold text-gray-800 dark:text-slate-100 mb-2">Área de foco</p>
                  <select
                    value={focusArea}
                    onChange={(e) => setFocusArea(e.target.value)}
                    className="w-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 rounded-lg p-2 text-sm font-medium"
                  >
                    {['Geral', 'Graduação', 'Pós-graduação', 'Concurso', 'Residência', 'Outro'].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {focusRecommendations[focusArea] && (
                    <div className="mt-2 text-[11px] text-gray-500">
                      Sugestão: {focusRecommendations[focusArea].label} ({focusRecommendations[focusArea].focus}m / {focusRecommendations[focusArea].break}m)
                    </div>
                  )}
                  <button
                    onClick={applyFocusRecommendation}
                    className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    Aplicar sugestão
                  </button>
                </div>

                <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-slate-100">Mostrar Pomodoro flutuante</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Oculta ou exibe o widget.</p>
                  </div>
                  <label className="inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only" checked={showPomodoro} onChange={(e) => setShowPomodoro(e.target.checked)} />
                    <span className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${showPomodoro ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                      <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${showPomodoro ? 'translate-x-4' : ''}`}></span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="w-4 h-4 text-indigo-600" />
                  <p className="text-sm font-bold text-gray-800">Pomodoro presets</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Foco (min)</p>
                    <input
                      type="number"
                      min={5}
                      max={180}
                      value={focusMinutes}
                      onChange={(e) => setFocusMinutes(Math.max(5, Number(e.target.value) || 0))}
                      className="w-full border border-gray-200 rounded-lg p-2 text-sm"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Pausa curta (min)</p>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={breakMinutes}
                      onChange={(e) => setBreakMinutes(Math.max(1, Number(e.target.value) || 0))}
                      className="w-full border border-gray-200 rounded-lg p-2 text-sm"
                    />
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Auto-iniciar pausa</p>
                      <p className="text-[11px] text-gray-400">Ao terminar o foco.</p>
                    </div>
                    <label className="inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only" checked={autoStartBreak} onChange={(e) => setAutoStartBreak(e.target.checked)} />
                      <span className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${autoStartBreak ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                        <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${autoStartBreak ? 'translate-x-4' : ''}`}></span>
                      </span>
                    </label>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400">Esses valores serão usados como padrão no Pomodoro flutuante.</p>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-slate-100">Lembrete de revisão</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Avisar quando houver revisões pendentes.</p>
                  </div>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={reviewReminders}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        if (checked && typeof Notification !== 'undefined' && Notification.permission === 'default') {
                          const perm = await Notification.requestPermission();
                          setPermission(perm);
                          if (perm !== 'granted') return;
                        }
                        setReviewReminders(checked);
                      }}
                    />
                    <span className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${reviewReminders ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                      <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${reviewReminders ? 'translate-x-4' : ''}`}></span>
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-slate-100">Alerta do Pomodoro</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Notificar ao finalizar foco/pausa.</p>
                  </div>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={pomodoroAlerts}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        if (checked && typeof Notification !== 'undefined' && Notification.permission === 'default') {
                          const perm = await Notification.requestPermission();
                          setPermission(perm);
                          if (perm !== 'granted') return;
                        }
                        setPomodoroAlerts(checked);
                      }}
                    />
                    <span className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${pomodoroAlerts ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                      <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${pomodoroAlerts ? 'translate-x-4' : ''}`}></span>
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-slate-100">Som</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Reproduzir som junto com notificações.</p>
                  </div>
                  <label className="inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} />
                    <span className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${soundEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                      <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${soundEnabled ? 'translate-x-4' : ''}`}></span>
                    </span>
                  </label>
                </div>

                <div className="mt-4 text-xs text-gray-500">
                  <p className="dark:text-slate-300">Permissão de notificação: <span className="font-bold text-gray-700 dark:text-slate-200">{permission}</span></p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-3">
                  <Crown className={`w-5 h-5 ${isPaid ? 'text-amber-500' : 'text-gray-400'}`} />
                  <div>
                    <p className="font-bold text-sm text-gray-800">Plano atual</p>
                    <p className="text-xs text-gray-500">{isPaid ? planLabel : 'Free'}</p>
                  </div>
                </div>
                {!isPaid && (
                  <button
                    onClick={() => alert('Planos: escolha Starter ou Pro no modal de assinatura.')}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold rounded-lg shadow"
                  >
                    Ver planos
                  </button>
                )}
              </div>

              <div className="p-4 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <HelpCircle className="w-4 h-4 text-indigo-600" />
                  <p className="text-sm font-bold text-gray-800">Limites do plano</p>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                  <li><strong>Roteiros:</strong> {limits.roadmaps}</li>
                  <li><strong>Fontes por roteiro:</strong> {limits.sources_per_study}</li>
                  <li><strong>Páginas por fonte:</strong> {limits.pages_per_source}</li>
                  <li><strong>Web research:</strong> {limits.web_research}</li>
                  <li><strong>Chat msgs:</strong> {limits.chat_messages}</li>
                  <li><strong>YouTube minutos:</strong> {limits.youtube_minutes}</li>
                  <li><strong>YouTube por vÃ­deo:</strong> {limits.youtube_minutes_per_video} min</li>
                  <li><strong>Tokens mensais:</strong> {limits.monthly_tokens.toLocaleString()}</li>
                </ul>

                {usage && (
                  <div className="mt-3 text-xs text-gray-500">
                    <p>Uso atual:</p>
                    <p>Roteiros: {usage.roadmaps_created} / {limits.roadmaps}</p>
                    <p>Web research: {usage.web_research_used} / {limits.web_research}</p>
                    <p>Chat: {usage.chat_messages} / {limits.chat_messages}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700">
                <p className="text-sm font-bold text-gray-800 dark:text-slate-100 mb-2">Tema</p>
                <div className="flex gap-3 flex-wrap">
                  {[
                    { key: 'system', label: 'Sistema' },
                    { key: 'light', label: 'Claro' },
                    { key: 'dark', label: 'Escuro' }
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setTheme(opt.key as any)}
                      className={`px-4 py-2 rounded-xl border text-sm font-bold transition-colors ${theme === opt.key ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-200'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">Ao escolher "Sistema", seguimos a preferência do dispositivo.</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 font-bold hover:bg-gray-50 dark:hover:bg-slate-700">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow">
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};








