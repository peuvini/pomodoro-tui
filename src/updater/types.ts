export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

export interface GitHubRelease {
  tag_name: string;
  assets: ReleaseAsset[];
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl?: string;
}

export interface PlatformInfo {
  platform: "darwin" | "linux" | "windows";
  arch: "x64" | "arm64";
  binaryName: string;
}
