/* =======================================================================
   Agent module entry - instantiates the kernel and all subsystems, and
   registers the generic agent IPC surface. Called once from main/index.ts.
   ======================================================================= */
import { ipcMain, BrowserWindow, app } from 'electron';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type {
    AgentDelta,
    AgentMessage,
    McpConfig,
    McpServerConfig,
    PermissionResolution,
    RunRequest,
    ScheduledTask,
    Surface,
} from '../../shared/agent';
import { AGENT_CHANNELS } from '../../shared/ipcContracts';
import { ToolRegistry } from './registry';
import { AgentKernel } from './kernel';
import { McpHost } from './mcp/host';
import { SkillLoader } from './skills/loader';
import { SessionStore } from './session/store';
import { Scheduler } from './scheduler';
import { fsTools } from './tools/fs';
import { searchTools } from './tools/search';
import { bashTools, killSessionShell } from './tools/bash';
import { webTools } from './tools/web';
import { taskTools } from './tools/task';
import { skillTools } from './tools/skill';
import { askTools, resolveAsk } from './tools/ask';

interface BackgroundBridge {
    getBriefing: () => string | Promise<string>;
}

export function registerAgentHandlers(mainWindow: BrowserWindow, bg?: BackgroundBridge) {
    const userData = app.getPath('userData');
    const registry = new ToolRegistry();
    registry.registerAll([...fsTools, ...searchTools, ...bashTools, ...webTools, ...taskTools, ...skillTools, ...askTools]);

    const skills = new SkillLoader([path.join(userData, 'skills')]);
    const store = new SessionStore(userData);
    const mcp = new McpHost(registry);

    const readMemory = async (root: string): Promise<string> => {
        const parts: string[] = [];
        try { parts.push(await fsp.readFile(path.join(root, '.vibe', 'memory.json'), 'utf-8')); } catch { /* none */ }
        try {
            const facts = JSON.parse(await fsp.readFile(path.join(root, '.vibe', 'facts.json'), 'utf-8'));
            if (facts?.facts) parts.push('FACTS: ' + JSON.stringify(facts.facts).slice(0, 800));
        } catch { /* none */ }
        return parts.join('\n').slice(0, 1500);
    };

    const readVibe = async (root: string): Promise<string | null> => {
        try { return await fsp.readFile(path.join(root, 'VIBE.md'), 'utf-8'); } catch { return null; }
    };

    const kernel = new AgentKernel({
        registry,
        getBriefing: bg ? async () => String(await bg.getBriefing()) : undefined,
        getMemory: readMemory,
        getSkillsIndex: () => skills.index(),
        loadSkill: (name) => skills.load(name),
        getVibeInstructions: readVibe,
        onPersist: (sessionId, messages) => { store.saveMessages(sessionId, messages).catch(() => {}); },
    });

    const send = (d: AgentDelta) => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send(AGENT_CHANNELS.delta, d); };

    // -- Run a turn --------------------------------------------------------
    ipcMain.handle(AGENT_CHANNELS.run, async (_e, req: RunRequest) => {
        // Rescan skills for the active project each run (cheap, keeps index fresh).
        const extraSkillDirs = req.projectRoot ? [path.join(req.projectRoot, '.vibe', 'skills')] : [];
        await skills.scan(extraSkillDirs).catch(() => {});
        const history = await store.getMessages(req.sessionId).catch(() => [] as AgentMessage[]);
        const stop = await kernel.run(req, send, history);
        return { stopReason: stop };
    });

    ipcMain.handle(AGENT_CHANNELS.cancel, (_e, runId: string) => { kernel.cancel(runId); return { ok: true }; });

    ipcMain.handle(AGENT_CHANNELS.approve, (_e, runId: string, res: PermissionResolution) => {
        const broker = kernel.getBroker(runId);
        const ok = broker ? broker.resolve(res) : false;
        return { ok };
    });

    ipcMain.handle(AGENT_CHANNELS.answer, (_e, reqId: string, answers: Record<string, string[]>) => {
        return { ok: resolveAsk(reqId, answers) };
    });

    ipcMain.handle(AGENT_CHANNELS.listTools, (_e, surface?: Surface) => {
        // Advertise everything registered; the surface preset decides what's enabled at run time.
        return registry.schemas();
    });

    // -- Sessions ------------------------------------------------------------
    ipcMain.handle(AGENT_CHANNELS.createSession, (_e, opts: { surface: Surface; title?: string; projectRoot: string | null; model: string }) => store.create(opts));
    ipcMain.handle(AGENT_CHANNELS.listSessions, (_e, surface?: Surface) => store.list(surface));
    ipcMain.handle(AGENT_CHANNELS.listProjects, (_e, surface?: Surface) => store.listByProject(surface));
    ipcMain.handle(AGENT_CHANNELS.getMessages, (_e, id: string) => store.getMessages(id));
    ipcMain.handle(AGENT_CHANNELS.getSession, (_e, id: string) => store.get(id));
    ipcMain.handle(AGENT_CHANNELS.renameSession, (_e, id: string, title: string) => store.rename(id, title));
    ipcMain.handle(AGENT_CHANNELS.deleteSession, (_e, id: string) => store.remove(id));
    ipcMain.handle(AGENT_CHANNELS.sessionRewind, (_e, id: string) => store.rewind(id));

    // -- MCP ------------------------------------------------------------------
    const mcpConfigPath = path.join(userData, 'mcp.json');

    const loadMcpConfig = async (): Promise<McpConfig> => {
        let config: McpConfig;
        try { config = JSON.parse(await fsp.readFile(mcpConfigPath, 'utf-8')); }
        catch { config = { mcpServers: {} }; }
        if (!config.mcpServers) config.mcpServers = {};
        return config;
    };
    ipcMain.handle(AGENT_CHANNELS.mcpGetConfig, () => loadMcpConfig());
    ipcMain.handle(AGENT_CHANNELS.mcpSaveConfig, async (_e, config: McpConfig) => {
        await fsp.mkdir(userData, { recursive: true }).catch(() => {});
        await fsp.writeFile(mcpConfigPath, JSON.stringify(config, null, 2));
        return mcp.load(config);
    });
    ipcMain.handle(AGENT_CHANNELS.mcpReload, async () => mcp.load(await loadMcpConfig()));

    // -- Skills -------------------------------------------------------------
    ipcMain.handle(AGENT_CHANNELS.skillsList, async () => { await skills.scan(); return skills.list(); });

    // -- Scheduler ------------------------------------------------------------
    const scheduler = new Scheduler(userData, async (task: ScheduledTask) => {
        const session = await store.create({ surface: task.surface, title: ` ${task.title}`, projectRoot: task.projectRoot, model: task.model });
        const req: RunRequest = {
            sessionId: session.id,
            surface: task.surface,
            model: task.model,
            projectRoot: task.projectRoot,
            input: [{ type: 'text', text: task.prompt }],
            apiKeys: {},
        };
        await kernel.run(req, send, []);
        if (!mainWindow.isDestroyed()) mainWindow.webContents.send(AGENT_CHANNELS.scheduledFired, { taskId: task.id, sessionId: session.id });
    });
    ipcMain.handle(AGENT_CHANNELS.scheduleList, () => scheduler.list());
    ipcMain.handle(AGENT_CHANNELS.scheduleAdd, (_e, t: any) => scheduler.add(t));
    ipcMain.handle(AGENT_CHANNELS.scheduleUpdate, (_e, id: string, patch: any) => scheduler.update(id, patch));
    ipcMain.handle(AGENT_CHANNELS.scheduleRemove, (_e, id: string) => scheduler.remove(id));

    // -- Live catalogs (pulled from the web) ---------------------------------
    ipcMain.handle(AGENT_CHANNELS.cloudModels, async (_e, ollamaKey?: string) => {
        try {
            const headers: Record<string, string> = {};
            if (ollamaKey) headers.Authorization = `Bearer ${ollamaKey}`;
            const res = await fetch('https://ollama.com/api/tags', { headers });
            if (!res.ok) return [];
            const data = await res.json() as any;
            return (data.models || []).map((m: any) => ({ name: m.name, size: m.size || 0, modifiedAt: m.modified_at || '' }));
        } catch { return []; }
    });

    ipcMain.handle(AGENT_CHANNELS.mcpSearch, async (_e, query?: string) => {
        try {
            const url = new URL('https://registry.modelcontextprotocol.io/v0/servers');
            if (query) url.searchParams.set('search', query);
            url.searchParams.set('limit', '50');
            const res = await fetch(url.toString());
            if (!res.ok) return [];
            const data = await res.json() as any;
            const cfg = await loadMcpConfig();
            const installedNames = new Set(Object.keys(cfg.mcpServers || {}));
            const seen = new Set<string>();
            const out: any[] = [];
            for (const row of (data.servers || [])) {
                const sv = row.server || {};
                if (!sv.name || seen.has(sv.name)) continue;
                seen.add(sv.name);
                let transport: 'stdio' | 'remote' | 'unknown' = 'unknown';
                let install: any = null;
                const pkg = Array.isArray(sv.packages) ? sv.packages[0] : null;
                if (pkg) {
                    const id = pkg.identifier || pkg.name;
                    const rt = pkg.registryType || pkg.registry_type;
                    if (rt === 'npm') { transport = 'stdio'; install = { command: 'npx', args: ['-y', id] }; }
                    else if (rt === 'pypi') { transport = 'stdio'; install = { command: 'uvx', args: [id] }; }
                }
                if (!install && Array.isArray(sv.remotes) && sv.remotes[0]?.url) { transport = 'remote'; install = { url: sv.remotes[0].url }; }
                const key = String(sv.name).split('/').pop() || String(sv.name);
                out.push({ name: sv.name, title: sv.title || key, description: sv.description || '', version: sv.version || '', transport, install, installed: installedNames.has(key) });
            }
            return out;
        } catch { return []; }
    });

    ipcMain.handle(AGENT_CHANNELS.mcpAdd, async (_e, key: string, config: McpServerConfig) => {
        const cfg = await loadMcpConfig();
        cfg.mcpServers = cfg.mcpServers || {};
        cfg.mcpServers[key] = config;
        await fsp.mkdir(userData, { recursive: true }).catch(() => {});
        await fsp.writeFile(mcpConfigPath, JSON.stringify(cfg, null, 2));
        return mcp.load(cfg);
    });

    ipcMain.handle(AGENT_CHANNELS.mcpRemove, async (_e, key: string) => {
        const cfg = await loadMcpConfig();
        if (cfg.mcpServers) delete cfg.mcpServers[key];
        await fsp.writeFile(mcpConfigPath, JSON.stringify(cfg, null, 2));
        return mcp.load(cfg);
    });

    const SKILL_REPO = 'anthropics/skills';
    const skillsDir = path.join(userData, 'skills');
    ipcMain.handle(AGENT_CHANNELS.skillsCatalog, async () => {
        try {
            const res = await fetch(`https://api.github.com/repos/${SKILL_REPO}/contents/skills`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'vibe-ide' } });
            if (!res.ok) return [];
            const rows = await res.json() as any[];
            const dirs = rows.filter((r) => r.type === 'dir');
            const installed = new Set(await fsp.readdir(skillsDir).catch(() => [] as string[]));
            return await Promise.all(dirs.map(async (d) => {
                let description = '';
                try {
                    const md = await fetch(`https://raw.githubusercontent.com/${SKILL_REPO}/main/skills/${d.name}/SKILL.md`);
                    if (md.ok) {
                        const text = await md.text();
                        const m = text.match(/description:\s*(.*)/i);
                        if (m) description = m[1].trim().replace(/^["']|["']$/g, '').slice(0, 240);
                    }
                } catch { /* ignore */ }
                return { name: d.name, description, installed: installed.has(d.name), path: d.path };
            }));
        } catch { return []; }
    });

    ipcMain.handle(AGENT_CHANNELS.skillsInstall, async (_e, name: string) => {
        try {
            const tree = await fetch(`https://api.github.com/repos/${SKILL_REPO}/git/trees/main?recursive=1`, { headers: { 'User-Agent': 'vibe-ide' } });
            if (!tree.ok) return { ok: false, error: `GitHub ${tree.status}` };
            const data = await tree.json() as any;
            const prefix = `skills/${name}/`;
            const files = (data.tree || []).filter((t: any) => t.type === 'blob' && String(t.path).startsWith(prefix));
            if (files.length === 0) return { ok: false, error: 'Skill not found' };
            for (const f of files) {
                const rel = f.path.slice('skills/'.length);
                const dest = path.join(skillsDir, rel);
                await fsp.mkdir(path.dirname(dest), { recursive: true });
                const raw = await fetch(`https://raw.githubusercontent.com/${SKILL_REPO}/main/${f.path}`);
                if (raw.ok) await fsp.writeFile(dest, Buffer.from(await raw.arrayBuffer()));
            }
            await skills.scan().catch(() => {});
            return { ok: true, files: files.length };
        } catch (e: any) { return { ok: false, error: e?.message || String(e) }; }
    });

    ipcMain.handle(AGENT_CHANNELS.skillsRemove, async (_e, name: string) => {
        try { await fsp.rm(path.join(skillsDir, name), { recursive: true, force: true }); await skills.scan().catch(() => {}); return { ok: true }; }
        catch (e: any) { return { ok: false, error: e?.message || String(e) }; }
    });

    // Boot async subsystems.
    (async () => {
        await skills.scan().catch(() => {});
        const mcpReport = await mcp.load(await loadMcpConfig()).catch((e: any) => {
            console.error('[MCP] Failed to load config:', e?.message || e);
            return [];
        });
        // Log MCP server status. A missing/optional server is a warning, not an
        // error, so the terminal doesn't look broken on first run.
        for (const r of mcpReport) {
            if (r.error) {
                console.log(`[MCP] ${r.server}: not connected (${r.error})`);
            } else {
                console.log(`[MCP] ${r.server}: ${r.tools} tools loaded`);
            }
        }
        await scheduler.start().catch(() => {});
    })();

    app.on('before-quit', () => { mcp.stopAll(); scheduler.stop(); });
    mainWindow.on('closed', () => { mcp.stopAll(); });

    return { registry, kernel, killSessionShell };
}
