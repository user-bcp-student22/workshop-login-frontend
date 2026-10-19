import { Injectable } from '@angular/core';
import axios from 'axios';
import { environment } from '../../environments/environment';
import { Credentials, isRecord, isUser, LoginRequest, LoginResponse, Preferences } from '../models/api.models';
import { SessionService } from './session.service';

export const AUTH_ERROR_MESSAGE = 'No se pudo completar el inicio de sesi\u00f3n. Int\u00e9ntalo de nuevo.';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private session: SessionService) {}

  async login(credentials: Credentials, preferences: Preferences): Promise<boolean> {
    try {
      const request: LoginRequest = { ...credentials, client: environment.client };
      const response = await axios.post<unknown>(environment.authUrl,
        request, { timeout: environment.loginTimeoutMs });
      const data = response.data;
      if (!isRecord(data) || typeof data.token !== 'string' || !data.token) return false;
      const user = data.user ?? {};
      if (!isUser(user)) throw new Error('Usuario no valido');
      const login: LoginResponse = { token: data.token, user };
      this.session.save(login.token, login.user, preferences);
      return true;
    } catch {
      throw new Error(AUTH_ERROR_MESSAGE);
    }
  }
}