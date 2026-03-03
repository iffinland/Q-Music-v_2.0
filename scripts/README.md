# Q-Music workspace backup ja restore

## Failid

- `backup-workspace.js` teeb kogu tööruumist ajatempliga `.tar.gz` backupi.
- `restore-workspace.js` näitab olemasolevaid backupe, laseb valida ning taastab valitud backupi täielikult tööruumi.

## Kuhu backupid salvestatakse

Backupid lähevad kataloogi:

`~/REACT-PROJECTS/_workspace_backups/Q-Music/Q-Music-2.0`

Seal hoitakse alati alles ainult 3 kõige värskemat backupi.

## Kasutamine npm käsuga

Tee uus backup:

```bash
npm run backup-qmusic
```

Taasta backup:

```bash
npm run restore-qmusic
```

Restore käsk:

- kuvab backupite nimekirja;
- küsib, millist backupi taastada;
- küsib kinnitust `YES`, sest olemasolev tööruumi sisu asendatakse täielikult.
