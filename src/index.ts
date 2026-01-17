import blessed from 'blessed';
import { parseArgs } from 'util';
import { Pomodoro } from './pomodoro';
import { HistoryManager } from './history';
import { MusicManager, type MusicMode } from './music';
import type { PomodoroConfig, PomodoroState, SessionType } from './types';
import { DEFAULT_CONFIG } from './types';

interface AppConfig {
  pomodoro: PomodoroConfig;
  historyFile?: string;
  musicMode: MusicMode;
  spotifyToken?: string;
}

function showHelp(): void {
  console.log(`
Pomodoro Timer - A TUI pomodoro timer

Usage: bun run start [options]

Options:
  -w, --work <minutes>     Work session duration (default: ${DEFAULT_CONFIG.workDuration})
  -s, --short <minutes>    Short break duration (default: ${DEFAULT_CONFIG.shortBreakDuration})
  -l, --long <minutes>     Long break duration (default: ${DEFAULT_CONFIG.longBreakDuration})
  -c, --cycles <number>    Pomodoros before long break (default: ${DEFAULT_CONFIG.pomodorosBeforeLongBreak})
  -d, --data <path>        Path to history JSON file (default: ~/.pomodoro/history.json)
  -m, --music <mode>       Music mode: radio, spotify, off (default: radio)
  --spotify-token <token>  Spotify access token for now-playing display
  -h, --help               Show this help message

Examples:
  bun run start                     # Use default durations (25/5/15)
  bun run start -w 50 -s 10 -l 30   # 50min work, 10min short, 30min long
  bun run start --work 45           # 45min work sessions
  bun run start -d ~/obsidian/pomodoro.json  # Custom history file
  bun run start -m off              # Disable music
  bun run start -m spotify --spotify-token <token>  # Spotify mode

Controls:
  [s] Start    [p] Pause    [r] Reset    [n] Next    [q] Quit
  [m] Toggle music    [>] Next station

Music:
  Lofi radio plays automatically during work sessions and pauses during breaks.
  Requires mpv, ffplay, or vlc installed for audio playback.

History:
  Completed sessions are saved to the history file in JSON format.
  Each entry includes: timestamp, session type, duration, and daily count.
`);
}

