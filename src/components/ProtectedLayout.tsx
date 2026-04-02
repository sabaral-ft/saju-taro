'use client';
import AuthGate from './AuthGate';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
