# Arcade

Original browser games in one monorepo, each deployed on its own at `/games/<slug>/`, plus a landing page. Static hosting on Cloudflare Workers static assets; saves live in the player's browser, and online races go through a small room Worker in `apps/api`.

```bash
pnpm install
pnpm exec playwright install chromium webkit
pnpm arcade list
pnpm arcade dev phaser-2d
```

- Agents and contributors: start with [AGENTS.md](AGENTS.md).
- Design: [docs/architecture.md](docs/architecture.md), [docs/agent-experience.md](docs/agent-experience.md), [docs/product-vision.md](docs/product-vision.md), [docs/problem-statement.md](docs/problem-statement.md).
