---
title: "My Web Portfolio: From Idea to Deployment"
pubDate: 2026-04-30
description: "How I designed, built, and deployed my personal portfolio site using Astro and Tailwind CSS."
tags: ["HTML", "CSS", "Astro"]
icon: "UI"
---

## Starting from Scratch

Every developer eventually builds a portfolio site. I had put it off for years, always telling myself I'd do it "when I had time." That time finally came, and I want to document what I learned along the way.

## Choosing the Stack

I evaluated several frameworks before landing on **Astro**. Here's what swayed me:

- **Zero JS by default** — my portfolio doesn't need heavy client-side interactivity
- **Content Collections** — perfect for managing blog posts as Markdown files
- **Excellent Tailwind integration** — utility-first styling fits my workflow

## Design Phase

I started with a wireframe on paper, sketching the three main views:

1. Home page with hero, about, projects, and skills sections
2. Blog post list
3. Individual post detail

Keeping the design simple meant I could focus on content and performance rather than visual complexity.

## Build and Deploy

The build process was straightforward. With Astro's static output, the entire site compiles to plain HTML, CSS, and minimal JavaScript. Deployment to Vercel took about two minutes — connect the repo, pick a framework preset, click deploy.

## Performance Results

After deployment, Lighthouse scores came in at 99 for performance, 100 for accessibility, and 100 for best practices. Static sites are hard to beat on these metrics.

## What I'd Do Differently

Next time I'd set up the content collections schema first, before writing any components. I refactored the data model twice, which cost a few hours of unnecessary rework.
