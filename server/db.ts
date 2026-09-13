import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.resolve(process.cwd(), 'chronous.sqlite');

export interface UserRow {
  id: number;
  name: string;
  mobile: string;
  email: string;
  password: string;
  role: string;
  created_at: string;
}

export interface TokenRow {
  id: number;
  token_number: string;
  numeric_id: number;
  service: string;
  user_id: number | null;
  user_name: string;
  user_mobile: string;
  status: 'waiting' | 'serving' | 'completed' | 'cancelled';
  counter: string | null;
  created_at: string;
  called_at: string | null;
  completed_at: string | null;
}

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    initSchema(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: DatabaseSync) {
  // WAL mode for fast concurrent operations
  db.exec('PRAGMA journal_mode = WAL;');

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      mobile TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tokens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_number TEXT UNIQUE NOT NULL,
      numeric_id INTEGER NOT NULL,
      service TEXT NOT NULL,
      user_id INTEGER,
      user_name TEXT,
      user_mobile TEXT,
      status TEXT NOT NULL DEFAULT 'waiting',
      counter TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      called_at TEXT,
      completed_at TEXT
    );
  `);

  // System state key-value table
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Initialize system state defaults if not existing
  const getSetting = db.prepare('SELECT value FROM system_state WHERE key = ?');
  const setSetting = db.prepare('INSERT OR REPLACE INTO system_state (key, value) VALUES (?, ?)');

  const ensureDefault = (key: string, defaultVal: string) => {
    const existing = getSetting.get(key) as { value: string } | undefined;
    if (!existing) {
      setSetting.run(key, defaultVal);
    }
  };

  ensureDefault('session_active', 'true');
  ensureDefault('token_seq', '0');
  ensureDefault('current_token', '');
  ensureDefault('current_service', '');
  ensureDefault('current_counter', 'Counter 1');
  ensureDefault('last_completed_token', '');
  ensureDefault('last_notification', '');
  ensureDefault('last_alarm', '');

  // Seed default demo user if not exists (Mobile: user, Password: 1234)
  const findDemoUser = db.prepare('SELECT id FROM users WHERE mobile = ?');
  const demoUser = findDemoUser.get('user');
  if (!demoUser) {
    const insertUser = db.prepare(`
      INSERT INTO users (name, mobile, email, password, role)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertUser.run('Demo User', 'user', 'demo@chronous.com', '1234', 'user');
  }
}

