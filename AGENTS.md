# Agent Task Memo

> [!IMPORTANT]
> **NEVER COMMIT OR PUSH THIS FILE.** This file is listed in `.gitignore` and should only exist locally.

## Workflow Rules
- **Releasing**: Before pushing a new version tag (e.g., `v1.3.1`), **ALWAYS** update `CHANGELOG.md` with the latest changes in both English and Japanese (English first). The `release.yml` is configured to automatically extract the top entry from this file.

## Current Status
- **Objective**: Add and fix the `release.yml` GitHub Actions workflow and establish a changelog process.
- **Local State**: `v1.3.1` re-pushed with bug fix for checkpoint path extraction (Windows/Linux support).
- **Problem**: (Resolved) Checkpoint names containing paths (e.g. `epsilon\model`) were not being parsed correctly. Fixed by supporting both `/` and `\` delimiters.
- **Last Action**: Pushed `main` and tag `v1.3.1`.

## Next Steps
- Verify the successful execution of the GitHub Actions workflow on the repository page.
- Check the created Release on GitHub to ensure the changelog was correctly extracted (with today's date) and the `.eagleplugin` file is attached.

