"use client";

import { useOptimistic, useState, useTransition } from "react";
import { CheckIcon, ChevronRightIcon, ExternalLinkIcon, PlusIcon } from "@/components/icons";
import { PhotoUpload } from "@/components/PhotoUpload";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { ListGroup, Section } from "@/components/ui/Card";
import { Field, FormError, MoneyInput, Segmented, Select, TextArea, TextInput } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/Sheet";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useFormAction } from "@/components/ui/useFormAction";
import { undoKey } from "@/components/undo/keys";
import { formRunner, useUndo } from "@/components/undo/UndoProvider";
import { cn } from "@/lib/cn";
import { GEAR_CATEGORIES, type GearCategory, type GearStatus, type ItemPriority } from "@/lib/finance/goal";
import { formatEur, type Cents } from "@/lib/finance/money";
import { GEAR_CATEGORY_LABEL, PRIORITY_LABEL } from "@/lib/labels";
import { deleteGearItemAction, saveGearItemAction, toggleGearBoughtAction } from "./actions";

export interface GearRow {
  id: string;
  name: string;
  priceCents: Cents;
  category: GearCategory;
  priority: ItemPriority;
  status: GearStatus;
  storeUrl: string | null;
  notes: string | null;
  photoUrl: string | null;
  /** Ex.: "comprado a 12 de março" (calculado no servidor). */
  purchasedLabel: string | null;
}

type Filter = "to_buy" | "bought" | "all";

const FILTERS = [
  { value: "to_buy", label: "Por comprar" },
  { value: "bought", label: "Comprados" },
  { value: "all", label: "Todos" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "essential", label: "Essencial" },
  { value: "later", label: "Depois" },
] as const;

const STATUS_OPTIONS = [
  { value: "to_buy", label: "Por comprar" },
  { value: "bought", label: "Comprado" },
] as const;

export function GearList({ items, userId }: { items: GearRow[]; userId: string }) {
  const [filter, setFilter] = useState<Filter>("to_buy");
  const [editing, setEditing] = useState<GearRow | "new" | null>(null);
  const { hidden, remove } = useUndo();
  const [optimisticItems, setOptimisticStatus] = useOptimistic(items, (current, change: { id: string; status: GearStatus }) =>
    current.map((item) => (item.id === change.id ? { ...item, status: change.status } : item)),
  );

  const visible = optimisticItems
    .filter((item) => !hidden.has(undoKey.gear(item.id)))
    .filter((item) => filter === "all" || item.status === filter)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "to_buy" ? -1 : 1;
      if (a.priority !== b.priority) return a.priority === "essential" ? -1 : 1;
      return 0;
    });

  const close = () => setEditing(null);
  const deleteItem = (item: GearRow) => {
    close();
    remove({ label: `"${item.name}" apagado`, keys: [undoKey.gear(item.id)], run: formRunner(deleteGearItemAction, { id: item.id }) });
  };

  return (
    <>
      <Section title="Itens">
        <Segmented name="filter" options={FILTERS} defaultValue={filter} onChange={setFilter} />
        <ListGroup className="mt-3">
          {visible.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted">
              {filter === "bought" ? "Ainda não compraste nada." : "Nada por comprar."}
            </p>
          )}
          {visible.map((item) => (
            <div key={item.id} className="flex items-center gap-1 pl-2">
              <ToggleBought item={item} onToggle={setOptimisticStatus} />
              <button
                type="button"
                onClick={() => setEditing(item)}
                className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 pr-3.5 text-left outline-none focus-visible:bg-card-2 active:opacity-70"
              >
                {item.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.photoUrl}
                    alt=""
                    loading="lazy"
                    className={cn(
                      "h-11 w-11 shrink-0 rounded-xl border border-white/10 object-cover",
                      item.status === "bought" && "opacity-50",
                    )}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-[0.9375rem] font-semibold",
                      item.status === "bought" && "text-muted line-through decoration-1",
                    )}
                  >
                    {item.name}
                  </p>
                  {item.status === "bought" ? (
                    <p className="mt-0.5 text-xs text-muted">
                      {GEAR_CATEGORY_LABEL[item.category]}
                      {item.purchasedLabel && ` · ${item.purchasedLabel}`}
                    </p>
                  ) : (
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span>{GEAR_CATEGORY_LABEL[item.category]}</span>
                      <Badge tone={item.priority === "essential" ? "accent" : "neutral"}>{PRIORITY_LABEL[item.priority]}</Badge>
                    </p>
                  )}
                </div>
                {item.priceCents > 0 ? (
                  <span className={cn("display text-[1.25rem]", item.status === "bought" && "text-muted")}>
                    {formatEur(item.priceCents)}
                  </span>
                ) : (
                  <Badge tone="warning">Sem preço</Badge>
                )}
                <ChevronRightIcon size={16} className="shrink-0 text-faint" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex min-h-14 w-full items-center gap-2 px-4 py-3.5 text-[0.9375rem] font-semibold text-accent outline-none focus-visible:bg-card-2 active:bg-card-2"
          >
            <PlusIcon size={18} /> Adicionar item
          </button>
        </ListGroup>
      </Section>

      <Sheet open={editing !== null} onClose={close} title={editing === "new" ? "Novo item" : "Editar item"}>
        {editing === "new" && <GearForm onDone={close} />}
        {editing && editing !== "new" && <GearForm item={editing} userId={userId} onDone={close} onDelete={() => deleteItem(editing)} />}
      </Sheet>
    </>
  );
}

