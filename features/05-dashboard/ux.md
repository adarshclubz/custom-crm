# 05 · Dashboard — UX

Status: ⬜ Template — to fill in a later chat. (This is the main UX surface — most design effort lands here.)

## Layout
- _Overall: stats bar on top, filters row, contacts table, side panel slides in from right?_
- _Single screen — describe the regions and their proportions._

## Components & states
| Component | States to design |
|---|---|
| Stats bar | loading · populated · zero-state |
| Filter controls | status filter · tag filter · date-range picker · active-filter chips · clear |
| Contacts table | loading · populated · empty · filtered-empty · row hover/selected · multi-select (for bulk send) |
| Status cell | one visual per status (not_contacted/sent/opened/clicked/replied/bounced) |
| Contact side panel | closed · open/loading · history timeline · reply display · no-activity · actions (send) |

## Interactions
- _Row click → panel open. Multi-select → bulk send entry (feature 02)._
- _How do filters combine and clear?_
- _Timeline ordering and how events nest under each sent email._

## Visual / wireframe notes
- _Sketch / describe here. Tailwind. Keep it one clean dashboard view._

## Cross-references
- Add/import contacts: [feature 01](../01-contacts/ux.md).
- Compose/send entry points: [feature 02](../02-compose-send/ux.md).
- Event timeline content: [feature 03](../03-tracking/ux.md).
- Reply content: [feature 04](../04-reply-detection/ux.md).
