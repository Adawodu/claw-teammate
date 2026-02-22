"use client";

import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";

interface ApiKeyRowProps {
  secretName: string;
  maskedValue: string;
  rotatedAt?: number;
  onRotate: () => void;
}

export function ApiKeyRow({ secretName, maskedValue, rotatedAt, onRotate }: ApiKeyRowProps) {
  return (
    <tr className="border-b border-border/50">
      <td className="py-3 font-mono text-sm">{secretName}</td>
      <td className="py-3 font-mono text-sm text-muted-foreground">{maskedValue}</td>
      <td className="py-3 text-sm text-muted-foreground">
        {rotatedAt ? new Date(rotatedAt).toLocaleDateString() : "Never"}
      </td>
      <td className="py-3 text-right">
        <Button variant="ghost" size="sm" onClick={onRotate}>
          <RotateCw className="mr-1 h-3 w-3" />
          Rotate
        </Button>
      </td>
    </tr>
  );
}
