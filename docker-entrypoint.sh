#!/bin/sh
set -eu

pnpm --filter @workspace/db run push
exec node artifacts/api-server/dist/index.mjs