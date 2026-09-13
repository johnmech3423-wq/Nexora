"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/state";

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <div className="py-16">
      <ErrorState
        title="This page hit an unexpected error"
        message="Something went wrong on our side. Your work is safe — try again."
        onRetry={reset}
      />
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
      {message}
    </div>
  );
}

export function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      Try again
    </Button>
  );
}
