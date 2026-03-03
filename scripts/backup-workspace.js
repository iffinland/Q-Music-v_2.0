import { mkdir, readdir, rm, stat } from 'fs/promises';
import { basename, dirname, join } from 'path';
import { homedir } from 'os';
import { promisify } from 'util';
import { execFile } from 'child_process';

const execFileAsync = promisify(execFile);
const workspaceRoot = process.cwd();
const workspaceName = basename(workspaceRoot);
const workspaceParent = dirname(workspaceRoot);
const backupDirectory = join(
  homedir(),
  'REACT-PROJECTS',
  '_workspace_backups',
  'Q-Music',
  'Q-Music-2.0',
);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const archiveName = `${workspaceName}-${timestamp}.tar.gz`;
const archivePath = join(backupDirectory, archiveName);

async function pruneOldBackups() {
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
        const filePath = join(backupDirectory, entry.name);
        const fileStat = await stat(filePath);
        return { filePath, modifiedAt: fileStat.mtimeMs };
      }),
  );

  archives.sort((left, right) => right.modifiedAt - left.modifiedAt);

  for (const archive of archives.slice(3)) {
    await rm(archive.filePath, { force: true });
    console.log(`Removed old backup: ${archive.filePath}`);
  }
}

async function run() {
  await mkdir(backupDirectory, { recursive: true });

  await execFileAsync('tar', [
    '-czf',
    archivePath,
    '-C',
    workspaceParent,
    workspaceName,
  ]);

  console.log(`Backup created: ${archivePath}`);
  await pruneOldBackups();
}

run().catch((error) => {
  console.error('Backup failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
