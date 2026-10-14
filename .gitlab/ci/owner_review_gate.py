#!/usr/bin/env python3
"""owner_review_gate — CE substitute for "Require approval from code owners".

Runs in merge-request pipelines. Reads CODEOWNERS from the MR's TARGET branch (so an MR
cannot weaken the rules it is judged by), lists every path the MR changes, and exits 1
unless an owner (OWNER_GATE_USER_IDS, default "2" = dirwin) approved the MR AFTER its
latest push whenever any changed path matches a CODEOWNERS rule. If the target branch has
no CODEOWNERS yet, the gate passes with a notice (bootstrap).

Env: OWNER_GATE_TOKEN (read_api, masked CI variable), CI_API_V4_URL, CI_PROJECT_ID,
CI_MERGE_REQUEST_IID, CI_MERGE_REQUEST_TARGET_BRANCH_NAME. Self-test: --selftest.
Copied from dirwin/wp-site-uplinksync tools/ci/owner_review_gate.py (2026-10-14); lives under .gitlab/ci/
here so the production rsync (which excludes .git*) never ships it.
"""
import json, os, re, sys, urllib.parse, urllib.request, urllib.error

CODEOWNERS_PATHS = ("CODEOWNERS", ".gitlab/CODEOWNERS", "docs/CODEOWNERS")

# Per-repo self-test fixtures (paths that MUST / MUST NOT match .gitlab/CODEOWNERS).
SELFTEST_OWNED = [".gitlab-ci.yml", ".gitlab/CODEOWNERS", ".gitlab/ci/owner_review_gate.py", ".gitlab/ci/release.yml", ".github/workflows/deploy-wordpress.yml", "scripts/bootstrap.sh", "gallery-sync.php", "includes/class-x.php", "includes/api/y.php", "src/Core/Z.php", "worker/src/index.ts", "workers/wrangler.toml", "supabase/migrations/001.sql", "infrastructure/scripts/a.sh", "config/clover_endpoints.yml", "tools/generate_openapi_docs.py", "composer.json", "composer.lock", "package.json", "package-lock.json", "build.mjs", "AGENTS.md", "CLAUDE.md", ".claude/settings.json", "tests/FooTest.php", ".env.example", ".gitignore", "certs/x.pem", "notes/my-secret-file.txt"]
SELFTEST_LOW = ["README.md", "CHANGELOG.md", "readme.txt", "docs/x.md", "assets/css/admin.css", "assets/js/admin.js", "assets/img/logo.png", "openapi-docs.yaml", "LICENSE"]


def glob_to_regex(pat):
    """gitignore-like CODEOWNERS pattern -> compiled regex over a repo-relative path."""
    anchored = pat.startswith("/")
    p = pat.lstrip("/")
    is_dir = p.endswith("/")
    p = p.rstrip("/")
    if not anchored and "/" in p:
        anchored = True  # a slash inside the pattern anchors it to the root (gitignore rule)
    out, i = [], 0
    while i < len(p):
        if p.startswith("**/", i):
            out.append("(?:.*/)?"); i += 3
        elif p.startswith("**", i):
            out.append(".*"); i += 2
        elif p[i] == "*":
            out.append("[^/]*"); i += 1
        elif p[i] == "?":
            out.append("[^/]"); i += 1
        else:
            out.append(re.escape(p[i])); i += 1
    body = "".join(out)
    prefix = "^" if anchored else "^(?:.*/)?"
    # a match may be the path itself or any directory containing it
    return re.compile(prefix + body + ("/.*$" if is_dir else "(?:/.*)?$"))


def parse_codeowners(text):
    rules = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if re.match(r"^\^?\[[^\]]+\]", line):
            continue  # section header
        pat = line.split()[0]
        rules.append((pat, glob_to_regex(pat)))
    return rules


def matches(rules, path):
    return [pat for pat, rx in rules if rx.search(path)]


def api(path, token):
    url = os.environ["CI_API_V4_URL"].rstrip("/") + path
    req = urllib.request.Request(url, headers={"PRIVATE-TOKEN": token})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.read(), r.headers


