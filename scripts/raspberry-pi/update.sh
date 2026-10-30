#!/usr/bin/env bash
set -Eeuo pipefail
# Include administration commands such as useradd, runuser, and nginx.
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
source /etc/manar.conf
exec 9>/opt/manar/update.lock
flock -n 9 || exit 0
export GIT_TERMINAL_PROMPT=0
root=/opt/manar
run() { runuser -u manar -- env HOME=/opt/manar PM2_HOME=/opt/manar/.pm2 "$@"; }
activate() {
  run pm2 startOrRestart /opt/manar/ecosystem.config.cjs --update-env
}
if [[ ! -d $root/repo.git ]]; then
  run git clone --bare "$REPOSITORY" "$root/repo.git"
fi
run git --git-dir="$root/repo.git" fetch --prune origin '+refs/heads/*:refs/heads/*'
branch=${BRANCH:-$(run git --git-dir="$root/repo.git" symbolic-ref --short HEAD)}
commit=$(run git --git-dir="$root/repo.git" rev-parse "refs/heads/$branch^{commit}")
echo "Remote branch: $branch; target commit: $commit"
old=
if [[ -L $root/current ]]; then old=$(readlink -f "$root/current"); fi
if [[ -n $old && -f $old/.release-commit && $(cat "$old/.release-commit") == "$commit" ]]; then
  echo "Already running $commit (remote branch: $branch). Only committed and pushed changes are deployed."
  exit 0
fi
release=$(run mktemp -d "$root/releases/${commit:0:12}.XXXXXX")
candidate_pid=
activated=0
cleanup() {
  status=$?
  trap - EXIT
  if [[ -n $candidate_pid ]]; then
    kill "$candidate_pid" 2>/dev/null || true
    wait "$candidate_pid" 2>/dev/null || true
  fi
  if (( status != 0 && activated )); then
    if [[ -n $old ]]; then
      ln -sfn "$old" "$root/current.next"
      mv -Tf "$root/current.next" "$root/current"
      activate || true
      run pm2 save || true
    else
      run pm2 delete manar || true
      run pm2 save --force || true
      rm -f "$root/current"
    fi
  fi
  if (( status != 0 )); then echo "Update failed; previous release retained. Candidate: $release" >&2; fi
  exit "$status"
}
trap cleanup EXIT
run git --git-dir="$root/repo.git" archive "$commit" | run tar -x -C "$release"
cd "$release"
run pnpm install --frozen-lockfile
run pnpm build
test -f build/index.js
printf '%s\n' "$commit" > .release-commit
# Smoke-test with isolated storage, never against the live writable data.
run node --input-type=module -e 'import net from "node:net"; const s=net.createServer(); s.on("error",()=>process.exit(1)); s.listen(3001,"127.0.0.1",()=>s.close());'
entry=build/index.js
[[ ! -f server.mjs ]] || entry=server.mjs
run env HOST=127.0.0.1 PORT=3001 ORIGIN=http://localhost:5000 node "$entry" &
candidate_pid=$!
healthy() {
  local port=$1
  for ((i=0; i<60; i++)); do
    if curl --fail --silent --max-time 2 "http://127.0.0.1:$port/" >/dev/null && curl --fail --silent --max-time 2 "http://127.0.0.1:$port/display" >/dev/null; then return 0; fi
    sleep 1
  done
  return 1
}
healthy 3001
kill -0 "$candidate_pid"
kill "$candidate_pid"
wait "$candidate_pid" || true
candidate_pid=
# Keep runtime files outside all release directories.
for path in data static/uploads; do
  if [[ -e $path || -L $path ]]; then mv "$path" "${path}.release-default"; fi
  mkdir -p "$(dirname "$path")"
  ln -s "$root/shared/$path" "$path"
done
ln -sfn "$release" "$root/current.next"
activated=1
mv -Tf "$root/current.next" "$root/current"
activate
healthy 3000
# Verify the process actually serves this release, not a stale PM2 process.
if [[ -f src/routes/api/version/+server.ts ]]; then
  live=$(curl --fail --silent --max-time 5 http://127.0.0.1:3000/api/version)
  printf '%s' "$live" | node --input-type=module -e 'let s=""; for await(const c of process.stdin)s+=c; if(JSON.parse(s).version!==process.argv[1])process.exit(1)' "$commit"
fi
run pm2 save
# Record the successfully activated release.
printf '%s\n' "$commit" > "$root/shared/version"
echo "Activated $commit"
