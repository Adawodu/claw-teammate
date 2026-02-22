"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WizardState } from "@/app/(dashboard)/deploy/page";

interface Props {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}

export function StepGcpProject({ state, update }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">GCP Project</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="projectId">Project ID</Label>
          <Input
            id="projectId"
            placeholder="my-gcp-project"
            value={state.gcpProjectId}
            onChange={(e) => update({ gcpProjectId: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zone">Zone</Label>
          <Input
            id="zone"
            value={state.gcpZone}
            onChange={(e) => update({ gcpZone: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vmName">VM Name</Label>
          <Input
            id="vmName"
            value={state.vmName}
            onChange={(e) => update({ vmName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="machineType">Machine Type</Label>
          <Input
            id="machineType"
            value={state.machineType}
            onChange={(e) => update({ machineType: e.target.value })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
