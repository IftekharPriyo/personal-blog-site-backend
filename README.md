# Personal Blog Site Backend

Backend API for my personal portfolio and blog website.

## Overview

This project provides the backend services for:

* Blog management
* Portfolio project management
* Travel history management
* Media management
* Admin authentication

The website owner manages content through a protected admin dashboard.

```txt
/admin
```

This project is not intended to be a standalone CMS.

---

## Tech Stack

### Backend

* Node.js
* Express.js

### Database

* PostgreSQL
* Prisma ORM

### Authentication

* JWT
* bcrypt

### Deployment

Planned:

* AWS EC2
* AWS RDS
* Amazon S3
* Docker
* Nginx

---

## Project Structure

```txt
src/
├── app.js
├── server.js
├── config/
├── routes/
├── controllers/
├── services/
├── middleware/
├── validators/
├── utils/
└── constants/

prisma/
└── schema.prisma
```

---

## Features

### Authentication

* Admin login
* JWT-based authorization
* Protected API routes

### Blog Posts

* Create post
* Update post
* Delete post
* Publish/unpublish post

### Projects

* Create project
* Update project
* Delete project

### Travel Entries

* Create travel entry
* Update travel entry
* Delete travel entry

### Media

* Store image metadata
* Support future S3 integration

---

## Environment Variables

Create a `.env` file:

```env
PORT=5000

DATABASE_URL=

JWT_SECRET=

FRONTEND_URL=
```

---

## Local Development

Install dependencies:

```bash
pnpm install
```

Generate Prisma client:

```bash
pnpm dlx prisma generate
```

Run migrations:

```bash
pnpm dlx prisma migrate dev
```

Start development server:

```bash
pnpm dev
```

---

## Database

Current planned entities:

```txt
User
Post
Project
TravelEntry
Media
```

Schema will evolve as the website grows.

---

## API Design

Base URL:

```txt
/api
```

Examples:

```txt
POST   /api/auth/login

GET    /api/posts
POST   /api/posts

GET    /api/projects
POST   /api/projects

GET    /api/travels
POST   /api/travels
```

---

## Future Improvements

* S3 image uploads
* Rich text editor support
* Tags
* Search
* Draft system
* Docker deployment
* CI/CD pipeline
* Monitoring and logging

---

## Author

Iftekhar Priyo

Personal portfolio and blog platform built for learning and production use.
