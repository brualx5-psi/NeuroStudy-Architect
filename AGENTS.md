# Repository Guidelines

## Project Structure & Module Organization
- Root config: `package.json`, `vite.config.ts`, and `tsconfig*.json`.
- App entry points: `index.html` and `client/src/main.tsx`.
- Frontend source: `client/src/` with `components/`, `pages/`, `contexts/`, and `services/`.
- Public assets: `client/public/`.
- Shared types: `types.ts` (root) and `client/src/types.ts`.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start the Vite dev server for local development.
- `npm run build`: create a production build.
- `npm run preview`: serve the production build locally.
- `npm run lint`: run ESLint over the repo.

## Coding Style & Naming Conventions
- TypeScript + React with `.tsx` components.
- Indentation uses 2 spaces and single quotes (see `client/src/main.tsx`).
- Component files are PascalCase (e.g., `ErrorBoundary.tsx`); hooks/functions use camelCase.
- Keep UI text and business logic in `pages/` and `services/` respectively; reuse UI in `components/`.

## Testing Guidelines
- No testing framework is configured in this repo right now.
- If you add tests, document the runner and add a `npm run test` script.

## Commit & Pull Request Guidelines
- Commit messages follow a conventional prefix style seen in history (e.g., `feat:`, `fix:`).
- PRs should include a short description, rationale, and test/verification notes.
- For UI changes, include before/after screenshots or a short clip.

## Configuration & Secrets
- Local environment variables live in `client/.env` and a `.env.local` for API keys (see README).
- Never commit real keys; use `.env.local` for developer-specific secrets.
