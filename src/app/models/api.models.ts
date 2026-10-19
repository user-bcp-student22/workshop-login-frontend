export interface Credentials {
  username: string;
  password: string;
}

export interface LoginRequest extends Credentials {
  client: string;
}

export interface User {
  username?: string;
  displayName?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface LoginMessage {
  title: string;
  detail?: string;
}

export interface Preferences {
  [key: string]: unknown;
}

export interface Task {
  status?: string;
  priority?: string | number;
  owner?: string;
  title?: string;
  description?: string;
  label?: string;
}

export interface TasksQuery {
  owner: string;
}

export type TasksResponse = Task[];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isUser(value: unknown): value is User {
  return isRecord(value)
    && (value.username === undefined || typeof value.username === 'string')
    && (value.displayName === undefined || typeof value.displayName === 'string');
}

export function isTask(value: unknown): value is Task {
  if (!isRecord(value)) return false;
  const textFields = ['status', 'owner', 'title', 'description', 'label'];
  return textFields.every((field) => value[field] === undefined || typeof value[field] === 'string')
    && (value.priority === undefined || typeof value.priority === 'string' || typeof value.priority === 'number');
}

export function errorMessage(error: unknown, field: 'message' | 'detail', fallback: string): string {
  if (!isRecord(error)) return fallback;
  const response = isRecord(error.response) ? error.response : {};
  const data = isRecord(response.data) ? response.data : {};
  if (typeof data[field] === 'string' && data[field]) return data[field];
  return typeof error.message === 'string' && error.message ? error.message : fallback;
}