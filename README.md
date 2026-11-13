# Rate Limiter (Node.js + Express + Redis)

A concurrency-safe, per-IP **token bucket** rate limiter built with Express and
Redis. The bucket math runs as a single **atomic Lua script** inside Redis, so
concurrent requests cannot race each other (no read-modify-write drift, no lost
updates) even across multiple Node processes.

## How it works

- The Express middleware runs before every route.
- Each client IP gets a Redis hash: `rate_limit:token_bucket:<ip>` holding
  `tokens` and `lastRefill`.
- A single `EVAL` call runs the Lua script atomically:
  1. Reads Redis server `TIME` (avoids clock skew across app instances).
  2. Refills tokens based on elapsed time and the refill rate, capped at capacity.
  3. Consumes one token if available, otherwise computes `Retry-After`.
  4. Persists new state and refreshes the TTL (1 week).
  5. Returns `[allowed, remaining, retryAfter, resetSeconds]`.
- On rejection the middleware throws an `AppError(429)` handled by the global
  error handler and sets the `Retry-After` header.

## Configuration

| Setting          | Value                          |
| ---------------- | ------------------------------ |
| Capacity         | `10` requests                  |
| Refill rate      | `10 / 60` tokens per second    |
| Key TTL          | `604800` seconds (1 week)      |
| Redis URL        | `redis://localhost:6379`       |
| Server port      | `3000`                         |

## Run it

```bash
# Requires Redis on localhost:6379
npm install
npm run dev      # or: npm start
```

Test the protected route:

```bash
curl -i http://localhost:3000/api/ping
```

Response headers include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and
`X-RateLimit-Reset`. Exceeding the limit returns HTTP `429` with a
`Retry-After` header.

## Important files to inspect

### The two that matter most

1. **`src/scripts/token-bucket.lua`** — the heart of the limiter. This atomic
   script does the refill, consume, `Retry-After`, and TTL work in one Redis
   round trip. Read this first to understand the algorithm.
2. **`src/services/rate-limitter.ts`** — the Express middleware. It loads the
   script, builds the per-IP key, passes `capacity / refillRate / ttl` as
   `ARGV`, and turns the script's return value into headers and a 429.

### Supporting files

| File | Why it matters |
| ---- | -------------- |
| `src/lib/redis.ts` | ioredis client wrapper, lifecycle events, connect/disconnect helpers. |
| `src/index.ts` | App wiring: trust proxy, rate limiter mount order, error/404 handlers, graceful shutdown. |
| `src/router/index.ts` | Example protected route and how rate-limit headers are emitted. |
| `src/response.ts` | `AppError` plus global error and 404 handlers (where 429 is rendered). |
| `src/lib/helper.ts` | Extracts the client IP used as the bucket key. |

## Commit history (how the implementation evolved)

The Lua path is the current design. To compare against the non-atomic version,
check out the previous commits:

```bash
git log --oneline -- src/services/rate-limitter.ts src/scripts/token-bucket.lua

# Pre-Lua implementation (read-modify-write in Node)
git show 95da9ff:src/services/rate-limitter.ts

# First version (with correctness bugs)
git show a03c362:src/services/rate-limitter.ts

# The commit that introduced the Lua script
git show b25744d
```

| Commit | What changed |
| ------ | ------------ |
| `a03c362` | First limiter: token logic in Node, broken reset math, no Lua. |
| `95da9ff` | Fixed refill/reset logic, still read-modify-write in Node — races under concurrency. |
| `b25744d` | Moved all bucket math into `token-bucket.lua`, executed atomically via `EVAL`. |

Why the move matters: the pre-Lua version did `GET` → compute → `SET`. Two
concurrent requests can read the same token count and both succeed, letting a
client exceed the limit. `EVAL` makes the whole check-and-update atomic inside
Redis.
