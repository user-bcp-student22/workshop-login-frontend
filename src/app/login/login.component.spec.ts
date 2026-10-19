import '@angular/compiler';
import { readFileSync } from 'node:fs';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginComponent } from './login.component';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { TasksService } from '../services/tasks.service';

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

describe('LoginComponent characterization', () => {
  const stored = new Map<string, string>();
  const navigate = vi.fn().mockResolvedValue(true);
  const detectChanges = vi.fn();
  const storage = {
    getItem: vi.fn((key: string) => stored.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { stored.set(key, value); }),
    removeItem: vi.fn((key: string) => { stored.delete(key); })
  };
  let component: LoginComponent;
  let session: SessionService;
  const createComponent = () => {
    session = new SessionService();
    return new LoginComponent({ navigate } as unknown as Router, new AuthService(session), session,
      { detectChanges } as unknown as ChangeDetectorRef);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    stored.clear();
    vi.stubGlobal('localStorage', storage);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    component = createComponent();
    component.username = ' student ';
    component.password = ' password ';
  });

  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('posts original credentials, saves memory session/preferences before navigation', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { token: 'test-token', user: { username: 'student' } } });
    navigate.mockImplementationOnce(async () => {
      expect(session.token).toBe('test-token');
      expect(session.user).toEqual({ username: 'student' });
      expect(stored.has('workshop_token')).toBe(false);
      expect(stored.has('workshop_user')).toBe(false);
      return true;
    });
    await component.login();
    expect(axios.post).toHaveBeenCalledWith('http://localhost:8080/auth/login', {
      username: ' student ', password: ' password ', client: 'angular-workshop'
    }, { timeout: 5000 });
    expect(stored.get('workshop_preferences')).toBe(JSON.stringify(component.preferences));
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.busy).toBe(false);
  });

  it.each([null, undefined, '', '   '])('rejects empty username %s without HTTP', async (username) => {
    component.username = username;
    await component.login();
    expect(component.message).toEqual({ title: 'Ingrese un usuario.' });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it.each([null, undefined, '', '   '])('rejects empty password %s without HTTP', async (password) => {
    component.password = password;
    await component.login();
    expect(component.message?.title).toBe('Ingrese una contrase\u00f1a.');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('does not save or navigate when the response has no token', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: {} });
    await component.login();
    expect(component.message?.title).toContain('sin token');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(component.busy).toBe(false);
  });

  it.each([
    [{ response: { data: { message: 'remote detail' } }, message: 'transport detail' }, 'remote detail'],
    [{ message: 'transport detail' }, 'transport detail'],
    [{}, 'Error desconocido']
  ])('replaces the previous remote/transport fallback with controlled text', async (error, previousDetail) => {
    vi.mocked(axios.post).mockRejectedValue(error);
    await component.login();
    expect(component.message?.detail).toBe('No se pudo completar el inicio de sesi\u00f3n. Int\u00e9ntalo de nuevo.');
    expect(JSON.stringify(component.message)).not.toContain(previousDetail);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(component.busy).toBe(false);
  });

  it('clears a previous message while a request is pending', async () => {
    let finish!: (value: { data: object }) => void;
    vi.mocked(axios.post).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    component.message = { title: 'previous error' };
    const pending = component.login();
    expect(component.message).toBeNull();
    expect(component.busy).toBe(true);
    finish({ data: {} });
    await pending;
    expect(component.busy).toBe(false);
    expect(detectChanges).toHaveBeenCalledOnce();
  });

  it('merges saved preferences and tolerates invalid preference JSON', () => {
    stored.set('workshop_preferences', '{"compact":true}');
    const restored = createComponent();
    expect(restored.preferences).toEqual({ theme: 'light', showTips: true, compact: true });
    stored.set('workshop_preferences', '{');
    expect(() => createComponent()).not.toThrow();
  });

  it('uses static emphasis around interpolated text (not a DOM security test)', () => {
    const template = readFileSync(new URL('./login.component.html', import.meta.url), 'utf8');
    expect(template).toContain('<strong>{{ message.title }}</strong>');
  });

  it('H-04 uses a structured text validation message', async () => {
    component.username = '';
    await component.login();
    expect(component.message).toEqual({ title: 'Ingrese un usuario.' });
  });

  it('H-04 keeps username literal and hides untrusted remote details', async () => {
    component.username = '<em>usuario</em>';
    vi.mocked(axios.post).mockRejectedValue({ response: { data: { message: '<b>private detail</b>' } } });
    await component.login();
    expect(component.message).toEqual({
      title: 'No se pudo autenticar a <em>usuario</em>.',
      detail: 'No se pudo completar el inicio de sesi\u00f3n. Int\u00e9ntalo de nuevo.'
    });
  });

  it('H-04 interpolates text rather than binding HTML (structural check only)', () => {
    const template = readFileSync(new URL('./login.component.html', import.meta.url), 'utf8');
    expect(template).not.toContain('[innerHTML]');
    expect(template).toContain('{{ message.title }}');
    expect(template).toContain('{{ message.detail }}');
  });

  it('completes login, loads tasks through the same session and logs out locally', async () => {
    component.username = 'student';
    component.password = 'test-password';
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { token: 'test-token', user: { username: 'student' } } });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: [
      { title: 'visible', status: 'TODO', priority: 2, owner: 'student' },
      { title: 'hidden', status: 'ARCHIVED' }
    ] });
    await component.login();
    expect(component.message).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    const dashboard = new DashboardComponent(
      { navigate } as unknown as Router,
      { detectChanges } as unknown as ChangeDetectorRef,
      { run: (operation: () => void) => operation() } as unknown as NgZone,
      session, new TasksService(session)
    );
    await dashboard.ngOnInit();
    expect(axios.post).toHaveBeenCalledExactlyOnceWith('http://localhost:8080/auth/login', {
      username: 'student', password: 'test-password', client: 'angular-workshop'
    }, { timeout: 5000 });
    expect(axios.get).toHaveBeenCalledExactlyOnceWith('http://localhost:8000/api/tasks?owner=student', {
      headers: { Authorization: 'Bearer test-token' }
    });
    expect(dashboard.visibleTasks.map((task) => task.title)).toEqual(['visible']);
    expect(dashboard.loading).toBe(false);
    expect(dashboard.error).toBe('');
    expect(stored.has('workshop_token')).toBe(false);
    await dashboard.logout();
    expect(session.token).toBeNull();
    expect(navigate).toHaveBeenLastCalledWith(['/login']);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: 'HTTP 401', error: { response: { status: 401, data: { message: 'invalid credentials' } } } },
    { name: 'HTTP 403', error: { response: { status: 403, data: { message: 'forbidden' } } } },
    { name: 'HTTP 404', error: { response: { status: 404, data: {} } } },
    { name: 'HTTP 500', error: { response: { status: 500, data: { message: 'private backend detail' } } } },
    { name: 'backend down', error: { code: 'ECONNREFUSED', message: 'connection refused' } },
    { name: 'network/CORS rejection', error: { code: 'ERR_NETWORK', message: 'Network Error' } },
    { name: 'cancellation', error: { code: 'ERR_CANCELED', message: 'canceled' } }
  ])('handles $name with controlled UI, no session and no navigation', async ({ error }) => {
    vi.mocked(axios.post).mockRejectedValueOnce(error);
    await component.login();
    expect(component.message).toEqual({
      title: 'No se pudo autenticar a ' + component.username + '.',
      detail: 'No se pudo completar el inicio de sesi\u00f3n. Int\u00e9ntalo de nuevo.'
    });
    expect(component.busy).toBe(false);
    expect(detectChanges).toHaveBeenCalledOnce();
    expect(session.token).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('handles a simulated Axios timeout at the configured 5000 ms and releases busy', async () => {
    vi.useFakeTimers();
    vi.mocked(axios.post).mockImplementationOnce((_url, _data, config) => {
      expect(config?.timeout).toBe(5000);
      return new Promise((_resolve, reject) => {
        setTimeout(() => reject(Object.assign(new Error('timeout of 5000ms exceeded'), { code: 'ECONNABORTED' })), config?.timeout);
      });
    });
    const pending = component.login();
    await vi.advanceTimersByTimeAsync(4999);
    expect(component.busy).toBe(true);
    expect(component.message).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(component.busy).toBe(false);
    expect(component.message?.detail).toBe('No se pudo completar el inicio de sesi\u00f3n. Int\u00e9ntalo de nuevo.');
    expect(session.token).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(detectChanges).toHaveBeenCalledOnce();
  });

  it.each([undefined, null, 'not JSON', [], {}, { token: '' }, { token: 123 }])('shows the missing-token UI for unexpected response %s', async (data) => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data });
    await component.login();
    expect(component.message?.title).toBe('El backend respondi\u00f3 sin token.');
    expect(component.busy).toBe(false);
    expect(session.token).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([[], 'invalid', { username: null }, { displayName: false }])('shows controlled UI for malformed user %s', async (user) => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { token: 'test-token', user } });
    await component.login();
    expect(component.message?.detail).toBe('No se pudo completar el inicio de sesi\u00f3n. Int\u00e9ntalo de nuevo.');
    expect(component.busy).toBe(false);
    expect(session.token).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([undefined, null])('accepts absent user %s without inventing required fields', async (user) => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { token: 'test-token', user } });
    await component.login();
    expect(session.user).toEqual({});
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.message).toBeNull();
  });

  it('reports preference-write failure before saving a new session', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { token: 'test-token', user: {} } });
    storage.setItem.mockImplementationOnce(() => { throw new Error('quota exceeded'); });
    await component.login();
    expect(component.message?.detail).toBe('No se pudo completar el inicio de sesi\u00f3n. Int\u00e9ntalo de nuevo.');
    expect(session.token).toBeNull();
    expect(component.busy).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reports a rejected navigation without silently rolling back the saved session', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { token: 'test-token', user: {} } });
    navigate.mockRejectedValueOnce(new Error('navigation failed'));
    await component.login();
    expect(component.message?.detail).toBe('No se pudo completar el inicio de sesi\u00f3n. Int\u00e9ntalo de nuevo.');
    expect(session.token).toBe('test-token');
    expect(component.busy).toBe(false);
  });
});