// Helper methods for token management
export const dbOps = {
  getSystemState() {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM system_state').all() as Array<{ key: string; value: string }>;
    const state: Record<string, string> = {};
    rows.forEach(r => {
      state[r.key] = r.value;
    });
    return {
      sessionActive: state.session_active === 'true',
      tokenSeq: parseInt(state.token_seq || '0', 10),
      currentToken: state.current_token || null,
      currentService: state.current_service || null,
      currentCounter: state.current_counter || 'Counter 1',
      lastCompletedToken: state.last_completed_token || null,
      lastNotification: state.last_notification ? JSON.parse(state.last_notification) : null,
      lastAlarm: state.last_alarm ? JSON.parse(state.last_alarm) : null,
    };
  },

  updateSystemState(key: string, value: string) {
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO system_state (key, value) VALUES (?, ?)').run(key, value);
  },

  setSessionActive(active: boolean) {
    this.updateSystemState('session_active', active ? 'true' : 'false');
  },

  getAllTokens() {
    const db = getDb();
    return db.prepare('SELECT * FROM tokens ORDER BY numeric_id ASC').all() as unknown as TokenRow[];
  },

  getWaitingTokens() {
    const db = getDb();
    return db.prepare("SELECT * FROM tokens WHERE status = 'waiting' ORDER BY numeric_id ASC").all() as unknown as TokenRow[];
  },

  getCompletedTokens() {
    const db = getDb();
    return db.prepare("SELECT * FROM tokens WHERE status = 'completed' ORDER BY completed_at DESC, numeric_id DESC LIMIT 50").all() as unknown as TokenRow[];
  },

  getCurrentServingToken(): TokenRow | null {
    const db = getDb();
    const token = db.prepare("SELECT * FROM tokens WHERE status = 'serving' ORDER BY called_at DESC LIMIT 1").get();
    return (token as unknown as TokenRow) || null;
  },

  getUserActiveToken(filter: { mobile?: string; id?: number }): TokenRow | null {
    const db = getDb();
    const cleanMobile = (filter.mobile || '').trim();
    const userId = filter.id || null;

    if (!cleanMobile && !userId) return null;

    const token = db.prepare(`
      SELECT * FROM tokens
      WHERE (
        (? != '' AND user_mobile = ?)
        OR (? IS NOT NULL AND user_id = ?)
      )
      AND status IN ('waiting', 'serving')
      ORDER BY numeric_id DESC
      LIMIT 1
    `).get(cleanMobile, cleanMobile, userId, userId) as unknown as TokenRow | undefined;

    return token || null;
  },

  generateToken(service: string, user: { id?: number; name?: string; mobile?: string }) {
    const db = getDb();
    const state = this.getSystemState();
    if (!state.sessionActive) {
      throw new Error('Session is currently inactive');
    }

    const cleanMobile = (user.mobile || '').trim();
    const userId = user.id || null;

    // Strict constraint: Each user can only hold ONE active token at a time!
    if (cleanMobile || userId) {
      const activeToken = this.getUserActiveToken({ mobile: cleanMobile, id: userId });
      if (activeToken) {
        throw new Error(
          `You already have an active token (${activeToken.token_number} - ${activeToken.service}). Each citizen is limited to only one active token.`
        );
      }
    }

    const nextSeq = state.tokenSeq + 1;
    const tokenNumber = 'T' + String(nextSeq).padStart(3, '0');
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO tokens (token_number, numeric_id, service, user_id, user_name, user_mobile, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'waiting', ?)
    `).run(
      tokenNumber,
      nextSeq,
      service,
      userId,
      user.name || 'Walk-in Citizen',
      cleanMobile,
      now
    );

    this.updateSystemState('token_seq', String(nextSeq));

    const token = db.prepare('SELECT * FROM tokens WHERE token_number = ?').get(tokenNumber) as unknown as TokenRow;
    return token;
  },

  callNextToken(counter = 'Counter 1') {
    const db = getDb();
    const waiting = this.getWaitingTokens();
    if (waiting.length === 0) {
      return null;
    }

    const nextToken = waiting[0];
    const now = new Date().toISOString();

    // Mark previous serving token completed if any
    db.prepare(`
      UPDATE tokens
      SET status = 'completed', completed_at = ?
      WHERE status = 'serving'
    `).run(now);

    // Call new token
    db.prepare(`
      UPDATE tokens
      SET status = 'serving', counter = ?, called_at = ?
      WHERE id = ?
    `).run(counter, now, nextToken.id);

    this.updateSystemState('current_token', nextToken.token_number);
    this.updateSystemState('current_service', nextToken.service);
    this.updateSystemState('current_counter', counter);

    // Calculate the +2 token alarm target:
    // If token 3 is called, alarm goes to token 5 (3 + 2 = 5).
    // Look up by sequence (numeric_id + 2) or the 2nd token in the remaining waiting queue
    const remainingWaiting = this.getWaitingTokens();
    const plusTwoTargetSeq = nextToken.numeric_id + 2;
    const targetPlusTwoByNumber = db.prepare(`
      SELECT * FROM tokens WHERE numeric_id = ? AND status = 'waiting'
    `).get(plusTwoTargetSeq) as unknown as TokenRow | undefined;
    const targetPlusTwoByOrder = remainingWaiting[1];
    const alarmTarget = targetPlusTwoByNumber || targetPlusTwoByOrder;

    const alarmData = {
      calledTokenNumber: nextToken.token_number,
      calledNumericId: nextToken.numeric_id,
      plusTwoTokenNumber: alarmTarget ? alarmTarget.token_number : ('T' + String(plusTwoTargetSeq).padStart(3, '0')),
      plusTwoNumericId: alarmTarget ? alarmTarget.numeric_id : plusTwoTargetSeq,
      time: Date.now(),
    };
    this.updateSystemState('last_alarm', JSON.stringify(alarmData));

    return db.prepare('SELECT * FROM tokens WHERE id = ?').get(nextToken.id) as unknown as TokenRow;
  },

  completeCurrentToken() {
    const db = getDb();
    const current = this.getCurrentServingToken();
    if (!current) {
      return null;
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE tokens
      SET status = 'completed', completed_at = ?
      WHERE id = ?
    `).run(now, current.id);

    this.updateSystemState('last_completed_token', current.token_number);
    this.updateSystemState('current_token', '');
    this.updateSystemState('current_service', '');

    // Check if there is an upcoming waiting token to send "GET READY!" notification
    const waiting = this.getWaitingTokens();
    if (waiting.length > 0) {
      const upcoming = waiting[0];
      const notificationPayload = JSON.stringify({
        targetToken: upcoming.numeric_id,
        targetTokenNumber: upcoming.token_number,
        time: Date.now()
      });
      this.updateSystemState('last_notification', notificationPayload);
    }

    return current;
  },

  clearAllTokens() {
    const db = getDb();
    db.exec('DELETE FROM tokens');
    this.updateSystemState('token_seq', '0');
    this.updateSystemState('current_token', '');
    this.updateSystemState('current_service', '');
    this.updateSystemState('last_completed_token', '');
    this.updateSystemState('last_notification', '');
    return { success: true };
  },

  findUserByMobile(mobile: string): UserRow | null {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
    return (user as unknown as UserRow) || null;
  },

  findUserByEmail(email: string): UserRow | null {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    return (user as unknown as UserRow) || null;
  },

  createUser(name: string, mobile: string, email: string, password: string): UserRow {
    const db = getDb();
    db.prepare(`
      INSERT INTO users (name, mobile, email, password, role)
      VALUES (?, ?, ?, ?, 'user')
    `).run(name, mobile, email, password);

    return db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile) as unknown as UserRow;
  },

  getAllUsers() {
    const db = getDb();
    return db.prepare('SELECT id, name, mobile, email, role, created_at FROM users').all() as unknown as Array<Omit<UserRow, 'password'>>;
  }
};
