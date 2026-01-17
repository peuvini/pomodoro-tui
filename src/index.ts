import * as readline from 'readline';
import { Pomodoro } from './pomodoro';
import { PomodoroState, SessionType } from './types';

class PomodoroApp {
  private pomodoro: Pomodoro;
  private rl: readline.Interface;

  constructor() {
    this.pomodoro = new Pomodoro();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.setupCallbacks();
  }

  private setupCallbacks(): void {
    this.pomodoro.setOnTick((state) => this.render(state));
    this.pomodoro.setOnSessionComplete((session) => this.onSessionComplete(session));
  }

  private clearLine(): void {
    process.stdout.write('\r\x1b[K');
  }

  private render(state: PomodoroState): void {
    this.clearLine();
    const time = this.pomodoro.formatTime(state.timeRemaining);
    const session = this.pomodoro.getSessionLabel(state.currentSession);
    const status = state.isRunning ? 'Running' : 'Paused';
    const pomodoros = state.completedPomodoros;

    process.stdout.write(
      `[${session}] ${time} | ${status} | Completed: ${pomodoros} pomodoros`
    );
  }

  private onSessionComplete(session: SessionType): void {
    console.log();
    const label = this.pomodoro.getSessionLabel(session);
    console.log(`\n*** ${label} complete! ***`);
    this.notifyUser();
  }

  private notifyUser(): void {
    // Terminal bell
    process.stdout.write('\x07');
  }

  private showHelp(): void {
    console.log(`
Pomodoro Timer - Commands:
  s, start       - Start the timer
  p, pause       - Pause the timer
  r, reset       - Reset current session
  n, skip        - Skip to next session
  q, quit        - Exit the app
  h, help        - Show this help
`);
  }

  private handleCommand(input: string): boolean {
    const cmd = input.trim().toLowerCase();

    switch (cmd) {
      case 's':
      case 'start':
        this.pomodoro.start();
        return true;
      case 'p':
      case 'pause':
        this.pomodoro.pause();
        this.render(this.pomodoro.getState());
        return true;
      case 'r':
      case 'reset':
        this.pomodoro.reset();
        return true;
      case 'n':
      case 'skip':
        this.pomodoro.skip();
        return true;
      case 'h':
      case 'help':
        console.log();
        this.showHelp();
        return true;
      case 'q':
      case 'quit':
      case 'exit':
        return false;
      default:
        if (cmd) {
          console.log('\nUnknown command. Type "help" for available commands.');
        }
        return true;
    }
  }

  run(): void {
    console.log('=================================');
    console.log('   Pomodoro Timer');
    console.log('=================================');
    console.log('Work: 25min | Short Break: 5min | Long Break: 15min');
    this.showHelp();

    this.render(this.pomodoro.getState());

    this.rl.on('line', (input) => {
      const shouldContinue = this.handleCommand(input);
      if (!shouldContinue) {
        console.log('\nGoodbye! You completed', this.pomodoro.getState().completedPomodoros, 'pomodoros.');
        this.rl.close();
        process.exit(0);
      }
    });

    this.rl.on('close', () => {
      process.exit(0);
    });
  }
}

const app = new PomodoroApp();
app.run();
