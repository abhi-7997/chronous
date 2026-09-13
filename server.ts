import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { dbOps } from './server/db.js';

const PORT = 3000;
const OPERATOR_ACCESS_CODE = 'CHRONOUS2026';

// SSE client connections for real-time live synchronization
const sseClients: Set<express.Response> = new Set();

function broadcastEvent(type: string, data: any) {
  const payload = `data: ${JSON.stringify({ type, data, timestamp: Date.now() })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // SSE stream endpoint
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);

    // Initial state event
    const state = dbOps.getSystemState();
    res.write(`data: ${JSON.stringify({ type: 'INIT', state })}\n\n`);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // Auth: Login
  app.post('/api/auth/login', (req, res) => {
    const { mobile, password } = req.body;
    if (!mobile || !password) {
      return res.status(400).json({ error: 'Mobile and password are required' });
    }

    // Check demo user
    if (mobile === 'user' && password === '1234') {
      let user = dbOps.findUserByMobile('user');
      if (!user) {
        user = dbOps.createUser('Demo User', 'user', 'demo@chronous.com', '1234');
      }
      return res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          mobile: user.mobile,
          email: user.email,
          role: 'user',
        },
      });
    }

    const user = dbOps.findUserByMobile(mobile);
    if (!user) {
      return res.status(404).json({
        error: 'No account found for this mobile number. Please complete registration.',
        notRegistered: true,
      });
    }

    if (user.password !== password) {
      return res.status(401).json({ error: 'Incorrect password. Please verify and try again.' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        role: user.role,
      },
    });
  });

  // Auth: Register (Create Account)
  app.post('/api/auth/register', (req, res) => {
    const { name, mobile, email, password } = req.body;
    if (!name || !mobile || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must contain at least 6 characters' });
    }

    const existingMobile = dbOps.findUserByMobile(mobile);
    if (existingMobile) {
      return res.status(409).json({ error: 'This mobile number is already registered' });
    }

    const existingEmail = dbOps.findUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({ error: 'This email is already registered' });
    }

    try {
      const newUser = dbOps.createUser(name.trim(), mobile.trim(), email.trim(), password);
      return res.json({
        success: true,
        message: 'Account created successfully',
        user: {
          id: newUser.id,
          name: newUser.name,
          mobile: newUser.mobile,
          email: newUser.email,
          role: newUser.role,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Database error creating user' });
    }
  });

  // Auth: Operator validation
  app.post('/api/auth/operator', (req, res) => {
    const { code } = req.body;
    if (code === OPERATOR_ACCESS_CODE) {
      return res.json({ success: true, role: 'operator' });
    }
    return res.status(401).json({ error: 'Invalid operator code. Access denied.' });
  });

  // Token Queue Full State
  app.get('/api/tokens/state', (req, res) => {
    try {
      const state = dbOps.getSystemState();
      const waitingTokens = dbOps.getWaitingTokens();
      const currentServing = dbOps.getCurrentServingToken();
      const completedTokens = dbOps.getCompletedTokens();
      const allTokens = dbOps.getAllTokens();

      return res.json({
        systemState: state,
        waitingTokens,
        currentServing,
        completedTokens,
        totalGenerated: allTokens.length,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Get active token for user
  app.get('/api/tokens/user-active', (req, res) => {
    const mobile = (req.query.mobile as string) || '';
    const userId = req.query.id ? parseInt(req.query.id as string, 10) : undefined;
    if (!mobile && !userId) {
      return res.json({ token: null });
    }

    const active = dbOps.getUserActiveToken({ mobile, id: userId });
    return res.json({ token: active || null });
  });

  // Generate Token
  app.post('/api/tokens', (req, res) => {
    try {
      const { service, user } = req.body;
      if (!service) {
        return res.status(400).json({ error: 'Service category is required' });
      }

      const token = dbOps.generateToken(service, user || {});
      broadcastEvent('TOKEN_GENERATED', { token });
      return res.json({ success: true, token });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Call Next Token (Operator)
  app.post('/api/tokens/call-next', (req, res) => {
    try {
      const { counter } = req.body;
      const calledToken = dbOps.callNextToken(counter || 'Counter 1');
      if (!calledToken) {
        return res.status(404).json({ error: 'No tokens waiting in queue' });
      }

      const state = dbOps.getSystemState();
      broadcastEvent('TOKEN_CALLED', { token: calledToken, lastAlarm: state.lastAlarm });
      return res.json({ success: true, token: calledToken, lastAlarm: state.lastAlarm });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Complete Current Token (Operator)
  app.post('/api/tokens/complete', (req, res) => {
    try {
      const completed = dbOps.completeCurrentToken();
      if (!completed) {
        return res.status(404).json({ error: 'No token currently being served' });
      }

      const state = dbOps.getSystemState();
      broadcastEvent('TOKEN_COMPLETED', {
        completedToken: completed,
        lastNotification: state.lastNotification,
      });
      return res.json({ success: true, completedToken: completed });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Clear All Tokens (Operator)
  app.post('/api/tokens/clear', (req, res) => {
    try {
      dbOps.clearAllTokens();
      broadcastEvent('QUEUE_CLEARED', {});
      return res.json({ success: true, message: 'Queue reset successfully' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Session Active / Inactive (Operator)
  app.post('/api/tokens/session', (req, res) => {
    try {
      const { active } = req.body;
      dbOps.setSessionActive(Boolean(active));
      const state = dbOps.getSystemState();
      broadcastEvent('SESSION_CHANGED', { sessionActive: state.sessionActive });
      return res.json({ success: true, sessionActive: state.sessionActive });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Database Inspector / Schema & Data Viewer
  app.get('/api/db/inspect', (req, res) => {
    try {
      const state = dbOps.getSystemState();
      const tokens = dbOps.getAllTokens();
      const users = dbOps.getAllUsers();
      return res.json({
        databaseEngine: 'SQLite (Node.js native)',
        dbFile: 'chronous.sqlite',
        status: 'Connected & Operational',
        tables: {
          users: {
            count: users.length,
            rows: users,
          },
          tokens: {
            count: tokens.length,
            rows: tokens,
          },
          system_state: {
            rows: state,
          },
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CHRONOUS Full-Stack Server running on port ${PORT}`);
  });
}

startServer();
