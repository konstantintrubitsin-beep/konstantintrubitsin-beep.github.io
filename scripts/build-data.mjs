/**
 * Превращает сырую выгрузку Readymag (reference/coslovs/data) в данные для Astro.
 * Запуск: npm run data
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.resolve(here, '../../reference/coslovs/data');
const OUT = path.resolve(here, '../src/data');

const CANVAS = 1024;
const PHONE = 320;

// Гарнитуры оригинала -> наши CSS-переменные. nddy = Pragmatica Condensed (Adobe Fonts).
const FONTS = {
  nddy: 'var(--f-cond)',
  wtqc: 'var(--f-cond)',
  vgvs: 'var(--f-cond)',
  'Pinyon Script': 'var(--f-script)',
  'League Gothic': 'var(--f-gothic)',
  'Meow Script': 'var(--f-meow)',
  'Courier New': 'var(--f-mono)',
};

/** Цвет Readymag: RRGGBB + прозрачность 0–100 в hex. */
function color(v) {
  if (!v) return null;
  const hex = String(v).replace('#', '');
  const rgb = hex.slice(0, 6);
  const a = hex.length > 6 ? parseInt(hex.slice(6), 16) / 100 : 1;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(rgb.slice(i, i + 2), 16));
  return a >= 1 ? `#${rgb}` : `rgba(${r},${g},${b},${+a.toFixed(3)})`;
}

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Имя стиля ссылки Readymag -> короткий css-класс. */
function linkClass(name) {
  if (!name) return 'ls-default';
  return 'ls-' + String(name).replace(/^link-style-/, '').slice(0, 8);
}

/** CSS для стилей ссылок проекта. */
function linkStyleCss(styles) {
  const rules = ['.lnk{color:inherit;text-decoration:none;transition:color .15s}'];
  for (const s of styles) {
    const c = linkClass(s.name);
    const st = s.style ?? {};
    const line = (v) => (v?.type && v.type !== 'None' ? `text-decoration:underline;text-decoration-color:${color(v.color)};` : '');
    rules.push(`.${c},.${c} *{color:${color(st.link?.textColor)}!important;${line(st.link)}}`);
    rules.push(`.${c}:hover,.${c}:hover *{color:${color(st.hover?.textColor)}!important;${line(st.hover)}}`);
  }
  return rules.join('\n');
}

