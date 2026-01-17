import { tmpdir } from "os";
import { join } from "path";
import { getPlatformInfo, getCurrentVersion } from "./config";
import { checkForUpdates } from "./checker";

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  await Bun.write(destPath, buffer);
}

function getInstallPath(): string {
  const platform = process.platform;

  if (platform === "win32") {
    // Windows: install to LocalAppData
    const localAppData = process.env.LOCALAPPDATA || join(process.env.USERPROFILE || "", "AppData", "Local");
    return join(localAppData, "Programs", "pomotui", "pomotui.exe");
  } else {
    // Unix: try to find where pomotui is currently installed, fallback to /usr/local/bin
    const currentPath = process.argv[0];
    if (currentPath && !currentPath.includes("bun")) {
      return currentPath;
    }
    return "/usr/local/bin/pomotui";
  }
}

async function installUnix(tempPath: string, installPath: string): Promise<void> {
  // Make executable
  await Bun.spawn(["chmod", "+x", tempPath]).exited;

  // Try to move directly, fall back to sudo if needed
  const installDir = installPath.substring(0, installPath.lastIndexOf("/"));

  try {
    // Check if we can write to the install directory
    const testFile = join(installDir, ".pomotui-test");
    try {
      await Bun.write(testFile, "test");
      await Bun.spawn(["rm", testFile]).exited;
      // We have write access, move directly
      await Bun.spawn(["mv", tempPath, installPath]).exited;
    } catch {
      // Need sudo
      console.log(`Need sudo to install to ${installDir}`);
      const result = await Bun.spawn(["sudo", "mv", tempPath, installPath], {
        stdout: "inherit",
        stderr: "inherit",
        stdin: "inherit",
      }).exited;
      if (result !== 0) {
        throw new Error("Failed to install with sudo");
      }
    }
  } catch (error) {
    throw new Error(`Installation failed: ${error}`);
  }
}

async function installWindows(tempPath: string, installPath: string): Promise<void> {
  // Create install directory if needed
  const installDir = installPath.substring(0, installPath.lastIndexOf("\\"));
  await Bun.spawn(["cmd", "/c", "mkdir", installDir], { stdout: "ignore", stderr: "ignore" }).exited;

  // On Windows, we can't replace a running executable directly
  // Create a batch script that will replace the binary after we exit
  const batchScript = `
@echo off
timeout /t 1 /nobreak >nul
move /y "${tempPath}" "${installPath}"
echo Updated successfully!
del "%~f0"
`;

  const batchPath = join(tmpdir(), "pomotui-update.bat");
  await Bun.write(batchPath, batchScript);

  // Start the batch script and exit
  Bun.spawn(["cmd", "/c", "start", "/b", batchPath], {
    stdout: "ignore",
    stderr: "ignore",
  });

  console.log("Update will complete after this process exits...");
}

export async function performUpdate(): Promise<void> {
  const currentVersion = getCurrentVersion();
  console.log(`Current version: ${currentVersion}`);
  console.log("Checking for updates...");

  const result = await checkForUpdates();

  if (!result.updateAvailable) {
    console.log(`You are already on the latest version (${currentVersion})`);
    return;
  }

  if (!result.downloadUrl) {
    const platformInfo = getPlatformInfo();
    throw new Error(
      `No binary available for ${platformInfo.platform}-${platformInfo.arch}`
    );
  }

  console.log(`New version available: ${result.latestVersion}`);
  console.log("Downloading and installing...");

  // Download to temp directory
  const platformInfo = getPlatformInfo();
  const tempPath = join(tmpdir(), platformInfo.binaryName);
  await downloadFile(result.downloadUrl, tempPath);

  const installPath = getInstallPath();
  console.log(`Installing to ${installPath}...`);

  if (process.platform === "win32") {
    await installWindows(tempPath, installPath);
  } else {
    await installUnix(tempPath, installPath);
  }

  console.log(`Updated to ${result.latestVersion}!`);
}
