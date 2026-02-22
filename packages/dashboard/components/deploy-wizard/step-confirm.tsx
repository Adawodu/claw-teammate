"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLUGIN_REGISTRY, SKILL_REGISTRY } from "@claw-teammate/shared";
import type { WizardState } from "@/app/(dashboard)/deploy/page";

interface Props {
  state: WizardState;
}

export function StepConfirm({ state }: Props) {
  const enabledPlugins = PLUGIN_REGISTRY.filter((p) => state.plugins[p.id]);
  const enabledSkills = SKILL_REGISTRY.filter((s) => state.skills[s.id]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Review & Deploy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Section title="GCP">
          <Row label="Project" value={state.gcpProjectId || "(not set)"} />
          <Row label="Zone" value={state.gcpZone} />
          <Row label="VM" value={state.vmName} />
          <Row label="Machine" value={state.machineType} />
        </Section>

        <Section title="Branding">
          <Row label="Name" value={state.branding.botName} />
          <Row label="Personality" value={state.branding.personality} />
          <Row label="Model" value={state.models.primary} />
        </Section>

        <Section title="Plugins">
          {enabledPlugins.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {enabledPlugins.map((p) => (
                <Badge key={p.id} variant="secondary">{p.name}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">None selected</p>
          )}
        </Section>

        <Section title="Skills">
          {enabledSkills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {enabledSkills.map((s) => (
                <Badge key={s.id} variant="secondary">{s.name}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">None selected</p>
          )}
        </Section>

        <Section title="API Keys">
          <p className="text-muted-foreground">
            {Object.keys(state.apiKeys).filter((k) => state.apiKeys[k]).length} keys configured
          </p>
        </Section>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 font-medium text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
