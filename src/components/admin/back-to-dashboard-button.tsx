"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackToDashboardButton() {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Use replace to avoid adding to history, or push for normal navigation
    router.push("/admin-dashboard");
  };

  return (
    <div className="relative z-20 pointer-events-auto">
      <Button
        variant="outline"
        size="sm"
        className="gap-2 relative z-20 pointer-events-auto"
        onClick={handleClick}
        type="button"
        style={{ position: "relative", zIndex: 20 }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Button>
    </div>
  );
}

