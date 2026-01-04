import { getSupabaseAdmin } from './supabase.js';

export type AuthContext = {
  userId: string;
  email?: string | null;
};

export const getAuthContext = async (req: any): Promise<AuthContext | null> => {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  const supabase = getSupabaseAdmin();
  if (token && supabase) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user?.id) {
      return { userId: data.user.id, email: data.user.email };
    }
  }

  const devUser = req.headers?.['x-dev-user'];
  if (devUser && process.env.NODE_ENV !== 'production') {
    return { userId: String(devUser) };
  }

  return null;
};
