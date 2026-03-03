# Q-Music 2.0

React + TypeScript + Vite rakendus Q-Music projekti jaoks.

## Nõuded

- Node.js 22 või uuem
- npm

## Käivitamine lokaalselt

Paigalda sõltuvused:

```bash
npm install
```

Käivita arenduskeskkond:

```bash
npm run dev
```

Muud kasulikud käsud:

```bash
npm run lint
npm run build
npm run preview
```

## Backup ja restore

Tööruumi backup/restore skriptid asuvad kataloogis [scripts/README.md](/home/iffiolen/REACT-PROJECTS/q-music20/scripts/README.md).

Kiirkäsud:

```bash
npm run backup-qmusic
npm run restore-qmusic
```

Backupid salvestatakse siia:

```text
~/REACT-PROJECTS/_workspace_backups/Q-Music/Q-Music-2.0
```

Selles kataloogis hoitakse alles ainult 3 viimast backupi.

## GitHub Actions

Repo sisaldab CI workflow’d failis [.github/workflows/ci.yml](/home/iffiolen/REACT-PROJECTS/q-music20/.github/workflows/ci.yml).

Workflow käivitub:

- igal `push`
- igal `pull_request`

Kontrollid:

- `npm ci`
- `npm run lint`
- `npm run build`
