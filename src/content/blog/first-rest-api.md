---
title: "How I Structured My First REST API"
pubDate: 2026-02-15
description: "Lessons learned building a Node.js REST API from scratch — routing, middleware, and error handling."
tags: ["Node.js", "API", "Backend"]
icon: "API"
---

## Background

Building a REST API for the first time is both exciting and confusing. There are a hundred ways to structure your code and no single "right" answer. Here's what I landed on after a few iterations, and why.

## The Tech Stack

- **Node.js** + **Express** for the server
- **Zod** for request validation
- **JSON** responses throughout (no database in v1)

## Project Structure

```
api/
├── routes/
│   ├── users.js
│   └── posts.js
├── middleware/
│   ├── auth.js
│   └── errorHandler.js
├── validators/
│   └── schemas.js
└── index.js
```

## Route Design

I followed RESTful conventions throughout:

| Method | Path | Description |
|--------|------|-------------|
| GET | /posts | List all posts |
| GET | /posts/:id | Get one post |
| POST | /posts | Create a post |
| PUT | /posts/:id | Replace a post |
| PATCH | /posts/:id | Update a post |
| DELETE | /posts/:id | Delete a post |

## Centralized Error Handling

The most important pattern I learned: centralize error handling. Don't call `res.status(500).json(...)` inside every route.

```javascript
function errorHandler(err, req, res, next) {
  const status = err.status ?? 500;
  const message = err.message ?? 'Internal Server Error';
  res.status(status).json({ error: message });
}

app.use(errorHandler); // must be registered last
```

## Request Validation with Zod

Before any business logic runs, validate the incoming request body:

```javascript
import { z } from 'zod';

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
});

app.post('/posts', (req, res, next) => {
  const result = CreatePostSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten() });
  }
  // proceed with result.data
});
```

## What I'd Add Next

1. A real database — PostgreSQL with Prisma
2. JWT authentication
3. Rate limiting
4. Integration tests against a test database

Building your first API teaches you how HTTP actually works. I'd recommend it to every web developer, regardless of their primary stack.
