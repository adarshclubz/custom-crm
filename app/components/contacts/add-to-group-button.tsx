"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ManualAddDialog } from "@/components/contacts/manual-add-dialog";

export function AddToGroupButton({
  groupId,
  groupName,
}: {
  groupId: string;
  groupName: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <UserPlus className="size-4" />
        Add contacts
      </Button>
      <ManualAddDialog
        open={open}
        onOpenChange={setOpen}
        target={{ mode: "append", groupId, groupName }}
      />
    </>
  );
}
