#!/usr/bin/env zsh
# catdir46.sh — union of tree ∪ find, show text files,
# and list ONLY text/non-binary files that were NOT displayed.

set -eu
set -o pipefail 2>/dev/null || true

TS() { printf '[%s] ' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"; }
hr() { printf '%s\n' '--------------------------------------------------------------------------------'; }
is_cmd() { command -v "$1" >/dev/null 2>&1; }

# ------------ config ------------
ROOT="."
MAX_BYTES=200000
LIST_ONLY=0
LIST_SOURCE="union"    # union | find | tree

EXCLUDE_DIRS=(
  .git node_modules dist build .next .expo .idea .turbo .vercel
  android ios coverage logs .output .cache .gradle .vscode .pnpm-store
)

# only affects PREVIEW (not listing). If skipped by these, it will be reported missing.
SKIP_PREVIEW_GLOBS=(
  '*.png' '*.jpg' '*.jpeg' '*.gif' '*.bmp' '*.webp' '*.ico' '*.icns'
  '*.mp3' '*.wav' '*.flac' '*.mp4' '*.mov' '*.mkv' '*.webm'
  '*.zip' '*.gz' '*.tgz' '*.tar' '*.bz2' '*.xz' '*.7z'
  '*.pdf' '*.dmg' '*.apk' '*.aab' '*.jar' '*.so' '*.dylib' '*.o' '*.wasm'
  '*.ttf' '*.otf' '*.woff' '*.woff2' '*.eot'
  '*.lock' '*.sqlite' '*.db'
)

# ------------ args ------------
for arg in "$@"; do
  case "$arg" in
    --max-bytes=*) MAX_BYTES="${arg#*=}" ;;
    --list-only)   LIST_ONLY=1 ;;
    --source=union|--source=find|--source=tree)
      LIST_SOURCE="${arg#--source=}" ;;
    --help|-h)
      cat <<'EOF'
Usage: catdir46.sh [ROOT_DIR=. ] [options]

  --list-only             Only list files (no previews)
  --max-bytes=N           Max bytes per file when previewing (default 200000)
  --source=union|find|tree
                          Choose final list source (default union)

Only text/non-binary files (as detected) are candidates for "missing" reporting.
EOF
      exit 0 ;;
    *)
      if [[ "$arg" == -* ]]; then
        echo "Unknown option: $arg" >&2; exit 2
      else
        ROOT="$arg"
      fi ;;
  esac
done

[[ -d "$ROOT" ]] || { echo "Root directory not found: $ROOT" >&2; exit 1; }
cd "$ROOT"; ROOT="."

MISSING_FILE="./_catdir_missing.txt"
: > "$MISSING_FILE"

