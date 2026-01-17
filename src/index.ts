import blessed from 'blessed';
import { Pomodoro } from './pomodoro';
import type { PomodoroState, SessionType } from './types';

class PomodoroTUI {
  private pomodoro: Pomodoro;
  private screen: blessed.Widgets.Screen;
  private timerBox: blessed.Widgets.BoxElement;
  private sessionBox: blessed.Widgets.BoxElement;
  private progressBar: blessed.Widgets.ProgressBarElement;
  private statsBox: blessed.Widgets.BoxElement;
  private statusBox: blessed.Widgets.BoxElement;
  private totalSeconds: number;

  constructor() {
    this.pomodoro = new Pomodoro();
    this.totalSeconds = this.pomodoro.getState().timeRemaining;

    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Pomodoro Timer',
    });

    // Create main container
    const mainBox = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: 50,
      height: 18,
      border: {
        type: 'line',
      },
      style: {
        border: {
          fg: 'cyan',
        },
      },
    });

    // Title
    blessed.box({
      parent: mainBox,
      top: 0,
      left: 'center',
      width: 'shrink',
      height: 1,
      content: ' POMODORO TIMER ',
      style: {
        fg: 'white',
        bold: true,
      },
    });

    // Session type display
    this.sessionBox = blessed.box({
      parent: mainBox,
      top: 2,
      left: 'center',
      width: 'shrink',
      height: 1,
      content: 'WORK',
      style: {
        fg: 'red',
        bold: true,
      },
    });

    // Timer display
    this.timerBox = blessed.box({
      parent: mainBox,
      top: 4,
      left: 'center',
      width: 'shrink',
      height: 3,
      content: this.getLargeTime('25:00'),
      style: {
        fg: 'white',
        bold: true,
      },
    });

    // Progress bar
    this.progressBar = blessed.progressbar({
      parent: mainBox,
      top: 8,
      left: 2,
      width: 44,
      height: 1,
      orientation: 'horizontal',
      filled: 100,
      style: {
        bar: {
          bg: 'green',
        },
      },
      ch: '█',
    });

    // Status display (Running/Paused)
    this.statusBox = blessed.box({
      parent: mainBox,
      top: 10,
      left: 'center',
      width: 'shrink',
      height: 1,
      content: '[ PAUSED ]',
      style: {
        fg: 'yellow',
      },
    });

    // Stats display
    this.statsBox = blessed.box({
      parent: mainBox,
      top: 12,
      left: 'center',
      width: 'shrink',
      height: 1,
      content: 'Completed: 0 pomodoros',
      style: {
        fg: 'gray',
      },
    });

    // Controls help
    blessed.box({
      parent: mainBox,
      top: 14,
      left: 'center',
      width: 'shrink',
      height: 1,
      content: '[s]tart [p]ause [r]eset [n]ext [q]uit',
      style: {
        fg: 'cyan',
      },
    });

    this.setupCallbacks();
    this.setupKeyBindings();
  }

  private getLargeTime(time: string): string {
    return `     ${time}     `;
  }

  private getSessionColor(session: SessionType): string {
    switch (session) {
      case 'work':
        return 'red';
      case 'shortBreak':
        return 'green';
      case 'longBreak':
        return 'blue';
    }
  }

  private getSessionLabel(session: SessionType): string {
    switch (session) {
      case 'work':
        return 'WORK';
      case 'shortBreak':
        return 'SHORT BREAK';
      case 'longBreak':
        return 'LONG BREAK';
    }
  }

  private setupCallbacks(): void {
    this.pomodoro.setOnTick((state) => this.render(state));
    this.pomodoro.setOnSessionComplete((session) => this.onSessionComplete(session));
  }

  private setupKeyBindings(): void {
    // Quit
    this.screen.key(['q', 'C-c', 'escape'], () => {
      const state = this.pomodoro.getState();
      this.screen.destroy();
      console.log(`\nGoodbye! You completed ${state.completedPomodoros} pomodoros.`);
      process.exit(0);
    });

    // Start
    this.screen.key(['s'], () => {
      this.pomodoro.start();
    });

    // Pause
    this.screen.key(['p'], () => {
      this.pomodoro.pause();
      this.render(this.pomodoro.getState());
    });

    // Reset
    this.screen.key(['r'], () => {
      this.pomodoro.reset();
    });

    // Next/Skip
    this.screen.key(['n'], () => {
      this.pomodoro.skip();
    });
  }

  private render(state: PomodoroState): void {
    const time = this.pomodoro.formatTime(state.timeRemaining);
    const session = state.currentSession;
    const color = this.getSessionColor(session);

    // Update timer
    this.timerBox.setContent(this.getLargeTime(time));

    // Update session label and color
    this.sessionBox.setContent(this.getSessionLabel(session));
    this.sessionBox.style.fg = color;

    // Update progress bar
    const sessionDuration = this.getSessionDuration(session);
    const progress = (state.timeRemaining / (sessionDuration * 60)) * 100;
    this.progressBar.setProgress(progress);
    (this.progressBar.style.bar as any).bg = color;

    // Update status
    this.statusBox.setContent(state.isRunning ? '[ RUNNING ]' : '[ PAUSED ]');
    this.statusBox.style.fg = state.isRunning ? 'green' : 'yellow';

    // Update stats
    this.statsBox.setContent(`Completed: ${state.completedPomodoros} pomodoros`);

    // Update screen title
    this.screen.title = `${time} - ${this.getSessionLabel(session)}`;

    this.screen.render();
  }

  private getSessionDuration(session: SessionType): number {
    switch (session) {
      case 'work':
        return 25;
      case 'shortBreak':
        return 5;
      case 'longBreak':
        return 15;
    }
  }

  private onSessionComplete(session: SessionType): void {
    this.notifyUser();
    // Update total seconds for next session
    const state = this.pomodoro.getState();
    this.totalSeconds = state.timeRemaining;
  }

  private notifyUser(): void {
    // Terminal bell
    this.screen.program.bell();

    // Play notification sound based on platform
    const platform = process.platform;
    let command: string;

    if (platform === 'darwin') {
      command = 'afplay /System/Library/Sounds/Glass.aiff';
    } else if (platform === 'win32') {
      command = 'powershell -c "(New-Object Media.SoundPlayer \'C:\\Windows\\Media\\notify.wav\').PlaySync()"';
    } else {
      command = 'paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || aplay /usr/share/sounds/alsa/Front_Center.wav 2>/dev/null || true';
    }

    Bun.spawn(['sh', '-c', command], { stdout: 'ignore', stderr: 'ignore' });
  }

  run(): void {
    this.render(this.pomodoro.getState());
    this.screen.render();
  }
}

const app = new PomodoroTUI();
app.run();
