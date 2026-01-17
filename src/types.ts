export type SessionType = 'work' | 'shortBreak' | 'longBreak';

export interface PomodoroConfig {
  workDuration: number;      // in minutes
  shortBreakDuration: number; // in minutes
  longBreakDuration: number;  // in minutes
  pomodorosBeforeLongBreak: number;
}

export interface PomodoroState {
  currentSession: SessionType;
  timeRemaining: number;     // in seconds
  isRunning: boolean;
  completedPomodoros: number;
}

export const DEFAULT_CONFIG: PomodoroConfig = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  pomodorosBeforeLongBreak: 4,
};
