import { AlertTriangle, LoaderCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

export function LoadingState({ label }: { label: string }) {
  return (
    <Card className="border-white/12">
      <CardContent className="flex min-h-[16rem] flex-col items-center justify-center gap-4 text-center">
        <LoaderCircle className="size-8 animate-spin text-[var(--accent)]" />
        <div>
          <CardTitle>{label}</CardTitle>
          <CardDescription>Fetching the latest scan and triage state.</CardDescription>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card className="border-dashed border-white/12 bg-white/[0.025]">
      <CardContent className="flex min-h-[16rem] flex-col items-center justify-center gap-4 text-center">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{body}</CardDescription>
        </div>
      </CardContent>
    </Card>
  );
}

export function ErrorState({ error }: { error: Error }) {
  return (
    <Card className="border-[var(--danger)]/25">
      <CardContent className="flex min-h-[16rem] flex-col items-center justify-center gap-4 text-center">
        <AlertTriangle className="size-8 text-[var(--danger)]" />
        <div>
          <CardTitle>Dashboard error</CardTitle>
          <CardDescription>{error.message}</CardDescription>
        </div>
      </CardContent>
    </Card>
  );
}
