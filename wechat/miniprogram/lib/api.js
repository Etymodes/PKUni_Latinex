const config = require('./config');

let session = null;
let loaded = false;
let generation = 0;
let refreshing = null;

function error(message, status, code) {
  return Object.assign(new Error(message), { status, code });
}

function sessionFrom(value) {
  if (!value || typeof value.access_token !== 'string' || !value.access_token ||
      typeof value.refresh_token !== 'string' || !value.refresh_token ||
      !value.user || typeof value.user.id !== 'string' || !value.user.id) return null;
  const expiresAt = Number(value.expires_at || (Date.now() / 1000 + Number(value.expires_in)));
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return null;
  const email = typeof value.user.email === 'string' ? value.user.email : '';
  const metadata = value.user.user_metadata || {};
  const name = metadata.full_name || metadata.name || value.user.name || email;
  return {
    access_token: value.access_token,
    refresh_token: value.refresh_token,
    expires_at: expiresAt,
    user: { id: value.user.id, email, name: typeof name === 'string' ? name : email },
  };
}

function load() {
  if (loaded) return;
  try {
    session = sessionFrom(wx.getStorageSync(config.sessionStorageKey));
    loaded = true;
  } catch (_) {
    throw error('Unable to read the saved session.', 0, 'STORAGE_ERROR');
  }
}

function save(value) {
  try {
    wx.setStorageSync(config.sessionStorageKey, value);
    session = value;
  } catch (_) {
    // Keep a rotated refresh token usable in memory if device storage is full.
    session = value;
    throw error('Unable to save the session on this device.', 0, 'STORAGE_ERROR');
  }
}

function getSession() {
  load();
  return session ? { user: { ...session.user } } : null;
}

function signOut() {
  generation += 1;
  loaded = true;
  session = null;
  refreshing = null;
  try {
    wx.removeStorageSync(config.sessionStorageKey);
  } catch (_) {
    throw error('Unable to remove the saved session from this device.', 0, 'STORAGE_ERROR');
  }
}

function assertCurrent(expected) {
  if (generation !== expected) throw error('The signed-in account has changed.', 409, 'SESSION_CHANGED');
}

function send(url, method, data, header) {
  return new Promise((resolve, reject) => {
    const fail = () => reject(error('Unable to connect. Check your network and try again.', 0, 'NETWORK_ERROR'));
    try {
      wx.request({
        url, method, data, header: { 'Content-Type': 'application/json', ...header },
        timeout: 15000,
        dataType: 'json',
        success(response) {
          const status = Number(response.statusCode) || 0;
          let body = response.data;
          if (typeof body === 'string' && body) {
            try { body = JSON.parse(body); } catch (_) {
              if (status >= 200 && status < 300) {
                reject(error('The server returned an invalid response.', status, 'INVALID_RESPONSE'));
                return;
              }
              body = null;
            }
          }
          if (status < 200 || status >= 300) {
            const message = body && (body.error_description || body.msg || body.message || body.error);
            reject(error(typeof message === 'string' ? message.slice(0, 240) : 'Request failed.', status, 'HTTP_ERROR'));
          } else {
            resolve(body === '' || body === undefined ? null : body);
          }
        },
        fail,
      });
    } catch (_) { fail(); }
  });
}

function authRequest(grantType, data) {
  return send(`${config.supabaseUrl}/auth/v1/token?grant_type=${grantType}`, 'POST', data, {
    apikey: config.supabasePublishableKey,
  });
}

async function signIn(email, password) {
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    throw error('Enter your email and password.', 400, 'INVALID_CREDENTIALS');
  }
  // Invalidate every previous account response before starting a new login.
  signOut();
  const expected = generation;
  let next;
  try {
    const body = await authRequest('password', { email: email.trim(), password });
    assertCurrent(expected);
    next = sessionFrom(body);
    if (!next) throw error('The server returned an invalid session.', 502, 'INVALID_RESPONSE');
  } catch (failure) {
    assertCurrent(expected);
    throw failure;
  }
  // Anonymous calls started during login must not overwrite the authenticated UI.
  generation += 1;
  save(next);
  return getSession();
}

async function usableSession() {
  load();
  if (!session) throw error('Sign in to sync your learning progress.', 401, 'AUTH_REQUIRED');
  if (session.expires_at > Date.now() / 1000 + 60) return session;
  if (refreshing) return refreshing;
  const expected = generation;
  const previous = session;
  const pending = (async () => {
    try {
      const body = await authRequest('refresh_token', { refresh_token: previous.refresh_token });
      assertCurrent(expected);
      const next = sessionFrom(body);
      if (!next || next.user.id !== previous.user.id) {
        throw error('The server returned an invalid session.', 502, 'INVALID_RESPONSE');
      }
      save(next);
      return next;
    } catch (failure) {
      assertCurrent(expected);
      // Network errors, rate limits and server failures leave the session recoverable.
      if ([400, 401, 403].includes(failure.status)) signOut();
      throw failure;
    } finally {
      if (refreshing === pending) refreshing = null;
    }
  })();
  refreshing = pending;
  return pending;
}

async function request(path, method = 'GET', data) {
  if (typeof path !== 'string' || !/^\/api\/[a-z0-9/-]+$/.test(path)) {
    throw error('Invalid API path.', 400, 'INVALID_REQUEST');
  }
  if (typeof method !== 'string') throw error('Invalid request method.', 400, 'INVALID_REQUEST');
  method = method.toUpperCase();
  load();
  const expected = generation;
  const publicQuestions = path === '/api/questions' && method === 'GET';
  const publicMe = path === '/api/me' && method === 'GET' && !session;
  try {
    const active = publicQuestions || publicMe ? null : await usableSession();
    assertCurrent(expected);
    const body = await send(`${config.apiOrigin}${path}`, method, data,
      active ? { Authorization: `Bearer ${active.access_token}` } : {});
    assertCurrent(expected);
    return body;
  } catch (failure) {
    // Never replay a mutation: vocabulary POSTs increment existing counters.
    assertCurrent(expected);
    throw failure;
  }
}

module.exports = {
  getSession, signIn, signOut, request,
  getOverrides: () => request('/api/questions'),
  getStats: () => request('/api/stats'),
};
