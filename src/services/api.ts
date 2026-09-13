import { QueueState, Token, User } from '../types';

/* =========================================================
   SUPABASE CONFIGURATION
   ========================================================= */

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://bnxbnkuottgjzqbotpve.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isSupabaseConfigured = Boolean(
  SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.trim().length > 15
);

const supabaseHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};


/* =========================================================
   SUPABASE REQUEST
   ========================================================= */

async function supabaseRequest(
  path: string,
  options: RequestInit = {}
) {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Please check the GitHub Actions SUPABASE_ANON_KEY secret.'
    );
  }

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
    throw new Error(
      `Supabase returned an invalid response (${response.status}).`
    );
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


/* =========================================================
   SUPABASE RPC
   ========================================================= */

async function rpc(
  functionName: string,
  params: Record<string, unknown> = {}
) {
  return supabaseRequest(
    `/rest/v1/rpc/${functionName}`,
    {
      method: 'POST',
      body: JSON.stringify(params),
    }
  );
}


/* =========================================================
   CONVERT USER
   ========================================================= */

function convertUser(data: any): User {
  return {
    id: Number(data.id),
    name: data.name,
    mobile: data.mobile,
    email: data.email || '',
    role: data.role || 'user',
  };
}


/* =========================================================
   CONVERT TOKEN
   ========================================================= */

function convertToken(data: any): Token {
  return {
    id: Number(data.id),
    token_number: data.token_number,
    numeric_id: Number(data.numeric_id),

    service: data.service,

    user_id:
      data.user_id === null ||
      data.user_id === undefined
        ? null
        : Number(data.user_id),

    user_name: data.user_name || '',
    user_mobile: data.user_mobile || '',

    status: data.status,

    counter: data.counter || null,

    created_at: data.created_at,

    called_at:
      data.called_at || null,

    completed_at:
      data.completed_at || null,
  };
}


/* =========================================================
   API
   ========================================================= */

