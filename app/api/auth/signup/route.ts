import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { signupSchema } from '@/lib/validators/auth';
import { sendPlatformEmail } from '@/lib/notifications/tenant-email';
import { APP_NAME, APP_URL } from '@/lib/env';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // Platform owner can close signups globally (Admin → Platform).
  const platform = await db.platformSettings.findUnique({
    where: { id: 'singleton' },
    select: { signupEnabled: true },
  });
  if (platform && !platform.signupEnabled) {
    return NextResponse.json({ error: 'signups_disabled' }, { status: 403 });
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

  // Welcome email — fire-and-forget so a slow/unconfigured mailer never blocks
  // or fails signup. No-op when the email channel isn't configured.
  void sendPlatformEmail({
    to: normalizedEmail,
    subject: `Welcome to ${APP_NAME}`,
    heading: `Welcome, ${name} 👋`,
    intro:
      `Your account is ready.\n` +
      `Sign in to set up your company and hire your first AI employees — a full team across every department, working autonomously.`,
    cta: { label: 'Get started', url: `${APP_URL}/login` },
    footnote: 'If you didn’t create this account, you can safely ignore this email.',
  }).catch((err) => console.error('[signup] welcome email failed:', err));

  return NextResponse.json({ ok: true }, { status: 201 });
}
