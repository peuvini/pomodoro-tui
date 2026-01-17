import type { Subprocess } from 'bun';

export interface MusicStatus {
  isPlaying: boolean;
  stationName: string;
  stationIndex: number;
  totalStations: number;
}

export interface LofiStation {
  name: string;
  url: string;
}

// Curated list of lofi radio streams
export const LOFI_STATIONS: LofiStation[] = [
  {
    name: 'Lofi Girl',
    url: 'https://play.streamafrica.net/lofiradio',
  },
  {
    name: 'ChillHop',
    url: 'https://streams.fluxfm.de/Chillhop/mp3-128/streams.fluxfm.de/',
  },
  {
    name: 'Box Lofi',
    url: 'https://stream.zeno.fm/f3wvbbqmdg8uv',
  },
  {
    name: 'Lofi Cafe',
    url: 'https://stream.zeno.fm/0r0xa792kwzuv',
  },
  {
    name: 'Study Beats',
    url: 'https://stream.zeno.fm/yn65fsaurfhvv',
  },
];

export class RadioPlayer {
  private process: Subprocess | null = null;
  private currentStationIndex: number = 0;
  private isPlaying: boolean = false;
  private playerCommand: string | null = null;

  constructor() {
    this.detectPlayer();
  }

  private detectPlayer(): void {
    // Try to find an available audio player
    const players = ['mpv', 'ffplay', 'cvlc', 'mplayer'];

    for (const player of players) {
      try {
        const result = Bun.spawnSync(['which', player]);
        if (result.exitCode === 0) {
          this.playerCommand = player;
          break;
        }
      } catch {
        continue;
      }
    }
  }

  getAvailablePlayer(): string | null {
    return this.playerCommand;
  }

  async play(): Promise<boolean> {
    if (!this.playerCommand) {
      return false;
    }

    if (this.isPlaying) {
      return true;
    }

    const station = LOFI_STATIONS[this.currentStationIndex];

    try {
      const args = this.getPlayerArgs(station.url);
      this.process = Bun.spawn([this.playerCommand, ...args], {
        stdout: 'ignore',
        stderr: 'ignore',
      });
      this.isPlaying = true;
      return true;
    } catch {
      return false;
    }
  }

  private getPlayerArgs(url: string): string[] {
    switch (this.playerCommand) {
      case 'mpv':
        return ['--no-video', '--really-quiet', url];
      case 'ffplay':
        return ['-nodisp', '-autoexit', '-loglevel', 'quiet', url];
      case 'cvlc':
        return ['--intf', 'dummy', '--quiet', url];
      case 'mplayer':
        return ['-really-quiet', '-noconsolecontrols', url];
      default:
        return [url];
    }
  }

  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.isPlaying = false;
  }

  pause(): void {
    this.stop();
  }

  async resume(): Promise<boolean> {
    return this.play();
  }

  async toggle(): Promise<boolean> {
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      return this.play();
    }
  }

  nextStation(): void {
    const wasPlaying = this.isPlaying;
    this.stop();
    this.currentStationIndex = (this.currentStationIndex + 1) % LOFI_STATIONS.length;
    if (wasPlaying) {
      this.play();
    }
  }

  previousStation(): void {
    const wasPlaying = this.isPlaying;
    this.stop();
    this.currentStationIndex = (this.currentStationIndex - 1 + LOFI_STATIONS.length) % LOFI_STATIONS.length;
    if (wasPlaying) {
      this.play();
    }
  }

  setStation(index: number): void {
    if (index >= 0 && index < LOFI_STATIONS.length) {
      const wasPlaying = this.isPlaying;
      this.stop();
      this.currentStationIndex = index;
      if (wasPlaying) {
        this.play();
      }
    }
  }

  getStatus(): MusicStatus {
    const station = LOFI_STATIONS[this.currentStationIndex];
    return {
      isPlaying: this.isPlaying,
      stationName: station.name,
      stationIndex: this.currentStationIndex,
      totalStations: LOFI_STATIONS.length,
    };
  }

  getCurrentStation(): LofiStation {
    return LOFI_STATIONS[this.currentStationIndex];
  }

  getStations(): LofiStation[] {
    return [...LOFI_STATIONS];
  }
}

