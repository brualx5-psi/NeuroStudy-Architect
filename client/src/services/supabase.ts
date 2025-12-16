import { createClient } from '@supabase/supabase-js';

// Essas variáveis vêm do Vercel/Netlify quando a flag VITE_SUPABASE_URL está configurada.
// Caso contrário, são undefined e o cliente não é criado (modo local).
// @ts-ignore: O Vite injeta estes tipos
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// @ts-ignore
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Só cria o cliente Supabase se as variáveis de ambiente existirem (Modo Nuvem Ativado)
export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;
