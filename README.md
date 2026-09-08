# KickOff

KickOff is a Next.js football dashboard backed by an Express and PostgreSQL API.

## Run locally

Create a `.env` file with the PostgreSQL connection values used by `backend/src/db/index.ts`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kickoff
DB_USER=postgres
DB_PASSWORD=your-password
JWT_SECRET=use-a-long-random-value
ADMIN_BOOTSTRAP_KEY=use-a-separate-admin-invite
API_FOOTBALL_KEY=your-api-football-key
```

For a fresh database, apply `backend/database/schema.sql`. For an existing database, the backend automatically adds the `Users.Role` column and `UserSessions` table when it starts. Then run:

```bash
npm install
npm --prefix backend install
npm run dev
```

The web app runs at `http://localhost:3000` and the API at `http://localhost:5000`.

After changing the schema or backend startup code, stop and restart `npm run dev` once so the migration runs.

## Authentication and authorization demo

- `POST /api/auth/register` creates a `fan` account. Passwords are bcrypt-hashed.
- `POST /api/auth/bootstrap-admin` creates an `admin` account only when the server-side `ADMIN_BOOTSTRAP_KEY` matches. The client never chooses or submits a role.
- `POST /api/auth/login` loads the role from `Users`, creates a database-backed session, and sets an HTTP-only cookie containing a signed JWT session identifier.
- `POST /api/auth/logout` marks that session revoked in `UserSessions`, so the old cookie cannot be used again.
- `GET /api/users/teams`, `POST /api/users/teams/:teamId`, and `DELETE /api/users/teams/:teamId` are fan-only and always scope queries to the authenticated user.
- `GET /api/users/admin/users` is admin-only. An unauthenticated request receives `401`; a fan request receives `403`.

The dashboard exercises these paths: fans manage their own followed teams, while admins see the protected user list. Use the optional administrator invite field on registration to create an admin during a clean demonstration.

## Checks

```bash
npm run lint
npm run build
npm --prefix backend run build
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.
Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
