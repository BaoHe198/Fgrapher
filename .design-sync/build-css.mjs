// Builds the stylesheet the Claude Design bundle ships (cfg.cssEntry).
//
// Fgrapher styles with Tailwind v4, which only emits the utilities its
// sources use. Claude Design's agent writes new layouts, so on top of
// everything the app and the authored previews use, this safelists the
// layout/spacing families and every brand token utility - generated from
// globals.css itself so a new token is picked up without editing this file.
//
// Fonts: the app loads them with next/font, which only exists inside Next.
// Outside it, globals.css's own family names (Bricolage Grotesque, Plus
// Jakarta Sans, IBM Plex Mono) are served from Google Fonts.
//
// Run from the repo root: node .design-sync/build-css.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const require = createRequire(import.meta.url);
const twPath = require.resolve("@tailwindcss/postcss", { paths: [root] });
const postcss = createRequire(twPath)("postcss");
const tailwind = (await import(twPath)).default;

const globalsPath = resolve(root, "src/app/globals.css");
const globals = readFileSync(globalsPath, "utf8");

const colors = [...new Set([...globals.matchAll(/^\s*--color-([a-z0-9-]+)\s*:/gm)].map((m) => m[1]))];
const utilities = [...new Set([...globals.matchAll(/^@utility ([a-z0-9-]+)/gm)].map((m) => m[1]))];
const spacing = "0,0.5,1,1.5,2,2.5,3,3.5,4,5,6,7,8,9,10,11,12,14,16,20,24,28,32";
const safelist = [
  "{sm:,md:,lg:,xl:,}{block,inline-block,inline,flex,inline-flex,grid,hidden,contents}",
  "{sm:,md:,lg:,}{flex-row,flex-col,flex-wrap,flex-1,shrink-0,grow}",
  "{sm:,md:,lg:,}{items,self}-{start,center,end,stretch,baseline}",
  "{sm:,md:,lg:,}justify-{start,center,end,between,around,evenly}",
  "{sm:,md:,lg:,}grid-cols-{1,2,3,4,5,6,12}",
  "{sm:,md:,lg:,}col-span-{1,2,3,4,5,6,12,full}",
  `{sm:,md:,lg:,}{p,px,py,pt,pb,pl,pr,m,mx,my,mt,mb,ml,mr,gap,gap-x,gap-y,space-y,space-x}-{${spacing}}`,
  "{w,h,min-h,min-w,max-h}-{full,screen,auto,fit}",
  "max-w-{xs,sm,md,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl,full,prose}",
  "{mx,my}-auto",
  "{relative,absolute,fixed,sticky,inset-0,top-0,left-0,right-0,bottom-0,z-10,z-20,z-50}",
  "{overflow-hidden,overflow-auto,overflow-x-auto,truncate,line-clamp-1,line-clamp-2,line-clamp-3}",
  "{text-left,text-center,text-right,uppercase,italic,tracking-tight,tracking-wide,font-medium,font-semibold,font-bold}",
  "{aspect-square,aspect-video,aspect-[3/4],aspect-[4/5],object-cover,object-contain}",
  "{rounded,rounded-full,rounded-none,border,border-t,border-b,border-0,shadow-sm,shadow-md,shadow-lg}",
  "{opacity-50,opacity-70,transition,duration-150,duration-300}",
  `{bg,text,border,ring,fill,stroke,from,to}-{${colors.join(",")}}`,
  `{hover:,}{bg,text,border}-{${colors.join(",")}}`,
  utilities.join(" "),
];

const fonts =
  '@import url("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..700&family=IBM+Plex+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:ital,wght@0,400..800;1,400..800&display=swap");\n';
const input =
  fonts +
  globals +
  "\n/* design-sync: previews and the safelist for the design agent */\n" +
  '@source "../../.design-sync/previews";\n' +
  safelist.map((s) => `@source inline(${JSON.stringify(s)});`).join("\n") +
  "\n";

const result = await postcss([tailwind({ base: root })]).process(input, {
  from: globalsPath,
  to: resolve(root, ".design-sync/.cache/fgrapher.css"),
});
const out = resolve(root, ".design-sync/.cache/fgrapher.css");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, result.css);
console.log(
  `fgrapher.css: ${(result.css.length / 1024).toFixed(0)} KB, ${colors.length} color tokens, ${utilities.length} custom utilities`,
);
