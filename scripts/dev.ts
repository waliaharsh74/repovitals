import { spawn, type ChildProcess } from "node:child_process";
import process from "node:process";

type ManagedProcess = {
  name: string;
  command: string;
  args: string[];
  child?: ChildProcess;
};

const processes: ManagedProcess[] = [
  {
    name: "web",
    command: "next",
    args: ["dev"],
  },
  {
    name: "worker",
    command: "tsx",
    args: ["src/workers/analysisWorker.ts"],
  },
];

let shuttingDown = false;

function writeOutput(name: string, stream: NodeJS.WriteStream, chunk: Buffer) {
  const lines = chunk.toString().split(/\r?\n/);
  for (const line of lines) {
    if (line.length > 0) {
      stream.write(`[${name}] ${line}\n`);
    }
  }
}

function shutdown(exitCode: number) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const processInfo of processes) {
    if (processInfo.child && !processInfo.child.killed) {
      stopChild(processInfo.child);
    }
  }

  process.exitCode = exitCode;
}

function stopChild(child: ChildProcess) {
  if (process.platform === "win32" && child.pid) {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  child.kill();
}

for (const processInfo of processes) {
  const child = spawn(processInfo.command, processInfo.args, {
    env: process.env,
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  processInfo.child = child;
  child.stdout?.on("data", (chunk: Buffer) => {
    writeOutput(processInfo.name, process.stdout, chunk);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    writeOutput(processInfo.name, process.stderr, chunk);
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `exit code ${code ?? 0}`;
    process.stderr.write(`[dev] ${processInfo.name} stopped with ${reason}.\n`);
    shutdown(code ?? 1);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
