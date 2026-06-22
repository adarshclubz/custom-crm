"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Users,
  User,
  Mail,
  Search,
  Loader2,
  Settings as SettingsIcon,
  AlertTriangle,
  Send,
  PartyPopper,
  UploadCloud,
  Info,
  Plus,
  Trash2,
  Clock,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TypeChip } from "@/components/status/type-chip";
import { CsvDropzone, type CsvParseResult } from "@/components/csv-dropzone";
import { MergeBlockError } from "@/components/campaigns/merge-block-error";
import { ScheduleSendButton } from "@/components/campaigns/schedule-send-button";
import {
  validateBulk,
  extractTags,
  MERGE_FIELDS,
  type RenderableContact,
  type BulkValidation,
} from "@/lib/templates";

type CampaignType = "bulk" | "single";
type AudienceSource = "group" | "csv";

interface GroupSummary {
  id: string;
  name: string;
  contactCount: number;
}
interface GroupContact extends RenderableContact {
  tags?: string[];
}

// An automated follow-up step: "wait N days, if no reply, send this message."
// Ordered, unlimited. Armed on send; dispatched by the follow-up worker.
interface SequenceStep {
  id: string;
  waitDays: number;
  body: string;
}

const STEPS = ["Name & type", "Audience", "Compose", "Review"] as const;

