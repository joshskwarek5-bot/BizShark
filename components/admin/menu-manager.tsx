"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MenuImporter } from "@/components/admin/menu-importer";
import {
  AIImageEnhancer,
  EnhanceButton,
} from "@/components/admin/ai-image-enhancer";
import {
  Plus,
  Wand2,
  Edit3,
  Trash2,
  GripVertical,
  Loader2,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  ImageIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogCloseButton,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/components/admin/image-uploader";
import { cn, formatMoney, parseMoneyToCents } from "@/lib/utils";
import {
  createCategory,
  createMenuItem,
  deleteCategory,
  deleteMenuItem,
  removeMenuItemImage,
  updateCategory,
  updateMenuItem,
  uploadMenuItemImage,
} from "@/app/r/[slug]/admin/(panel)/actions";

export interface ItemRow {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  isAvailable: boolean;
  categoryId: string;
  imageUrl: string | null;
}
export interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  items: ItemRow[];
}

interface MenuManagerProps {
  slug: string;
  categories: CategoryRow[];
  hasOpenAI: boolean;
}

export function MenuManager({ slug, categories, hasOpenAI }: MenuManagerProps) {
  const router = useRouter();

  const [addCategoryOpen, setAddCategoryOpen] = React.useState(false);
  const [editCategory, setEditCategory] = React.useState<CategoryRow | null>(null);
  const [addingToCategory, setAddingToCategory] = React.useState<string | null>(null);
  const [editingItem, setEditingItem] = React.useState<ItemRow | null>(null);
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const [importerOpen, setImporterOpen] = React.useState(false);

  async function handleToggleAvailable(item: ItemRow, next: boolean) {
    const res = await updateMenuItem({
      slug,
      id: item.id,
      isAvailable: next,
      categoryId: item.categoryId,
    });
    if (res.ok) {
      toast.success(next ? `${item.name} is available` : `${item.name} marked 86'd`);
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not update");
    }
  }

  async function handleDeleteItem(item: ItemRow) {
    if (!confirm(`Delete "${item.name}"? This can't be undone.`)) return;
    const res = await deleteMenuItem({ slug, id: item.id });
    if (res.ok) {
      toast.success("Item deleted");
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not delete");
    }
  }

  async function handleDeleteCategory(cat: CategoryRow) {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    const res = await deleteCategory({ slug, id: cat.id });
    if (res.ok) {
      toast.success("Category deleted");
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not delete");
    }
  }

  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="font-display text-4xl text-surface-900">Menu</h1>
          <p className="text-sm text-surface-500 mt-1">
            Add, edit, or 86 items. Changes appear on the customer site instantly.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImporterOpen(true)}>
            <Wand2 className="h-4 w-4" /> Import with AI
          </Button>
          <Button variant="outline" onClick={() => setAddCategoryOpen(true)}>
            <FolderPlus className="h-4 w-4" /> Add category
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {categories.length === 0 && (
          <div className="rounded-3xl border border-dashed border-surface-300 bg-white/60 p-12 text-center">
            <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-brand/10 text-brand">
              <Wand2 className="h-6 w-6" />
            </div>
            <div className="mt-4 font-display text-2xl text-surface-900">
              Your menu is empty
            </div>
            <p className="mt-1 text-surface-500 max-w-md mx-auto">
              Paste your menu (PDF copy, photo OCR, old website — anything) and Claude
              will turn it into sections + items + prices in one click.
            </p>
            <div className="mt-6 flex gap-2 justify-center">
              <Button onClick={() => setImporterOpen(true)}>
                <Wand2 className="h-4 w-4" /> Import menu with AI
              </Button>
              <Button variant="outline" onClick={() => setAddCategoryOpen(true)}>
                <FolderPlus className="h-4 w-4" /> Start manually
              </Button>
            </div>
          </div>
        )}
        {categories.map((cat) => {
          const isCollapsed = collapsed[cat.id];
          return (
            <section
              key={cat.id}
              className="rounded-3xl border border-surface-200 bg-white shadow-soft overflow-hidden"
            >
              <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-surface-100">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [cat.id]: !c[cat.id] }))
                  }
                  className="flex items-center gap-2 min-w-0 text-left"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-surface-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-surface-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-display text-xl text-surface-900 truncate">
                      {cat.name}
                      <span className="ml-2 text-sm font-sans font-normal text-surface-500">
                        {cat.items.length} item{cat.items.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {cat.description && !isCollapsed && (
                      <div className="text-sm text-surface-500 mt-0.5 truncate">
                        {cat.description}
                      </div>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setAddingToCategory(cat.id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-100 px-3 text-sm font-medium text-surface-700 hover:bg-surface-200 transition"
                  >
                    <Plus className="h-3.5 w-3.5" /> Item
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditCategory(cat)}
                    className="h-9 w-9 grid place-items-center rounded-full text-surface-500 hover:bg-surface-100 hover:text-surface-800 transition"
                    aria-label="Edit category"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat)}
                    className="h-9 w-9 grid place-items-center rounded-full text-surface-400 hover:bg-red-50 hover:text-red-600 transition"
                    aria-label="Delete category"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </header>

              {!isCollapsed && (
                <ul className="divide-y divide-surface-100">
                  {cat.items.length === 0 && (
                    <li className="px-6 py-8 text-center text-sm text-surface-500">
                      No items yet —{" "}
                      <button
                        onClick={() => setAddingToCategory(cat.id)}
                        className="text-brand font-medium hover:underline"
                      >
                        add one
                      </button>
                      .
                    </li>
                  )}
                  {cat.items.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        "group flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition",
                        !item.isAvailable && "opacity-60"
                      )}
                    >
                      <GripVertical className="h-4 w-4 text-surface-300 opacity-0 group-hover:opacity-100 transition" />
                      <button
                        type="button"
                        className="flex-1 min-w-0 text-left flex items-center gap-4"
                        onClick={() => setEditingItem(item)}
                      >
                        {item.imageUrl ? (
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-100">
                            <Image
                              src={item.imageUrl}
                              alt={item.name}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-12 w-12 shrink-0 grid place-items-center rounded-lg bg-surface-100 text-surface-300">
                            <ImageIcon className="h-4 w-4" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-surface-900 truncate">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-surface-500 truncate mt-0.5">
                              {item.description}
                            </div>
                          )}
                        </div>
                        <div className="font-mono text-sm text-surface-900 tabular-nums shrink-0">
                          {formatMoney(item.priceCents)}
                        </div>
                      </button>
                      <Switch
                        checked={item.isAvailable}
                        onCheckedChange={(next) => handleToggleAvailable(item, next)}
                        aria-label={`${item.name} availability`}
                      />
                      <button
                        type="button"
                        onClick={() => setEditingItem(item)}
                        className="h-8 w-8 grid place-items-center rounded-full text-surface-400 hover:text-surface-800 hover:bg-surface-100 opacity-0 group-hover:opacity-100 transition"
                        aria-label="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        className="h-8 w-8 grid place-items-center rounded-full text-surface-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <CategoryDialog
        open={addCategoryOpen}
        onOpenChange={setAddCategoryOpen}
        onSubmit={async (vals) => {
          const res = await createCategory({ slug, ...vals });
          if (res.ok) {
            toast.success(`Created category "${vals.name}"`);
            setAddCategoryOpen(false);
            router.refresh();
          } else {
            toast.error(res.error ?? "Could not create");
          }
        }}
      />
      <CategoryDialog
        open={!!editCategory}
        existing={editCategory ?? undefined}
        onOpenChange={(o) => !o && setEditCategory(null)}
        onSubmit={async (vals) => {
          if (!editCategory) return;
          const res = await updateCategory({ slug, id: editCategory.id, ...vals });
          if (res.ok) {
            toast.success("Category updated");
            setEditCategory(null);
            router.refresh();
          } else {
            toast.error(res.error ?? "Could not update");
          }
        }}
      />

      <ItemDialog
        slug={slug}
        hasOpenAI={hasOpenAI}
        open={addingToCategory !== null}
        categoryId={addingToCategory ?? ""}
        categories={categories}
        onOpenChange={(o) => !o && setAddingToCategory(null)}
        onSubmit={async (vals) => {
          if (!addingToCategory) return;
          const res = await createMenuItem({
            slug,
            categoryId: vals.categoryId,
            name: vals.name,
            description: vals.description || null,
            priceCents: vals.priceCents,
            isAvailable: vals.isAvailable,
          });
          if (res.ok) {
            toast.success(`Added "${vals.name}"`);
            setAddingToCategory(null);
            router.refresh();
          } else {
            toast.error(res.error ?? "Could not create");
          }
        }}
      />
      <ItemDialog
        slug={slug}
        hasOpenAI={hasOpenAI}
        open={!!editingItem}
        existing={editingItem ?? undefined}
        categoryId={editingItem?.categoryId ?? ""}
        categories={categories}
        onOpenChange={(o) => !o && setEditingItem(null)}
        onSubmit={async (vals) => {
          if (!editingItem) return;
          const res = await updateMenuItem({
            slug,
            id: editingItem.id,
            categoryId: vals.categoryId,
            name: vals.name,
            description: vals.description || null,
            priceCents: vals.priceCents,
            isAvailable: vals.isAvailable,
          });
          if (res.ok) {
            toast.success("Item updated");
            setEditingItem(null);
            router.refresh();
          } else {
            toast.error(res.error ?? "Could not update");
          }
        }}
      />
      <MenuImporter
        open={importerOpen}
        onOpenChange={setImporterOpen}
        slug={slug}
        hasExistingMenu={categories.length > 0}
      />
    </>
  );
}

// ---------- Dialogs ----------

function CategoryDialog({
  open,
  onOpenChange,
  existing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing?: CategoryRow;
  onSubmit: (v: { name: string; description: string | null }) => Promise<void>;
}) {
  const [name, setName] = React.useState(existing?.name ?? "");
  const [desc, setDesc] = React.useState(existing?.description ?? "");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(existing?.name ?? "");
      setDesc(existing?.description ?? "");
    }
  }, [open, existing]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit category" : "New category"}</DialogTitle>
          <DialogCloseButton />
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setSaving(true);
            await onSubmit({ name: name.trim(), description: desc.trim() || null });
            setSaving(false);
          }}
          className="px-6 pb-6 grid gap-5"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cat-desc">Description (optional)</Label>
            <Textarea
              id="cat-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {existing ? "Save changes" : "Create category"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({
  slug,
  hasOpenAI,
  open,
  onOpenChange,
  existing,
  categoryId,
  categories,
  onSubmit,
}: {
  slug: string;
  hasOpenAI: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing?: ItemRow;
  categoryId: string;
  categories: CategoryRow[];
  onSubmit: (v: {
    name: string;
    description: string | null;
    priceCents: number;
    isAvailable: boolean;
    categoryId: string;
  }) => Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [available, setAvailable] = React.useState(true);
  const [cat, setCat] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [enhancerOpen, setEnhancerOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(existing?.name ?? "");
      setDesc(existing?.description ?? "");
      setPrice(existing ? (existing.priceCents / 100).toFixed(2) : "");
      setAvailable(existing?.isAvailable ?? true);
      setCat(existing?.categoryId ?? categoryId);
      setImageUrl(existing?.imageUrl ?? null);
      setError(null);
    }
  }, [open, existing, categoryId]);

  async function uploadFile(file: File): Promise<string> {
    if (!existing) throw new Error("Save the item first to add a photo.");
    const fd = new FormData();
    fd.append("slug", slug);
    fd.append("itemId", existing.id);
    fd.append("file", file);
    const res = await uploadMenuItemImage(fd);
    if (!res.ok || !res.imageUrl) {
      throw new Error(res.error ?? "Upload failed");
    }
    return res.imageUrl;
  }
  async function removeFile(): Promise<void> {
    if (!existing) return;
    const res = await removeMenuItemImage({ slug, id: existing.id });
    if (!res.ok) throw new Error("error" in res ? res.error : "Could not remove");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit item" : "New item"}</DialogTitle>
          <DialogCloseButton />
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const cents = parseMoneyToCents(price);
            if (cents === null) {
              setError("Enter a valid price (e.g. 12.95)");
              return;
            }
            if (!name.trim()) {
              setError("Name is required");
              return;
            }
            setSaving(true);
            setError(null);
            await onSubmit({
              name: name.trim(),
              description: desc.trim() || null,
              priceCents: cents,
              isAvailable: available,
              categoryId: cat,
            });
            setSaving(false);
          }}
          className="px-6 pb-6 grid gap-5"
        >
          {existing ? (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>Photo</Label>
                {hasOpenAI && (
                  <EnhanceButton onClick={() => setEnhancerOpen(true)} />
                )}
              </div>
              <ImageUploader
                value={imageUrl}
                onUploaded={(url) => setImageUrl(url)}
                onRemoved={() => setImageUrl(null)}
                upload={uploadFile}
                remove={removeFile}
                alt={existing.name}
              />
              <AIImageEnhancer
                open={enhancerOpen}
                onOpenChange={setEnhancerOpen}
                slug={slug}
                kind="item"
                itemId={existing.id}
                defaultSubject={
                  desc.trim() ? `${name.trim()} — ${desc.trim()}` : name.trim()
                }
                currentImageUrl={imageUrl}
                onSaved={(u) => setImageUrl(u)}
              />
            </div>
          ) : (
            <div className="rounded-xl bg-surface-50 px-4 py-3 text-xs text-surface-600">
              <ImageIcon className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5 text-surface-500" />
              Save this item, then re-open it to add a photo.
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="i-name">Name</Label>
            <Input
              id="i-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="i-desc">Description</Label>
            <Textarea
              id="i-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="What's in it?"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="i-price">Price (USD)</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 text-sm">
                  $
                </span>
                <Input
                  id="i-price"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="12.95"
                  className="pl-7"
                  required
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={cat} onValueChange={setCat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-surface-50 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-surface-900">Available</div>
              <div className="text-xs text-surface-500">
                Customers can order it when on.
              </div>
            </div>
            <Switch checked={available} onCheckedChange={setAvailable} aria-label="Available" />
          </div>
          {error && (
            <div className="rounded-xl bg-red-50 ring-1 ring-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {existing ? "Save changes" : "Add item"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