export interface SpotifyTrack {
  name: string;
  artist: string;
  album: string;
  isPlaying: boolean;
}

export class SpotifyDisplay {
  private accessToken: string | null = null;
  private currentTrack: SpotifyTrack | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(accessToken?: string) {
    if (accessToken) {
      this.accessToken = accessToken;
    }
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  async getCurrentTrack(): Promise<SpotifyTrack | null> {
    if (!this.accessToken) {
      return null;
    }

    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (response.status === 204 || response.status === 401) {
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (!data || !data.item) {
        return null;
      }

      this.currentTrack = {
        name: data.item.name,
        artist: data.item.artists.map((a: { name: string }) => a.name).join(', '),
        album: data.item.album.name,
        isPlaying: data.is_playing,
      };

      return this.currentTrack;
    } catch {
      return null;
    }
  }

  startPolling(callback: (track: SpotifyTrack | null) => void, intervalMs: number = 5000): void {
    this.stopPolling();

    // Initial fetch
    this.getCurrentTrack().then(callback);

    // Poll periodically
    this.pollInterval = setInterval(async () => {
      const track = await this.getCurrentTrack();
      callback(track);
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  getCachedTrack(): SpotifyTrack | null {
    return this.currentTrack;
  }

  isConfigured(): boolean {
    return this.accessToken !== null;
  }
}

export type MusicMode = 'radio' | 'spotify' | 'off';

export class MusicManager {
  private mode: MusicMode;
  private radio: RadioPlayer;
  private spotify: SpotifyDisplay;
  private onStatusChange: ((status: string) => void) | null = null;

  constructor(mode: MusicMode = 'radio', spotifyToken?: string) {
    this.mode = mode;
    this.radio = new RadioPlayer();
    this.spotify = new SpotifyDisplay(spotifyToken);

    if (mode === 'spotify' && spotifyToken) {
      this.spotify.startPolling((track) => {
        if (this.onStatusChange && track) {
          this.onStatusChange(`${track.name} - ${track.artist}`);
        }
      });
    }
  }

  setOnStatusChange(callback: (status: string) => void): void {
    this.onStatusChange = callback;
  }

  async play(): Promise<boolean> {
    if (this.mode === 'off') return false;
    if (this.mode === 'radio') {
      return this.radio.play();
    }
    return false; // Spotify mode doesn't control playback
  }

  stop(): void {
    if (this.mode === 'radio') {
      this.radio.stop();
    }
  }

  pause(): void {
    this.stop();
  }

  async resume(): Promise<boolean> {
    return this.play();
  }

  async toggle(): Promise<boolean> {
    if (this.mode === 'radio') {
      return this.radio.toggle();
    }
    return false;
  }

  nextStation(): void {
    if (this.mode === 'radio') {
      this.radio.nextStation();
    }
  }

  getStatusText(): string {
    if (this.mode === 'off') {
      return 'Music: Off';
    }

    if (this.mode === 'spotify') {
      const track = this.spotify.getCachedTrack();
      if (track && track.isPlaying) {
        const name = track.name.length > 20 ? track.name.substring(0, 17) + '...' : track.name;
        const artist = track.artist.length > 15 ? track.artist.substring(0, 12) + '...' : track.artist;
        return `♪ ${name} - ${artist}`;
      }
      return '♪ Spotify: Not playing';
    }

    // Radio mode
    const status = this.radio.getStatus();
    const icon = status.isPlaying ? '♪' : '♪';
    const state = status.isPlaying ? '' : ' (paused)';
    return `${icon} ${status.stationName}${state}`;
  }

  getMode(): MusicMode {
    return this.mode;
  }

  isPlaying(): boolean {
    if (this.mode === 'radio') {
      return this.radio.getStatus().isPlaying;
    }
    if (this.mode === 'spotify') {
      const track = this.spotify.getCachedTrack();
      return track?.isPlaying ?? false;
    }
    return false;
  }

  hasPlayer(): boolean {
    if (this.mode === 'radio') {
      return this.radio.getAvailablePlayer() !== null;
    }
    return true;
  }

  cleanup(): void {
    this.radio.stop();
    this.spotify.stopPolling();
  }
}