export function CreateCampaignWizard() {
  const [step, setStep] = React.useState(0);

  // Step 1
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<CampaignType | null>(null);

  // Step 2 — audience
  const [groups, setGroups] = React.useState<GroupSummary[]>([]);
  const [groupsLoading, setGroupsLoading] = React.useState(true);
  const [source, setSource] = React.useState<AudienceSource>("group");
  const [groupId, setGroupId] = React.useState<string | null>(null);
  const [contactsByGroup, setContactsByGroup] = React.useState<
    Record<string, GroupContact[]>
  >({});
  const [contactsLoading, setContactsLoading] = React.useState(false);
  const [csv, setCsv] = React.useState<CsvParseResult | null>(null);
  const [singleContactId, setSingleContactId] = React.useState<string | null>(
    null
  );
  const [contactSearch, setContactSearch] = React.useState("");
  // Single campaigns: "new" (type a fresh recipient — the common case) or
  // "existing" (pick from a group). New contacts are created on send.
  const [singleMode, setSingleMode] = React.useState<"new" | "existing">("new");
  const [newEmail, setNewEmail] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [newCompany, setNewCompany] = React.useState("");

  // Step 3 — compose
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const subjectRef = React.useRef<HTMLInputElement>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  const lastFocused = React.useRef<"subject" | "body">("body");

  // Automated follow-up sequence (optional, unlimited steps).
  const [sequence, setSequence] = React.useState<SequenceStep[]>([]);
  function addStep() {
    setSequence((prev) => [
      ...prev,
      { id: crypto.randomUUID(), waitDays: 3, body: "" },
    ]);
  }
  function updateStep(id: string, patch: Partial<SequenceStep>) {
    setSequence((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }
  function removeStep(id: string) {
    setSequence((prev) => prev.filter((s) => s.id !== id));
  }

  // Step 4 — send
  const [gmail, setGmail] = React.useState<
    { connected: boolean; email?: string } | null
  >(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  // When the user picks a time via the schedule panel, hold the ISO here until
  // they confirm. null = a plain "send now".
  const [pendingSchedule, setPendingSchedule] = React.useState<string | null>(null);
  // Set on a successful scheduled send so the success panel reads "scheduled".
  const [scheduledFor, setScheduledFor] = React.useState<string | null>(null);
  const [blocked, setBlocked] = React.useState<BulkValidation | null>(null);
  const [done, setDone] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);

  // Load groups + gmail status once.
  React.useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.json())
      .then((d) => setGroups(d.groups ?? []))
      .finally(() => setGroupsLoading(false));
    fetch("/api/gmail/status")
      .then((r) => r.json())
      .then(setGmail)
      .catch(() => setGmail({ connected: false }));
  }, []);

  // Fetch a group's contacts on demand.
  const loadGroupContacts = React.useCallback(
    async (id: string) => {
      if (contactsByGroup[id]) return;
      setContactsLoading(true);
      try {
        const d = await fetch(`/api/groups/${id}`).then((r) => r.json());
        const contacts: GroupContact[] = (d.contacts ?? []).map(
          (c: { id: string; email: string; name: string | null; company: string | null }) => ({
            id: c.id,
            email: c.email,
            name: c.name,
            company: c.company,
          })
        );
        setContactsByGroup((prev) => ({ ...prev, [id]: contacts }));
      } finally {
        setContactsLoading(false);
      }
    },
    [contactsByGroup]
  );

  function selectGroup(id: string) {
    setGroupId(id);
    setSingleContactId(null);
    loadGroupContacts(id);
  }

  // The resolved audience for validation + counts.
  const audience: RenderableContact[] = React.useMemo(() => {
    if (type === "single") {
      if (singleMode === "new") {
        const email = newEmail.trim().toLowerCase();
        if (!email || !email.includes("@")) return [];
        return [
          {
            id: `new:${email}`,
            email,
            name: newName.trim() || null,
            company: newCompany.trim() || null,
          },
        ];
      }
      const list = groupId ? contactsByGroup[groupId] ?? [] : [];
      const c = list.find((x) => x.id === singleContactId);
      return c ? [c] : [];
    }
    if (source === "csv") {
      return (csv?.rows ?? []).map((r) => ({
        id: r.email,
        email: r.email,
        name: r.name,
        company: r.company,
      }));
    }
    return groupId ? contactsByGroup[groupId] ?? [] : [];
  }, [
    type,
    source,
    groupId,
    contactsByGroup,
    singleContactId,
    csv,
    singleMode,
    newEmail,
    newName,
    newCompany,
  ]);

  const usedTags = React.useMemo(
    () => extractTags(subject, body),
    [subject, body]
  );
  const unknownUsedTags = usedTags.filter(
    (t) => !MERGE_FIELDS.includes(t as (typeof MERGE_FIELDS)[number])
  );

  // Per-step gating.
  const canNext = (() => {
    if (step === 0) return name.trim().length > 0 && type !== null;
    if (step === 1) return audience.length > 0;
    if (step === 2) return subject.trim().length > 0 && body.trim().length > 0;
    return true;
  })();

  function insertTag(tag: string) {
    const field = lastFocused.current;
    const el = field === "subject" ? subjectRef.current : bodyRef.current;
    const value = field === "subject" ? subject : body;
    const setter = field === "subject" ? setSubject : setBody;
    const token = `{{${tag}}}`;
    if (!el) {
      setter(value + token);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    setter(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  // Resolve the audience to real DB contact ids: create a one-off contact for
  // single-"new", import the CSV (creating a group) for bulk-csv, otherwise the
  // audience already holds real ids (group source / existing single).
  async function resolveContactIds(): Promise<string[]> {
    if (type === "single") {
      if (singleMode === "new") {
        const res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newName.trim() || undefined,
            email: newEmail.trim(),
            company: newCompany.trim() || undefined,
          }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Failed to create contact");
        return [d.id];
      }
      return singleContactId ? [singleContactId] : [];
    }
    if (source === "csv") {
      if (!csv) return [];
      const fd = new FormData();
      fd.append("file", csv.file);
      const res = await fetch("/api/contacts/import", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to import CSV");
      const group = await fetch(`/api/groups/${d.groupId}`).then((r) => r.json());
      return (group.contacts ?? []).map((c: { id: string }) => c.id);
    }
    return audience.map((a) => a.id); // group source — already real ids
  }

  async function attemptSend(scheduledAt?: string) {
    setConfirmOpen(false);
    setSendError(null);
    // Instant client-side merge check for bulk (server re-validates authoritatively).
    if (type === "bulk") {
      const validation = validateBulk(subject, body, audience);
      if (!validation.ok) {
        setBlocked(validation);
        return;
      }
    }
    setBlocked(null);
    setSending(true);
    try {
      const contactIds = await resolveContactIds();
      if (contactIds.length === 0) throw new Error("No recipients to send to");

      const createRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          subject,
          body,
          contactIds,
          followups: sequence.map((s) => ({ waitDays: s.waitDays, body: s.body })),
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error ?? "Failed to create campaign");

      const sendRes = await fetch(`/api/campaigns/${createData.campaign.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scheduledAt ? { scheduledAt } : {}),
      });
      const sendData = await sendRes.json();
      if (sendRes.status === 422) {
        // Server merge-block — surface offenders in the same UI as the client check.
        setBlocked({
          ok: false,
          unknownTags: sendData.unknownTags ?? [],
          offenders: sendData.offenders ?? [],
        });
        return;
      }
      if (!sendRes.ok) throw new Error(sendData.error ?? "Failed to send campaign");

      if (scheduledAt) setScheduledFor(scheduledAt);
      setDone(true);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <SuccessPanel
        name={name}
        count={audience.length}
        type={type!}
        scheduledFor={scheduledFor}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link
          href="/campaigns"
          className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          Campaigns
        </Link>
        <h1 className="font-display text-3xl tracking-tight">Create campaign</h1>
      </div>

      <Stepper current={step} type={type} />

      <div className="border-border bg-card rounded-xl border p-6">
        {step === 0 && (
          <StepNameType
            name={name}
            setName={setName}
            type={type}
            setType={setType}
          />
        )}

        {step === 1 && (
          <StepAudience
            type={type!}
            groups={groups}
            groupsLoading={groupsLoading}
            source={source}
            setSource={setSource}
            groupId={groupId}
            selectGroup={selectGroup}
            csv={csv}
            setCsv={setCsv}
            contacts={groupId ? contactsByGroup[groupId] ?? [] : []}
            contactsLoading={contactsLoading}
            singleContactId={singleContactId}
            setSingleContactId={setSingleContactId}
            contactSearch={contactSearch}
            setContactSearch={setContactSearch}
            singleMode={singleMode}
            setSingleMode={setSingleMode}
            newEmail={newEmail}
            setNewEmail={setNewEmail}
            newName={newName}
            setNewName={setNewName}
            newCompany={newCompany}
            setNewCompany={setNewCompany}
          />
        )}

        {step === 2 && (
          <StepCompose
            type={type!}
            subject={subject}
            setSubject={setSubject}
            body={body}
            setBody={setBody}
            subjectRef={subjectRef}
            bodyRef={bodyRef}
            lastFocused={lastFocused}
            insertTag={insertTag}
            usedTags={usedTags}
            unknownUsedTags={unknownUsedTags}
            sequence={sequence}
            addStep={addStep}
            updateStep={updateStep}
            removeStep={removeStep}
          />
        )}

        {step === 3 && (
          <StepReview
            name={name}
            type={type!}
            count={audience.length}
            followupCount={sequence.length}
            source={type === "single" ? "group" : source}
            gmail={gmail}
            blocked={blocked}
            sending={sending}
            sendError={sendError}
            onEditTemplate={() => {
              setBlocked(null);
              setStep(2);
            }}
            onReupload={() => {
              setBlocked(null);
              setCsv(null);
              setStep(1);
            }}
            onSend={() => {
              setPendingSchedule(null);
              setConfirmOpen(true);
            }}
            onSchedule={(iso) => {
              setPendingSchedule(iso);
              setConfirmOpen(true);
            }}
          />
        )}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          Back
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            Continue
            <ArrowRight className="size-4" />
          </Button>
        ) : null}
      </div>

      {/* Send confirmation */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingSchedule ? "Schedule this campaign?" : "Send this campaign?"}
            </DialogTitle>
            <DialogDescription>
              {pluralize(audience.length, "recipient")} will be emailed
              {pendingSchedule
                ? ` on ${new Date(pendingSchedule).toLocaleString()}`
                : type === "bulk"
                  ? ", paced out over time for deliverability"
                  : ""}
              {type === "bulk" && pendingSchedule
                ? ", paced out over time for deliverability"
                : ""}
              . This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => attemptSend(pendingSchedule ?? undefined)}
              className="gap-1.5"
            >
              {pendingSchedule ? (
                <Clock className="size-4" />
              ) : (
                <Send className="size-4" />
              )}
              {pendingSchedule ? "Schedule" : "Send campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------- Stepper ----------------------------- */

function Stepper({
  current,
  type,
}: {
  current: number;
  type: CampaignType | null;
}) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const active = i === current;
        const complete = i < current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                active && "border-primary bg-primary text-primary-foreground",
                complete && "border-primary bg-primary/10 text-primary",
                !active && !complete && "border-border text-muted-foreground"
              )}
            >
              {complete ? <Check className="size-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                "hidden text-sm sm:inline",
                active ? "font-medium" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="bg-border mx-1 hidden h-px flex-1 sm:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* --------------------------- Step 1: type --------------------------- */

function StepNameType({
  name,
  setName,
  type,
  setType,
}: {
  name: string;
  setName: (v: string) => void;
  type: CampaignType | null;
  setType: (t: CampaignType) => void;
}) {
  const options: {
    value: CampaignType;
    icon: typeof Users;
    title: string;
  }[] = [
    {
      value: "bulk",
      icon: Users,
      title: "Bulk",
    },
    {
      value: "single",
      icon: User,
      title: "Single personalized",
    },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="campaign-name">Campaign name</Label>
        <Input
          id="campaign-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Q3 Cold Outreach"
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Type</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setType(o.value)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
                type === o.value
                  ? "border-primary bg-primary/5 ring-primary/20 ring-2"
                  : "border-border hover:border-primary/40 hover:bg-accent/40"
              )}
            >
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg",
                  type === o.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent text-primary"
                )}
              >
                <o.icon className="size-5" />
              </div>
              <span className="font-medium">{o.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Step 2: audience ------------------------- */

function StepAudience({
  type,
  groups,
  groupsLoading,
  source,
  setSource,
  groupId,
  selectGroup,
  csv,
  setCsv,
  contacts,
  contactsLoading,
  singleContactId,
  setSingleContactId,
  contactSearch,
  setContactSearch,
  singleMode,
  setSingleMode,
  newEmail,
  setNewEmail,
  newName,
  setNewName,
  newCompany,
  setNewCompany,
}: {
  type: CampaignType;
  groups: GroupSummary[];
  groupsLoading: boolean;
  source: AudienceSource;
  setSource: (s: AudienceSource) => void;
  groupId: string | null;
  selectGroup: (id: string) => void;
  csv: CsvParseResult | null;
  setCsv: (c: CsvParseResult | null) => void;
  contacts: GroupContact[];
  contactsLoading: boolean;
  singleContactId: string | null;
  setSingleContactId: (id: string) => void;
  contactSearch: string;
  setContactSearch: (v: string) => void;
  singleMode: "new" | "existing";
  setSingleMode: (m: "new" | "existing") => void;
  newEmail: string;
  setNewEmail: (v: string) => void;
  newName: string;
  setNewName: (v: string) => void;
  newCompany: string;
  setNewCompany: (v: string) => void;
}) {
  const groupList = (
    <div className="flex flex-col gap-2">
      {groupsLoading ? (
        <p className="text-muted-foreground text-sm">Loading groups…</p>
      ) : groups.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No groups yet — upload a CSV to create one.
        </p>
      ) : (
        groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => selectGroup(g.id)}
            className={cn(
              "flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
              groupId === g.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-accent/40"
            )}
          >
            <span className="font-medium">{g.name}</span>
            <span className="text-muted-foreground text-sm">
              {pluralize(g.contactCount, "contact")}
            </span>
          </button>
        ))
      )}
    </div>
  );

  if (type === "single") {
    const filtered = contacts.filter((c) => {
      const q = contactSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        c.email.toLowerCase().includes(q) ||
        (c.name ?? "").toLowerCase().includes(q)
      );
    });
    return (
      <div className="flex flex-col gap-5">
        <Segmented
          value={singleMode}
          onChange={(v) => setSingleMode(v as "new" | "existing")}
          options={[
            { value: "new", label: "New contact" },
            { value: "existing", label: "Existing contact" },
          ]}
        />
        {singleMode === "new" ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="person@company.com"
                autoFocus
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-name">Name</Label>
                <Input
                  id="new-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-company">Company</Label>
                <Input
                  id="new-company"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="Acme Inc."
                />
              </div>
            </div>
            <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Contact will be added
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label>Pick a group</Label>
              {groupList}
            </div>
            {groupId && (
          <div className="flex flex-col gap-2">
            <Label>Pick one contact</Label>
            {contactsLoading ? (
              <p className="text-muted-foreground text-sm">Loading contacts…</p>
            ) : (
              <>
                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                  <Input
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search contacts…"
                    className="pl-9"
                  />
                </div>
                <div className="border-border max-h-64 divide-y divide-border overflow-y-auto rounded-lg border">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSingleContactId(c.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                        singleContactId === c.id
                          ? "bg-primary/5"
                          : "hover:bg-accent/40"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 items-center justify-center rounded-full border",
                          singleContactId === c.id
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input"
                        )}
                      >
                        {singleContactId === c.id && (
                          <Check className="size-3" />
                        )}
                      </span>
                      <span className="flex flex-col">
                        <span className="font-medium">{c.name || c.email}</span>
                        {c.name && (
                          <span className="text-muted-foreground text-xs">
                            {c.email}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
          </div>
        )}
      </div>
    );
  }

  // bulk
  return (
    <div className="flex flex-col gap-4">
      {source === "group" ? (
        <>
          <Label>Choose a group</Label>
          {groupList}
          <button
            type="button"
            onClick={() => setSource("csv")}
            className="border-border hover:border-primary/40 hover:bg-accent/40 flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors"
          >
            <span className="flex items-center gap-2 font-medium">
              <UploadCloud className="text-primary size-4" />
              Upload a CSV
            </span>
            <span className="text-muted-foreground text-sm">New list</span>
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <Label>Upload a CSV</Label>
            <button
              type="button"
              onClick={() => {
                setSource("group");
                setCsv(null);
              }}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              ← Choose a group instead
            </button>
          </div>
          <CsvDropzone
            result={csv}
            onParsed={setCsv}
            onClear={() => setCsv(null)}
          />
        </>
      )}
      <CsvFormatHint />
    </div>
  );
}

/* ----------------------- Audience sub-helpers ----------------------- */

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="bg-muted inline-flex w-fit gap-1 rounded-lg p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CsvFormatHint() {
  return (
    <p className="text-muted-foreground flex items-start gap-1.5 rounded-lg border border-dashed p-3 text-xs">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>
        CSV format: a header row with{" "}
        <code className="text-foreground">name, email, company, tags</code>.
        Email is required; separate multiple tags with <code>;</code>.
      </span>
    </p>
  );
}

/* -------------------------- Step 3: compose ------------------------- */

function StepCompose({
  type,
  subject,
  setSubject,
  body,
  setBody,
  subjectRef,
  bodyRef,
  lastFocused,
  insertTag,
  usedTags,
  unknownUsedTags,
  sequence,
  addStep,
  updateStep,
  removeStep,
}: {
  type: CampaignType;
  subject: string;
  setSubject: (v: string) => void;
  body: string;
  setBody: (v: string) => void;
  subjectRef: React.RefObject<HTMLInputElement | null>;
  bodyRef: React.RefObject<HTMLTextAreaElement | null>;
  lastFocused: React.MutableRefObject<"subject" | "body">;
  insertTag: (t: string) => void;
  usedTags: string[];
  unknownUsedTags: string[];
  sequence: SequenceStep[];
  addStep: () => void;
  updateStep: (id: string, patch: Partial<SequenceStep>) => void;
  removeStep: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {type === "bulk" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">Insert tag:</span>
          {MERGE_FIELDS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => insertTag(f)}
              className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 rounded-md border px-2 py-0.5 font-mono text-xs"
            >
              {`{{${f}}}`}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          ref={subjectRef}
          value={subject}
          onFocus={() => (lastFocused.current = "subject")}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={type === "bulk" ? "Hi {{name}}" : "Subject"}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="body">Body</Label>
        <Textarea
          id="body"
          ref={bodyRef}
          value={body}
          onFocus={() => (lastFocused.current = "body")}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            type === "bulk"
              ? "Hi {{name}},\n\nI noticed {{company}} is…"
              : "Write your personalized email…"
          }
          className="min-h-48"
        />
        <p className="text-muted-foreground text-xs">Plain text. </p>
      </div>

      {type === "bulk" && usedTags.length > 0 && (
        <div className="text-sm">
          <span className="text-muted-foreground">Tags in use: </span>
          {usedTags.map((t) => (
            <code
              key={t}
              className={cn(
                "mr-1 rounded px-1",
                unknownUsedTags.includes(t)
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
              )}
            >{`{{${t}}}`}</code>
          ))}
          {unknownUsedTags.length > 0 && (
            <span className="text-destructive">
              {" "}
              — only {`{{name}}`} and {`{{company}}`} are supported.
            </span>
          )}
        </div>
      )}

      {/* Automated follow-up sequence — sent only if the contact doesn't reply. */}
      <div className="flex flex-col gap-3 border-t pt-5">
        {sequence.length > 0 && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium">Automated follow-ups</span>
            <span className="text-muted-foreground text-xs">
              sent only if there&apos;s no reply
            </span>
          </div>
        )}

        {sequence.map((step, i) => (
          <FollowUpStepCard
            key={step.id}
            index={i}
            step={step}
            type={type}
            onUpdate={(patch) => updateStep(step.id, patch)}
            onRemove={() => removeStep(step.id)}
          />
        ))}

        <button
          type="button"
          onClick={addStep}
          className="border-border hover:border-primary/40 hover:bg-accent/40 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-3 text-sm font-medium transition-colors"
        >
          <Plus className="text-primary size-4" />
          Add {sequence.length > 0 ? "another " : "a "}follow-up
        </button>

        {sequence.length > 0 && (
          <p className="text-muted-foreground text-xs">
            Sent automatically on the schedule above, in-thread — and stopped if
            the recipient replies.
          </p>
        )}
      </div>
    </div>
  );
}

/* -------------------- Step 3: follow-up step card ------------------- */

function FollowUpStepCard({
  index,
  step,
  type,
  onUpdate,
  onRemove,
}: {
  index: number;
  step: SequenceStep;
  type: CampaignType;
  onUpdate: (patch: Partial<SequenceStep>) => void;
  onRemove: () => void;
}) {
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  function insertTag(tag: string) {
    const el = bodyRef.current;
    const token = `{{${tag}}}`;
    if (!el) {
      onUpdate({ body: step.body + token });
      return;
    }
    const start = el.selectionStart ?? step.body.length;
    const end = el.selectionEnd ?? step.body.length;
    onUpdate({ body: step.body.slice(0, start) + token + step.body.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="border-border bg-muted/30 flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-primary/10 text-primary flex size-6 items-center justify-center rounded-full text-xs font-semibold">
            {index + 1}
          </span>
          <span className="text-sm font-medium">Follow-up {index + 1}</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive transition-colors"
          aria-label={`Remove follow-up ${index + 1}`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Clock className="text-muted-foreground size-4" />
        <span className="text-muted-foreground">Wait</span>
        <Input
          type="number"
          min={1}
          value={step.waitDays}
          onChange={(e) =>
            onUpdate({ waitDays: Math.max(1, Number(e.target.value) || 1) })
          }
          className="h-8 w-16 text-center"
        />
        <span className="text-muted-foreground">
          {step.waitDays === 1 ? "day" : "days"} after the previous email, if no
          reply
        </span>
      </div>

      {type === "bulk" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Insert tag:</span>
          {MERGE_FIELDS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => insertTag(f)}
              className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 rounded-md border px-2 py-0.5 font-mono text-xs"
            >
              {`{{${f}}}`}
            </button>
          ))}
        </div>
      )}

      <Textarea
        ref={bodyRef}
        value={step.body}
        onChange={(e) => onUpdate({ body: e.target.value })}
        placeholder={
          type === "bulk"
            ? "Hi {{name}}, just following up…"
            : "Write the follow-up email…"
        }
        className="bg-background min-h-28"
      />
    </div>
  );
}

/* -------------------------- Step 4: review -------------------------- */

function StepReview({
  name,
  type,
  count,
  followupCount,
  source,
  gmail,
  blocked,
  sending,
  sendError,
  onEditTemplate,
  onReupload,
  onSend,
  onSchedule,
}: {
  name: string;
  type: CampaignType;
  count: number;
  followupCount: number;
  source: AudienceSource;
  gmail: { connected: boolean; email?: string } | null;
  blocked: BulkValidation | null;
  sending: boolean;
  sendError: string | null;
  onEditTemplate: () => void;
  onReupload: () => void;
  onSend: () => void;
  onSchedule: (scheduledAtIso: string) => void;
}) {
  const notConnected = gmail !== null && !gmail.connected;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Row label="Campaign">
          <span className="font-medium">{name}</span>
        </Row>
        <Row label="Type">
          <TypeChip type={type} />
        </Row>
        <Row label="Recipients">
          <span className="font-medium tabular-nums">
            {pluralize(count, "recipient")}
          </span>
        </Row>
        {followupCount > 0 && (
          <Row label="Automated follow-ups">
            <span className="font-medium tabular-nums">
              {pluralize(followupCount, "step")}
            </span>
          </Row>
        )}
        <Row label="Sender">
          {gmail === null ? (
            <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Loader2 className="size-3.5 animate-spin" /> Checking…
            </span>
          ) : gmail.connected ? (
            <span className="flex items-center gap-1.5 text-sm">
              <Mail className="size-4" /> {gmail.email}
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">
              Not connected
            </span>
          )}
        </Row>
      </div>

      {notConnected && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            <span>Connect a Gmail account before you can send.</span>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/settings">
              <SettingsIcon className="size-3.5" />
              Settings
            </Link>
          </Button>
        </div>
      )}

      {type === "bulk" && !blocked && (
        <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
          Sends are <span className="text-foreground font-medium">paced out</span>{" "}
          over time for deliverability.
        </p>
      )}

      {blocked && (
        <MergeBlockError
          validation={blocked}
          source={source}
          onEditTemplate={onEditTemplate}
          onReupload={onReupload}
        />
      )}

      {sendError && (
        <p className="text-destructive text-sm">{sendError}</p>
      )}

      <ScheduleSendButton
        label={blocked ? "Retry send" : "Send campaign"}
        loadingLabel="Sending…"
        loading={sending}
        disabled={notConnected || count === 0}
        onSend={onSend}
        onSchedule={onSchedule}
      />
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-dashed pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      {children}
    </div>
  );
}

/* ----------------------------- Success ----------------------------- */

function SuccessPanel({
  name,
  count,
  type,
  scheduledFor,
}: {
  name: string;
  count: number;
  type: CampaignType;
  scheduledFor?: string | null;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-xl border px-6 py-16 text-center">
      <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-full">
        {scheduledFor ? (
          <Clock className="size-7" />
        ) : (
          <PartyPopper className="size-7" />
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-2xl tracking-tight">
          {scheduledFor ? `“${name}” is scheduled` : `“${name}” is ready`}
        </h2>
        <p className="text-muted-foreground text-sm">
          {scheduledFor
            ? `Will send to ${pluralize(count, "recipient")} on ${new Date(
                scheduledFor
              ).toLocaleString()}.`
            : `Validated and ready for ${pluralize(count, "recipient")}. ${
                type === "bulk"
                  ? "The campaign is created and the paced send has started."
                  : "The campaign is created and sent."
              }`}
        </p>
      </div>
      <Button asChild>
        <Link href="/campaigns">Back to campaigns</Link>
      </Button>
    </div>
  );
}
