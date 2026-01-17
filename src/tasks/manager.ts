import { homedir } from 'os';
import { join } from 'path';
import type { Task } from './types';

const DEFAULT_TASKS_PATH = join(homedir(), '.pomotui-tasks.json');

export class TaskManager {
  private tasks: Task[];
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || DEFAULT_TASKS_PATH;
    this.tasks = this.load();
  }

  private load(): Task[] {
    try {
      const file = Bun.file(this.filePath);
      if (file.size === 0) {
        return [];
      }
      const content = require(this.filePath);
      return Array.isArray(content) ? content : [];
    } catch {
      return [];
    }
  }

  private async save(): Promise<void> {
    await Bun.write(this.filePath, JSON.stringify(this.tasks, null, 2));
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  add(text: string): Task {
    const task: Task = {
      id: this.generateId(),
      text: text.trim(),
      completed: false,
      createdAt: Date.now(),
    };
    this.tasks.push(task);
    this.save();
    return task;
  }

  toggle(id: string): void {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      this.save();
    }
  }

  delete(id: string): void {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.save();
  }

  getTasks(): Task[] {
    return [...this.tasks];
  }

  getPending(): Task[] {
    return this.tasks
      .filter(t => !t.completed)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  getCompleted(): Task[] {
    return this.tasks
      .filter(t => t.completed)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
}
