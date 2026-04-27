import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { signupSchema } from '@/lib/validators/auth';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    const code = parsed.error.issues[0]?.path[0];
    const map: Record<string, string> = {
      name: 'nameRequired',
      email: 'invalidEmail',
      password: 'weakPassword',
    };
    return NextResponse.json(
      { error: map[String(code)] ?? 'generic' },
      { status: 400 }
    );
  }

  const { name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: 'emailExists' }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);
  await db.user.create({
    data: {
      name,
      email: normalizedEmail,
      password: hashed,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
