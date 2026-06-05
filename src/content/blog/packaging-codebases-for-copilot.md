---
title: "Packaging a Whole Codebase for Copilot — Without Leaking It"
pubDate: 2026-05-29
description: "A small Node.js CLI that turns an entire project into one AI-ready prompt, while respecting .gitignore so sensitive corporate logic never gets pasted into a chat box."
tags: ["Node.js", "CLI", "Automation"]
icon: ">_"
---

AI coding assistants are great until you hit their blind spot: context. Copilot can see the file you're staring at, but it can't reason about how that file fits into the other forty around it. So you end up copy-pasting snippets one at a time, re-explaining the same architecture every conversation, and hoping the model guesses the rest.

The obvious fix — paste the *whole* project — has two problems. It's tedious, and in a corporate environment it's dangerous. Drop the wrong folder into a chat window and you've just leaked credentials, internal business logic, or a client's proprietary code.

I built a small command-line tool to solve both at once.

## What it does

It's a single Node.js script. Point it at a project directory and it produces one clean, AI-ready document: a visual file tree followed by the contents of every text file, wrapped in a prompt that tells the assistant to treat this as the *entire* project context.

```bash
node copilot-context.js .            # Markdown output
node copilot-context.js . --plaintext
```

Now instead of dribbling out snippets, I hand the model the full picture in one paste — and the answers get noticeably sharper.

## The part that actually matters: not leaking anything

The safety story is the whole point. The tool reads the project's own `.gitignore` and refuses to include anything it excludes. If your team already keeps secrets and proprietary modules out of version control — and you should — they're automatically kept out of the AI prompt too. No separate allowlist to maintain, no second config to forget to update.

```js
function isIgnored(filePath) {
  const base = path.basename(filePath);
  const parts = filePath.split(path.sep);
  return (
    DEFAULT_IGNORE_DIRS.has(base) ||
    DEFAULT_IGNORE_FILES.has(base) ||
    parts.some(p => DEFAULT_IGNORE_DIRS.has(p)) ||
    matchesGitignore(filePath)
  );
}
```

On top of `.gitignore`, it skips the usual noise (`node_modules`, `dist`, lockfiles) and only reads known text extensions, so binaries and build artifacts never sneak in.

## The guardrails

A couple of limits keep the output sane. Files over ~200 KB are skipped, and anything past 500 lines gets truncated with a note about the real length. That keeps the prompt focused on the code worth reasoning about instead of blowing the model's context window on a giant generated file.

## Why I like this kind of project

It's maybe 230 lines, zero dependencies, and it removed a daily annoyance while quietly closing a real security gap. That's the sweet spot for automation work: small, sharp tools that fit how a team already works instead of asking them to change. If your team is leaning on AI assistants but worried about what's getting pasted where, this is exactly the kind of thing I build.
