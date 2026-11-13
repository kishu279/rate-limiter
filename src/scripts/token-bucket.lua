-- KEYS[1] = bucket key
--
-- ARGV[1] = capacity
-- ARGV[2] = refill rate (tokens per second)
-- ARGV[3] = TTL in seconds

local key = KEYS[1]

local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local ttl = math.floor(tonumber(ARGV[3]))

if not ttl or ttl <= 0 then
    return redis.error_reply("Invalid TTL")
end

-- Get Redis server time
local time = redis.call("TIME")

local current_time =
    tonumber(time[1]) + tonumber(time[2]) / 1000000

-- get bucket hash keyed valued
local bucket = redis.call(
    "HMGET",
    key,
    "tokens",
    "lastRefill"
)

-- tokens and lastRefill time
local tokens = tonumber(bucket[1])
local lastRefill = tonumber(bucket[2])

if not tokens or not lastRefill then
    tokens = capacity
    lastRefill = current_time
end

-- Calculate elapsed time
local elapsed_time = math.max(0, current_time - lastRefill)

-- Refill tokens
tokens = math.min(
    capacity,
    tokens + elapsed_time * refill_rate
)

-- Update timestamp.
-- Fractional refill is preserved in tokens.
-- Excess time at full capacity is discarded.
lastRefill = current_time

local allowed = 0
local retry_after = 0

if tokens >= 1 then
    tokens = tokens - 1
    allowed = 1
else
    retry_after = math.ceil((1 - tokens) / refill_rate)
end

-- Persist updated bucket
redis.call(
    "HSET",
    key,
    "tokens", tostring(tokens),
    "lastRefill", tostring(lastRefill)
)

-- Set expiration
redis.call("EXPIRE", key, ttl)

-- Time until bucket becomes full
local reset_seconds = math.ceil(
    (capacity - tokens) / refill_rate
)

-- Return decision
return {
    allowed,
    tokens,
    retry_after,
    reset_seconds
}
