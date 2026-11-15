// Prints the release version: <major>.<minor> from package.json + git height as the patch.
//
// Git height = number of commits since major.minor in package.json last changed
// (the commit that changed it counts as 1), like Nerdbank.GitVersioning.
// Requires full git history (actions/checkout with fetch-depth: 0).
//
//   bun scripts/version.mjs          print the version
//   bun scripts/version.mjs --write  also write it to package.json
import { $ } from 'bun';

const majorMinor = (json) => {
  const m = /^(\d+)\.(\d+)\./.exec(JSON.parse(json).version ?? '');
  if (!m) throw new Error(`package.json version must be major.minor.patch, got ${JSON.parse(json).version}`);
  return `${m[1]}.${m[2]}`;
};

const pkgText = await Bun.file('package.json').text();
const current = majorMinor(pkgText);

// Oldest commit of the newest unbroken run of package.json revisions with the current major.minor.
let first = null;
for (const sha of (await $`git log --format=%H -- package.json`.text()).split('\n').filter(Boolean)) {
  const { stdout, exitCode } = await $`git show ${sha}:package.json`.quiet().nothrow();
  let mm = null;
  try {
    mm = exitCode === 0 ? majorMinor(stdout.toString()) : null;
  } catch {}
  if (mm !== current) break;
  first = sha;
}

// Commits reachable from HEAD but not from before `first` (its parents), so `first` itself counts as 1.
let height = 0;
if (first) {
  const parents = (await $`git rev-parse ${first}^@`.text()).split('\n').filter(Boolean);
  height = Number((await $`git rev-list --count HEAD --not ${parents}`.text()).trim());
}
const version = `${current}.${height}`;

if (process.argv.includes('--write')) {
  await Bun.write('package.json', pkgText.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`));
}
console.log(version);
