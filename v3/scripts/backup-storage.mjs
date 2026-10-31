import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const [outputDirectory] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!outputDirectory || !url || !key) throw new Error("output directory, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: buckets, error } = await client.storage.listBuckets();
if (error) throw error;
const manifest = [];
for (const bucket of buckets ?? []) await downloadFolder(bucket.name, "");
await writeFile(path.join(outputDirectory, "storage-manifest.json"), JSON.stringify(manifest, null, 2));

async function downloadFolder(bucket, prefix) {
  const { data, error: listError } = await client.storage.from(bucket).list(prefix, { limit: 1000 });
  if (listError) throw listError;
  for (const entry of data ?? []) {
    const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (!entry.id) { await downloadFolder(bucket, objectPath); continue; }
    const { data: blob, error: downloadError } = await client.storage.from(bucket).download(objectPath);
    if (downloadError) throw downloadError;
    const target = path.join(outputDirectory, "storage", bucket, ...objectPath.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await blob.arrayBuffer()));
    manifest.push({ bucket, path: objectPath, size: blob.size });
  }
}
