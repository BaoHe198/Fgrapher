"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { REPORT_REASONS } from "@/lib/constants";

const REASONS: string[] = [...REPORT_REASONS];

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: "review" | "user" | "message" | "product";
  targetId: string;
}

export function ReportModal({ open, onOpenChange, targetType, targetId }: ReportModalProps) {
  const [reason, setReason] = useState(REASONS[0]);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async () => {
    setIsSubmitting(true);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason, description: description || undefined }),
    });
    setIsSubmitting(false);

    if (res.ok) {
      toast.add({ title: "Report submitted", type: "success" });
      onOpenChange(false);
      setDescription("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this {targetType}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <NativeSelect
            label="Reason"
            value={reason}
            onChange={setReason}
            options={REASONS}
          />
          <Textarea
            placeholder="Additional details (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isSubmitting} onClick={onSubmit}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
