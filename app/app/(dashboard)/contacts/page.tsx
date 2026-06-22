import { listGroups } from "@/lib/groups";
import { GroupsBrowser } from "@/components/contacts/groups-browser";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const groups = await listGroups();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl tracking-tight">Contacts</h1>
        <p className="text-muted-foreground text-sm">
          Each CSV upload creates a group. Click a group to view its contacts.
        </p>
      </div>

      <GroupsBrowser groups={groups} />
    </div>
  );
}