def api_json_all(path, token):
    out, page = [], 1
    while True:
        sep = "&" if "?" in path else "?"
        _, body, hdrs = api(f"{path}{sep}per_page=100&page={page}", token)
        data = json.loads(body)
        if not isinstance(data, list):
            return data
        out.extend(data)
        nxt = hdrs.get("X-Next-Page")
        if not nxt:
            return out
        page = int(nxt)


def main():
    token = os.environ.get("OWNER_GATE_TOKEN", "").strip()
    if not token:
        print("FAIL: OWNER_GATE_TOKEN is not set; the gate fails closed.")
        return 1
    pid = os.environ["CI_PROJECT_ID"]
    iid = os.environ["CI_MERGE_REQUEST_IID"]
    target = os.environ["CI_MERGE_REQUEST_TARGET_BRANCH_NAME"]
    owner_ids = {int(x) for x in os.environ.get("OWNER_GATE_USER_IDS", "2").split(",") if x.strip()}

    text, source = None, None
    for cand in CODEOWNERS_PATHS:
        q = urllib.parse.quote(cand, safe="")
        try:
            _, body, _ = api(f"/projects/{pid}/repository/files/{q}/raw?ref={urllib.parse.quote(target, safe='')}", token)
            text, source = body.decode("utf-8", "replace"), cand
            break
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise
    if text is None:
        print(f"NOTICE: no CODEOWNERS on target branch '{target}' — nothing to enforce yet (bootstrap). PASS.")
        return 0
    rules = parse_codeowners(text)

    diffs = api_json_all(f"/projects/{pid}/merge_requests/{iid}/diffs", token)
    paths = sorted({p for d in diffs for p in (d.get("old_path"), d.get("new_path")) if p})
    hits = {p: matches(rules, p) for p in paths}
    hits = {p: m for p, m in hits.items() if m}
    print(f"owner_review_gate: {len(paths)} changed path(s); {len(hits)} code-owned (rules from {target}:{source}).")
    if not hits:
        print("PASS: no code-owned paths changed — low-risk by path. (The `low-risk` label is still required for agent merges.)")
        return 0
    for p, m in sorted(hits.items())[:50]:
        print(f"  code-owned: {p}   <- {', '.join(m)}")

    _, body, _ = api(f"/projects/{pid}/merge_requests/{iid}/approvals", token)
    appr = json.loads(body)
    versions = api_json_all(f"/projects/{pid}/merge_requests/{iid}/versions", token)
    last_push = max((v.get("created_at") or "" for v in versions), default="")
    ok = []
    for a in appr.get("approved_by") or []:
        u = a.get("user") or {}
        if u.get("id") in owner_ids:
            at = a.get("approved_at")
            if at and last_push and at < last_push:
                print(f"  owner approval by {u.get('username')} at {at} predates the latest push ({last_push}) — stale.")
                continue
            ok.append(u.get("username"))
    if ok:
        print(f"PASS: code-owned changes approved by owner ({', '.join(ok)}).")
        return 0
    print("FAIL: this MR changes code-owned paths and has no current owner approval.\n"
          "      Owner: review, click Approve, then re-run this job (or the pipeline).")
    return 1


def selftest():
    """Checks this repo's CODEOWNERS against SELFTEST_OWNED / SELFTEST_LOW (defined per repo below)."""
    here = os.path.dirname(os.path.abspath(__file__))
    rules = parse_codeowners(open(os.path.join(here, "..", "CODEOWNERS")).read()
                             if len(sys.argv) < 3 else open(sys.argv[2]).read())
    bad = [p for p in SELFTEST_OWNED if not matches(rules, p)] + [p for p in SELFTEST_LOW if matches(rules, p)]
    for p in bad:
        print("SELFTEST MISMATCH:", p, matches(rules, p))
    print("selftest", "FAIL" if bad else "OK", f"({len(SELFTEST_OWNED)} owned, {len(SELFTEST_LOW)} low-risk)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(selftest() if "--selftest" in sys.argv else main())
