import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';

import { env } from '@/lib/env';
import { getStoredOAuthConfig } from '@/lib/platform-config';
import { prisma } from '@/lib/prisma';
import { logServerError, logServerEvent } from '@/lib/server-logger';

const credentialsProvider = Credentials({
  name: 'Email and password',
  credentials: {
    email: { label: 'Email', type: 'email' },
    password: { label: 'Password', type: 'password' },
  },
  async authorize(credentials) {
    const email = String(credentials?.email ?? '').trim().toLowerCase();
    const password = String(credentials?.password ?? '');

    if (!email || !password) {
      logServerError('auth.login.failed', 'validation_error', { status: 'failed' });
      return null;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      logServerError('auth.login.failed', 'auth_error', { status: 'failed' });
      return null;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      logServerError('auth.login.failed', 'auth_error', { status: 'failed', userId: user.id });
      return null;
    }

    logServerEvent('auth.login.succeeded', {
      status: 'success',
      userId: user.id,
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const oauth = await getStoredOAuthConfig();

  const googleProvider =
    oauth?.enabled && oauth.clientId && oauth.clientSecret
      ? Google({
          clientId: oauth.clientId,
          clientSecret: oauth.clientSecret,
          authorization: oauth.authUrl ? { url: oauth.authUrl } : undefined,
          token: oauth.tokenUrl ? oauth.tokenUrl : undefined,
          userinfo: oauth.userInfoUrl ? oauth.userInfoUrl : undefined,
        })
      : null;

  const providers = [
    credentialsProvider,
    ...(googleProvider ? [googleProvider] : []),
  ];

  return {
    adapter: PrismaAdapter(prisma),
    session: { strategy: 'jwt' },
    secret: env.nextAuthSecret,
    pages: {
      signIn: '/login',
    },
    providers,
    callbacks: {
      async session({ session, token, user }) {
        if (session.user) {
          session.user.id = user?.id ?? String(token.sub ?? '');
        }
        return session;
      },
    },
    trustHost: true,
  };
});
