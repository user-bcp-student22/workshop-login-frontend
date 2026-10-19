import '@angular/compiler';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_ERROR_MESSAGE, AuthService } from './auth.service';
import { SessionService } from './session.service';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));

describe('AuthService contract and controlled errors', () => {
  let session: SessionService;
  let auth: AuthService;
  const credentials = { username: 'student', password: 'test-password' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', { removeItem: vi.fn(), setItem: vi.fn() });
    session = new SessionService();
    auth = new AuthService(session);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('preserves the POST contract and stores a valid session in memory', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { token: 'test-token', user: { username: 'student', displayName: 'Student' } } });
    expect(await auth.login(credentials, {})).toBe(true);
    expect(axios.post).toHaveBeenCalledWith('http://localhost:8080/auth/login', {
      ...credentials, client: 'angular-workshop'
    }, { timeout: 5000 });
    expect(session.user.displayName).toBe('Student');
    expect(session.token).toBe('test-token');
  });

  it('does not invent mandatory user fields when the backend omits user', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { token: 'test-token' } });
    expect(await auth.login(credentials, {})).toBe(true);
    expect(session.user).toEqual({});
  });

  it.each([null, [], 'invalid', {}, { token: '' }, { token: 123 }])('rejects missing or invalid token in %s', async (data) => {
    vi.mocked(axios.post).mockResolvedValue({ data });
    expect(await auth.login(credentials, {})).toBe(false);
    expect(session.token).toBeNull();
  });

  it.each([[], 'invalid', { username: 123 }, { displayName: false }])('rejects malformed user %s without creating a session', async (user) => {
    vi.mocked(axios.post).mockResolvedValue({ data: { token: 'test-token', user } });
    await expect(auth.login(credentials, {})).rejects.toThrow(AUTH_ERROR_MESSAGE);
    expect(session.token).toBeNull();
  });

  it.each([new Error('private transport detail'), { response: { data: { message: '<b>private remote detail</b>' } } }, null])('normalizes unknown failures without leaking details', async (error) => {
    vi.mocked(axios.post).mockRejectedValue(error);
    await expect(auth.login(credentials, {})).rejects.toThrow(AUTH_ERROR_MESSAGE);
    expect(session.token).toBeNull();
  });

  it('does not retain credentials when preferences cannot be saved', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { token: 'test-token', user: {} } });
    vi.mocked(localStorage.setItem).mockImplementationOnce(() => { throw new Error('quota'); });
    await expect(auth.login(credentials, {})).rejects.toThrow(AUTH_ERROR_MESSAGE);
    expect(session.token).toBeNull();
  });
});