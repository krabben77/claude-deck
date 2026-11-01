# Byggslogg

Senast ändrat: 2026-11-01

Här loggas varje utfört block, så att Niclas kan läsa vad som gjorts hela tiden.
Nyaste raden överst. Varje rad följer Gjort · Hinder · Nästa steg.

## 2026-11-01 · Uppdelning av webviewShared.ts, steg 2 av 2

- **Commit**: `0f479bc`
- **Gjort**: Delade panelens inbäddade JavaScript i 16 moduler under `src/webview/script/` (core, scope, nav, stack, skills, modal, mcp, hooks, permissions, memory, git, sessions, chat, utils, events, init) plus `index.ts` som sätter ihop dem i ursprunglig ordning. `webviewShared.ts` är nu 57 rader (var 2084). Punkten är bockad i `TODO.md`.
- **Verifierat**: HTML från `buildWebviewHtml()` är byte för byte identisk med baslinjen, med och utan projekt (md5 `006eb806…` och `d66d5e38…`). `npx tsc --noEmit`, `npm run build` och `webview-template-guard` går igenom.
- **Ej verifierat**: Klick i panelen i en riktig VS Code-session.
- **Hinder**: `CLAUDE.md` och README beskriver fortfarande allt som liggande i `webviewShared.ts`. Det är inte ändrat, eftersom det inte ingick i det godkända blocket.
- **Nästa steg**: Uppdatera `CLAUDE.md` och README:s arkitekturavsnitt (väntar på ok).

## 2026-11-01 · Uppdelning av webviewShared.ts, steg 1 av 2

- **Commit**: `a956e89`
- **Gjort**: Flyttade meddelandehanteringen (`src/webview/messages.ts`), ikoner (`icons.ts`), CSS (`styles.ts`) och HTML-skelettet (`markup.ts`) ut ur `webviewShared.ts`. Filen gick från 2084 till 1154 rader. Fasaden exporterar samma funktioner som förut, så `skillsPanel.ts` är orörd.
- **Verifierat**: HTML från `buildWebviewHtml()` är byte för byte identisk med före ändringen, både med och utan projekt (md5 `006eb806…` och `d66d5e38…`). `npx tsc --noEmit`, `npm run build` och `webview-template-guard` går igenom.
- **Ej verifierat**: Klick i panelen i en riktig VS Code-session. Identisk utdata gör det osannolikt att något ändrats, men det är inte provat.
- **Hinder**: Inga.
- **Nästa steg**: Steg 2, panelens JavaScript delas upp i `src/webview/script/`.

## 2026-11-01 · Block 3: package.json och CHANGELOG

- **Commit**: `c70c2e5`
- **Gjort**: Pekade `repository`, `bugs` och `homepage` i `package.json` mot `krabben77/claude-deck` och uppdaterade beskrivningen. Fyllde i `CHANGELOG.md` under Unreleased med det som saknades (ångra, Permissions, hälsokontroll, MCP-redigering, hook-fixar), hämtat ur git-historiken.
- **Hinder**: `publisher` ("Ajax1029") och licensnamn är orörda (väntar på Niclas). Raden "Path allowlist for external lock-hook integration" bygger bara på commit-titeln, inte på att koden är läst.
- **Verifierat**: `npx tsc --noEmit` och `npm run build` går igenom. `package.json` är giltig JSON.
- **Nästa steg**: Svar på publisher och licensnamn, sedan val av nästa punkt i `TODO.md`.

## 2026-11-01 · Block 2: README

- **Commit**: `2b2e39a`
- **Gjort**: Skrev om `README.md` (199 rader, 6 kodblock): vad panelen gör, bygg och installation, arkitektur (mermaid), scope, handoff via Notion utan databas-ID, arbetssätt och planerat. Originalets upphovsman krediteras och MIT-licensen står kvar.
- **Hinder**: Inte verifierat i en riktig VS Code-session. Länkarna till lokala filer och bilder är kontrollerade. Publisher-id och licensnamn är fortsatt öppna.
- **Nästa steg**: Block 3, `package.json` (metadata) och `CHANGELOG.md` (väntar på ok och publisher-id).

## 2026-11-01 · Block 1: TODO och byggslogg

- **Commit**: `923cbd3`
- **Gjort**: Lade sektionen "Ta över och höja kvaliteten" i `TODO.md` (10 punkter, befintliga punkter orörda). Skapade `docs/BYGGLOGG.md`.
- **Hinder**: Publisher-id, licensnamn och frågan om Notion-ID i README är öppna.
- **Nästa steg**: Block 2, ny README (klart, se ovan).