/** Ссылка Readymag -> путь нашего сайта. */
function href(data, pageById) {
  if (!data) return '#';
  const t = data.type;
  if (t === 'Page' || data.pageId) {
    const uri = pageById.get(data.pageId) || data.pageUri || data.url;
    return uri === '1' ? '/' : `/${uri}/`;
  }
  const u = String(data.url || '');
  if (/^https?:\/\//.test(u)) return u;
  if (/^[\w.+-]+@[\w.-]+$/.test(u)) return `mailto:${u}`;
  if (/^(t\.me|instagram\.com|vimeo\.com|www\.)/.test(u)) return `https://${u}`;
  return u.startsWith('/') ? u : `/${u}/`;
}

/**
 * Draft.js-блок -> HTML. Стили лежат прогонами по offset/length,
 * поздний прогон перекрывает ранний; ссылки — отдельными диапазонами.
 */
function renderBlock(block, styleEntry, meta, entityMap, pageById) {
  const text = block.text ?? '';
  const chars = Array.from(text);
  if (!chars.length) return '<p><br></p>';

  const inl = styleEntry?.inlineStyles ?? {};
  const keys = inl.keys ?? [];
  const values = inl.values ?? [];
  const perChar = chars.map(() => ({}));

  for (const run of inl.styles ?? []) {
    for (let i = run.offset; i < run.offset + run.length && i < perChar.length; i++) {
      for (const pair of run.styles ?? []) {
        const [ki, vi] = pair.split(';').map(Number);
        perChar[i][keys[ki]] = values[vi];
      }
    }
  }

  const linkAt = chars.map(() => null);
  for (const r of block.entityRanges ?? []) {
    const ent = entityMap?.[r.key];
    if (!ent || ent.type !== 'LINK') continue;
    for (let i = r.offset; i < r.offset + r.length && i < linkAt.length; i++) {
      linkAt[i] = ent.data;
    }
  }

  const css = (s) => {
    const out = [];
    if (s.COLOR) out.push(`color:${color(s.COLOR)}`);
    if (s.FONT_FAMILY) out.push(`font-family:${FONTS[s.FONT_FAMILY] ?? s.FONT_FAMILY}`);
    if (s.FONT_SIZE) out.push(`font-size:${s.FONT_SIZE}px`);
    if (s.FONT_WEIGHT) out.push(`font-weight:${s.FONT_WEIGHT}`);
    if (s.FONT_STYLE && s.FONT_STYLE !== 'normal') out.push(`font-style:${s.FONT_STYLE}`);
    if (s.LETTER_SPACING && s.LETTER_SPACING !== '0') out.push(`letter-spacing:${s.LETTER_SPACING}px`);
    if (s.TRANSFORM && s.TRANSFORM !== 'none') out.push(`text-transform:${s.TRANSFORM}`);
    if (s.DECORATION && s.DECORATION !== 'none') out.push(`text-decoration:${s.DECORATION}`);
    return out.join(';');
  };

  let html = '';
  let i = 0;
  while (i < chars.length) {
    const sig = css(perChar[i]);
    const link = linkAt[i];
    let j = i;
    while (j < chars.length && css(perChar[j]) === sig && linkAt[j] === link) j++;
    const inner = esc(chars.slice(i, j).join(''));
    let piece = sig ? `<span style="${sig}">${inner}</span>` : inner;
    if (link) {
      const url = href(link, pageById);
      const ext = /^https?:|^mailto:/.test(url);
      const cls = `lnk ${linkClass(link.linkStyle)}`;
      piece = `<a class="${cls}" href="${esc(url)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${piece}</a>`;
    }
    html += piece;
    i = j;
  }

  const first = perChar[0] ?? {};
  const p = [];
  if (meta?.lineHeight) p.push(`line-height:${meta.lineHeight}px`);
  if (first.FONT_FAMILY) p.push(`font-family:${FONTS[first.FONT_FAMILY] ?? first.FONT_FAMILY}`);
  if (first.FONT_SIZE) p.push(`font-size:${first.FONT_SIZE}px`);
  if (first.FONT_WEIGHT) p.push(`font-weight:${first.FONT_WEIGHT}`);
  const align = (meta?.align ?? 'align-left').replace('align-', '');
  return `<p class="al-${align}" style="${p.join(';')}">${html}</p>`;
}

/** Кроп-параметры картинки на CDN Readymag. */
function imgSrc(pic, crop, w) {
  const base = pic?.lambdaUrl || pic?.url;
  if (!base) return null;
  const q = new URLSearchParams({ w: String(Math.round(w)), e: 'webp' });
  if (crop && crop.cropW) {
    q.set('cX', String(Math.round(crop.cropX ?? 0)));
    q.set('cY', String(Math.round(crop.cropY ?? 0)));
    q.set('cW', String(Math.round(crop.cropW)));
    q.set('cH', String(Math.round(crop.cropH)));
  }
  return `${base}?${q}`;
}

/** Якорь fixed-виджета -> координата x на холсте 1024. */
function anchorX(x, w, anchor, canvas) {
  switch (anchor) {
    case 'ne':
    case 'se':
      return canvas - x - w;
    case 'n':
    case 's':
    case 'c':
      return canvas / 2 + x - w / 2;
    default:
      return x;
  }
}

function box(src, canvas, anchor) {
  if (src?.x == null) return null;
  const x = anchor ? anchorX(src.x, src.w ?? 0, anchor, canvas) : src.x;
  return { x: +x.toFixed(2), y: +(src.y ?? 0).toFixed(2), w: +(src.w ?? 0).toFixed(2), h: +(src.h ?? 0).toFixed(2) };
}

function animOf(w) {
  const list = w.animation ?? [];
  return list
    .map((a) => {
      const s = a.steps?.[0] ?? {};
      return {
        type: a.type,
        trigger: a.trigger ?? [],
        duration: s.duration ?? 0,
        delay: s.delay ?? 0,
        ease: s.acceleration ?? 'ease-both',
        loop: s.loop ?? null,
        fromOpacity: s.use_opacity ? s.from_opacity : null,
        opacity: s.use_opacity ? s.opacity : null,
        fromScale: s.use_scale ? s.from_scale : null,
        scale: s.use_scale ? s.scale : null,
        fromRotate: s.use_rotate ? s.from_rotate : null,
        rotate: s.use_rotate ? s.rotate : null,
        dx: s.use_move ? s.dx ?? 0 : null,
        dy: s.use_move ? s.dy ?? 0 : null,
        speed: s.speed ?? null,
        startOffset: s.start_offset ?? null,
      };
    })
    .filter((a) => a.type);
}

/** Per-page override: [{pid, value}] -> значение для конкретной страницы. */
function override(list, pageId, fallback) {
  if (!Array.isArray(list)) return fallback;
  const hit = list.find((e) => e.pid === pageId);
  return hit ? hit.value : fallback;
}

function convert(w, pageById, pageId) {
  const v = w.viewport_phone_portrait ?? {};
  const anchor = w.fixed_position ?? null;
  const d = box(w, CANVAS, anchor);
  const p = box(v, PHONE, v.fixed_position ?? anchor);
  const base = {
    id: w.wid,
    type: w.type,
    z: override(w._z, pageId, w.z ?? 0),
    zPhone: override(v._z, pageId, v.z ?? w.z ?? 0),
    d,
    p,
    fixed: anchor,
    hidden: override(w._hidden, pageId, w.hidden) === true,
    hiddenPhone: override(v._hidden, pageId, v.hidden) === true,
    anim: animOf(w),
  };

  switch (w.type) {
    case 'text': {
      const styles = new Map((w.styles ?? []).filter((s) => s?.key).map((s) => [s.key, s]));
      const metas = new Map((w.blocksMeta ?? []).map((b) => [b.key, b.data]));
      base.html = (w.blocks ?? [])
        .map((b) => renderBlock(b, styles.get(b.key), metas.get(b.key), w.entityMap, pageById))
        .join('');
      base.valign = w.verticalAlign ?? 'top';
      base.autosize = w.autosize !== false;
      break;
    }
    case 'shape': {
      base.shape = w.tp;
      base.color = color(w.bg_color ? w.bg_color + '64' : null);
      base.opacity = w.bg_opacity ?? 1;
      base.weight = w.weight ?? 1;
      base.radius = w.radius ?? 0;
      base.sides = w.sides ?? 3;
      base.raster = w.raster2xUrl ?? w.raster3xUrl ?? null;
      break;
    }
    case 'picture': {
      const desk = w.picture ? w : null;
      const ph = v.picture ? v : null;
      const src = desk ?? ph;
      if (src) {
        const width = (d ?? p)?.w ?? 300;
        base.src = imgSrc(src.picture, src, width);
        base.src2x = imgSrc(src.picture, src, width * 2);
        base.blur = w.blurHash ?? null;
      }
      break;
    }
    case 'slideshow': {
      const t = w.theme_data ?? {};
      base.play = w.play_method ?? 'autoplay';
      base.transition = w.transition_type ?? 'crossfade';
      base.fill = t.fill !== false;
      base.counters = t.counters === true;
      base.arrows = t.arrows === true;
      base.delay = t.autoplay_delay ?? 2;
      base.hoverFps = t.hover_frame_rate ?? 0.8;
      base.speed = t.slider_transition ?? 0.5;
      base.images = (w.pictures ?? [])
        .map((pic) => {
          const width = (d ?? p)?.w ?? 300;
          return { src: imgSrc(pic, null, width), src2x: imgSrc(pic, null, width * 2), w: pic.width, h: pic.height };
        })
        .filter((x) => x.src);
      break;
    }
    case 'video': {
      base.src = w.url?.startsWith('http') ? w.url : `https://v-p.rmcdn.net/${w.url}`;
      base.poster = w.thumbnail_url ? `https://v-p.rmcdn.net/${w.thumbnail_url}` : null;
      base.autoplay = w.autoplay !== false;
      base.loop = w.loop !== false;
      base.mute = w.mute !== false;
      base.controls = w.controls === true;
      base.radius = w.video_styles?.radius ?? 0;
      break;
    }
    case 'background': {
      base.color = typeof w.color === 'string' ? color(w.color + '64') : '#ffffff';
      break;
    }
    default:
      return null;
  }
  return base;
}

function main() {
  const project = JSON.parse(fs.readFileSync(path.join(RAW, '_project.json'), 'utf8'));
  const mag = project.mags.mag;
  const pageById = new Map(mag.pages.map((p) => [p._id, p.pagePath]));
  const meta = new Map(mag.pages.map((p) => [p.pagePath, p]));

  const globals = mag.globalWidgets ?? [];

  fs.mkdirSync(path.join(OUT, 'pages'), { recursive: true });
  fs.mkdirSync(path.resolve(here, '../src/styles'), { recursive: true });
  fs.writeFileSync(
    path.resolve(here, '../src/styles/links.css'),
    '/* Сгенерировано build-data.mjs из стилей ссылок проекта. */\n' + linkStyleCss(mag.linkStyles?.project ?? [])
  );
  const index = [];

  for (const file of fs.readdirSync(RAW)) {
    if (!file.endsWith('.json') || file === '_project.json') continue;
    const uri = file.slice(0, -5);
    const raw = JSON.parse(fs.readFileSync(path.join(RAW, file), 'utf8'));
    const m = meta.get(uri) ?? {};
    // Шапка и подвал — глобальные виджеты проекта, в выдаче страницы их нет.
    const seen = new Set(raw.map((w) => w.wid));
    const all = raw.concat(globals.filter((g) => !seen.has(g.wid)));
    const widgets = all
      .map((w) => convert(w, pageById, m._id))
      .filter(Boolean)
      .sort((a, b) => a.z - b.z);

    const page = {
      uri,
      slug: uri === '1' ? '' : uri,
      title: m.title || '',
      height: m.height ?? 1000,
      phoneHeight: m.viewport_phone_portrait?.height ?? m.height ?? 1000,
      widgets,
    };
    fs.writeFileSync(path.join(OUT, 'pages', `${uri}.json`), JSON.stringify(page));
    index.push({ uri, slug: page.slug, title: page.title, height: page.height, widgets: widgets.length });
  }

  index.sort((a, b) => a.uri.localeCompare(b.uri));
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1));
  console.log(`страниц: ${index.length}, виджетов: ${index.reduce((s, p) => s + p.widgets, 0)}`);
}

main();
