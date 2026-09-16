import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const mediaDir = path.join(root, 'public/media/noah');
const dataFile = path.join(root, 'src/data/noah-media.json');
const projectId = 'wxs0fye6';
const dataset = 'production';
const query = `*[_type == "mediaCollections"][0]{
  photographs[]{asset->{_id, url, metadata{dimensions, _createdAt, _updatedAt}}},
  objects[]{asset->{_id, url, metadata{dimensions, _createdAt, _updatedAt}}},
  installation[]{asset->{_id, url, metadata{dimensions, _createdAt, _updatedAt}}},
  books[]{asset->{_id, url, metadata{dimensions, _createdAt, _updatedAt}}},
  video[]{link, thumbnail{asset->{_id, url, metadata{dimensions, _createdAt, _updatedAt}}}},
  lectures[]{link, thumbnail{asset->{_id, url, metadata{dimensions, _createdAt, _updatedAt}}}},
  music[]{link, thumbnail{asset->{_id, url, metadata{dimensions, _createdAt, _updatedAt}}}}
}`;
const endpoint = new URL(`https://${projectId}.apicdn.sanity.io/v2022-03-25/data/query/${dataset}`);
endpoint.searchParams.set('query', query);

const response = await fetch(endpoint);
if (!response.ok) throw new Error(`Sanity query failed: ${response.status}`);
const { result } = await response.json();

const settings = {
  photographs: { title: 'Photograph' },
  objects: { title: 'Object' },
  installation: { title: 'Installation' },
  books: { title: 'Book' },
  video: { title: 'Video' },
  lectures: { title: 'Lecture' },
  music: { title: 'Music' },
};

const assetId = (ref) => ref.replace(/^image-/, '').replace(/-\d+x\d+-[a-z]+$/, '');
const assetFormat = (ref) => ref.match(/-([a-z]+)$/)?.[1] || 'webp';
const assetUrl = (ref) => {
  const format = assetFormat(ref);
  const filename = `${ref.replace(/^image-/, '').slice(0, -(format.length + 1))}.${format}`;
  return `https://cdn.sanity.io/images/${projectId}/${dataset}/${filename}?w=1400&q=82&auto=format`;
};
await mkdir(mediaDir, { recursive: true });
const jobs = [];

for (const [category, config] of Object.entries(settings)) {
  const sourceItems = Array.isArray(result?.[category]) ? result[category] : [];
  for (let index = 0; index < sourceItems.length; index += 1) {
    const source = sourceItems[index];
    const asset = category === 'video' || category === 'music' || category === 'lectures'
      ? source.thumbnail?.asset
      : source.asset;
    const assetRef = asset?._id || asset?._ref;
    if (!assetRef) continue;

    const number = String(index + 1).padStart(3, '0');
    const filename = `${category}-${number}.${assetFormat(assetRef)}`;
    const item = {
      id: `${category}-${number}`,
      category,
      label: `${config.title} ${number}`,
      src: `/media/noah/${filename}`,
      href: source.link || null,
      sourceId: assetId(assetRef),
      width: asset.metadata?.dimensions?.width || null,
      height: asset.metadata?.dimensions?.height || null,
      createdAt: asset.metadata?._createdAt || asset.metadata?._updatedAt || null,
    };
    jobs.push({ assetRef, filename, item });
  }
}

for (let offset = 0; offset < jobs.length; offset += 8) {
  const batch = jobs.slice(offset, offset + 8);
  await Promise.all(batch.map(async ({ assetRef, filename }) => {
    const image = await fetch(assetUrl(assetRef));
    if (!image.ok) throw new Error(`Asset download failed: ${assetRef} (${image.status})`);
    await writeFile(path.join(mediaDir, filename), Buffer.from(await image.arrayBuffer()));
  }));
  console.log(`Downloaded ${Math.min(offset + batch.length, jobs.length)}/${jobs.length}`);
}

const items = jobs.map(({ item }) => item);

await writeFile(dataFile, `${JSON.stringify({ items }, null, 2)}\n`);
console.log(`Synced ${items.length} local assets to ${mediaDir}`);
