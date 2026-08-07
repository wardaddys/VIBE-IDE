# VIBE — clone & run

The repo holds **only the app**. `node_modules` and build output are **not**
committed — each machine provisions its own. That is what makes a clone build
cleanly on any OS.

## Run (Linux / macOS)

```bash
git clone <your-repo-url> vibe
cd vibe
npm install                 # compiles node-pty, pulls the platform electron
ollama serve                # in another shell (or: systemctl start ollama)
npm run dev                 # dev — or: npm run build  ->  release/<version>/*
```

Running as root on Linux: the app auto-adds `--no-sandbox`. For the packaged
AppImage as root, pass it explicitly, and if FUSE is missing use
`--appimage-extract-and-run`.

## Run (Windows)

```powershell
git clone <your-repo-url> vibe
cd vibe
npm install
npm run dev                 # or: npm run build
```

## Notes

- **Never copy `node_modules` between OSes.** `electron` and `node-pty` are native
  per-platform; always `npm install` fresh. This is the single most common way to
  brick the build.
- Ollama is optional at launch but needed for local models; cloud providers work
  with an API key set in Settings.
