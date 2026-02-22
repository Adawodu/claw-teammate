"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WizardState } from "@/app/(dashboard)/deploy/page";

interface Props {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}

export function StepBranding({ state, update }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Branding</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="botName">Bot Name</Label>
          <Input
            id="botName"
            value={state.branding.botName}
            onChange={(e) =>
              update({
                branding: { ...state.branding, botName: e.target.value },
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="personality">Personality</Label>
          <Input
            id="personality"
            value={state.branding.personality}
            onChange={(e) =>
              update({
                branding: { ...state.branding, personality: e.target.value },
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="primaryModel">Primary Model</Label>
          <Input
            id="primaryModel"
            value={state.models.primary}
            onChange={(e) =>
              update({
                models: { ...state.models, primary: e.target.value },
              })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
