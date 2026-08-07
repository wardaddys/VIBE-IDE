/* =======================================================================
   Scheduler - recurring (cron) and one-shot (fireAt) headless agent runs.
   Minimal 5-field cron matcher (minute hour dom month dow); good enough for
   "every morning", step syntax, and weekly patterns. Ticks every 30s.
   ======================================================================= */
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ScheduledTask } from '../../shared/agent';

type Runner = (task: ScheduledTask) => Promise<void>;

function matchField(field: string, value: number): boolean {
    if (field === '*') return true;
    for (const part of field.split(',')) {
        const step = part.match(/^\*\/(\d+)$/);
        if (step) { if (value % parseInt(step[1], 10) === 0) return true; continue; }
        const range = part.match(/^(\d+)-(\d+)$/);
        if (range) { if (value >= +range[1] && value <= +range[2]) return true; continue; }
        if (parseInt(part, 10) === value) return true;
    }
    return false;
}

export function cronMatches(cron: string, d: Date): boolean {
    const f = cron.trim().split(/\s+/);
    if (f.length !== 5) return false;
    return matchField(f[0], d.getMinutes())
        && matchField(f[1], d.getHours())
        && matchField(f[2], d.getDate())
        && matchField(f[3], d.getMonth() + 1)
        && matchField(f[4], d.getDay());
}

export class Scheduler {
    private tasks: ScheduledTask[] = [];
    private timer: NodeJS.Timeout | null = null;
    private lastTickMinute = -1;
    private filePath: string;

    constructor(baseDir: string, private runner: Runner) {
        this.filePath = path.join(baseDir, 'schedules.json');
    }

    async start() {
        try { this.tasks = JSON.parse(await fsp.readFile(this.filePath, 'utf-8')); } catch { this.tasks = []; }
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => this.tick(), 30_000);
    }

    stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }

    private async persist() {
        await fsp.mkdir(path.dirname(this.filePath), { recursive: true }).catch(() => {});
        await fsp.writeFile(this.filePath, JSON.stringify(this.tasks, null, 2)).catch(() => {});
    }

    private async tick() {
        const now = new Date();
        const minute = Math.floor(now.getTime() / 60000);
        if (minute === this.lastTickMinute) return; // once per wall-clock minute
        this.lastTickMinute = minute;

        for (const task of this.tasks) {
            if (!task.enabled) continue;
            let due = false;
            if (task.fireAt) due = new Date(task.fireAt).getTime() <= now.getTime();
            else if (task.cron) due = cronMatches(task.cron, now);
            if (!due) continue;
            // Avoid double-firing a cron in the same minute.
            if (task.lastRunAt && Math.floor(new Date(task.lastRunAt).getTime() / 60000) === minute) continue;

            task.lastRunAt = now.toISOString();
            if (task.fireAt) task.enabled = false; // one-shot
            await this.persist();
            this.runner(task).catch(() => {});
        }
    }

    async add(t: Omit<ScheduledTask, 'id' | 'createdAt' | 'enabled'> & { enabled?: boolean }): Promise<ScheduledTask> {
        const task: ScheduledTask = { ...t, id: randomUUID(), enabled: t.enabled ?? true, createdAt: new Date().toISOString() };
        this.tasks.push(task);
        await this.persist();
        return task;
    }

    async update(id: string, patch: Partial<ScheduledTask>): Promise<boolean> {
        const t = this.tasks.find((x) => x.id === id);
        if (!t) return false;
        Object.assign(t, patch);
        await this.persist();
        return true;
    }

    async remove(id: string): Promise<boolean> {
        const before = this.tasks.length;
        this.tasks = this.tasks.filter((x) => x.id !== id);
        if (this.tasks.length === before) return false;
        await this.persist();
        return true;
    }

    list(): ScheduledTask[] { return this.tasks; }
}