# 🌿 Git Branching & Collaboration Guide

A quick-reference cheat sheet for switching branches, pulling updates, committing changes, and collaborating safely between `Email`, `email-dev`, and `main`.

---

## 📌 1. Check Which Branch You Are On

```bash
# Print just the current active branch name
git branch --show-current

# List all local branches (the one with * is active)
git branch

# Show detailed status of current branch
git status
```

---

## 🔄 2. Switching Between Branches

```bash
# Switch to the stable Email feature branch
git checkout Email

# Switch to the sub-branch for experimental/collaborator development
git checkout email-dev

# Switch to the main branch
git checkout main
```

---

## 📥 3. Pulling Latest Changes

Always pull before starting new work to get any updates pushed by your collaborator:

```bash
# When on email-dev
git checkout email-dev
git pull origin email-dev

# When on Email
git checkout Email
git pull origin Email
```

---

## 📤 4. Saving & Pushing Your Work

When you finish making edits on your branch:

```bash
# 1. Stage all modified and new files
git add .

# 2. Commit with a clear description
git commit -m "Add new feature updates"

# 3. Push to your active branch on GitHub
git push origin email-dev
```
*(Replace `email-dev` with `Email` if you are committing directly to the Email branch).*

---

## 👥 5. Guide for Your Collaborator (Friend)

Send these instructions to anyone joining to work on `email-dev`:

1. **Clone or Fetch the repository**:
   ```bash
   git fetch origin
   ```
2. **Switch to the `email-dev` sub-branch**:
   ```bash
   git checkout email-dev
   ```
3. **Make changes and push only to `email-dev`**:
   ```bash
   git add .
   git commit -m "Implemented new email enhancement"
   git push origin email-dev
   ```

---

## 🔀 6. Merging `email-dev` into `Email` (When Ready)

Once the new feature in `email-dev` is fully built and tested:

### Method A: Via GitHub (Recommended)
1. Go to your GitHub repository: [https://github.com/404stephenFound/christ-smart-map](https://github.com/404stephenFound/christ-smart-map)
2. Click **Pull Requests** ➔ **New Pull Request**.
3. Set **base**: `Email` ⬅️ **compare**: `email-dev`.
4. Review the changes and click **Create Pull Request** ➔ **Merge**.

### Method B: Via Terminal
```bash
# 1. Switch to the target branch
git checkout Email
git pull origin Email

# 2. Merge email-dev into Email
git merge email-dev

# 3. Push the merged result to GitHub
git push origin Email
```

---

## 🛠️ 7. Useful Safety Commands

```bash
# Discard all unstaged local edits (revert to last commit)
git restore .

# View commit history on current branch
git log --oneline -n 5
```
