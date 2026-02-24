"use client";

import { useState, useEffect, useCallback } from "react";
import { WizardShell } from "@/components/deploy-wizard/wizard-shell";
import { StepGcpProject } from "@/components/deploy-wizard/step-gcp-project";
import { StepBranding } from "@/components/deploy-wizard/step-branding";
import { StepPlugins } from "@/components/deploy-wizard/step-plugins";
import { StepSkills } from "@/components/deploy-wizard/step-skills";
import { StepApiKeys } from "@/components/deploy-wizard/step-api-keys";
import { StepConfirm } from "@/components/deploy-wizard/step-confirm";
import type { BrandingConfig, ModelsConfig } from "@dynoclaw/shared";

export interface WizardState {
  gcpProjectId: string;
  gcpZone: string;
  vmName: string;
  machineType: string;
  branding: BrandingConfig;
  models: ModelsConfig;
  plugins: Record<string, boolean>;
  skills: Record<string, boolean>;
  apiKeys: Record<string, string>;
}

const STORAGE_KEY = "claw-deploy-wizard";

const defaultState: WizardState = {
  gcpProjectId: "",
  gcpZone: "us-central1-a",
  vmName: "openclaw-vm",
  machineType: "e2-small",
  branding: { botName: "Claw", personality: "A helpful AI teammate" },
  models: {
    primary: "google/gemini-2.5-flash",
    fallbacks: ["anthropic/claude-sonnet-4-5-20250929", "openai/gpt-4o-mini"],
  },
  plugins: {},
  skills: {},
  apiKeys: {},
};

function loadSavedState(): { state: WizardState; step: number } {
  if (typeof window === "undefined") return { state: defaultState, step: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return {
        state: { ...defaultState, ...saved.state, apiKeys: {} },
        step: saved.step ?? 0,
      };
    }
  } catch {
    // Corrupted data — start fresh
  }
  return { state: defaultState, step: 0 };
}

const steps = [
  { id: "gcp", label: "GCP Project" },
  { id: "branding", label: "Branding" },
  { id: "plugins", label: "Plugins" },
  { id: "skills", label: "Skills" },
  { id: "api-keys", label: "API Keys" },
  { id: "confirm", label: "Confirm" },
];

export default function DeployPage() {
  const [initialized, setInitialized] = useState(false);
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(defaultState);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = loadSavedState();
    setState(saved.state);
    setStep(saved.step);
    setInitialized(true);
  }, []);

  // Save to localStorage on every change
  useEffect(() => {
    if (!initialized) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { ...state, apiKeys: {} }, step }));
    } catch {
      // Storage full or unavailable
    }
  }, [state, step, initialized]);

  const update = useCallback(
    (patch: Partial<WizardState>) =>
      setState((prev) => ({ ...prev, ...patch })),
    []
  );

  const handleStepChange = useCallback((newStep: number) => {
    setStep(newStep);
  }, []);

  const stepComponents = [
    <StepGcpProject key="gcp" state={state} update={update} />,
    <StepBranding key="branding" state={state} update={update} />,
    <StepPlugins key="plugins" state={state} update={update} />,
    <StepSkills key="skills" state={state} update={update} />,
    <StepApiKeys key="api-keys" state={state} update={update} />,
    <StepConfirm key="confirm" state={state} />,
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Deploy Your Teammate</h1>

      <WizardShell
        steps={steps}
        currentStep={step}
        onStepChange={handleStepChange}
        state={state}
      >
        {stepComponents[step]}
      </WizardShell>
    </div>
  );
}
