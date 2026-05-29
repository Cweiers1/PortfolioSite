---
title: "Intro to JavaScript DOM Manipulation"
pubDate: 2026-03-24
description: "A beginner-friendly guide to selecting, modifying, and responding to events in the browser DOM."
tags: ["JavaScript", "Web Dev"]
icon: "JS"
---

## What Is the DOM?

The Document Object Model (DOM) is the browser's structured representation of an HTML page. JavaScript can read and modify it, which is how web pages become interactive.

## Selecting Elements

```javascript
// By ID
const heading = document.getElementById('main-title');

// By CSS selector (returns first match)
const btn = document.querySelector('.submit-btn');

// By CSS selector (returns all matches)
const cards = document.querySelectorAll('.card');
```

## Modifying Content

```javascript
// Change text
heading.textContent = 'Hello, World!';

// Change HTML
heading.innerHTML = '<em>Hello</em>, World!';

// Change a style
btn.style.backgroundColor = 'coral';
```

## Adding and Removing Classes

```javascript
btn.classList.add('active');
btn.classList.remove('disabled');
btn.classList.toggle('hidden'); // adds if missing, removes if present
```

## Responding to Events

```javascript
btn.addEventListener('click', (event) => {
  console.log('Button clicked!', event.target);
  heading.textContent = 'You clicked the button!';
});
```

## Creating New Elements

```javascript
const newCard = document.createElement('div');
newCard.classList.add('card');
newCard.textContent = 'I was created by JavaScript';
document.body.appendChild(newCard);
```

## Why This Matters

DOM manipulation is the foundation of frontend interactivity. Every framework — React, Vue, Svelte — is ultimately an abstraction over these same browser APIs. Understanding the raw DOM makes you a better framework user and a sharper debugger when something goes wrong.
