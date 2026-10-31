# Lei Aberta: visual-first home (design brief)

Plan for the home page, implemented with Next.js + shadcn/ui. Since this was written the look moved to a brighter, playful style (3D art, motion, topic tiles first) and party colors follow the left-right survey in the README; the structure below still holds.

## Layout, top to bottom
1. **Header**: "Lei Aberta" + one line: "Políticas públicas do Brasil desde 1988, sempre com a fonte oficial." Theme toggle (claro/escuro), default follows the system, choice saved in localStorage.
2. **Filters, one sticky row**: busca, nível, área, partido do autor, partido no Executivo, período. Every chart, number and card below uses the same slice. Clicking a bar or segment applies that filter.
3. **Stat tiles**: total de políticas (hero number), níveis, áreas, % com fonte oficial (should always be 100%).
4. **Charts** (hover tooltip on every mark, "ver tabela" toggle on each):
   - Políticas por ano: stacked columns by level (federal / estadual / municipal), legend + peak label.
   - Por nível: tall segmented bar with % inside.
   - Por área: horizontal bars, one hue, value at the tip, area icon.
   - **Partido do autor** (at authorship): horizontal bars, one neutral hue. Executive-originated bills counted as "Poder Executivo", not as a party.
   - **Partido no Executivo** (president / governor / mayor at sanction): its own chart, also one neutral hue. Never merged with the author chart.
5. **Policy cards**: area icon, status chip (icon + label), level dot, year, title, summary clamped to 2 lines. Click opens a detail panel with full summary, authors with party, executive with party (labeled as a separate field), and a big "Ver texto oficial" button per source.

## Neutrality rules for the UI
- Parties use one neutral hue, never party colors, and are sorted by count (ties alphabetical).
- Status is shown with neutral icons, never good/bad colors.
- Copy describes; no adjectives about parties or policies.

## Color (validated with the dataviz checker)
- Levels use categorical slots 1-3. Light: federal `#2a78d6`, estadual `#eb6834`, municipal `#1baf7a`. Dark: `#3987e5`, `#d95926`, `#199e70`. All checks pass in both modes; municipal is under 3:1 contrast on the light surface, so the legend and table view are required.
- Surfaces: light `#fcfcfb` on page `#f9f9f7`; dark `#1a1a19` on page `#0d0d0d`.
- Bars at most 24px thick, 4px rounded data end, 2px gap between stacked segments, hairline gridlines.

## Data shape additions
Each record carries `executive: { name, office, party }` beside `authors[].party`. `party: null` means no party (for example a president without a party). Sample data in `site/data/` covers 17 well-known federal laws (1990 to 2020) with Planalto links; the links could not be checked from here because the sandbox blocks planalto.gov.br.
