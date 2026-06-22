import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getGroupDetail } from "@/lib/groups";
import { formatDate, pluralize } from "@/lib/format";
import { GroupContactsTable } from "@/components/contacts/group-contacts-table";

export const dynamic = "force-dynamic";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const detail = await getGroupDetail(groupId);
  if (!detail) notFound();

  const { group, contacts } = detail;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link
          href="/contacts"
          className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          Contacts
        </Link>

        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl tracking-tight">{group.name}</h1>
          <p className="text-muted-foreground text-sm">
            {pluralize(contacts.length, "contact")}
            {group.sourceFilename && (
              <span className="opacity-60"> · {group.sourceFilename}</span>
            )}
            <span className="opacity-60"> · Uploaded {formatDate(group.createdAt)}</span>
          </p>
        </div>
      </div>

      <GroupContactsTable contacts={contacts} />
    </div>
  );
}