function ToggleBought({ item, onToggle }: { item: GearRow; onToggle: (change: { id: string; status: GearStatus }) => void }) {
  const [, startTransition] = useTransition();
  const bought = item.status === "bought";
  const next: GearStatus = bought ? "to_buy" : "bought";

  return (
    <button
      type="button"
      aria-label={bought ? `Marcar ${item.name} como por comprar` : `Marcar ${item.name} como comprado`}
      aria-pressed={bought}
      onClick={() => {
        const form = new FormData();
        form.set("id", item.id);
        form.set("status", next);
        startTransition(async () => {
          onToggle({ id: item.id, status: next });
          await toggleGearBoughtAction(null, form);
        });
      }}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
          bought ? "border-accent bg-accent text-accent-fg" : "border-white/20",
        )}
      >
        {bought && <CheckIcon size={16} strokeWidth={3} />}
      </span>
    </button>
  );
}

function GearForm({ item, userId, onDone, onDelete }: { item?: GearRow; userId?: string; onDone: () => void; onDelete?: () => void }) {
  const { error, pending, formProps } = useFormAction(saveGearItemAction, onDone);

  return (
    <div className="space-y-4">
      {item && userId && <PhotoUpload userId={userId} target="gear" targetId={item.id} url={item.photoUrl} alt={item.name} />}
      <form {...formProps} className="space-y-4">
        {item && <input type="hidden" name="id" value={item.id} />}
        <Field label="Nome" htmlFor="name">
          <TextInput id="name" name="name" defaultValue={item?.name} placeholder="Ex.: Capacete" maxLength={100} required />
        </Field>
        <Field label="Preço" htmlFor="price">
          <MoneyInput id="price" name="price" defaultCents={item?.priceCents || null} />
        </Field>
        <Field label="Categoria" htmlFor="category">
          <Select id="category" name="category" defaultValue={item?.category ?? "protection"}>
            {GEAR_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {GEAR_CATEGORY_LABEL[category]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Prioridade" hint="Os essenciais entram no mínimo para começar a andar.">
          <Segmented name="priority" options={PRIORITY_OPTIONS} defaultValue={item?.priority ?? "essential"} />
        </Field>
        <Field label="Estado" hint="Os itens comprados deixam de contar para o que falta.">
          <Segmented name="status" options={STATUS_OPTIONS} defaultValue={item?.status ?? "to_buy"} />
        </Field>
        <Field label="Link da loja" htmlFor="store_url">
          <TextInput
            id="store_url"
            name="store_url"
            inputMode="url"
            autoCapitalize="none"
            defaultValue={item?.storeUrl ?? ""}
            placeholder="https://…"
          />
        </Field>
        {item?.storeUrl && (
          <a href={item.storeUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm", "w-full")}>
            Abrir loja <ExternalLinkIcon size={16} />
          </a>
        )}
        <Field label="Notas" htmlFor="notes">
          <TextArea id="notes" name="notes" defaultValue={item?.notes ?? ""} placeholder="Tamanho, cor, alternativas…" maxLength={1000} />
        </Field>
        <FormError error={error} />
        <SubmitButton pending={pending} size="lg" className="w-full">
          {item ? "Guardar" : "Adicionar item"}
        </SubmitButton>
      </form>
      {onDelete && (
        <Button variant="danger" className="w-full" onClick={onDelete}>
          Apagar item
        </Button>
      )}
    </div>
  );
}
