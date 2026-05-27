"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  Plus,
  Trash2,
  AlertTriangle,
  Check,
  Wand2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogCloseButton,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, parseMoneyToCents } from "@/lib/utils";
import {
  applyExtractedMenu,
  extractMenuPreview,
} from "@/app/r/[slug]/admin/(panel)/actions";

interface Item {
  name: string;
  description: string;
  priceDollars: string; // edit-friendly string; "" = no price
}
interface Category {
  name: string;
  description: string;
  items: Item[];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  slug: string;
  hasExistingMenu: boolean;
}

export function MenuImporter({ open, onOpenChange, slug, hasExistingMenu }: Props) {
  const router = useRouter();
  const [phase, setPhase] = React.useState<"paste" | "preview">("paste");
  const [text, setText] = React.useState("");
  const [extracting, setExtracting] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [mode, setMode] = React.useState<"append" | "replace">("append");
  const [elapsed, setElapsed] = React.useState(0);

  // Tick an elapsed timer + rotate status text while extracting so the user
  // knows the long AI call is actually working.
  React.useEffect(() => {
    if (!extracting) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(t);
  }, [extracting]);

  function extractStatus(s: number): string {
    if (s < 4) return "Reading your menu…";
    if (s < 10) return "Finding section headers…";
    if (s < 20) return "Pulling out items + prices…";
    if (s < 35) return "Almost done — large menu takes a sec…";
    return "Still working — Claude's writing structured JSON…";
  }

  React.useEffect(() => {
    if (!open) {
      setPhase("paste");
      setText("");
      setCategories([]);
      setExtracting(false);
      setApplying(false);
      setMode("append");
    }
  }, [open]);

  async function onExtract() {
    if (extracting) return;
    if (text.trim().length < 10) {
      toast.error("Paste your menu text first");
      return;
    }
    setExtracting(true);
    try {
      const res = await extractMenuPreview({ slug, text: text.trim() });
      if (res.ok) {
        setCategories(
          res.menu.categories.map((c) => ({
            name: c.name,
            description: c.description ?? "",
            items: c.items.map((i) => ({
              name: i.name,
              description: i.description ?? "",
              priceDollars:
                i.priceCents !== null ? (i.priceCents / 100).toFixed(2) : "",
            })),
          }))
        );
        setPhase("preview");
        toast.success(
          `Found ${res.itemCount} item${res.itemCount === 1 ? "" : "s"} in ${res.categoryCount} section${res.categoryCount === 1 ? "" : "s"}`
        );
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  async function onApply() {
    if (applying) return;
    const payload = categories
      .map((c) => ({
        name: c.name.trim(),
        description: c.description.trim() || null,
        items: c.items
          .map((i) => ({
            name: i.name.trim(),
            description: i.description.trim() || null,
            priceCents: parsePrice(i.priceDollars),
          }))
          .filter((i) => i.name.length > 0),
      }))
      .filter((c) => c.name.length > 0 && c.items.length > 0);

    if (payload.length === 0) {
      toast.error("Nothing left to import");
      return;
    }
    setApplying(true);
    try {
      const res = await applyExtractedMenu({ slug, categories: payload, mode });
      if (res.ok) {
        toast.success(
          `Imported ${res.itemCount} item${res.itemCount === 1 ? "" : "s"} into ${res.catCount} category${res.catCount === 1 ? "" : "s"}`
        );
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error("error" in res ? (res as { error: string }).error : "Import failed");
      }
    } finally {
      setApplying(false);
    }
  }

  function parsePrice(input: string): number | null {
    const s = input.trim();
    if (!s) return null;
    const cents = parseMoneyToCents(s);
    return cents !== null && cents > 0 ? cents : null;
  }

  function updateCategory(idx: number, patch: Partial<Category>) {
    setCategories((cs) => cs.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function removeCategory(idx: number) {
    setCategories((cs) => cs.filter((_, i) => i !== idx));
  }
  function addCategory() {
    setCategories((cs) => [...cs, { name: "New section", description: "", items: [] }]);
  }
  function updateItem(catIdx: number, itemIdx: number, patch: Partial<Item>) {
    setCategories((cs) =>
      cs.map((c, i) =>
        i === catIdx
          ? {
              ...c,
              items: c.items.map((it, j) => (j === itemIdx ? { ...it, ...patch } : it)),
            }
          : c
      )
    );
  }
  function removeItem(catIdx: number, itemIdx: number) {
    setCategories((cs) =>
      cs.map((c, i) =>
        i === catIdx ? { ...c, items: c.items.filter((_, j) => j !== itemIdx) } : c
      )
    );
  }
  function addItem(catIdx: number) {
    setCategories((cs) =>
      cs.map((c, i) =>
        i === catIdx
          ? {
              ...c,
              items: [...c.items, { name: "", description: "", priceDollars: "" }],
            }
          : c
      )
    );
  }

  const totalItems = categories.reduce((s, c) => s + c.items.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 grid place-items-center rounded-full bg-brand text-brand-fg">
              <Wand2 className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>Import menu with AI</DialogTitle>
              <DialogDescription>
                {phase === "paste"
                  ? "Paste your full menu — Claude will turn it into sections + items + prices."
                  : `Review what was parsed. Edit anything, then import.`}
              </DialogDescription>
            </div>
          </div>
          <DialogCloseButton />
        </DialogHeader>

        {phase === "paste" ? (
          <div className="px-6 pb-6 grid gap-4">
            <div className="grid gap-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="menu-text">Menu text</Label>
                <span
                  className={`text-[11px] tabular-nums ${
                    text.length > 40000
                      ? "text-red-600 font-medium"
                      : text.length > 35000
                        ? "text-amber-600"
                        : "text-surface-400"
                  }`}
                >
                  {text.length.toLocaleString()} / 40,000
                </span>
              </div>
              <Textarea
                id="menu-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={14}
                placeholder={`Paste your menu here. Anything works — copy-paste from a PDF, photo OCR, your old site, a Word doc...\n\nExample:\nBREAKFAST\nDenver Skillet — eggs, peppers, ham, cheese  $13.50\nBiscuits & Gravy — homemade sausage gravy  $9\n\nLUNCH\nCheeseburger — house-ground, american, lettuce, tomato  $14\n…`}
                className="font-mono text-xs"
              />
              <p className="text-xs text-surface-500">
                Sections, prices, and descriptions are figured out automatically. Up to
                ~80 items per section.
              </p>
            </div>
            {extracting && (
              <div className="rounded-2xl bg-sky-50 ring-1 ring-sky-200 p-4 flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-sky-700 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-sky-900">
                    {extractStatus(elapsed)}
                  </div>
                  <div className="text-xs text-sky-700 mt-0.5 tabular-nums">
                    {elapsed}s elapsed · long menus take 15–40s
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={extracting}>
                Cancel
              </Button>
              <Button onClick={onExtract} disabled={extracting || text.trim().length < 10}>
                {extracting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Parsing…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Parse with AI
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="px-6 pb-6 grid gap-5 max-h-[70vh] overflow-y-auto">
            <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 p-3 text-sm text-emerald-900 flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-700" />
              {totalItems} item{totalItems === 1 ? "" : "s"} across {categories.length}{" "}
              section{categories.length === 1 ? "" : "s"}. Edit anything below.
            </div>

            {hasExistingMenu && (
              <div className="rounded-2xl ring-1 ring-surface-200 p-4 bg-white">
                <div className="text-sm font-medium text-surface-900 mb-2">
                  You already have a menu — what should we do?
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <label
                    className={`flex items-start gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${
                      mode === "append"
                        ? "border-brand bg-brand/5"
                        : "border-surface-200 hover:border-surface-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === "append"}
                      onChange={() => setMode("append")}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium">Add to existing</div>
                      <div className="text-xs text-surface-500">
                        Keep current categories + items, add these on top.
                      </div>
                    </div>
                  </label>
                  <label
                    className={`flex items-start gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${
                      mode === "replace"
                        ? "border-red-400 bg-red-50"
                        : "border-surface-200 hover:border-surface-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === "replace"}
                      onChange={() => setMode("replace")}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                        Replace existing
                      </div>
                      <div className="text-xs text-surface-500">
                        Wipe the current menu first, then add these. Destructive.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {categories.map((cat, ci) => (
                <div
                  key={ci}
                  className="rounded-2xl ring-1 ring-surface-200 bg-white overflow-hidden"
                >
                  <div className="flex items-center gap-2 p-3 border-b border-surface-100 bg-surface-50/50">
                    <Input
                      value={cat.name}
                      onChange={(e) => updateCategory(ci, { name: e.target.value })}
                      className="font-medium"
                      placeholder="Section name"
                    />
                    <button
                      type="button"
                      onClick={() => removeCategory(ci)}
                      className="h-9 w-9 grid place-items-center rounded-full text-surface-400 hover:text-red-600 hover:bg-red-50 transition"
                      aria-label="Remove section"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <ul className="divide-y divide-surface-100">
                    {cat.items.map((it, ii) => (
                      <li
                        key={ii}
                        className="px-3 py-2 grid grid-cols-[1fr_100px_36px] gap-2 items-start"
                      >
                        <div className="grid gap-1">
                          <Input
                            value={it.name}
                            onChange={(e) =>
                              updateItem(ci, ii, { name: e.target.value })
                            }
                            placeholder="Item name"
                            className="h-9"
                          />
                          <Input
                            value={it.description}
                            onChange={(e) =>
                              updateItem(ci, ii, { description: e.target.value })
                            }
                            placeholder="Description (optional)"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400 text-sm">
                            $
                          </span>
                          <Input
                            inputMode="decimal"
                            value={it.priceDollars}
                            onChange={(e) =>
                              updateItem(ci, ii, { priceDollars: e.target.value })
                            }
                            placeholder="0.00"
                            className="h-9 pl-6 text-right tabular-nums"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(ci, ii)}
                          className="h-9 w-9 grid place-items-center rounded-full text-surface-400 hover:text-red-600 hover:bg-red-50 transition"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="p-2 border-t border-surface-100 bg-surface-50/30">
                    <button
                      type="button"
                      onClick={() => addItem(ci)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium text-surface-600 hover:bg-surface-100 transition"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add item
                    </button>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={addCategory} className="w-full">
                <Plus className="h-4 w-4" /> Add section
              </Button>
            </div>

            <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 bg-white border-t border-surface-200 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => setPhase("paste")}>
                ← Back to paste
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-surface-500">
                  {totalItems} item{totalItems === 1 ? "" : "s"} will be{" "}
                  {mode === "replace" ? "replaced" : "added"}
                </span>
                <Button onClick={onApply} disabled={applying || totalItems === 0}>
                  {applying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Importing…
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> Import {totalItems} item
                      {totalItems === 1 ? "" : "s"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
