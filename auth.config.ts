import type { NextAuthConfig } from 'next-auth'

// Edge-compatible config — no Node.js dependencies.
// Credentials provider and Prisma are added in lib/auth.ts (Node.js only).
export default {
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = user.role
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      return session
    },
  },
} satisfies NextAuthConfig