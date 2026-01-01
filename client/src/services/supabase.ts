import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Essas variáveis vêm do Vite quando configuradas no .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Log para debug
console.log('Supabase URL:', supabaseUrl ? 'configurado' : 'NÃO ENCONTRADO');
console.log('Supabase Key:', supabaseKey ? 'configurado' : 'NÃO ENCONTRADO');

// Só cria o cliente Supabase se as variáveis de ambiente existirem
let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });
  console.log('✅ Cliente Supabase criado com sucesso');
} else {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas!');
  console.error('Certifique-se de que o arquivo .env existe na raiz do projeto com:');
  console.error('VITE_SUPABASE_URL=https://seu-projeto.supabase.co');
  console.error('VITE_SUPABASE_ANON_KEY=sua-chave-anon');
}

export { supabase };
