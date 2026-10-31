# TODO — nya funktioner

Förslag på funktioner för Claude Deck, i prioritetsordning inom varje grupp.
Bocka av med `[x]` när något är klart.

## Först (störst nytta, liten insats)

- [x] **Ångra-funktion**: Ta en kopia av `settings.json` före varje skrivning och lägg till en knapp "Ångra senaste ändring". Gör alla övriga skrivfunktioner tryggare, så den bör komma först.
- [x] **Permissions-flik**: Visa och redigera `permissions.allow/deny/ask` och `defaultMode` (inklusive auto-läge) per scope.
- [x] **Hälsokontroll ("Doctor")**: Kort i Stack-fliken som varnar för trasig JSON i settings, MCP-servrar med saknad kommandofil, hooks som pekar på filer som inte finns och dubbletter mellan global och projekt-scope.
- [ ] **Redigera MCP-server och Skill i panelen**: Ändra `args`, `env` och skill-innehåll på plats, med diff-förhandsvisning före skrivning.
- [ ] **Import/export av stack**: Exportera valda skills, MCP-servrar och hooks som JSON och importera dem i ett annat projekt eller på en annan dator.

## Mellanstor insats

- [ ] **Hook-testkörning**: Kör ett hooks kommando med exempel-JSON på stdin och visa stdout, felkod och körtid.
- [ ] **Hook-körningshistorik**: Läs hook-poster ur sessionstranskripten och visa antal körningar och tid per hook, så att långsamma hooks syns.
- [ ] **Användningsstatistik**: Läs `skillUsage` i `~/.claude.json` och sessionerna för att visa vad som används, och underlätta städning av oanvänt.
- [ ] **Memory-redigering**: Skapa, redigera och ta bort minnesfiler (idag bara läsning), plus visning av `CLAUDE.md` med uppskattad tokenstorlek.
- [ ] **MCP-hälsostatus**: Provkör servern kort och visa om den svarar och vilka verktyg den har.
- [ ] **Sessions: sök och återuppta**: Fritextsökning över sessioner och en knapp som öppnar `claude --resume <id>` i terminalen.

## Större idéer

- [ ] **Profiler/presets**: Spara och växla mellan uppsättningar (t.ex. "Frontend", "Research") som slår på och av skills, MCP och hooks tillsammans.
- [ ] **Plugin-vy**: Lista installerade plugins och marketplaces, med aktivera/inaktivera via `enabledPlugins`.
- [ ] **Kostnad och kontext**: Visa uppskattad resident kontext per `CLAUDE.md`, skill-lista och MCP, ungefär som `/context` men i panelen.
