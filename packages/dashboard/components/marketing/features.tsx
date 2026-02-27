import { Card, CardContent } from "@/components/ui/card";
import { Cloud, Puzzle, Zap, Shield, Mail } from "lucide-react";

const features = [
  {
    icon: Cloud,
    title: "GCP Deploy",
    description:
      "One-click deployment to your own GCP project. Your data stays in your cloud — always.",
  },
  {
    icon: Puzzle,
    title: "Plugin Ecosystem",
    description:
      "Postiz, Beehiiv, Twitter research, Brave Search, and more. Extend your teammate with community plugins.",
  },
  {
    icon: Zap,
    title: "Skill Scheduling",
    description:
      "Cron-powered skills that run automatically — content generation, research, reporting on your schedule.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description:
      "API keys stored in GCP Secret Manager, Clerk auth, draft-only publishing, and full audit logs.",
  },
  {
    icon: Mail,
    title: "Email Assistant",
    description:
      "Draft emails with attachments via Telegram. DynoSist creates Gmail drafts — you review and send.",
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-24">
      <div className="mb-16 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">
          Everything you need for an{" "}
          <span className="gradient-brand-text">AI-powered workflow</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          DynoClaw combines deployment, orchestration, and enterprise controls
          into a single platform.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {features.map((f) => (
          <Card key={f.title} className="border-border/50 bg-card/50 backdrop-blur">
            <CardContent className="flex gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <f.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {f.description}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
