---
title: "Packaging a Whole Codebase for Copilot — Without Leaking It"
pubDate: 2026-05-29
description: "A tiny Node CLI that packs a repo into one AI prompt while honoring .gitignore — so secrets stay out of the chat box."
tags: ["Node.js", "CLI", "Automation"]
icon: ">_"
---

Copilot is fine on the file you're staring at. It's worse when the answer depends on the other forty files around it. So you paste snippets, re-explain the architecture every chat, and hope the model invents the rest.

Pasting the whole project sounds like the fix. Two problems: it's tedious, and at work it's risky. Wrong folder in a chat window means credentials, internal logic, or a client's code walking out the door.

I wrote a small CLI that does both jobs at once.

## What it does

One Node.js script. Point it at a directory. Out comes a single document: a file tree, then every text file's contents, wrapped in a short prompt that says "treat this as the whole project."

```bash
node copilot-context.js .            # Markdown output
node copilot-context.js . --plaintext
```

One paste instead of a drip of snippets. Answers get sharper because the model can see how the pieces fit.

## The part that matters: not leaking anything

Safety is the point. The tool reads the project's own `.gitignore` and skips whatever git already excludes. If your team already keeps secrets and proprietary modules out of version control (you should), they stay out of the AI prompt too. No second allowlist to maintain and forget.

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

On top of that it skips noise (`node_modules`, `dist`, lockfiles) and only reads known text extensions, so binaries don't sneak in.

## Guardrails

Files over about 200 KB get skipped. Anything past 500 lines gets truncated with a note about the real length. That keeps the prompt on code worth reasoning about instead of stuffing the context window with a generated blob.

## Why I built it

Roughly 230 lines, zero dependencies. It killed a daily annoyance and closed a real security gap. Small tools that fit how a team already works beat tools that ask everyone to change their habits.

If your team is leaning on AI assistants and worrying about what lands in the paste box, this is the kind of thing I like putting on a portfolio — practical, careful, and short enough to read in one sitting.
