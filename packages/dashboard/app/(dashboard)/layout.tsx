"use client";

import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
} from "@clerk/nextjs";
import { Sidebar, MobileNav } from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SignedOut>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
          <h1 className="text-2xl font-bold">Claw Teammate</h1>
          <p className="text-center text-sm text-muted-foreground">
            Sign in to manage your AI teammate
          </p>
          <div className="flex gap-2">
            <SignInButton mode="modal">
              <button className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                Sign up
              </button>
            </SignUpButton>
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <div className="flex h-screen flex-col md:flex-row">
          <Sidebar />
          <MobileNav />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </SignedIn>
    </>
  );
}
