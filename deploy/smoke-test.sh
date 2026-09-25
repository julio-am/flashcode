#!/usr/bin/env bash
# Grades one real submission through a running site, end to end: web ->
# queue -> worker -> sandbox runner -> result. Exits non-zero unless the
# reference solution to vectors/concat comes back "passed".
#
#   deploy/smoke-test.sh https://litecode.io
set -euo pipefail

BASE="${1:?usage: smoke-test.sh https://your.domain}"
jar="$(mktemp)"; trap 'rm -f "$jar"' EXIT
c() { curl -fsS ${SMOKE_INSECURE:+-k} -b "$jar" -c "$jar" "$@"; }
field() { python3 -c "import json,sys; print(json.load(sys.stdin).get('$1') or '')"; }

code="$(cat "$(dirname "$0")/../problems/vectors/concat/solution.cpp")"
body="$(python3 -c 'import json,sys,uuid; print(json.dumps({"problemId": "vectors/concat", "presentationId": str(uuid.uuid4()), "code": sys.argv[1]}))' "$code")"
id="$(c -H 'content-type: application/json' -d "$body" "$BASE/api/attempts" | field attemptId)"
echo "submitted attempt $id"

for _ in $(seq 60); do
  status="$(c "$BASE/api/attempts/$id" | field status)"
  case "$status" in
    queued|running) sleep 1 ;;
    passed) echo "graded: passed"; exit 0 ;;
    *) echo "graded: $status" >&2; c "$BASE/api/attempts/$id" >&2; exit 1 ;;
  esac
done
echo "still $status after 60 s" >&2
exit 1
