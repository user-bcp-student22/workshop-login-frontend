import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LoginMessage, Preferences } from '../models/api.models';
import { AUTH_ERROR_MESSAGE, AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username: string | null | undefined = '';
  password: string | null | undefined = '';
  busy = false;
  message: LoginMessage | null = null;
  preferences: Preferences;

  constructor(private router: Router, private auth: AuthService, session: SessionService,
    private cdr: ChangeDetectorRef) {
    this.preferences = session.loadPreferences();
  }

  async login(): Promise<void> {
    this.message = null;
    if (this.username === null || this.username === undefined || String(this.username).trim() === '') {
      this.message = { title: 'Ingrese un usuario.' };
      return;
    }
    if (this.password === null || this.password === undefined || String(this.password).trim() === '') {
      this.message = { title: 'Ingrese una contraseña.' };
      return;
    }
    this.busy = true;
    try {
      const authenticated = await this.auth.login({ username: this.username, password: this.password }, this.preferences);
      if (!authenticated) {
        this.message = { title: 'El backend respondió sin token.' };
        return;
      }
      await this.router.navigate(['/dashboard']);
    } catch {
      this.message = { title: 'No se pudo autenticar a ' + this.username + '.', detail: AUTH_ERROR_MESSAGE };
    } finally {
      this.busy = false;
      this.cdr.detectChanges();
    }
  }
}
