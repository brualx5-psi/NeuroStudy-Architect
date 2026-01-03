import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import { PreferredSource } from '../types';

type SearchSettings = {
  defaultSource: PreferredSource;
  preferPtEnHint: boolean;
};

type ThemeMode = 'light' | 'dark' | 'system';

const applyTheme = (mode: ThemeMode) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const prefersDark = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
  root.classList.toggle('dark', isDark);
};

type PomodoroSettings = {
  focusMinutes: number;
  breakMinutes: number;
  autoStartBreak: boolean;
  showWidget: boolean;
};

type NotificationSettings = {
  reviewReminders: boolean;
  pomodoroAlerts: boolean;
  soundEnabled: boolean;
};

export type SettingsState = {
  search: SearchSettings;
  focusArea: string;
  pomodoro: PomodoroSettings;
  theme: ThemeMode;
  notifications: NotificationSettings;
  updatedAt: number;
};

type SettingsUpdate = Partial<SettingsState> & {
  search?: Partial<SearchSettings>;
  pomodoro?: Partial<PomodoroSettings>;
  notifications?: Partial<NotificationSettings>;
};

interface SettingsContextValue {
  settings: SettingsState;
  hydrated: boolean;
  updateSettings: (update: SettingsUpdate) => void;
}

const DEFAULT_SETTINGS: SettingsState = {
  search: {
    defaultSource: 'auto',
    preferPtEnHint: true
  },
  focusArea: 'Geral',
  pomodoro: {
    focusMinutes: 25,
    breakMinutes: 5,
    autoStartBreak: false,
    showWidget: true
  },
  theme: 'system',
  notifications: {
    reviewReminders: false,
    pomodoroAlerts: false,
    soundEnabled: true
  },
  updatedAt: 0
};

const STORAGE_KEY = 'neurostudy_settings_v1';

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  hydrated: false,
  updateSettings: () => { }
});

const loadLocalSettings = (): SettingsState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, updatedAt: Date.now() };
    const parsed = JSON.parse(raw) as SettingsState;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      search: { ...DEFAULT_SETTINGS.search, ...parsed.search },
      pomodoro: { ...DEFAULT_SETTINGS.pomodoro, ...(parsed as any).pomodoro },
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(parsed as any).notifications }
    };
  } catch (error) {
    console.warn('[Settings] Falha ao ler localStorage', error);
    return { ...DEFAULT_SETTINGS, updatedAt: Date.now() };
  }
};

const saveLocalSettings = (value: SettingsState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.warn('[Settings] Falha ao salvar localStorage', error);
  }
};

const mergeSettings = (local: SettingsState, remote?: SettingsState): SettingsState => {
  if (!remote) return local;
  const localTs = local.updatedAt || 0;
  const remoteTs = remote.updatedAt || 0;
  const winner = remoteTs > localTs ? remote : local;
  return {
    ...DEFAULT_SETTINGS,
    ...winner,
    search: { ...DEFAULT_SETTINGS.search, ...(winner.search || {}) },
    pomodoro: { ...DEFAULT_SETTINGS.pomodoro, ...(winner as any).pomodoro },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...(winner as any).notifications }
  };
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  // Carrega local primeiro para ter resposta imediata
  useEffect(() => {
    const local = loadLocalSettings();
    setSettings(local);
    setHydrated(true);
  }, []);

  // Aplica tema no documento
  useEffect(() => {
    applyTheme(settings.theme);

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      if (settings.theme === 'system') applyTheme('system');
    };
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [settings.theme]);

  // Sincroniza com Supabase se logado
  useEffect(() => {
    if (!user || !supabase) return;

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('preferences')
          .eq('id', user.id)
          .single();

        if (error) {
          console.warn('[Settings] Erro ao ler preferences do Supabase (ignorado):', error.message);
          return;
        }

        const remotePrefs = data?.preferences as SettingsState | undefined;
        if (!remotePrefs) return;

        const merged = mergeSettings(loadLocalSettings(), remotePrefs);
        if (!cancelled) {
          setSettings(merged);
          saveLocalSettings(merged);
        }
      } catch (err: any) {
        console.warn('[Settings] Falha ao sincronizar Supabase (ignorado):', err.message);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  const updateSettings = (update: SettingsUpdate) => {
    setSettings(prev => {
      const next: SettingsState = {
        ...prev,
        ...update,
        search: { ...prev.search, ...(update.search || {}) },
        pomodoro: { ...prev.pomodoro, ...(update.pomodoro || {}) },
        notifications: { ...prev.notifications, ...(update.notifications || {}) },
        updatedAt: Date.now()
      };

      saveLocalSettings(next);
      applyTheme(next.theme);

      if (user && supabase) {
        (async () => {
          try {
            const { error } = await supabase
              .from('users')
              .update({ preferences: next })
              .eq('id', user.id);
            if (error) console.warn('[Settings] Erro ao salvar no Supabase (ignorado):', error.message);
          } catch (err: any) {
            console.warn('[Settings] Excecao ao salvar no Supabase (ignorado):', err.message);
          }
        })();
      }

      return next;
    });
  };

  const value = useMemo(() => ({ settings, hydrated, updateSettings }), [settings, hydrated]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
