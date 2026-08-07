/* =======================================================================
   Universal run system.

   Resolution order (first hit wins):
     1. .vibe/run.json           - explicit per-project override {"command","label"}
     2. Project markers          - package.json scripts, Cargo.toml, go.mod, ...
     3. Active-file runner       - extension -> toolchain command
   Commands execute in the visible terminal pane (PowerShell on Windows), so
   toolchains must be on PATH - failures surface honestly in the terminal.
   ======================================================================= */
import { useTerminalStore } from '../store/terminal';
import { useUIStore } from '../store/ui';

export interface RunPlan {
    label: string;    // what the Run button shows ("npm run dev", "cargo run", ...)
    command: string;  // exactly what is typed into the terminal
    source: 'override' | 'project' | 'file';
}

const q = (p: string) => `"${p.replace(/"/g, '')}"`;

/* ---- platform ----------------------------------------------------------- */
// The commands run in the visible terminal, which is PowerShell on Windows and
// bash/zsh elsewhere. Everything below branches on this so a compiled-language
// "Run" produces a valid command line on Linux/macOS, not PowerShell syntax.
const IS_WIN = window.vibe.platform === 'win32';
const OPEN = IS_WIN ? 'Start-Process' : (window.vibe.platform === 'darwin' ? 'open' : 'xdg-open');

/* ---- file-level runners: extension -> command builder ------------------- */
type FileRunner = (f: string, stem: string) => string;
// Scratch path for compiled output: %TEMP%\vibe_run.exe on Windows, /tmp/vibe_run elsewhere.
const TMP = IS_WIN ? '$env:TEMP\\vibe_run' : '/tmp/vibe_run';

/** Compile-then-run: chain with && on POSIX (fail-fast) and `; &` on PowerShell,
 *  and only append .exe on Windows. `build(out)` must emit the compiler invocation
 *  that writes the executable to `out`. */
function compileRun(build: (out: string) => string): string {
    const out = IS_WIN ? `${TMP}.exe` : TMP;
    if (IS_WIN) return `${build(`"${out}"`)}; & "${out}"`;
    return `${build(`"${out}"`)} && "${out}"`;
}

