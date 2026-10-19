import { Injectable } from '@angular/core';
import merge from 'lodash/merge';
import { Preferences, User } from '../models/api.models';

const STORAGE_KEYS = {
  token: 'workshop_token',
  user: 'workshop_user',
  preferences: 'workshop_preferences'
};

@Injectable({ providedIn: 'root' })
export class SessionService {
  private currentToken: string | null = null;
  private currentUser: User = {};

  constructor() {
    this.clear();
  }

  get token(): string | null {
    return this.currentToken;
  }

  get user(): User {
    return this.currentUser;
  }

  loadPreferences(): Preferences {
    const preferences: Preferences = { theme: 'light', showTips: true, compact: false };
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEYS.preferences) || '{}');
      return merge(preferences, saved);
    } catch {
      return preferences;
    }
  }

  save(token: string, user: User, preferences: Preferences): void {
    localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(preferences));
    this.currentToken = token;
    this.currentUser = user;
  }

  clear(): void {
    this.currentToken = null;
    this.currentUser = {};
    if (!this.removeLegacySessionKeys()) {
      console.warn('No se pudieron eliminar algunas claves antiguas de sesion.');
    }
  }

  private removeLegacySessionKeys(): boolean {
    let cleaned = true;
    for (const key of [STORAGE_KEYS.token, STORAGE_KEYS.user]) {
      try {
        localStorage.removeItem(key);
      } catch {
        cleaned = false;
      }
    }
    return cleaned;
  }
}