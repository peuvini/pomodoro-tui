import { homedir } from 'os';
import { join } from 'path';

interface Settings {
  userName: string;
}

const DEFAULT_SETTINGS_PATH = join(homedir(), '.pomotui-settings.json');

const DEFAULT_SETTINGS: Settings = {
  userName: 'User',
};

export class SettingsManager {
  private settings: Settings;
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || DEFAULT_SETTINGS_PATH;
    this.settings = this.load();
  }

  private load(): Settings {
    try {
      const file = Bun.file(this.filePath);
      if (file.size === 0) {
        return { ...DEFAULT_SETTINGS };
      }
      const content = require(this.filePath);
      return { ...DEFAULT_SETTINGS, ...content };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private async save(): Promise<void> {
    await Bun.write(this.filePath, JSON.stringify(this.settings, null, 2));
  }

  getUserName(): string {
    return this.settings.userName;
  }

  setUserName(name: string): void {
    this.settings.userName = name;
    this.save();
  }
}
