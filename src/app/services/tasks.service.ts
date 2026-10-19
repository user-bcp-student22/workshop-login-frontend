import { Injectable } from '@angular/core';
import axios from 'axios';
import { environment } from '../../environments/environment';
import { errorMessage, isTask, TasksQuery, TasksResponse } from '../models/api.models';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class TasksService {
  constructor(private session: SessionService) {}

  async load(): Promise<TasksResponse> {
    try {
      const query: TasksQuery = { owner: this.session.user.username || '' };
      const response = await axios.get<unknown>(environment.tasksUrl + '?owner=' + query.owner, {
        headers: { Authorization: 'Bearer ' + this.session.token }
      });
      const tasks = response.data;
      if (!Array.isArray(tasks) || !tasks.every(isTask)) throw new Error('Respuesta de tareas no valida');
      return tasks;
    } catch (error: unknown) {
      throw new Error(errorMessage(error, 'detail', 'No se pudo cargar el dashboard'));
    }
  }
}