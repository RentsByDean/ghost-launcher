import React, { type ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AppShell from './AppShell';
import { cookies as sessionCookies, verifySessionToken } from '../../lib/auth';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookies.SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session) redirect('/');
  return <AppShell>{children}</AppShell>;
}


