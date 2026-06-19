import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";

const startScript = isWindows
  ? path.join(repoRoot, "scripts", "start-windows.ps1")
  : path.join(repoRoot, "scripts", isMac ? "start-mac.sh" : "start-linux.sh");

const stopScript = isWindows
  ? path.join(repoRoot, "scripts", "stop-windows.ps1")
  : path.join(repoRoot, "scripts", isMac ? "stop-mac.sh" : "stop-linux.sh");

const runScript = (scriptPath) => {
  if (isWindows) {
    return spawnSync(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
      { stdio: "inherit" }
    );
  }

  return spawnSync("bash", [scriptPath], { stdio: "inherit" });
};

const startResult = runScript(startScript);
if (startResult.status !== 0) {
  process.exit(startResult.status ?? 1);
}

let stopped = false;
const stopContainer = () => {
  if (stopped) {
    return;
  }
  stopped = true;
  runScript(stopScript);
};

process.on("SIGINT", () => {
  stopContainer();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopContainer();
  process.exit(0);
});

process.on("exit", stopContainer);

setInterval(() => {
  // Keep process alive while Playwright runs tests.
}, 1000);