function parseConfig(): AppConfig | null {
  try {
    const { values } = parseArgs({
      args: Bun.argv.slice(2),
      options: {
        work: { type: 'string', short: 'w' },
        short: { type: 'string', short: 's' },
        long: { type: 'string', short: 'l' },
        cycles: { type: 'string', short: 'c' },
        data: { type: 'string', short: 'd' },
        music: { type: 'string', short: 'm' },
        'spotify-token': { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
      strict: true,
    });

    if (values.help) {
      showHelp();
      return null;
    }

    const pomodoro: PomodoroConfig = { ...DEFAULT_CONFIG };

    if (values.work) {
      const work = parseInt(values.work, 10);
      if (isNaN(work) || work < 1) {
        console.error('Error: Work duration must be a positive number');
        process.exit(1);
      }
      pomodoro.workDuration = work;
    }

    if (values.short) {
      const short = parseInt(values.short, 10);
      if (isNaN(short) || short < 1) {
        console.error('Error: Short break duration must be a positive number');
        process.exit(1);
      }
      pomodoro.shortBreakDuration = short;
    }

    if (values.long) {
      const long = parseInt(values.long, 10);
      if (isNaN(long) || long < 1) {
        console.error('Error: Long break duration must be a positive number');
        process.exit(1);
      }
      pomodoro.longBreakDuration = long;
    }

    if (values.cycles) {
      const cycles = parseInt(values.cycles, 10);
      if (isNaN(cycles) || cycles < 1) {
        console.error('Error: Cycles must be a positive number');
        process.exit(1);
      }
      pomodoro.pomodorosBeforeLongBreak = cycles;
    }

    // Parse music mode
    let musicMode: MusicMode = 'radio';
    if (values.music) {
      if (!['radio', 'spotify', 'off'].includes(values.music)) {
        console.error('Error: Music mode must be one of: radio, spotify, off');
        process.exit(1);
      }
      musicMode = values.music as MusicMode;
    }

    return {
      pomodoro,
      historyFile: values.data,
      musicMode,
      spotifyToken: values['spotify-token'],
    };
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    console.error('Use --help for usage information');
    process.exit(1);
  }
}

class PomodoroTUI {
  private pomodoro: Pomodoro;
  private history: HistoryManager;
  private music: MusicManager;
  private screen: blessed.Widgets.Screen;
  private mainBox: blessed.Widgets.BoxElement;
  private timerBox: blessed.Widgets.BoxElement;
  private sessionBox: blessed.Widgets.BoxElement;
  private progressBar: blessed.Widgets.ProgressBarElement;
  private statsBox: blessed.Widgets.BoxElement;
  private statusBox: blessed.Widgets.BoxElement;
  private configBox: blessed.Widgets.BoxElement;
  private musicBox: blessed.Widgets.BoxElement;

  constructor(config: AppConfig) {
    this.pomodoro = new Pomodoro(config.pomodoro);
    this.history = new HistoryManager(config.historyFile);
    this.music = new MusicManager(config.musicMode, config.spotifyToken);

    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Pomodoro Timer',
    });

    // Create main container
    this.mainBox = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: 50,
      height: 22,
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
      parent: this.mainBox,
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
      parent: this.mainBox,
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
    const initialTime = this.pomodoro.formatTime(this.pomodoro.getState().timeRemaining);
    this.timerBox = blessed.box({
      parent: this.mainBox,
      top: 4,
      left: 'center',
      width: 'shrink',
      height: 3,
      content: this.getLargeTime(initialTime),
      style: {
        fg: 'white',
        bold: true,
      },
    });

    // Progress bar
    this.progressBar = blessed.progressbar({
      parent: this.mainBox,
      top: 8,
      left: 2,
      width: 44,
      height: 1,
      orientation: 'horizontal',
      filled: 100,
      style: {
        bar: {
          bg: 'red',
        },
      },
      ch: '█',
    });

    // Status display (Running/Paused)
    this.statusBox = blessed.box({
      parent: this.mainBox,
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
    const todayStats = this.history.getTodayStats();
    this.statsBox = blessed.box({
      parent: this.mainBox,
      top: 12,
      left: 'center',
      width: 'shrink',
      height: 1,
      content: `Today: ${todayStats.pomodoros} pomodoros (${todayStats.totalMinutes}m)`,
      style: {
        fg: 'gray',
      },
    });

    // Config display
    const cfg = this.pomodoro.getConfig();
    this.configBox = blessed.box({
      parent: this.mainBox,
      top: 14,
      left: 'center',
      width: 'shrink',
      height: 1,
      content: `Work: ${cfg.workDuration}m | Short: ${cfg.shortBreakDuration}m | Long: ${cfg.longBreakDuration}m`,
      style: {
        fg: 'gray',
      },
    });

    // Music status
    this.musicBox = blessed.box({
      parent: this.mainBox,
      top: 16,
      left: 'center',
      width: 'shrink',
      height: 1,
      content: this.music.getStatusText(),
      style: {
        fg: 'magenta',
      },
    });

    // Controls help
    blessed.box({
      parent: this.mainBox,
      top: 18,
      left: 'center',
      width: 'shrink',
      height: 1,
      content: '[s]tart [p]ause [r]eset [n]ext [q]uit [m]usic [>]station',
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
      this.music.cleanup();
      const state = this.pomodoro.getState();
      this.screen.destroy();
      console.log(`\nGoodbye! You completed ${state.completedPomodoros} pomodoros.`);
      process.exit(0);
    });

    // Start
    this.screen.key(['s'], () => {
      this.pomodoro.start();
      // Auto-play music when work session starts
      const state = this.pomodoro.getState();
      if (state.currentSession === 'work') {
        this.music.play();
        this.updateMusicStatus();
      }
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

    // Toggle music
    this.screen.key(['m'], async () => {
      await this.music.toggle();
      this.updateMusicStatus();
    });

    // Next station
    this.screen.key(['>','.'], () => {
      this.music.nextStation();
      this.updateMusicStatus();
    });
  }

  private updateMusicStatus(): void {
    this.musicBox.setContent(this.music.getStatusText());
    this.screen.render();
  }

  private render(state: PomodoroState): void {
    const time = this.pomodoro.formatTime(state.timeRemaining);
    const session = state.currentSession;
    const color = this.getSessionColor(session);
    const config = this.pomodoro.getConfig();

    // Update timer
    this.timerBox.setContent(this.getLargeTime(time));

    // Update session label and color
    this.sessionBox.setContent(this.getSessionLabel(session));
    this.sessionBox.style.fg = color;

    // Update progress bar
    const sessionDuration = this.getSessionDuration(session, config);
    const progress = (state.timeRemaining / (sessionDuration * 60)) * 100;
    this.progressBar.setProgress(progress);
    (this.progressBar.style.bar as any).bg = color;

    // Update status
    this.statusBox.setContent(state.isRunning ? '[ RUNNING ]' : '[ PAUSED ]');
    this.statusBox.style.fg = state.isRunning ? 'green' : 'yellow';

    // Update stats
    const todayStats = this.history.getTodayStats();
    this.statsBox.setContent(`Today: ${todayStats.pomodoros} pomodoros (${todayStats.totalMinutes}m)`);

    // Update music status
    this.musicBox.setContent(this.music.getStatusText());

    // Update screen title
    this.screen.title = `${time} - ${this.getSessionLabel(session)}`;

    this.screen.render();
  }

  private getSessionDuration(session: SessionType, config: PomodoroConfig): number {
    switch (session) {
      case 'work':
        return config.workDuration;
      case 'shortBreak':
        return config.shortBreakDuration;
      case 'longBreak':
        return config.longBreakDuration;
    }
  }

  private async onSessionComplete(session: SessionType): Promise<void> {
    const config = this.pomodoro.getConfig();
    const duration = this.getSessionDuration(session, config);

    // Save to history
    await this.history.addEntry(session, duration);

    // Handle music based on next session
    const nextState = this.pomodoro.getState();
    if (nextState.currentSession === 'work') {
      // Starting work session - play music
      await this.music.play();
    } else {
      // Starting break - pause music
      this.music.pause();
    }
    this.updateMusicStatus();

    this.notifyUser();
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

// Main
const config = parseConfig();
if (config) {
  const app = new PomodoroTUI(config);
  app.run();
}
