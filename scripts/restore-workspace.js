import {
  cp,
  mkdtemp,
  readdir,
  rm,
  stat,
} from 'fs/promises';
import { basename, join } from 'path';
import { homedir, tmpdir } from 'os';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const execFileAsync = promisify(execFile);
const workspaceRoot = process.cwd();
const workspaceName = basename(workspaceRoot);
const backupDirectory = join(
  homedir(),
  'REACT-PROJECTS',
  '_workspace_backups',
  'Q-Music',
  'Q-Music-2.0',
);

async function listBackups() {
  const entries = await readdir(backupDirectory, { withFileTypes: true });
  const archives = await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.startsWith(`${workspaceName}-`) &&
          entry.name.endsWith('.tar.gz'),
      )
      .map(async (entry) => {
        const archivePath = join(backupDirectory, entry.name);
        const archiveStat = await stat(archivePath);
        return {
          name: entry.name,
          path: archivePath,
          modifiedAtMs: archiveStat.mtimeMs,
          modifiedAtText: archiveStat.mtime.toLocaleString(),
        };
      }),
  );

  return archives.sort((left, right) => right.modifiedAtMs - left.modifiedAtMs);
}

async function restoreBackup(archivePath) {
  const tempRoot = await mkdtemp(join(tmpdir(), 'qmusic-restore-'));

  try {
    await execFileAsync('tar', ['-xzf', archivePath, '-C', tempRoot]);

    const extractedWorkspacePath = join(tempRoot, workspaceName);
    const currentEntries = await readdir(workspaceRoot, { withFileTypes: true });

    for (const entry of currentEntries) {
      await rm(join(workspaceRoot, entry.name), {
        recursive: true,
        force: true,
      });
    }

    const restoredEntries = await readdir(extractedWorkspacePath, {
      withFileTypes: true,
    });

    for (const entry of restoredEntries) {
      await cp(join(extractedWorkspacePath, entry.name), join(workspaceRoot, entry.name), {
        recursive: true,
        force: true,
      });
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function run() {
  const backups = await listBackups();

  if (backups.length === 0) {
    console.error(`No backups found in ${backupDirectory}`);
    process.exitCode = 1;
    return;
  }

  console.log('Available backups:\n');
  backups.forEach((backup, index) => {
    console.log(`${index + 1}. ${backup.name} (${backup.modifiedAtText})`);
  });

  const rl = createInterface({ input, output });

  try {
    const answer = await rl.question('\nEnter the backup number to restore: ');
    const selectedIndex = Number.parseInt(answer.trim(), 10) - 1;

    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= backups.length) {
      console.error('Invalid selection. Restore cancelled.');
      process.exitCode = 1;
      return;
    }

    const selectedBackup = backups[selectedIndex];
    const confirmation = await rl.question(
      `Restore "${selectedBackup.name}" into ${workspaceRoot}? This replaces the current workspace contents. Type YES to continue: `,
    );

    if (confirmation.trim() !== 'YES') {
      console.log('Restore cancelled.');
      return;
    }

    await restoreBackup(selectedBackup.path);
    console.log(`Restore completed from ${selectedBackup.name}`);
  } finally {
    rl.close();
  }
}

run().catch((error) => {
  console.error('Restore failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
