import { homedir } from 'os';
import { join } from 'path';
import type { PomodoroHistory, PomodoroHistoryEntry, SessionType } from './types';

const DEFAULT_HISTORY_PATH = join(homedir(), '.pomodoro', 'history.json');

export class HistoryManager {
  private filePath: string;
  private history: PomodoroHistory;

  constructor(filePath?: string) {
    this.filePath = filePath || DEFAULT_HISTORY_PATH;
    this.history = this.load();
  }

  private load(): PomodoroHistory {
    try {
      const fs = require('fs');
      if (!fs.existsSync(this.filePath)) {
        return this.createEmpty();
      }
      const file = Bun.file(this.filePath);
      if (file.size === 0) {
        return this.createEmpty();
      }
      const content = require(this.filePath);
      return content as PomodoroHistory;
    } catch {
      return this.createEmpty();
    }
  }

  private createEmpty(): PomodoroHistory {
    return {
      entries: [],
      totalPomodoros: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  private async ensureDirectory(): Promise<void> {
    const dir = this.filePath.substring(0, this.filePath.lastIndexOf('/'));
    try {
      await Bun.write(join(dir, '.keep'), '');
    } catch {
      // Directory might already exist
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private getDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private getPomodoroNumberForToday(): number {
    const today = this.getDateString(new Date());
    const todayEntries = this.history.entries.filter(
      (e) => e.date === today && e.sessionType === 'work'
    );
    return todayEntries.length + 1;
  }

  async addEntry(sessionType: SessionType, duration: number): Promise<PomodoroHistoryEntry> {
    const now = new Date();
    const entry: PomodoroHistoryEntry = {
      id: this.generateId(),
      sessionType,
      duration,
      completedAt: now.toISOString(),
      date: this.getDateString(now),
      pomodoroNumber: sessionType === 'work' ? this.getPomodoroNumberForToday() : 0,
    };

    this.history.entries.push(entry);
    if (sessionType === 'work') {
      this.history.totalPomodoros++;
    }
    this.history.lastUpdated = now.toISOString();

    await this.save();
    return entry;
  }

  private async save(): Promise<void> {
    await this.ensureDirectory();
    await Bun.write(this.filePath, JSON.stringify(this.history, null, 2));
  }

  getHistory(): PomodoroHistory {
    return { ...this.history };
  }

  getTodayStats(): { pomodoros: number; totalMinutes: number } {
    const today = this.getDateString(new Date());
    const todayEntries = this.history.entries.filter(
      (e) => e.date === today && e.sessionType === 'work'
    );
    return {
      pomodoros: todayEntries.length,
      totalMinutes: todayEntries.reduce((sum, e) => sum + e.duration, 0),
    };
  }

  getFilePath(): string {
    return this.filePath;
  }
}
