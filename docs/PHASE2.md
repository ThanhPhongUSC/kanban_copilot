# Phase 2 Run Notes

## What Phase 2 Delivers

- Single Docker container runtime
- FastAPI backend scaffold in `backend/`
- Static hello-world page at `/`
- API health endpoint at `/api/health`
- Start/stop scripts for macOS, Linux, and Windows

## Run

From project root:

macOS:

```bash
./scripts/start-mac.sh
```

Linux:

```bash
./scripts/start-linux.sh
```

Windows (PowerShell):

```powershell
./scripts/start-windows.ps1
```

Then open:

- `http://localhost:8000/`
- `http://localhost:8000/api/health`

## Stop

macOS:

```bash
./scripts/stop-mac.sh
```

Linux:

```bash
./scripts/stop-linux.sh
```

Windows (PowerShell):

```powershell
./scripts/stop-windows.ps1
```

## Local Backend Tests (without Docker)

From `backend/`:

```bash
uv sync --dev
uv run pytest
```
