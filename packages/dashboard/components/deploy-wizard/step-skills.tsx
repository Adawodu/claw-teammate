"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { SKILL_REGISTRY } from "@claw-teammate/shared";
import type { WizardState } from "@/app/(dashboard)/deploy/page";

interface Props {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}

export function StepSkills({ state, update }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Skills</CardTitle>
        <CardDescription>Select which skills to enable</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {SKILL_REGISTRY.map((skill) => {
          const missingPlugins = skill.requiredPlugins.filter(
            (p) => !state.plugins[p]
          );
          const disabled = missingPlugins.length > 0;

          return (
            <div
              key={skill.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div>
                <p className="text-sm font-medium">{skill.name}</p>
                <p className="text-xs text-muted-foreground">{skill.description}</p>
                {skill.cron && (
                  <Badge variant="secondary" className="mt-1 text-xs font-mono">
                    {skill.cronDescription}
                  </Badge>
                )}
                {disabled && (
                  <p className="mt-1 text-xs text-destructive">
                    Requires: {missingPlugins.join(", ")}
                  </p>
                )}
              </div>
              <Switch
                checked={state.skills[skill.id] ?? false}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  update({
                    skills: { ...state.skills, [skill.id]: checked },
                  })
                }
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
