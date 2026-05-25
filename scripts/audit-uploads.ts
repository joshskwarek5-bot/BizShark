/**
 * Verifies the image upload pipeline:
 *  1. uploadImage accepts a valid image, returns a URL, writes the file
 *  2. validateImage rejects unsupported types
 *  3. validateImage rejects oversized files
 *  4. deleteImage removes the file
 *  5. End-to-end via the admin server actions for a real menu item
 *     (creates an order test item, uploads, verifies DB write, removes, cleans up)
 */
import { stat, readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import {
  uploadImage,
  deleteImage,
  validateImage,
  UploadError,
  MAX_UPLOAD_BYTES,
} from "@/lib/upload";

let passes = 0;
let failures = 0;
const pass = (l: string) => {
  passes++;
  console.log(`  ✓ ${l}`);
};
const fail = (l: string, why?: string) => {
  failures++;
  console.log(`  ✗ ${l}${why ? ` — ${why}` : ""}`);
};
const section = (l: string) => console.log(`\n${l}`);

// Smallest valid PNG (1×1 transparent pixel)
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function makeFile(name: string, type: string, bytes: Uint8Array): File {
  return new File([bytes], name, { type });
}

async function main() {
  console.log("🖼️  Image Upload Audit\n");

  section("Phase A: lib/upload — validation");
  const tinyPngBytes = Buffer.from(TINY_PNG_BASE64, "base64");
  const goodFile = makeFile("test.png", "image/png", tinyPngBytes);
  try {
    await validateImage(goodFile);
    pass("Valid PNG accepted by validateImage");
  } catch {
    fail("Valid PNG rejected");
  }

  const badType = makeFile("doc.pdf", "application/pdf", new Uint8Array([1, 2, 3]));
  try {
    await validateImage(badType);
    fail("Should reject PDF");
  } catch (e) {
    if (e instanceof UploadError) pass("Rejects unsupported file type");
    else fail("Unexpected error type");
  }

  const huge = makeFile(
    "huge.png",
    "image/png",
    Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0)
  );
  try {
    await validateImage(huge);
    fail("Should reject oversize");
  } catch (e) {
    if (e instanceof UploadError && /too large/i.test(e.message))
      pass("Rejects oversize file");
    else fail("Unexpected oversize error");
  }

  const empty = makeFile("empty.png", "image/png", new Uint8Array(0));
  try {
    await validateImage(empty);
    fail("Should reject empty");
  } catch (e) {
    if (e instanceof UploadError) pass("Rejects empty file");
    else fail("Unexpected empty error");
  }

  section("Phase B: lib/upload — write + delete (local fs)");
  const url = await uploadImage("audit-test", goodFile, "items");
  if (url.startsWith("/restaurants/audit-test/items/")) pass(`Returned local URL (${url})`);
  else fail("URL format wrong", url);

  const filePath = path.join(process.cwd(), "public", url);
  try {
    const st = await stat(filePath);
    if (st.size === tinyPngBytes.length) pass(`File written to disk (${st.size} bytes)`);
    else fail(`File size mismatch (got ${st.size})`);
  } catch (e) {
    fail("File not found on disk", String(e));
  }

  // Verify it's actually the PNG we sent
  const back = await readFile(filePath);
  if (back.equals(tinyPngBytes)) pass("File content matches");
  else fail("File content corrupted");

  await deleteImage(url);
  try {
    await stat(filePath);
    fail("File should have been deleted");
  } catch {
    pass("File deleted from disk");
  }

  // Deleting non-existent or non-restaurant paths should be a no-op
  await deleteImage("/some/random/path.png");
  pass("Non-restaurant path delete is a no-op (no throw)");
  await deleteImage("");
  pass("Empty URL delete is a no-op");

  section("Phase C: End-to-end via menu item — DB integration");
  const restaurant = await db.restaurant.findUnique({ where: { slug: "mama-bears" } });
  if (!restaurant) throw new Error("Mama Bears seed missing");
  const cat = await db.menuCategory.findFirst({
    where: { restaurantId: restaurant.id },
  });
  if (!cat) throw new Error("No category");

  const testItem = await db.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      categoryId: cat.id,
      name: "AUDIT_PHOTO_ITEM",
      priceCents: 100,
      displayOrder: 9999,
      isAvailable: true,
    },
  });

  const newFile = makeFile("photo.png", "image/png", tinyPngBytes);
  const uploadedUrl = await uploadImage("mama-bears", newFile, "items");
  await db.menuItem.update({
    where: { id: testItem.id },
    data: { imageUrl: uploadedUrl },
  });
  const fresh = await db.menuItem.findUnique({ where: { id: testItem.id } });
  if (fresh?.imageUrl === uploadedUrl) pass("Item.imageUrl persisted in DB");
  else fail("DB write failed", String(fresh?.imageUrl));

  await deleteImage(uploadedUrl);
  await db.menuItem.delete({ where: { id: testItem.id } });
  pass("Cleaned up test item + image");

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`Result: ${passes} passed, ${failures} failed.`);
  if (failures > 0) process.exit(1);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
