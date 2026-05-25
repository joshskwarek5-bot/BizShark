"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Star, Power, Trash2 } from "lucide-react";
import {
  deleteRestaurant,
  setPrimaryRestaurant,
  toggleRestaurantActive,
} from "@/app/platform/(panel)/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogCloseButton,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  id: string;
  name: string;
  isActive: boolean;
  isPrimary: boolean;
}

export function RestaurantRowActions({ id, name, isActive, isPrimary }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  async function handleTogglePrimary() {
    setMenuOpen(false);
    const res = await setPrimaryRestaurant({ id });
    if (res.ok) {
      toast.success(`${name} is now the primary restaurant`);
      router.refresh();
    }
  }

  async function handleToggleActive() {
    setMenuOpen(false);
    const res = await toggleRestaurantActive({ id, isActive: !isActive });
    if (res.ok) {
      toast.success(isActive ? `${name} deactivated` : `${name} activated`);
      router.refresh();
    }
  }

  async function handleDelete() {
    if (confirm !== name) {
      toast.error("Type the restaurant name to confirm");
      return;
    }
    setDeleting(true);
    const res = await deleteRestaurant({ id, confirmName: confirm });
    if (res.ok) {
      toast.success(`${name} deleted`);
      setDeleteOpen(false);
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not delete");
    }
    setDeleting(false);
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className="h-8 w-8 grid place-items-center rounded-full text-surface-500 hover:bg-surface-100 hover:text-surface-900"
        aria-label="More actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menuOpen && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-surface-200 bg-white shadow-elevated overflow-hidden">
          {!isPrimary && (
            <button
              type="button"
              onClick={handleTogglePrimary}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 text-left"
            >
              <Star className="h-4 w-4 text-amber-500" />
              Set as primary
            </button>
          )}
          <button
            type="button"
            onClick={handleToggleActive}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 text-left"
          >
            <Power className="h-4 w-4 text-surface-500" />
            {isActive ? "Deactivate" : "Activate"}
          </button>
          <div className="border-t border-surface-100" />
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setDeleteOpen(true);
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 text-left"
          >
            <Trash2 className="h-4 w-4" />
            Delete restaurant
          </button>
        </div>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete restaurant?</DialogTitle>
            <DialogCloseButton />
          </DialogHeader>
          <div className="px-6 pb-6 grid gap-4">
            <p className="text-sm text-surface-700">
              This will permanently delete{" "}
              <span className="font-medium text-surface-900">{name}</span>, its menu, orders, and
              admin users. This action <strong>cannot be undone.</strong>
            </p>
            <div className="grid gap-1.5">
              <Label htmlFor="confirm-name">Type the restaurant name to confirm</Label>
              <Input
                id="confirm-name"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={name}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={confirm !== name || deleting}
                onClick={handleDelete}
              >
                {deleting ? "Deleting…" : "Delete forever"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
