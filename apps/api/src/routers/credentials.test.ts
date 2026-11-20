import { beforeAll, describe, expect, it } from 'vitest';
import { appRouter } from './appRouter';
import { hashPassword, verifyPassword } from '../auth/password';
import { fakePrisma } from '../testing/fakePrisma';

// T19 / D26-D28: login + register rate limits, change password, change username.
// The limiters are module-wide, so each test uses its own IP to start from a clean count.

let ipCounter = 0;
const freshIp = () => `10.0.0.${++ipCounter}`;

let harryHash: string;
beforeAll(async () => {
  harryHash = await hashPassword('correct-horse');
});

function setup() {
  const db = fakePrisma([{ id: 'harry', username: 'harry', email: 'h@example.com', passwordHash: harryHash }, { id: 'taken', username: 'rival_9' }]);
  const ip = freshIp();
  const asGuest = appRouter.createCaller({ prisma: db.prisma, userId: null, ip });
  const asHarry = appRouter.createCaller({ prisma: db.prisma, userId: 'harry', ip });
  return { db, ip, asGuest, asHarry };
}

const failLogins = async (caller: ReturnType<typeof setup>['asGuest'], times: number) => {
  for (let i = 0; i < times; i++) {
    await expect(caller.auth.login({ username: 'harry', password: 'wrong-password' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  }
};

describe('login rate limit (D26)', () => {
  it('blocks the 11th try in 15 minutes for that IP + username, even with the right password', async () => {
    const { asGuest } = setup();
    await failLogins(asGuest, 10);
    await expect(asGuest.auth.login({ username: 'harry', password: 'correct-horse' })).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });

  it('only counts that IP: the same account from another IP can still sign in', async () => {
    const { db, asGuest } = setup();
    await failLogins(asGuest, 10);
    const elsewhere = appRouter.createCaller({ prisma: db.prisma, userId: null, ip: freshIp() });
    await expect(elsewhere.auth.login({ username: 'harry', password: 'correct-horse' })).resolves.toMatchObject({ user: { id: 'harry' } });
  });

  it('a successful login clears the count, so typos never add up to a lockout', async () => {
    const { asGuest } = setup();
    await failLogins(asGuest, 9);
    await asGuest.auth.login({ username: 'harry', password: 'correct-horse' });
    await failLogins(asGuest, 10);
  });

  it('treats usernames case-insensitively for the count', async () => {
    const { asGuest } = setup();
    await failLogins(asGuest, 10);
    await expect(asGuest.auth.login({ username: 'HARRY', password: 'whatever1' })).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });
});

describe('register rate limit (D26)', () => {
  it('allows 5 sign-ups per IP per hour, then refuses', async () => {
    const { asGuest } = setup();
    for (let i = 0; i < 5; i++) {
      await asGuest.auth.register({ email: `new${i}@example.com`, username: `newbie${i}`, password: 'password1' });
    }
    await expect(asGuest.auth.register({ email: 'six@example.com', username: 'newbie6', password: 'password1' }))
      .rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });
});

describe('user.changePassword (D28)', () => {
  it('stores a new hash when the current password is right', async () => {
    const { db, asHarry } = setup();
    await expect(asHarry.user.changePassword({ currentPassword: 'correct-horse', newPassword: 'battery-staple' })).resolves.toEqual({ ok: true });
    const stored = db.rows.find(r => r.id === 'harry')!.passwordHash;
    expect(await verifyPassword('battery-staple', stored)).toBe(true);
    expect(await verifyPassword('correct-horse', stored)).toBe(false);
  });

  it('refuses a wrong current password and keeps the old hash', async () => {
    const { db, asHarry } = setup();
    await expect(asHarry.user.changePassword({ currentPassword: 'nope-nope', newPassword: 'battery-staple' }))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Current password is incorrect' });
    expect(db.rows.find(r => r.id === 'harry')!.passwordHash).toBe(harryHash);
  });

  it('holds the new password to the password rules', async () => {
    const { asHarry } = setup();
    await expect(asHarry.user.changePassword({ currentPassword: 'correct-horse', newPassword: 'short' }))
      .rejects.toMatchObject({ code: 'BAD_REQUEST' }); // the readable message comes from the HTTP error formatter, which callers skip
  });

  it('shares the login limit, so the form is no faster for guessing than the login screen', async () => {
    const { asGuest, asHarry } = setup();
    await failLogins(asGuest, 10);
    await expect(asHarry.user.changePassword({ currentPassword: 'correct-horse', newPassword: 'battery-staple' }))
      .rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });

  it('needs a signed-in user', async () => {
    const { asGuest } = setup();
    await expect(asGuest.user.changePassword({ currentPassword: 'correct-horse', newPassword: 'battery-staple' }))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('says NOT_FOUND for a token whose account is gone (D13 signs the desktop out on this)', async () => {
    const { db, ip } = setup();
    const ghost = appRouter.createCaller({ prisma: db.prisma, userId: 'deleted', ip });
    await expect(ghost.user.changePassword({ currentPassword: 'correct-horse', newPassword: 'battery-staple' }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('user.changeUsername (D28)', () => {
  it('renames when the password is right, and the new name signs in', async () => {
    const { db, asHarry, asGuest } = setup();
    await expect(asHarry.user.changeUsername({ password: 'correct-horse', newUsername: 'harry_t' })).resolves.toEqual({ username: 'harry_t' });
    expect(db.rows.find(r => r.id === 'harry')!.username).toBe('harry_t');
    await expect(asGuest.auth.login({ username: 'harry_t', password: 'correct-horse' })).resolves.toMatchObject({ user: { id: 'harry' } });
  });

  it('refuses a wrong password and leaves the name alone', async () => {
    const { db, asHarry } = setup();
    await expect(asHarry.user.changeUsername({ password: 'nope-nope', newUsername: 'harry_t' }))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Current password is incorrect' });
    expect(db.rows.find(r => r.id === 'harry')!.username).toBe('harry');
  });

  // taken names are caught by the unique index (P2002 in the fake too), which also covers two people racing for one name
  it('refuses a name someone else has', async () => {
    const { asHarry } = setup();
    await expect(asHarry.user.changeUsername({ password: 'correct-horse', newUsername: 'rival_9' }))
      .rejects.toMatchObject({ code: 'CONFLICT', message: 'Username already taken' });
  });

  it('keeping the same name is a no-op, not a conflict with yourself', async () => {
    const { asHarry } = setup();
    await expect(asHarry.user.changeUsername({ password: 'correct-horse', newUsername: 'harry' })).resolves.toEqual({ username: 'harry' });
  });

  it('holds the new name to the username rules', async () => {
    const { asHarry } = setup();
    await expect(asHarry.user.changeUsername({ password: 'correct-horse', newUsername: 'no spaces!' }))
      .rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('user.me', () => {
  it('never sends the password hash', async () => {
    const { asHarry } = setup();
    const me = await asHarry.user.me();
    expect(me).toEqual({ id: 'harry', username: 'harry', email: 'h@example.com', lichessName: null, chesscomName: null });
  });
});
