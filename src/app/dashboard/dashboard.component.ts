import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Task, User } from '../models/api.models';
import { SessionService } from '../services/session.service';
import { TasksService } from '../services/tasks.service';
import { formatTaskLabel } from '../utils/legacy-format';

const STATUS_LABELS: Record<string, string> = {
  TODO: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  DONE: 'Completado',
  RESUELTO: 'Resuelto',
  COMPLETED: 'Completado'
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  tasks: Task[] = [];
  visibleTasks: Task[] = [];
  user: User = {};
  loading = true;
  error = '';

  constructor(private router: Router, private cdr: ChangeDetectorRef, private zone: NgZone,
    private session: SessionService, private tasksService: TasksService) {}

  statusLabel(status: string): string {
    return STATUS_LABELS[(status || '').toUpperCase()] || status;
  }

  async ngOnInit(): Promise<void> {
    const token = this.session.token;
    this.user = this.session.user;
    if (!token) {
      await this.router.navigate(['/login']);
      return;
    }
    try {
      const tasks = await this.tasksService.load();
      const visibleTasks: Task[] = [];
      for (const task of tasks) {
        if (task.status === 'ARCHIVED') continue;
        task.label = formatTaskLabel(task);
        visibleTasks.push(task);
      }
      visibleTasks.sort((first, second) => {
        if (first.priority === second.priority) return 0;
        if (first.priority === undefined || second.priority === undefined) return 1;
        return first.priority > second.priority ? -1 : 1;
      });
      this.zone.run(() => {
        this.tasks = tasks;
        this.visibleTasks = visibleTasks;
        this.loading = false;
        this.cdr.detectChanges();
      });
    } catch (error: unknown) {
      this.zone.run(() => {
        this.error = error instanceof Error ? error.message : 'No se pudo cargar el dashboard';
        this.loading = false;
        this.cdr.detectChanges();
      });
    }
  }

  async logout(): Promise<void> {
    this.session.clear();
    await this.router.navigate(['/login']);
  }
}
