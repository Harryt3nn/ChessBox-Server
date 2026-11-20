/* apps/api/src/security/rateLimit.ts */

// small in-memory fixed-window rate limiter
// one API process on one Pi, so memory is enough -- if the API is ever scaled to
// several instances this would need a shared store (e.g. Redis)

interface Window {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private windows = new Map<string, Window>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {
    // sweep expired windows so the map can't grow forever
    const sweep = setInterval(() => this.sweep(), Math.max(windowMs, 60_000));
    sweep.unref();
  }

  /** records a hit for `key`; returns how many ms until it may retry, or 0 if allowed */
  hit(key: string, now = Date.now()): number {
    const current = this.windows.get(key);

    if (!current || current.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return 0;
    }

    current.count++;
    return current.count > this.max ? current.resetAt - now : 0;
  }

  reset(key: string) {
    this.windows.delete(key);
  }

  private sweep(now = Date.now()) {
    for (const [key, w] of this.windows) {
      if (w.resetAt <= now) this.windows.delete(key);
    }
  }
}

const MINUTE = 60_000;

export const limits = {
  global: new RateLimiter(300, MINUTE), // every request, per IP

  // proxies to Lichess / Chess.com -- keep well under their API limits
  connectByUser: new RateLimiter(10, 15 * MINUTE),

  // D26 (TUNE): password tries per IP + username, cleared on success so typos never lock you out
  login: new RateLimiter(10, 15 * MINUTE),
  register: new RateLimiter(5, 60 * MINUTE), // per IP
};

// per IP + username, so guessing one account from one machine is stopped without
// letting anyone lock the owner out everywhere; usernames are compared case-insensitively here
export const loginKey = (ip: string, username: string) => `${ip}|${username.toLowerCase()}`;
