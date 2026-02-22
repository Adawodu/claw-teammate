"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WizardState } from "@/app/(dashboard)/deploy/page";

interface WizardShellProps {
  steps: { id: string; label: string }[];
  currentStep: number;
  onStepChange: (step: number) => void;
  state: WizardState;
  children: React.ReactNode;
}

export function WizardShell({
  steps,
  currentStep,
  onStepChange,
  state,
  children,
}: WizardShellProps) {
  const router = useRouter();
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const isLast = currentStep === steps.length - 1;

  async function handleDeploy() {
    setDeploying(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch("/api/gcp/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        try { localStorage.removeItem("claw-deploy-wizard"); } catch {}
        if (data.warning) {
          setWarning(data.warning);
        } else {
          router.push("/deploy/progress");
        }
      } else {
        setError(data.error || `Deploy failed (${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="space-y-6">
      <nav className="flex gap-1 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => onStepChange(i)}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:flex-1",
              i === currentStep
                ? "bg-primary text-primary-foreground"
                : i < currentStep
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="min-h-[300px]">{children}</div>

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {warning && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
          <p className="font-medium">VM created, but:</p>
          <p>{warning}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => router.push("/")}
          >
            Go to Dashboard
          </Button>
        </div>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => onStepChange(currentStep - 1)}
          disabled={currentStep === 0}
        >
          Back
        </Button>

        {isLast ? (
          <Button onClick={handleDeploy} disabled={deploying}>
            {deploying ? "Deploying..." : "Deploy"}
          </Button>
        ) : (
          <Button onClick={() => onStepChange(currentStep + 1)}>Next</Button>
        )}
      </div>
    </div>
  );
}