export const api = {

  /* =======================================================
     GET COMPLETE QUEUE STATE
     ======================================================= */

  async getQueueState(): Promise<QueueState> {

    const data = await rpc(
      'get_chronous_queue'
    );

    const state =
      Array.isArray(data)
        ? data[0]
        : data;

    if (!state) {
      throw new Error(
        'Queue state is unavailable.'
      );
    }

    return state as QueueState;
  },


  /* =======================================================
     LOGIN
     ======================================================= */

  async login(
    mobile: string,
    password: string
  ): Promise<{
    success: boolean;
    user: User;
  }> {

    /*
      Demo login removed.

      Login now uses Supabase database only.
    */

    const rows = await supabaseRequest(
      `/rest/v1/citizen_users?select=id,name,mobile,email,role,password_hash&mobile=eq.${encodeURIComponent(
        mobile
      )}&limit=1`
    );

    if (!rows || rows.length === 0) {

      const error: any = new Error(
        'No account found for this mobile number. Please complete registration.'
      );

      error.notRegistered = true;

      throw error;
    }

    const user = rows[0];


    /* -------------------------------------------------------
       HASH ENTERED PASSWORD
       ------------------------------------------------------- */

    const encoder = new TextEncoder();

    const passwordBytes =
      encoder.encode(password);

    const hashBuffer =
      await crypto.subtle.digest(
        'SHA-256',
        passwordBytes
      );

    const hashArray =
      Array.from(
        new Uint8Array(hashBuffer)
      );

    const hashedPassword =
      hashArray
        .map(
          (b) =>
            b.toString(16).padStart(2, '0')
        )
        .join('');


    /* -------------------------------------------------------
       CHECK PASSWORD
       ------------------------------------------------------- */

    if (
      user.password_hash !== hashedPassword &&
      user.password_hash !== password
    ) {

      throw new Error(
        'Incorrect password. Please verify and try again.'
      );
    }


    /* -------------------------------------------------------
       LOGIN SUCCESS
       ------------------------------------------------------- */

    return {
      success: true,
      user: convertUser(user),
    };
  },


  /* =======================================================
     REGISTER
     ======================================================= */

  async register(data: {
    name: string;
    mobile: string;
    email: string;
    password: string;
  }): Promise<{
    success: boolean;
    user: User;
    message: string;
  }> {

    /* -------------------------------------------------------
       CHECK EXISTING MOBILE
       ------------------------------------------------------- */

    const existing =
      await supabaseRequest(
        `/rest/v1/citizen_users?select=id&mobile=eq.${encodeURIComponent(
          data.mobile
        )}&limit=1`
      );

    if (
      existing &&
      existing.length > 0
    ) {

      throw new Error(
        'An account with this mobile number already exists.'
      );
    }


    /* -------------------------------------------------------
       HASH PASSWORD
       ------------------------------------------------------- */

    const encoder =
      new TextEncoder();

    const passwordBytes =
      encoder.encode(data.password);

    const hashBuffer =
      await crypto.subtle.digest(
        'SHA-256',
        passwordBytes
      );

    const hashArray =
      Array.from(
        new Uint8Array(hashBuffer)
      );

    const password_hash =
      hashArray
        .map(
          (b) =>
            b.toString(16).padStart(2, '0')
        )
        .join('');


    /* -------------------------------------------------------
       INSERT USER INTO SUPABASE
       ------------------------------------------------------- */

    const rows =
      await supabaseRequest(
        '/rest/v1/citizen_users',
        {
          method: 'POST',

          headers: {
            Prefer:
              'return=representation',
          },

          body: JSON.stringify({
            name: data.name,
            mobile: data.mobile,
            email: data.email,
            password_hash,
            role: 'user',
          }),
        }
      );


    if (
      !rows ||
      rows.length === 0
    ) {

      throw new Error(
        'Account creation failed.'
      );
    }


    /* -------------------------------------------------------
       REGISTRATION SUCCESS
       ------------------------------------------------------- */

    return {
      success: true,

      user:
        convertUser(rows[0]),

      message:
        'Account created successfully.',
    };
  },


  /* =======================================================
     OPERATOR LOGIN
     ======================================================= */

  async verifyOperator(
    code: string
  ): Promise<{
    success: boolean;
  }> {

    if (
      code === 'CHRONOUS2026'
    ) {
      return {
        success: true,
      };
    }

    throw new Error(
      'Invalid operator code'
    );
  },


  /* =======================================================
     GENERATE TOKEN
     ======================================================= */

  async generateToken(
    service: string,
    user?: {
      id?: number;
      name?: string;
      mobile?: string;
    }
  ): Promise<Token> {

    /* -------------------------------------------------------
       CHECK ACTIVE TOKEN
       ------------------------------------------------------- */

    if (
      user?.mobile ||
      user?.id
    ) {

      const active =
        await this.getUserActiveToken(
          user.mobile || '',
          user.id
        );

      if (
        active &&
        (
          active.status === 'waiting' ||
          active.status === 'serving'
        )
      ) {

        throw new Error(
          `You already have an active token (${active.token_number} - ${active.service}). Each citizen is limited to only one active token.`
        );
      }
    }


    /* -------------------------------------------------------
       CREATE TOKEN
       ------------------------------------------------------- */

    const data =
      await rpc(
        'create_chronous_token',
        {
          p_service: service,

          p_user_id:
            user?.id || null,

          p_user_name:
            user?.name || '',

          p_user_mobile:
            user?.mobile || '',
        }
      );


    const token =
      Array.isArray(data)
        ? data[0]
        : data;


    if (!token) {
      throw new Error(
        'Failed to generate token.'
      );
    }


    return convertToken(token);
  },


  /* =======================================================
     CALL NEXT TOKEN
     ======================================================= */

  async callNextToken(
    counter = 'Counter 1'
  ): Promise<Token> {

    const data =
      await rpc(
        'call_next_chronous_token',
        {
          p_counter: counter,
        }
      );


    const token =
      Array.isArray(data)
        ? data[0]
        : data;


    if (!token) {
      throw new Error(
        'No waiting token is available.'
      );
    }


    return convertToken(token);
  },


  /* =======================================================
     COMPLETE CURRENT TOKEN
     ======================================================= */

  async completeCurrentToken(): Promise<Token> {

    const data =
      await rpc(
        'complete_chronous_token'
      );


    const token =
      Array.isArray(data)
        ? data[0]
        : data;


    if (!token) {
      throw new Error(
        'No current token is available.'
      );
    }


    return convertToken(token);
  },


  /* =======================================================
     CLEAR ALL TOKENS
     ======================================================= */

  async clearAllTokens(): Promise<void> {

    await rpc(
      'clear_chronous_tokens'
    );
  },


  /* =======================================================
     SESSION ACTIVE / END SESSION
     ======================================================= */

  async setSessionActive(
    active: boolean
  ): Promise<void> {

    await rpc(
      'set_chronous_session',
      {
        p_active: active,
      }
    );
  },


  /* =======================================================
     GET USER ACTIVE TOKEN
     ======================================================= */

  async getUserActiveToken(
    mobile: string,
    id?: number
  ): Promise<Token | null> {

    const data =
      await rpc(
        'get_user_active_chronous_token',
        {
          p_mobile: mobile,
        }
      );


    const token =
      Array.isArray(data)
        ? data[0]
        : data;


    if (!token) {
      return null;
    }


    return convertToken(token);
  },
};
