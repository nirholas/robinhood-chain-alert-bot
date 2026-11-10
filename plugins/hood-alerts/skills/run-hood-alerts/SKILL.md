---
name: run-hood-alerts
description: Self-host the hood-alerts engine for Robinhood Chain (launches, graduations, whale trades, Stock Token moves, rug warnings) with console, Telegram, Discord or X delivery. Use when asked to set up, run or check a Robinhood Chain alert bot.
---

# Run hood-alerts

`hood-alerts` (npm, bin `hood-alerts`) is one long-running process: a detection engine, a small HTTP server, and optional Telegram, Discord and X transports. It watches Robinhood Chain (chain ID 4663) and sends alerts for new launches, bonding-curve graduations, whale trades, Stock Token price moves and premium or discount crossings, holder milestones and liquidity-pull rug warnings. Requires Node.js 20 or newer.

## Smoke test (no configuration)

```bash
npx -y hood-alerts
```

With no environment variables the detectors use the public chain RPC, alerts print as structured JSON log lines (console transport), and the server listens on port 8080. Check it:

```bash
curl -s localhost:8080/healthz     # uptime, last detector event, event counts, premium enabled flag
curl -s localhost:8080/            # service metadata and endpoint list
```

## Going live on a platform

Tell the user to create the bot themselves and export the tokens in their own shell before starting; do not ask them to paste tokens into the chat.

- Telegram: create a bot with @BotFather, export `HOOD_ALERTS_TELEGRAM_TOKEN`.
- Discord: create an application and bot in the Developer Portal, export `HOOD_ALERTS_DISCORD_TOKEN` and `HOOD_ALERTS_DISCORD_APP_ID`.
- X: broadcast only. Set `HOOD_ALERTS_X_MODE` to `official` (with `HOOD_ALERTS_X_API_KEY`, `HOOD_ALERTS_X_API_SECRET`, `HOOD_ALERTS_X_ACCESS_TOKEN`, `HOOD_ALERTS_X_ACCESS_SECRET`) or `xactions` (with `HOOD_ALERTS_XACTIONS_URL`, `HOOD_ALERTS_XACTIONS_TOKEN`). `HOOD_ALERTS_X_TOPICS` picks what is posted (default `launches,graduations,whales`). Posting publicly is the user's decision; confirm before enabling it.

Other settings: `HOOD_ALERTS_RPC_URL`, `HOOD_ALERTS_DB` (default `./data/hood-alerts.db`), `PORT` (8080), `LOG_LEVEL`, `HOOD_ALERTS_WHALE_DEFAULT_USD` (5000), `HOOD_ALERTS_PRICE_WINDOW_S` (900), `HOOD_ALERTS_RUG_DEFAULT_PCT` (30). `.env.example` in the repo lists every variable.

## Bot commands (Telegram and Discord)

`watch <what> [threshold]` where `<what>` is `launches` (optionally `noxa` or `odyssey`), `graduations`, `whales [usd]`, `premiums [pct]`, `rugs [pct]`, a Stock Token ticker such as `TSLA`, or a token `0x` address. Also `unwatch <what|all>`, `list`, `threshold <what> <n>`, `digest on|off [min]`, `quiet <from> <to>` (UTC hours) and `premium`, `help`. In groups, changing subscriptions is admin only.

## Free and premium

Free tier: 3 subscriptions, at most one immediate alert per 60 seconds, no `premiums` or `rugs`. Premium is bought with x402 in USDG on chain 4663 through `POST /premium/activate?platform=...&chat=...`, and stays disabled until the operator sets `HOOD402_PAY_TO` plus `HOOD402_FACILITATOR_URL` or `HOOD402_SETTLER_KEY`. Never sign or send that payment yourself; show the user the amount and wait for an explicit yes. `GET /premium/status?platform=...&chat=<id>` reports a chat's tier.

## Worked example

Start `npx -y hood-alerts &`, wait about 30 seconds, then `curl -s localhost:8080/healthz` and report uptime, the last event time and the per-event counts. If counts stay at zero, check `HOOD_ALERTS_RPC_URL` and outbound access to the chain RPC.
