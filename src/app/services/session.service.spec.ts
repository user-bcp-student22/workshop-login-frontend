import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from './session.service';

describe('H-02 SessionService correction', () => {
  const stored = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => stored.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { stored.set(key, value); }),
    removeItem: vi.fn((key: string) => { stored.delete(key); })
  };

  beforeEach(() => {
    vi.clearAllMocks();
    stored.clear();
    storage.removeItem.mockImplementation((key: string) => { stored.delete(key); });
    vi.stubGlobal('localStorage', storage);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('keeps token and user in the same application instance only', () => {
    const session = new SessionService();
    session.save('test-token', { username: 'student' }, { compact: true });
    expect(session.token).toBe('test-token');
    expect(session.user).toEqual({ username: 'student' });
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith('workshop_preferences', '{"compact":true}');
    expect(stored.has('workshop_token')).toBe(false);
    expect(stored.has('workshop_user')).toBe(false);
  });

  it('does not recover session after an application restart', () => {
    const first = new SessionService();
    first.save('test-token', { username: 'student' }, { compact: true });
    const restarted = new SessionService();
    expect(restarted.token).toBeNull();
    expect(restarted.user).toEqual({});
    expect(restarted.loadPreferences().compact).toBe(true);
  });

  it('removes old credentials without ever reading them', () => {
    stored.set('workshop_token', 'legacy-token');
    stored.set('workshop_user', '{');
    stored.set('workshop_preferences', '{"theme":"dark"}');
    const session = new SessionService();
    expect(session.token).toBeNull();
    expect(session.user).toEqual({});
    expect(storage.getItem).not.toHaveBeenCalledWith('workshop_token');
    expect(storage.getItem).not.toHaveBeenCalledWith('workshop_user');
    expect(stored.has('workshop_token')).toBe(false);
    expect(stored.has('workshop_user')).toBe(false);
    expect(session.loadPreferences().theme).toBe('dark');
  });

  it('clears in-memory credentials, retaining preferences', () => {
    const session = new SessionService();
    session.save('test-token', { username: 'student' }, { compact: true });
    session.clear();
    expect(session.token).toBeNull();
    expect(session.user).toEqual({});
    expect(stored.get('workshop_preferences')).toBe('{"compact":true}');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it.each([null, '{', '{"compact":true}', '{"nested":{"enabled":true}}'])('preserves preference merging for %s', (saved) => {
    if (saved !== null) stored.set('workshop_preferences', saved);
    const preferences = new SessionService().loadPreferences();
    expect(preferences.theme).toBe('light');
    expect(preferences.showTips).toBe(true);
    expect(preferences.compact).toBe(saved === '{"compact":true}');
    if (saved?.includes('nested')) expect(preferences.nested).toEqual({ enabled: true });
  });

  it('H-12 initializes without throwing when legacy cleanup is blocked', () => {
    storage.removeItem.mockImplementation(() => { throw new DOMException('private storage detail', 'SecurityError'); });
    let session!: SessionService;
    expect(() => { session = new SessionService(); }).not.toThrow();
    expect(session.token).toBeNull();
    expect(session.user).toEqual({});
    expect(console.warn).toHaveBeenCalledExactlyOnceWith('No se pudieron eliminar algunas claves antiguas de sesion.');
  });

  it('H-12 catches access to the localStorage getter and restores the global afterwards', () => {
    const getStorage = vi.fn(() => { throw new DOMException('private getter detail', 'SecurityError'); });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: getStorage });
    let session!: SessionService;
    expect(() => { session = new SessionService(); }).not.toThrow();
    expect(session.token).toBeNull();
    expect(session.user).toEqual({});
    expect(getStorage).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledExactlyOnceWith('No se pudieron eliminar algunas claves antiguas de sesion.');
  });

  it.each([
    { name: 'token key', failedKeys: ['workshop_token'] },
    { name: 'user key', failedKeys: ['workshop_user'] },
    { name: 'both keys', failedKeys: ['workshop_token', 'workshop_user'] }
  ])('H-12 attempts both legacy keys when cleanup fails for $name', ({ failedKeys }) => {
    stored.set('workshop_token', 'legacy-test-token');
    stored.set('workshop_user', '{"username":"private-test-user"}');
    stored.set('workshop_preferences', '{"compact":true}');
    storage.removeItem.mockImplementation((key: string) => {
      if (failedKeys.includes(key)) throw new Error('private storage detail');
      stored.delete(key);
    });
    let session!: SessionService;
    expect(() => { session = new SessionService(); }).not.toThrow();
    expect(storage.removeItem.mock.calls).toEqual([['workshop_token'], ['workshop_user']]);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(session.token).toBeNull();
    expect(session.user).toEqual({});
    expect(stored.get('workshop_preferences')).toBe('{"compact":true}');
    for (const key of ['workshop_token', 'workshop_user']) {
      expect(stored.has(key)).toBe(failedKeys.includes(key));
    }
    expect(console.warn).toHaveBeenCalledExactlyOnceWith('No se pudieron eliminar algunas claves antiguas de sesion.');
  });
});