# ------------ helpers ------------
sanitize_filename() {
  local s="$1"
  [[ "$s" == ./* ]] && s="${s:2}"
  s="${s//\"/}"
  s="${s//\'/}"
  s="${s##[[:space:]]}"
  s="${s%%[[:space:]]}"
  print -r -- "$s"
}

build_tree_ignore() {
  local d parts=()
  for d in "${EXCLUDE_DIRS[@]}"; do parts+=("$d"); done
  print -nr -- "${(j:|:)parts}"
}

# broader extension-based text guess
is_texty_ext() {
  case "$1" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.md|*.markdown|*.txt|*.yml|*.yaml|*.toml|*.ini|*.env|*.env.*|*.cfg|*.conf|*.sh|*.zsh|*.bash|*.ksh|*.c|*.h|*.cpp|*.cc|*.hpp|*.java|*.kt|*.kts|*.cs|*.py|*.rb|*.rs|*.go|*.php|*.html|*.htm|*.css|*.scss|*.sass|*.vue|*.svelte|*.gql|*.graphql|*.sql|*.gradle|*.tsbuildinfo|Dockerfile|dockerfile|Makefile|makefile)
      return 0 ;;
  esac
  return 1
}

# final text detector: ONLY these files are candidates
is_text_file() {
  local f="$1" mt=""
  if is_texty_ext "$f"; then
    return 0
  fi
  if LC_ALL=C grep -Iq . -- "$f" 2>/dev/null; then
    return 0
  fi
  if is_cmd file; then
    mt="$(file -bI -- "$f" 2>/dev/null || true)"
    case "$mt" in
      text/*|application/json*|application/javascript*|*/xml*)
        return 0 ;;
    esac
  fi
  return 1
}

matches_skip_glob() {
  local f="$1" pat
  for pat in "${SKIP_PREVIEW_GLOBS[@]}"; do
    if [[ "${f:t}" == ${~pat} ]]; then return 0; fi
  done
  return 1
}

file_size() { wc -c < "$1" 2>/dev/null | tr -d ' ' || echo 0; }

report_everywhere() {
  local line="$1"
  TS; echo "$line"
  { TS; echo "$line"; } >&2
  printf '%s\n' "$line" >> "$MISSING_FILE"
}

# ------------ collect (tree + find) ------------
typeset -A set_tree
typeset -A set_find
TREE_PRESENT=0
TREE_IGNORE="$(build_tree_ignore)"

# tree
if is_cmd tree; then
  TREE_PRESENT=1
  TS; echo "Enumerating with tree (unified ignore)…"
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    line="$(sanitize_filename "$line")"
    [[ -f "$line" ]] || continue
    set_tree["$line"]=1
  done < <(tree -afi --noreport -I "$TREE_IGNORE" 2>/dev/null || true)
else
  TS; echo "tree not found; skipping tree enumeration."
fi

# find
TS; echo "Enumerating with find (unified prune)…"
typeset -a FIND
FIND=( . )
if (( ${#EXCLUDE_DIRS[@]} )); then
  FIND+=( \( )
  local i=1 d
  for d in "${EXCLUDE_DIRS[@]}"; do
    FIND+=( -name "$d" )
    (( i < ${#EXCLUDE_DIRS[@]} )) && FIND+=( -o )
    (( i++ ))
  done
  FIND+=( \) -prune -o )
fi
FIND+=( -type f -print0 )

while IFS= read -r -d '' f; do
  [[ -z "$f" ]] && continue
  f="$(sanitize_filename "$f")"
  [[ -f "$f" ]] || continue
  set_find["$f"]=1
done < <(noglob command find "${FIND[@]}" 2>/dev/null)

# ------------ compare ------------
hr
TS; echo "Discrepancies between tree and find (after unified filters):"
if (( TREE_PRESENT )); then
  typeset -a only_tree only_find
  for k in ${(k@)set_tree}; do [[ -n "${set_find[$k]-}" ]] || only_tree+=("$k"); done
  for k in ${(k@)set_find}; do [[ -n "${set_tree[$k]-}" ]] || only_find+=("$k"); done
  (( ${#only_tree[@]} )) && {
    echo "Paths shown by tree but not returned by find:"
    printf '  %s\n' "${only_tree[@]}"
  } || echo "✅ No paths exclusively in tree."
  (( ${#only_find[@]} )) && {
    echo "Paths returned by find but not shown by tree:"
    printf '  %s\n' "${only_find[@]}"
  } || echo "✅ No paths exclusively in find."
else
  echo "⚠️ Skipped (tree not available)."
fi

# ------------ final list ------------
hr
typeset -a base_list
case "$LIST_SOURCE" in
  tree)
    if (( TREE_PRESENT )); then
      base_list=( "${(@k@)set_tree}" )
    else
      TS; echo "tree not available; falling back to find."
      base_list=( "${(@k@)set_find}" )
    fi ;;
  find)
    base_list=( "${(@k@)set_find}" ) ;;
  union|*)
    typeset -a union_list
    union_list=( "${(@k@)set_find}" "${(@k@)set_tree}" )
    typeset -aU union_list
    base_list=( "${union_list[@]}" ) ;;
esac

typeset -a sorted
sorted=( "${(on)base_list[@]}" )
for i in {1..${#sorted[@]}}; do
  sorted[$i]="$(sanitize_filename "${sorted[$i]}")"
done

TS; echo "Final file list (${LIST_SOURCE}, after unified filters):"
printf '  %s\n' "${sorted[@]}"
echo
TS; echo "Total files: ${#sorted[@]}"

if (( LIST_ONLY )); then
  hr
  TS; echo "--list-only set; skipping content preview."
  TS; echo "Missing-text summary (if any) is in $MISSING_FILE"
  exit 0
fi

# ------------ preview + tracking ------------
hr
TS; echo "Safe previews (text only, sanitized, max ${MAX_BYTES} bytes each)…"

# only TEXT files go in here
typeset -a TEXT_CANDIDATES=()
typeset -a TEXT_DISPLAYED=()

for f in "${sorted[@]}"; do
  [[ -n "$f" ]] || continue
  f="$(sanitize_filename "$f")"

  # only non-binary files are candidates
  if ! is_text_file "$f"; then
    # true binary -> ignore for missing list
    TS; echo "🧱 $f (binary/unknown MIME — ignored for missing list)"
    continue
  fi

  TEXT_CANDIDATES+=("$f")

  # skipped by glob -> candidate but not shown
  if matches_skip_glob "$f"; then
    TS; echo "⏭️  $f (preview skipped by glob rule)"
    report_everywhere "MISSING TEXT (skipped by glob): $f"
    continue
  fi

  TS; echo "📄 $f"
  sz="$(file_size "$f")"
  if is_cmd iconv; then
    if (( sz > MAX_BYTES )); then
      iconv -f UTF-8 -t UTF-8 -c -- "$f" 2>/dev/null | head -c "$MAX_BYTES"
      printf '\n… [truncated at %d bytes]\n' "$MAX_BYTES"
      report_everywhere "MISSING TEXT (truncated at ${MAX_BYTES}): $f"
    else
      iconv -f UTF-8 -t UTF-8 -c -- "$f" 2>/dev/null || true
      TEXT_DISPLAYED+=("$f")
    fi
  else
    head -c "$MAX_BYTES" -- "$f" 2>/dev/null || true
    if (( sz > MAX_BYTES )); then
      printf '\n… [truncated at %d bytes]\n' "$MAX_BYTES"
      report_everywhere "MISSING TEXT (truncated at ${MAX_BYTES}): $f"
    else
      TEXT_DISPLAYED+=("$f")
    fi
  fi
  hr
done

# ------------ final diff ------------
hr
TS; echo "Missing-text summary (also in $MISSING_FILE):"

typeset -A shownmap
for f in "${TEXT_DISPLAYED[@]}"; do
  shownmap["$f"]=1
done

typeset -a NOT_SHOWN=()
for f in "${TEXT_CANDIDATES[@]}"; do
  [[ -n "${shownmap[$f]-}" ]] || NOT_SHOWN+=("$f")
done

if (( ${#NOT_SHOWN[@]} )); then
  for f in "${NOT_SHOWN[@]}"; do
    report_everywhere "MISSING TEXT (not displayed at all): $f"
  done
else
  report_everywhere "(none — all text-like files were displayed)"
fi

TS; echo "Done."
