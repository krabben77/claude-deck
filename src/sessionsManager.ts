import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

export interface SessionFile {
  file: string;
  filepath: string;
  date: Date;
  messageCount: number;
}

export interface ProjectSessions {
  slug: string;
  projectPath: string;
  sessions: SessionFile[];
}

function slugToPath(slug: string): string {
  // Converts "-home-ajax-myproject" → "/home/ajax/myproject"
  return slug.replace(/^-/, '/').replace(/-/g, '/');
}

export function getSessions(): ProjectSessions[] {
  if (!fs.existsSync(PROJECTS_DIR)) { return []; }
  const result: ProjectSessions[] = [];

  for (const slug of fs.readdirSync(PROJECTS_DIR)) {
    const dir = path.join(PROJECTS_DIR, slug);
    if (!fs.statSync(dir).isDirectory()) { continue; }
    const sessions: SessionFile[] = [];
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'))) {
      const filepath = path.join(dir, file);
      const stat = fs.statSync(filepath);
      let messageCount = 0;
      try {
        messageCount = fs.readFileSync(filepath, 'utf-8').split('\n').filter(l => l.trim().length > 0).length;
      } catch {
        // unreadable session file, leave count at 0
      }
      sessions.push({ file, filepath, date: stat.mtime, messageCount });
    }
    if (sessions.length === 0) { continue; }
    sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
    result.push({ slug, projectPath: slugToPath(slug), sessions });
  }

  return result.sort((a, b) => b.sessions[0].date.getTime() - a.sessions[0].date.getTime());
}
