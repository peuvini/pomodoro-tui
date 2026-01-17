import type { GitHubRelease, UpdateCheckResult } from "./types";
import {
  GITHUB_API_URL,
  CHECK_TIMEOUT_MS,
  getPlatformInfo,
  getCurrentVersion,
} from "./config";

function compareVersions(current: string, latest: string): number {
  // Strip leading 'v' if present
  const cleanCurrent = current.replace(/^v/, "");
  const cleanLatest = latest.replace(/^v/, "");

  const currentParts = cleanCurrent.split(".").map((n) => parseInt(n, 10));
  const latestParts = cleanLatest.split(".").map((n) => parseInt(n, 10));

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const curr = currentParts[i] || 0;
    const lat = latestParts[i] || 0;

    if (lat > curr) return 1; // latest is newer
    if (curr > lat) return -1; // current is newer
  }

  return 0; // equal
}

export async function fetchLatestRelease(): Promise<GitHubRelease> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(GITHUB_API_URL, {
      signal: controller.signal,
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "pomotui-updater",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    return (await response.json()) as GitHubRelease;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = getCurrentVersion();
  const platformInfo = getPlatformInfo();

  const release = await fetchLatestRelease();
  const latestVersion = release.tag_name;

  const updateAvailable = compareVersions(currentVersion, latestVersion) > 0;

  // Find the correct binary asset for this platform
  const asset = release.assets.find(
    (a) => a.name === platformInfo.binaryName
  );

  return {
    updateAvailable,
    currentVersion,
    latestVersion,
    downloadUrl: asset?.browser_download_url,
  };
}
