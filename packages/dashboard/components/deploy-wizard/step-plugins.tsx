"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PLUGIN_REGISTRY } from "@dynoclaw/shared";
import type { WizardState } from "@/app/(dashboard)/deploy/page";

interface Props {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}

export function StepPlugins({ state, update }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Plugins</CardTitle>
        <CardDescription>Select which plugins to enable</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {PLUGIN_REGISTRY.map((plugin) => (
          <div
            key={plugin.id}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div>
              <p className="text-sm font-medium">{plugin.name}</p>
              <p className="text-xs text-muted-foreground">{plugin.description}</p>
            </div>
            <Switch
              checked={state.plugins[plugin.id] ?? false}
              onCheckedChange={(checked) =>
                update({
                  plugins: { ...state.plugins, [plugin.id]: checked },
                })
              }
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
