import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const frontendRoot = process.cwd();
const projectRoot = path.resolve(frontendRoot, "..");

const run = (command, args, cwd) => {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
};

let testExitCode = 0;

try {
  const upExitCode = run("docker", ["compose", "up", "--build", "-d"], projectRoot);
  if (upExitCode !== 0) {
    process.exit(upExitCode);
  }

  testExitCode = run("npx", ["playwright", "test"], frontendRoot);
} finally {
  run("docker", ["compose", "down"], projectRoot);
}

process.exit(testExitCode);
