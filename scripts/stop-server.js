import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const port = Number(process.env.PORT || 3000);

async function findWindowsPids() {
  const { stdout } = await exec('netstat', ['-ano']);
  const pids = new Set();

  for (const line of stdout.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;

    const localAddress = parts[1];
    const state = parts[3];
    const pid = parts[4];

    if (state === 'LISTENING' && localAddress.endsWith(`:${port}`)) {
      pids.add(pid);
    }
  }

  return [...pids];
}

async function stopWindows() {
  const pids = await findWindowsPids();

  if (pids.length === 0) {
    console.log(`No server is using port ${port}.`);
    return;
  }

  for (const pid of pids) {
    try {
      await exec('taskkill', ['/PID', pid, '/F']);
      console.log(`Stopped process ${pid} on port ${port}.`);
    } catch {
      console.log(`Could not stop process ${pid}. Close the terminal running npm start, or run this command as Administrator:`);
      console.log(`taskkill /PID ${pid} /F`);
    }
  }
}

async function stopUnix() {
  try {
    const { stdout } = await exec('lsof', ['-ti', `:${port}`]);
    const pids = stdout.trim().split(/\s+/).filter(Boolean);
    if (pids.length === 0) {
      console.log(`No server is using port ${port}.`);
      return;
    }
    for (const pid of pids) {
      await exec('kill', [pid]);
      console.log(`Stopped process ${pid} on port ${port}.`);
    }
  } catch {
    console.log(`No server is using port ${port}.`);
  }
}

if (process.platform === 'win32') {
  await stopWindows();
} else {
  await stopUnix();
}
