// Process, Docker and timing helpers for the verify-support-api scripts.
import { spawnSync } from "node:child_process";
import net from "node:net";

export function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  const stdout = r.stdout ?? "";
  const stderr = r.stderr ?? "";
  return { code: r.status, stdout, stderr, out: stdout + stderr };
}

export function docker(args) {
  return sh("docker", args);
}

export function containerRunning(name) {
  return docker(["inspect", "-f", "{{.State.Running}}", name]).stdout.trim() === "true";
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitFor(check, { timeoutMs, what, intervalMs = 500 }) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out after ${timeoutMs} ms waiting for ${what}`);
}

export function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function windowsImageName(pid) {
  const r = sh("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"]);
  const match = r.stdout.match(/^"([^"]+)"/m);
  return match ? match[1].toLowerCase() : "";
}

// True when the PID is alive and is a Node process, so a reused PID is not killed.
export function isOurNode(pid) {
  if (!pid || !pidAlive(pid)) return false;
  if (process.platform !== "win32") return true;
  return windowsImageName(pid) === "node.exe";
}

export function killTree(pid) {
  if (process.platform === "win32") {
    sh("taskkill", ["/PID", String(pid), "/T", "/F"]);
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    // The process group is already gone.
  }
}

function listenerPidWindows(port) {
  const r = sh("netstat", ["-ano", "-p", "tcp"]);
  const line = r.stdout
    .split(/\r?\n/)
    .find((l) => l.includes(`127.0.0.1:${port} `) && l.includes("LISTENING"));
  return line ? Number(line.trim().split(/\s+/).at(-1)) : undefined;
}

// The PID that listens on the TCP port, or undefined.
export function listenerPid(port) {
  if (process.platform === "win32") return listenerPidWindows(port);
  const r = sh("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
  const first = r.stdout.trim().split(/\s+/)[0];
  return first ? Number(first) : undefined;
}

export async function getHealth(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
    return { status: res.status, body: await res.text() };
  } catch (err) {
    return { status: 0, body: String(err) };
  }
}
