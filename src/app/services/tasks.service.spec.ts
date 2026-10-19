import '@angular/compiler';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from './session.service';
import { TasksService } from './tasks.service';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));

describe('TasksService contract', () => {
  let session: SessionService;
  let tasks: TasksService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', { removeItem: vi.fn(), setItem: vi.fn() });
    session = new SessionService();
    session.save('test-token', { username: 'student' }, {});
    tasks = new TasksService(session);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns the original task list with the exact GET and Bearer contract', async () => {
    const response = [{ title: 'task', description: 'detail', owner: 'student', priority: 2, status: 'TODO', label: 'old' }, {}];
    vi.mocked(axios.get).mockResolvedValue({ data: response });
    expect(await tasks.load()).toBe(response);
    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student', {
      headers: { Authorization: 'Bearer test-token' }
    });
  });

  it('preserves an empty owner and does not add a timeout', async () => {
    session.save('test-token', {}, {});
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    expect(await tasks.load()).toEqual([]);
    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=', {
      headers: { Authorization: 'Bearer test-token' }
    });
  });

  it.each([null, {}, [null], [{ priority: {} }], [{ title: 123 }], [{ priority: 'HIGH' }, false]])('rejects malformed task response %s', async (data) => {
    vi.mocked(axios.get).mockResolvedValue({ data });
    await expect(tasks.load()).rejects.toThrow('Respuesta de tareas no valida');
  });

  it.each([
    [{ response: { status: 401, data: { detail: 'unauthorized' } } }, 'unauthorized'],
    [{ response: { status: 403, data: { detail: 'forbidden' } } }, 'forbidden'],
    [{ response: { data: {} }, message: 'offline' }, 'offline'],
    [{ response: { data: { detail: '' } }, message: '' }, 'No se pudo cargar el dashboard'],
    [null, 'No se pudo cargar el dashboard']
  ])('preserves existing task error precedence without revoking session', async (error, expected) => {
    vi.mocked(axios.get).mockRejectedValue(error);
    await expect(tasks.load()).rejects.toThrow(expected);
    expect(session.token).toBe('test-token');
  });
});