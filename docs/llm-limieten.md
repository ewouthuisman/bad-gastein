# LLM-limieten (Soipie en Soipen-commentaar)

## Wat het gratis Gemini-plan beperkt (extern, niet in onze code)
- Per model gelden een aanvragen-per-minuut-, aanvragen-per-dag- en tokens-per-minuut-limiet. Gaat een model over de limiet, dan geeft Google `429`.
- De exacte getallen voor onze key zijn niet bekend. Ze staan in Google AI Studio onder Rate limits en wijzigen zonder aankondiging. Hier dus bewust geen getallen.
- Elk model heeft zijn eigen quota. Daarom probeert `complete()` bij een `429` het volgende model.

## Wat onze code zelf begrenst
| Wat | Waarde | Waar |
|---|---|---|
| Soipie-berichten per persoon per dag | 25 | `soipie/index.ts` (`PER_USER_PER_DAY`) |
| Soipie-berichten voor de hele groep per dag | 150 | `soipie/index.ts` (`GROUP_PER_DAY`) |
| Lengte van een bericht | 1000 tekens | `soipie/index.ts` |
| Chatgeschiedenis meegestuurd | laatste 10 berichten | `soipie/index.ts` |
| Max. uitvoer Soipie-antwoord | 500 tokens | `soipie/index.ts` |
| Max. uitvoer Soipen-commentaar | 700 tokens | `soipen-comment/index.ts` |
| Soipen-commentaar via cron | elke 30 min, niet tussen 02:00 en 10:00 (Wenen) | migratie `soipen_job` en `soipen-comment/index.ts` |
| Soipen-commentaar minimaal tussen twee runs | 10 min (ook bij aanroep vanuit de app) | `soipen-comment/index.ts` (`MIN_INTERVAL_MS`) |
| Max. aantal Gemini-modellen per aanroep | 6 | `_shared/llm.ts` |

## Belasting op de quota
- Cron: ongeveer 16 aanroepen per dag (8 uur actief, 2 per uur), plus aanroepen vanuit de app.
- Chat: maximaal 150 aanroepen per dag. Elk daarvan kan tot 6 Gemini-pogingen kosten als de modellen vol zitten.

## Als alles op is
- Soipie-chat: foutmelding "Soipie is even van de kaart (AI niet bereikbaar)" (HTTP 503).
- Soipen-commentaar: valt terug op vaste zinnen uit `fallbackLines.ts`.
- Tweede provider: OpenRouter, maar alleen als `OPENROUTER_API_KEY` als secret staat. Op 2026-10-20 stond die niet.