const FILE_RUNNERS: Record<string, { label: string; cmd: FileRunner }> = {
    py: { label: 'python', cmd: (f) => `python ${q(f)}` },
    js: { label: 'node', cmd: (f) => `node ${q(f)}` },
    mjs: { label: 'node', cmd: (f) => `node ${q(f)}` },
    cjs: { label: 'node', cmd: (f) => `node ${q(f)}` },
    ts: { label: 'tsx', cmd: (f) => `npx tsx ${q(f)}` },
    tsx: { label: 'tsx', cmd: (f) => `npx tsx ${q(f)}` },
    jsx: { label: 'tsx', cmd: (f) => `npx tsx ${q(f)}` },
    rs: { label: 'rustc', cmd: (f) => compileRun((o) => `rustc ${q(f)} -o ${o}`) },
    go: { label: 'go run', cmd: (f) => `go run ${q(f)}` },
    c: { label: 'gcc', cmd: (f) => compileRun((o) => `gcc ${q(f)} -o ${o}`) },
    cpp: { label: 'g++', cmd: (f) => compileRun((o) => `g++ ${q(f)} -o ${o}`) },
    cc: { label: 'g++', cmd: (f) => compileRun((o) => `g++ ${q(f)} -o ${o}`) },
    java: { label: 'java', cmd: (f) => `java ${q(f)}` },              // JEP 330 single-file launch
    kt: { label: 'kotlin', cmd: (f) => {
        const jar = `${TMP}.jar`;
        const sep = IS_WIN ? '; ' : ' && ';
        return `kotlinc ${q(f)} -include-runtime -d "${jar}"${sep}java -jar "${jar}"`;
    } },
    cs: { label: 'dotnet run', cmd: () => 'dotnet run' },             // needs a csproj context
    fs: { label: 'dotnet fsi', cmd: (f) => `dotnet fsi ${q(f)}` },
    sh: { label: 'bash', cmd: (f) => `bash ${q(f)}` },
    ps1: { label: 'powershell', cmd: (f) => `powershell -ExecutionPolicy Bypass -File ${q(f)}` },
    bat: { label: 'cmd', cmd: (f) => `cmd /c ${q(f)}` },
    rb: { label: 'ruby', cmd: (f) => `ruby ${q(f)}` },
    php: { label: 'php', cmd: (f) => `php ${q(f)}` },
    lua: { label: 'lua', cmd: (f) => `lua ${q(f)}` },
    pl: { label: 'perl', cmd: (f) => `perl ${q(f)}` },
    r: { label: 'Rscript', cmd: (f) => `Rscript ${q(f)}` },
    jl: { label: 'julia', cmd: (f) => `julia ${q(f)}` },
    swift: { label: 'swift', cmd: (f) => `swift ${q(f)}` },
    dart: { label: 'dart', cmd: (f) => `dart run ${q(f)}` },
    hs: { label: 'runghc', cmd: (f) => `runghc ${q(f)}` },
    ex: { label: 'elixir', cmd: (f) => `elixir ${q(f)}` },
    exs: { label: 'elixir', cmd: (f) => `elixir ${q(f)}` },
    erl: { label: 'escript', cmd: (f) => `escript ${q(f)}` },
    clj: { label: 'clojure', cmd: (f) => `clojure -M ${q(f)}` },
    scala: { label: 'scala-cli', cmd: (f) => `scala-cli run ${q(f)}` },
    groovy: { label: 'groovy', cmd: (f) => `groovy ${q(f)}` },
    nim: { label: 'nim', cmd: (f) => `nim c -r ${q(f)}` },
    zig: { label: 'zig', cmd: (f) => `zig run ${q(f)}` },
    d: { label: 'rdmd', cmd: (f) => `rdmd ${q(f)}` },
    ml: { label: 'ocaml', cmd: (f) => `ocaml ${q(f)}` },
    f90: { label: 'gfortran', cmd: (f) => compileRun((o) => `gfortran ${q(f)} -o ${o}`) },
    f95: { label: 'gfortran', cmd: (f) => compileRun((o) => `gfortran ${q(f)} -o ${o}`) },
    v: { label: 'v', cmd: (f) => `v run ${q(f)}` },
    cr: { label: 'crystal', cmd: (f) => `crystal run ${q(f)}` },
    html: { label: 'open in browser', cmd: (f) => `${OPEN} ${q(f)}` },
    sql: { label: 'sqlite3', cmd: (f) => `sqlite3 -init ${q(f)} ":memory:"` },
};

/* ---- project-level detection -------------------------------------------- */
async function readJson(path: string): Promise<any | null> {
    try { return JSON.parse(await window.vibe.readFile(path)); } catch { return null; }
}
async function exists(path: string): Promise<boolean> {
    try { await window.vibe.readFile(path); return true; } catch { return false; }
}

