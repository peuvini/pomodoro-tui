import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
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

Usage: pomotui [options]

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
  pomotui                              # Use default durations (25/5/15)
  pomotui -w 50 -s 10 -l 30            # 50min work, 10min short, 30min long
  pomotui --work 45                    # 45min work sessions
  pomotui -d ~/obsidian/pomodoro.json  # Custom history file
  pomotui -m off                       # Disable music
  pomotui -m spotify --spotify-token <token>  # Spotify mode

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

function getSessionColor(session: SessionType): string {
  switch (session) {
    case 'work':
      return 'red';
    case 'shortBreak':
      return 'green';
    case 'longBreak':
      return 'blue';
  }
}

function getSessionLabel(session: SessionType): string {
  switch (session) {
    case 'work':
      return 'WORK';
    case 'shortBreak':
      return 'SHORT BREAK';
    case 'longBreak':
      return 'LONG BREAK';
  }
}

function getSessionDuration(session: SessionType, config: PomodoroConfig): number {
  switch (session) {
    case 'work':
      return config.workDuration;
    case 'shortBreak':
      return config.shortBreakDuration;
    case 'longBreak':
      return config.longBreakDuration;
  }
}

function notifyUser(): void {
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

interface PomodoroTUIProps {
  config: AppConfig;
}

function PomodoroTUI({ config }: PomodoroTUIProps) {
  const { exit } = useApp();
  const [pomodoro] = useState(() => new Pomodoro(config.pomodoro));
  const [history] = useState(() => new HistoryManager(config.historyFile));
  const [music] = useState(() => new MusicManager(config.musicMode, config.spotifyToken));
  const [state, setState] = useState<PomodoroState>(pomodoro.getState());
  const [todayStats, setTodayStats] = useState(history.getTodayStats());
  const [musicStatus, setMusicStatus] = useState(music.getStatusText());

  useEffect(() => {
    pomodoro.setOnTick((newState) => {
      setState(newState);
    });

    pomodoro.setOnSessionComplete(async (session) => {
      const sessionDuration = getSessionDuration(session, config.pomodoro);
      await history.addEntry(session, sessionDuration);
      setTodayStats(history.getTodayStats());

      const nextState = pomodoro.getState();
      if (nextState.currentSession === 'work') {
        await music.play();
      } else {
        music.pause();
      }
      setMusicStatus(music.getStatusText());
      notifyUser();
    });

    return () => {
      music.cleanup();
    };
  }, []);

  useInput((input, key) => {
    if (input === 'q' || key.escape || (key.ctrl && input === 'c')) {
      music.cleanup();
      console.log(`\nGoodbye! You completed ${state.completedPomodoros} pomodoros.`);
      exit();
    } else if (input === 's') {
      pomodoro.start();
      if (state.currentSession === 'work') {
        music.play();
        setMusicStatus(music.getStatusText());
      }
    } else if (input === 'p') {
      pomodoro.pause();
    } else if (input === 'r') {
      pomodoro.reset();
    } else if (input === 'n') {
      pomodoro.skip();
    } else if (input === 'm') {
      music.toggle();
      setMusicStatus(music.getStatusText());
    } else if (input === '>' || input === '.') {
      music.nextStation();
      setMusicStatus(music.getStatusText());
    }
  });

  const time = pomodoro.formatTime(state.timeRemaining);
  const session = state.currentSession;
  const color = getSessionColor(session);
  const label = getSessionLabel(session);
  const sessionDuration = getSessionDuration(session, config.pomodoro);
  const progress = (state.timeRemaining / (sessionDuration * 60)) * 100;
  const progressBarLength = 40;
  const filledLength = Math.round((progressBarLength * progress) / 100);
  const progressBar = '█'.repeat(filledLength) + '░'.repeat(progressBarLength - filledLength);

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" borderStyle="round" borderColor="cyan" padding={1}>
      <Text bold color="white">POMODORO TIMER</Text>
      <Box marginY={1}>
        <Text bold color={color}>{label}</Text>
      </Box>
      <Box marginY={1}>
        <Text bold color="white">{`     ${time}     `}</Text>
      </Box>
      <Box marginY={1}>
        <Text color={color}>{progressBar}</Text>
      </Box>
      <Box marginY={1}>
        <Text color={state.isRunning ? 'green' : 'yellow'}>
          {state.isRunning ? '[ RUNNING ]' : '[ PAUSED ]'}
        </Text>
      </Box>
      <Box marginY={1}>
        <Text color="gray">{`Today: ${todayStats.pomodoros} pomodoros (${todayStats.totalMinutes}m)`}</Text>
      </Box>
      <Box marginY={1}>
        <Text color="gray">
          {`Work: ${config.pomodoro.workDuration}m | Short: ${config.pomodoro.shortBreakDuration}m | Long: ${config.pomodoro.longBreakDuration}m`}
        </Text>
      </Box>
      <Box marginY={1}>
        <Text color="magenta">{musicStatus}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color="cyan">[s]tart [p]ause [r]eset [n]ext [q]uit [m]usic [{'>'}/.]station</Text>
      </Box>
    </Box>
  );
}

const config = parseConfig();
if (config) {
  render(<PomodoroTUI config={config} />);
}
