import { QueueState, Token, User } from '../types';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://yurhvixksoyfgdyuxuxl.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Supabase is only used when a valid anon key has been injected
const isSupabaseConfigured = Boolean(
  SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.trim().length > 15
);

const supabaseHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

async function supabaseRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      ...supabaseHeaders,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Supabase returned an invalid response (${response.status}).`);
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error_description ||
      data?.hint ||
      data?.error ||
      `Supabase request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

async function rpc(functionName: string, params: Record<string, unknown> = {}) {
  return supabaseRequest(`/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

function convertUser(data: any): User {
  return {
    id: Number(data.id),
    name: data.name,
    mobile: data.mobile,
    email: data.email || '',
    role: data.role || 'user',
  };
}

function convertToken(data: any): Token {
  return {
    id: Number(data.id),
    token_number: data.token_number,
    numeric_id: Number(data.numeric_id),
    service: data.service,
    user_id:
      data.user_id === null || data.user_id === undefined
        ? null
        : Number(data.user_id),
    user_name: data.user_name || '',
    user_mobile: data.user_mobile || '',
    status: data.status,
    counter: data.counter || null,
    created_at: data.created_at,
    called_at: data.called_at || null,
    completed_at: data.completed_at || null,
  };
}

export const api = {
  // =========================================================
  // GET COMPLETE QUEUE STATE
  // =========================================================
  async getQueueState(): Promise<QueueState> {
    if (isSupabaseConfigured) {
      try {
        const data = await rpc('get_chronous_queue');
        const state = Array.isArray(data) ? data[0] : data;
        if (state) return state as QueueState;
      } catch (err) {
        console.warn('Supabase queue fetch failed, falling back to database API:', err);
      }
    }

    const res = await fetch('/api/tokens/state');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch queue state from database');
    }
    return res.json();
  },

  // =========================================================
  // LOGIN
  // =========================================================
  async login(mobile: string, password: string): Promise<{ success: boolean; user: User }> {
    if (isSupabaseConfigured) {
      try {
        if (mobile === 'user' && password === '1234') {
          return {
            success: true,
            user: {
              id: 1,
              name: 'Demo Citizen',
              mobile: 'user',
              email: 'user@chronous.local',
              role: 'user',
            },
          };
        }

        const rows = await supabaseRequest(
          `/rest/v1/citizen_users?select=id,name,mobile,email,role,password_hash&mobile=eq.${encodeURIComponent(
            mobile
          )}&limit=1`
        );

        if (!rows || rows.length === 0) {
          const notFoundErr: any = new Error(
            'No account found for this mobile number. Please complete registration.'
          );
          notFoundErr.notRegistered = true;
          throw notFoundErr;
        }

        const user = rows[0];
        const encoder = new TextEncoder();
        const passwordBytes = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', passwordBytes);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashedPassword = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

        if (user.password_hash === hashedPassword || user.password_hash === password) {
          return { success: true, user: convertUser(user) };
        } else {
          throw new Error('Incorrect password. Please verify and try again.');
        }
      } catch (err: any) {
        if (err.notRegistered) throw err;
        console.warn('Supabase login check failed, falling back to database API:', err);
      }
    }

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      const err: any = new Error(data.error || 'Login failed');
      err.notRegistered = Boolean(data.notRegistered || res.status === 404);
      throw err;
    }
    return data;
  },

  // =========================================================
  // REGISTER
  // =========================================================
  async register(data: {
    name: string;
    mobile: string;
    email: string;
    password: string;
  }): Promise<{ success: boolean; user: User; message: string }> {
    if (isSupabaseConfigured) {
      try {
        const existing = await supabaseRequest(
          `/rest/v1/citizen_users?select=id&mobile=eq.${encodeURIComponent(data.mobile)}&limit=1`
        );

        if (existing && existing.length > 0) {
          throw new Error('An account with this mobile number already exists.');
        }

        const encoder = new TextEncoder();
        const passwordBytes = encoder.encode(data.password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', passwordBytes);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const password_hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

        const rows = await supabaseRequest('/rest/v1/citizen_users', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            name: data.name,
            mobile: data.mobile,
            email: data.email,
            password_hash,
            role: 'user',
          }),
        });

        if (rows && rows.length > 0) {
          return {
            success: true,
            user: convertUser(rows[0]),
            message: 'Account created successfully.',
          };
        }
      } catch (err: any) {
        console.warn('Supabase register failed, falling back to database API:', err);
      }
    }

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Account creation failed');
    return resData;
  },

  // =========================================================
  // OPERATOR LOGIN
  // =========================================================
  async verifyOperator(code: string): Promise<{ success: boolean }> {
    if (isSupabaseConfigured) {
      if (code === 'CHRONOUS2026') {
        return { success: true };
      }
    }

    const res = await fetch('/api/auth/operator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Invalid operator code');
    return data;
  },

  // =========================================================
  // GENERATE TOKEN
  // =========================================================
  async generateToken(
    service: string,
    user?: { id?: number; name?: string; mobile?: string }
  ): Promise<Token> {
    if (isSupabaseConfigured) {
      try {
        if (user?.mobile || user?.id) {
          const active = await this.getUserActiveToken(user.mobile || '', user.id);
          if (active && (active.status === 'waiting' || active.status === 'serving')) {
            throw new Error(
              `You already have an active token (${active.token_number} - ${active.service}). Each citizen is limited to only one active token.`
            );
          }
        }

        const data = await rpc('create_chronous_token', {
          p_service: service,
          p_user_id: user?.id || null,
          p_user_name: user?.name || '',
          p_user_mobile: user?.mobile || '',
        });
        const token = Array.isArray(data) ? data[0] : data;
        if (token) return convertToken(token);
      } catch (err: any) {
        if (err.message && err.message.includes('already have an active token')) {
          throw err;
        }
        console.warn('Supabase token generation failed, falling back to database API:', err);
      }
    }

    const res = await fetch('/api/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service, user }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to generate token');
    return data.token;
  },

  // =========================================================
  // CALL NEXT TOKEN
  // =========================================================
  async callNextToken(counter = 'Counter 1'): Promise<Token> {
    if (isSupabaseConfigured) {
      try {
        const data = await rpc('call_next_chronous_token', { p_counter: counter });
        const token = Array.isArray(data) ? data[0] : data;
        if (token) return convertToken(token);
      } catch (err) {
        console.warn('Supabase call next failed, falling back to database API:', err);
      }
    }

    const res = await fetch('/api/tokens/call-next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counter }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to call next token');
    return data.token;
  },

  // =========================================================
  // COMPLETE CURRENT TOKEN
  // =========================================================
  async completeCurrentToken(): Promise<Token> {
    if (isSupabaseConfigured) {
      try {
        const data = await rpc('complete_chronous_token');
        const token = Array.isArray(data) ? data[0] : data;
        if (token) return convertToken(token);
      } catch (err) {
        console.warn('Supabase complete token failed, falling back to database API:', err);
      }
    }

    const res = await fetch('/api/tokens/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to complete current token');
    return data.completedToken;
  },

  // =========================================================
  // CLEAR ALL TOKENS
  // =========================================================
  async clearAllTokens(): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await rpc('clear_chronous_tokens');
        return;
      } catch (err) {
        console.warn('Supabase clear tokens failed, falling back to database API:', err);
      }
    }

    const res = await fetch('/api/tokens/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to clear tokens');
  },

  // =========================================================
  // SESSION ACTIVE / END SESSION
  // =========================================================
  async setSessionActive(active: boolean): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await rpc('set_chronous_session', { p_active: active });
        return;
      } catch (err) {
        console.warn('Supabase set session failed, falling back to database API:', err);
      }
    }

    const res = await fetch('/api/tokens/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update session');
  },

  // =========================================================
  // GET USER ACTIVE TOKEN
  // =========================================================
  async getUserActiveToken(mobile: string, id?: number): Promise<Token | null> {
    if (isSupabaseConfigured) {
      try {
        const data = await rpc('get_user_active_chronous_token', { p_mobile: mobile });
        const token = Array.isArray(data) ? data[0] : data;
        if (token) return convertToken(token);
      } catch {
        // Continue to fallback
      }
    }

    const params = new URLSearchParams();
    if (mobile) params.append('mobile', mobile);
    if (id) params.append('id', String(id));

    const res = await fetch(`/api/tokens/user-active?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.token;
  },
};
