---
name: Docker pnpm builds
description: Package-manager compatibility for building this pnpm workspace inside Docker images.
---

Pin the Docker image's Corepack-managed pnpm version to the workspace-compatible release when building the monorepo. Unpinned newer pnpm releases may reject the esbuild lifecycle script even though the workspace allowlist is present.

**Why:** A Docker build using the container's newest pnpm failed during dependency installation with an ignored esbuild build script; the pinned workspace-compatible version completed the build.

**How to apply:** When changing the Docker base image or package-manager version, keep the pin aligned with the workspace lockfile and re-run `docker compose build`.