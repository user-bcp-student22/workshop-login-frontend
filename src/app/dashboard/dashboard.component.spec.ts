import '@angular/compiler';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardComponent } from './dashboard.component';
import { SessionService } from '../services/session.service';
import { TasksService } from '../services/tasks.service';
import { Task } from '../models/api.models';

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

describe('DashboardComponent characterization', () => {
  const stored = new Map<string, string>();
  const navigate = vi.fn().mockResolvedValue(true);
  const detectChanges = vi.fn();
  const storage = {
    getItem: vi.fn((key: string) => stored.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { stored.set(key, value); }),
    removeItem: vi.fn((key: string) => { stored.delete(key); })
  };
  const createComponent = (session: SessionService, tasksService = new TasksService(session)) => {
    return new DashboardComponent(
      { navigate } as unknown as Router,
      { detectChanges } as unknown as ChangeDetectorRef,
      { run: (operation: () => void) => operation() } as unknown as NgZone,
      session, tasksService
    );
  };
  let component: DashboardComponent;
  let session: SessionService;

  const captureTaskComparator = async (tasks: Task[]) => {
    const sortSpy = vi.spyOn(Array.prototype, 'sort');
    vi.mocked(axios.get).mockResolvedValueOnce({ data: tasks });
    await component.ngOnInit();
    const callIndex = sortSpy.mock.contexts.findIndex((context) => context === component.visibleTasks);
    const compare = sortSpy.mock.calls[callIndex]?.[0];
    expect(compare).toBeTypeOf('function');
    return compare;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    stored.clear();
    vi.stubGlobal('localStorage', storage);
    session = new SessionService();
    session.save('test-token', { username: 'student' }, {});
    component = createComponent(session);
  });

  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('queries tasks with owner/Bearer and preserves filtering and sorting', async () => {
    const tasks = [
      { title: 'low', status: 'TODO', priority: 'A', owner: 'student' },
      { title: 'archived', status: 'ARCHIVED', priority: 'Z' },
      { title: 'high', status: 'DONE', priority: 'B', owner: 'student' }
    ];
    vi.mocked(axios.get).mockResolvedValue({ data: tasks });
    await component.ngOnInit();
    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student', {
      headers: { Authorization: 'Bearer test-token' }
    });
    expect(component.tasks).toBe(tasks);
    expect(component.visibleTasks.map((task) => task.title)).toEqual(['high', 'low']);
    expect(component.visibleTasks[0].label).toBe('B \u00b7 STUDENT');
    expect(component.loading).toBe(false);
    expect(detectChanges).toHaveBeenCalled();
  });

  it('redirects without token and never queries tasks', async () => {
    session.clear();
    await component.ngOnInit();
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it.each([
    [{ title: 'first', priority: 'A' }, { title: 'second' }],
    [{ title: 'first' }, { title: 'second', priority: 'A' }],
    [{ title: 'first', priority: 'A' }, { title: 'second', priority: 'A' }]
  ])('preserves existing comparator behavior for missing or equal priorities', async (first, second) => {
    vi.mocked(axios.get).mockResolvedValue({ data: [first, second] });
    await component.ngOnInit();
    expect(component.visibleTasks.map((task) => task.title)).toEqual(['first', 'second']);
  });

  it('uses an empty owner when username is absent', async () => {
    session.save('test-token', {}, {});
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    await component.ngOnInit();
    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=', expect.any(Object));
    expect(component.visibleTasks).toEqual([]);
    expect(component.loading).toBe(false);
  });

  it.each([
    [{ response: { status: 401, data: { detail: 'unauthorized' } } }, 'unauthorized'],
    [{ response: { status: 403, data: { detail: 'forbidden' } } }, 'forbidden'],
    [{ message: 'offline' }, 'offline'],
    [{}, 'No se pudo cargar el dashboard']
  ])('shows errors without automatic logout or redirection', async (error, expected) => {
    vi.mocked(axios.get).mockRejectedValue(error);
    await component.ngOnInit();
    expect(component.error).toBe(expected);
    expect(component.loading).toBe(false);
    expect(session.token).toBe('test-token');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not restore corrupt legacy user JSON after application restart', async () => {
    stored.set('workshop_user', '{');
    const restarted = createComponent(new SessionService());
    await restarted.ngOnInit();
    expect(stored.has('workshop_user')).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('shares session across components, but loses it after application restart', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    await createComponent(session).ngOnInit();
    expect(axios.get).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    vi.mocked(axios.get).mockClear();
    await createComponent(new SessionService()).ngOnInit();
    expect(axios.get).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('logs out locally, retaining preferences', async () => {
    stored.set('workshop_preferences', '{"compact":true}');
    await component.logout();
    expect(stored.has('workshop_token')).toBe(false);
    expect(stored.has('workshop_user')).toBe(false);
    expect(session.token).toBeNull();
    expect(session.user).toEqual({});
    expect(stored.get('workshop_preferences')).toBe('{"compact":true}');
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it.each([
    ['todo', 'Por hacer'], ['IN_PROGRESS', 'En progreso'], ['DONE', 'Completado'],
    ['RESUELTO', 'Resuelto'], ['COMPLETED', 'Completado'], ['custom', 'custom'], ['', '']
  ])('maps status %s', (status, expected) => {
    expect(component.statusLabel(status)).toBe(expected);
  });

  it('shows the API rejection of an invalid token without silently logging out', async () => {
    session.save('rejected-test-token', { username: 'student' }, {});
    vi.mocked(axios.get).mockRejectedValueOnce({ response: { status: 401, data: { detail: 'invalid token' } } });
    await component.ngOnInit();
    expect(axios.get).toHaveBeenCalledExactlyOnceWith('http://localhost:8000/api/tasks?owner=student', {
      headers: { Authorization: 'Bearer rejected-test-token' }
    });
    expect(component.error).toBe('invalid token');
    expect(component.loading).toBe(false);
    expect(component.visibleTasks).toEqual([]);
    expect(session.token).toBe('rejected-test-token');
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'backend down', error: { code: 'ECONNREFUSED', message: 'connection refused' }, message: 'connection refused' },
    { name: 'network/CORS rejection', error: { code: 'ERR_NETWORK', message: 'Network Error' }, message: 'Network Error' },
    { name: 'cancellation', error: { code: 'ERR_CANCELED', message: 'canceled' }, message: 'canceled' },
    { name: 'reported upstream timeout', error: { code: 'ETIMEDOUT', message: 'upstream timed out' }, message: 'upstream timed out' },
    { name: 'HTTP 404', error: { response: { status: 404, data: { detail: 'not found' } } }, message: 'not found' },
    { name: 'HTTP 500', error: { response: { status: 500, data: { detail: 'service unavailable' } } }, message: 'service unavailable' },
    { name: 'non-string error body', error: { response: { data: { detail: 123, message: 'ignored body message' } } }, message: 'No se pudo cargar el dashboard' }
  ])('handles $name with UI error and session preserved', async ({ error, message }) => {
    vi.mocked(axios.get).mockRejectedValueOnce(error);
    await component.ngOnInit();
    expect(component.error).toBe(message);
    expect(component.loading).toBe(false);
    expect(component.visibleTasks).toEqual([]);
    expect(session.token).toBe('test-token');
    expect(navigate).not.toHaveBeenCalled();
    expect(detectChanges).toHaveBeenCalledOnce();
  });

  it('does not invent a 5000 ms GET timeout while the request is unresolved', async () => {
    vi.useFakeTimers();
    let finish!: (value: { data: unknown[] }) => void;
    vi.mocked(axios.get).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const pending = component.ngOnInit();
    await vi.advanceTimersByTimeAsync(60000);
    expect(component.loading).toBe(true);
    expect(component.error).toBe('');
    expect(axios.get).toHaveBeenCalledExactlyOnceWith('http://localhost:8000/api/tasks?owner=student', {
      headers: { Authorization: 'Bearer test-token' }
    });
    finish({ data: [] });
    await pending;
    expect(component.loading).toBe(false);
    expect(component.error).toBe('');
  });

  it.each([undefined, null, 'not JSON', {}, [null], [{ status: null }], [{ priority: {} }], [{ title: 123 }]])('shows an error rather than partial tasks for unexpected response %s', async (data) => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data });
    await component.ngOnInit();
    expect(component.error).toBe('Respuesta de tareas no valida');
    expect(component.visibleTasks).toEqual([]);
    expect(component.loading).toBe(false);
    expect(session.token).toBe('test-token');
  });

  it.each([[], [{ title: 'hidden', status: 'ARCHIVED' }]])('finishes successfully with no visible tasks for %s', async (...tasks) => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: tasks[0] === undefined ? [] : tasks });
    await component.ngOnInit();
    expect(component.error).toBe('');
    expect(component.visibleTasks).toEqual([]);
    expect(component.loading).toBe(false);
  });

  it.each([new Error('unexpected processing failure'), 'non-Error rejection'])('handles an unexpected dependency failure without leaving loading active', async (error) => {
    const tasksService = new TasksService(session);
    vi.spyOn(tasksService, 'load').mockRejectedValueOnce(error);
    const dashboard = createComponent(session, tasksService);
    await dashboard.ngOnInit();
    expect(dashboard.error).toBe(error instanceof Error ? error.message : 'No se pudo cargar el dashboard');
    expect(dashboard.loading).toBe(false);
    expect(session.token).toBe('test-token');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reports a processing exception from a task without exposing a partial list', async () => {
    const tasksService = new TasksService(session);
    vi.spyOn(tasksService, 'load').mockResolvedValueOnce([{
      title: 'fault injection',
      get status(): string { throw new Error('processing failed'); }
    }]);
    const dashboard = createComponent(session, tasksService);
    await dashboard.ngOnInit();
    expect(dashboard.error).toBe('processing failed');
    expect(dashboard.visibleTasks).toEqual([]);
    expect(dashboard.loading).toBe(false);
    expect(session.token).toBe('test-token');
  });

  it.each(['A', 2, 0, '', undefined])('H-11 returns zero for equal priority %s and preserves tie order', async (priority) => {
    const first: Task = { title: 'first', priority };
    const second: Task = { title: 'second', priority };
    const compare = await captureTaskComparator([first, second]);
    expect(compare?.(first, first)).toBe(0);
    expect(compare?.(first, second)).toBe(0);
    expect(component.visibleTasks.map((task) => task.title)).toEqual(['first', 'second']);
  });

  it.each([
    { higher: 'B', lower: 'A' },
    { higher: 2, lower: 1 }
  ])('H-11 preserves signs for distinct priorities $higher and $lower', async ({ higher, lower }) => {
    const first: Task = { priority: higher };
    const second: Task = { priority: lower };
    const compare = await captureTaskComparator([first, second]);
    expect(compare?.(first, second)).toBeLessThan(0);
    expect(compare?.(second, first)).toBeGreaterThan(0);
  });

  it('H-12 completes logout and navigation when legacy storage cleanup fails', async () => {
    stored.set('workshop_preferences', '{"compact":true}');
    storage.removeItem.mockImplementationOnce(() => { throw new DOMException('private storage detail', 'SecurityError'); });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(component.logout()).resolves.toBeUndefined();
    expect(session.token).toBeNull();
    expect(session.user).toEqual({});
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/login']);
    expect(stored.get('workshop_preferences')).toBe('{"compact":true}');
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledExactlyOnceWith('No se pudieron eliminar algunas claves antiguas de sesion.');
  });
});