async function detectProjectPlan(root: string): Promise<RunPlan | null> {
    const r = root.replace(/[\\/]+$/, '');
    let names: Set<string>;
    try { names = new Set((await window.vibe.readDir(r)).map((e) => e.name)); } catch { return null; }

    // 1. explicit override always wins
    if (names.has('.vibe')) {
        const ov = await readJson(`${r}/.vibe/run.json`);
        if (ov?.command) return { label: ov.label || ov.command, command: ov.command, source: 'override' };
    }

    // 2. ecosystem markers
    if (names.has('package.json')) {
        const pkg = await readJson(`${r}/package.json`);
        const scripts = pkg?.scripts || {};
        for (const s of ['dev', 'start', 'serve', 'build']) {
            if (scripts[s]) return { label: `npm run ${s}`, command: `npm run ${s}`, source: 'project' };
        }
    }
    if (names.has('deno.json') || names.has('deno.jsonc')) {
        const dj = await readJson(`${r}/deno.json`) ?? await readJson(`${r}/deno.jsonc`);
        const t = dj?.tasks ? Object.keys(dj.tasks)[0] : null;
        if (t) return { label: `deno task ${t}`, command: `deno task ${t}`, source: 'project' };
    }
    if (names.has('Cargo.toml')) return { label: 'cargo run', command: 'cargo run', source: 'project' };
    if (names.has('go.mod')) return { label: 'go run .', command: 'go run .', source: 'project' };
    if (names.has('manage.py')) return { label: 'django runserver', command: 'python manage.py runserver', source: 'project' };
    if (names.has('platformio.ini')) return { label: 'pio run', command: 'pio run', source: 'project' };
    if (names.has('gradlew') || names.has('gradlew.bat')) {
        return { label: 'gradle run', command: IS_WIN ? '.\\gradlew.bat run' : './gradlew run', source: 'project' };
    }
    if (names.has('pom.xml')) return { label: 'maven package', command: 'mvn -q package', source: 'project' };
    if (names.has('mix.exs')) return { label: 'mix run', command: 'mix run', source: 'project' };
    if (names.has('pubspec.yaml')) {
        const pub = await window.vibe.readFile(`${r}/pubspec.yaml`).catch(() => '');
        return pub.includes('flutter')
            ? { label: 'flutter run', command: 'flutter run', source: 'project' }
            : { label: 'dart run', command: 'dart run', source: 'project' };
    }
    for (const n of names) {
        if (n.endsWith('.sln') || n.endsWith('.csproj')) return { label: 'dotnet run', command: 'dotnet run', source: 'project' };
    }
    if (names.has('CMakeLists.txt')) {
        return { label: 'cmake build', command: 'cmake -S . -B build; cmake --build build', source: 'project' };
    }
    if (names.has('Makefile') || names.has('makefile')) return { label: 'make', command: 'make', source: 'project' };
    if (names.has('main.py')) return { label: 'python main.py', command: 'python main.py', source: 'project' };
    if (names.has('app.py')) return { label: 'python app.py', command: 'python app.py', source: 'project' };
    if (names.has('index.php')) return { label: 'php server', command: 'php -S localhost:8080', source: 'project' };
    if (names.has('Gemfile') && await exists(`${r}/config.ru`)) return { label: 'rackup', command: 'bundle exec rackup', source: 'project' };
    return null;
}

/** Resolve what "Run" should do right now. */
export async function detectRunPlan(projectRoot: string | null, activeFile: string | null): Promise<RunPlan | null> {
    if (projectRoot) {
        const proj = await detectProjectPlan(projectRoot);
        // File runner beats a generic project plan when a runnable file is focused
        // and the project plan is only a weak fallback (make/cmake with a file open).
        if (proj && proj.source === 'override') return proj;
        const filePlan = fileRunPlan(activeFile);
        return proj ?? filePlan;
    }
    return fileRunPlan(activeFile);
}

function fileRunPlan(activeFile: string | null): RunPlan | null {
    if (!activeFile) return null;
    const ext = activeFile.split('.').pop()?.toLowerCase() || '';
    const runner = FILE_RUNNERS[ext];
    if (!runner) return null;
    const stem = (activeFile.split(/[\\/]/).pop() || '').replace(/\.[^.]+$/, '');
    return { label: `${runner.label}: ${activeFile.split(/[\\/]/).pop()}`, command: runner.cmd(activeFile, stem), source: 'file' };
}

/** Prefer the focused file's runner when one exists (explicit user intent). */
export async function detectRunPlanForFile(projectRoot: string | null, activeFile: string | null): Promise<RunPlan | null> {
    const filePlan = fileRunPlan(activeFile);
    if (filePlan) {
        // override still wins over everything
        if (projectRoot) {
            const proj = await detectProjectPlan(projectRoot);
            if (proj?.source === 'override') return proj;
        }
        return filePlan;
    }
    return detectRunPlan(projectRoot, activeFile);
}

/** Type the plan's command into the visible terminal. Returns false when no terminal. */
export function executeRunPlan(plan: RunPlan): boolean {
    const termId = useTerminalStore.getState().activeTerminalId;
    if (!termId) return false;
    const root = useUIStore.getState().projectPath;
    const prefix = root ? `cd "${root}"; ` : '';
    window.vibe.sendTerminalInput(termId, prefix + plan.command + '\r');
    return true;
}

/** Scaffold .vibe/run.json so any stack on earth can be wired up. */
export async function createRunOverride(projectRoot: string): Promise<string> {
    const path = `${projectRoot.replace(/[\\/]+$/, '')}/.vibe/run.json`;
    const template = JSON.stringify({ label: 'my app', command: 'echo configure your run command here' }, null, 2);
    await window.vibe.writeFile(path, template);
    return path;
}
