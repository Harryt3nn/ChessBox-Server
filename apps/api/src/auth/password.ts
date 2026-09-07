/* apps/api/src/auth/password.ts */


import { argon2id, argon2Verify } from "hash-wasm";
import { randomBytes } from "node:crypto";


/**
 * Argon2id parameters.
 * memorySize is in KiB (65536 = 64 MB). Tune iterations/memorySize based on
 * your server's hardware — these are OWASP-recommended minimums for argon2id.
 */


const ARGON2_PARAMS = {
  parallelism: 1,
  iterations: 3,
  memorySize: 65536,
  hashLength: 32,
  saltLength: 16,
} as const;


/**
 * Hashes a plaintext password with a fresh random salt.
 * Returns a self-contained PHC-formatted string
 * (e.g. "$argon2id$v=19$m=65536,t=3,p=1$<salt>$<hash>")
 * that stores the salt and params alongside the hash, so it's safe to
 * store this single string directly in the `passwordHash` column.
 */


export async function hashPassword(password: string): Promise<string> {
  if (password.length === 0) {
    throw new Error("Password must not be empty");
  }

  const salt = randomBytes(ARGON2_PARAMS.saltLength);

  return argon2id({
    password,
    salt,
    parallelism: ARGON2_PARAMS.parallelism,
    iterations: ARGON2_PARAMS.iterations,
    memorySize: ARGON2_PARAMS.memorySize,
    hashLength: ARGON2_PARAMS.hashLength,
    outputType: "encoded",
  });
}


/**
 * Verifies a plaintext password against a stored PHC-formatted hash.
 * Never throws on bad input — a malformed hash or wrong password both
 * just resolve to `false`, so callers can treat auth failure uniformly.
 */


export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    return await argon2Verify({ password, hash: storedHash });
  } catch {
    return false;
  }
}