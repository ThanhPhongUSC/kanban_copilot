# Scripts Agent Guide

This folder contains start/stop scripts for macOS, Linux, and Windows.

## Current Scripts

- `start-mac.sh` / `stop-mac.sh`
- `start-linux.sh` / `stop-linux.sh`
- `start-windows.ps1` / `stop-windows.ps1`

## Expected Behavior

- Start scripts build the single Docker image and run the container on port `8000`.
- Stop scripts stop/remove the container.
- Scripts should remain idempotent and safe to rerun.