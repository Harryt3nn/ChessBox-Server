/* apps/api/src/testing/fakePrisma.ts */

import { Prisma } from '../generated/prisma/client';
import type { Context } from '../trpc';

// just enough of prisma.user for the routers, backed by an array, so router tests run without Postgres

interface UserRow {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  lichessName: string | null;
  chesscomName: string | null;
}

type Where = Partial<Pick<UserRow, 'id' | 'username' | 'email'>>;

const matches = (row: UserRow, where: Where) =>
  Object.entries(where).every(([key, value]) => row[key as keyof UserRow] === value);

function pick(row: UserRow, select?: Record<string, boolean>) {
  if (!select) return { ...row };
  return Object.fromEntries(Object.keys(select).filter(k => select[k]).map(k => [k, row[k as keyof UserRow]]));
}

export function fakePrisma(seed: Partial<UserRow>[] = []) {
  const rows: UserRow[] = seed.map((r, i) => ({
    id: `user-${i}`,
    username: `user${i}`,
    email: `user${i}@example.com`,
    passwordHash: '',
    createdAt: new Date(0),
    lichessName: null,
    chesscomName: null,
    ...r,
  }));

  const uniqueClash = (data: Partial<UserRow>, self?: UserRow) =>
    rows.some(r => r !== self && ((data.username && r.username === data.username) || (data.email && r.email === data.email)));
  const p2002 = () => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });

  const user = {
    findUnique: async ({ where, select }: { where: Where; select?: Record<string, boolean> }) => {
      const row = rows.find(r => matches(r, where));
      return row ? pick(row, select) : null;
    },
    findFirst: async ({ where }: { where: { OR: Where[] } }) => rows.find(r => where.OR.some(w => matches(r, w))) ?? null,
    create: async ({ data }: { data: Omit<UserRow, 'id' | 'createdAt' | 'lichessName' | 'chesscomName'> }) => {
      if (uniqueClash(data)) throw p2002();
      const row = { id: `user-${rows.length}`, createdAt: new Date(), lichessName: null, chesscomName: null, ...data };
      rows.push(row);
      return row;
    },
    update: async ({ where, data }: { where: Where; data: Partial<UserRow> }) => {
      const row = rows.find(r => matches(r, where));
      if (!row) throw new Error('Record to update not found');
      if (uniqueClash(data, row)) throw p2002();
      Object.assign(row, data);
      return row;
    },
  };

  return { rows, prisma: { user } as unknown as Context['prisma'] };
}
