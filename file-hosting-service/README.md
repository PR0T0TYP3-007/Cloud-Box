# File Hosting Frontend (file-hosting-service)

This is the Next.js frontend for the DropBoxClone project. It expects a running backend API (NestJS) that implements the routes described in the repository root documentation.

Quick setup

1. Install dependencies

```bash
cd file-hosting-service
npm install
```

2. Environment

Create a `.env.local` at the project root or set environment variables. The frontend reads the API base URL from:

- `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3000`)

Example `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

3. Run development server

Open two terminals (one for backend, one for frontend) and run these commands:

- Start the backend (project root):

```bash
# From repository root
npm run start:dev
```

By default the backend runs on port 3000. If you need a different port on Windows (CMD):

```bash
set PORT=3000 && npm run start:dev
```

- Start the frontend on port 3001 (so it doesn't conflict with backend):

```bash
cd file-hosting-service
# Option 1: pass port arg to next
npm run dev -- -p 3001
# Option 2: with npx
npx next dev -p 3001
```

Build and start

```bash
npm run build
npm start
```

Verify connectivity

- Open your browser to `http://localhost:3001`.
- On the landing page click **Check API** — this calls the backend `/` endpoint and displays the response ("OK: ...") or an error if the backend is unreachable or CORS blocks it.
- You can also sign up and sign in using the UI; successful sign-in will store the access token in `localStorage` under `access_token`.

Notes

- The frontend stores the JWT access token in `localStorage` under the key `access_token`.
- Ensure the backend sets `POST /auth/signin` to return `{ access_token: string }` on successful login.
- If you deploy the backend under a different host/port, set `NEXT_PUBLIC_API_URL` accordingly.
- The frontend assumes the backend exposes the API routes used by `services/api.ts`, `services/auth.service.ts`, `services/files.service.ts`, etc.

If you want, I can also:
- Wire any missing UI flows to the API (login/register/upload/download)
- Add environment-based runtime checks or a small proxy for local development
