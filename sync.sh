#!/bin/bash
# sync.sh - compare local vs remote and update the older side

BRANCH=$(git rev-parse --abbrev-ref HEAD)
REMOTE="origin"

echo "Fetching latest from $REMOTE..."
git fetch "$REMOTE" || { echo "Fetch failed"; exit 1; }

# Uncommitted local changes: review them before committing
if [ -n "$(git status --porcelain)" ]; then
  echo "You have uncommitted changes:"
  git status --porcelain | while IFS= read -r line; do
    code="${line:0:2}"; file="${line:3}"
    case "$code" in
      *D*)  echo "  [DELETED]  $file   <-- will be removed from the repo" ;;
      "??") echo "  [NEW]      $file" ;;
      *R*)  echo "  [RENAMED]  $file" ;;
      *)    echo "  [MODIFIED] $file" ;;
    esac
  done
  if git status --porcelain | grep -q '^.D\|^D'; then
    echo "WARNING: some files are marked DELETED. Check they are intentional."
  fi
  read -p "Commit ALL of these? (y/n) " ans
  if [ "$ans" = "y" ]; then
    read -p "Commit message: " msg
    git add -A && git commit -m "${msg:-Update}"
  else
    echo "Nothing committed. Restore a deleted file with: git restore <file>"
    echo "Or commit selectively with git add <file>, then run this script again."
    exit 1
  fi
fi

LOCAL=$(git rev-parse @)
REMOTE_SHA=$(git rev-parse "$REMOTE/$BRANCH")
BASE=$(git merge-base @ "$REMOTE/$BRANCH")

if [ "$LOCAL" = "$REMOTE_SHA" ]; then
  echo "Already in sync. Nothing to do."
elif [ "$LOCAL" = "$BASE" ]; then
  echo "Online is newer -> updating your local copy..."
  git pull --ff-only "$REMOTE" "$BRANCH"
elif [ "$REMOTE_SHA" = "$BASE" ]; then
  echo "Local is newer -> pushing to online..."
  git push -u "$REMOTE" "$BRANCH"
else
  echo "Both have new changes (diverged)."
  echo "Run: git pull --rebase $REMOTE $BRANCH   then fix any conflicts, then: git push"
  exit 1
fi
