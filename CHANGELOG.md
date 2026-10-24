# Changelog

## 0.4.0

### Detective board
- **Drawing lines.** Pressing a card's link button starts a line at once; it follows the pointer and snaps to the card under it. Drag onto a card and let go, or click and then click any card.
- **Anywhere on a card.** A line can end on any part of the target card — title, text, picture, buttons. While a line is out, card buttons and fields are disabled, so finishing a line can no longer press a card's × by accident.
- **Line controls on hover.** Hovering a line shows a × at each end, either of which removes it, and a + in the middle to add a label.
- **Labels are optional.** A line without a label shows nothing on it. A label has its own × that removes the label and keeps the line; clicking the label edits it.

### Specialties
- **Several per skill.** The skill row shows the first specialty and a "+N" chip; hovering lists them all in a styled tooltip.
- **Specialty popover.** Clicking opens a popover by the row: click to rename, × to remove, a field at the bottom to add. Read-only when the sheet is locked.
- **Predator specialties** cannot be removed or renamed there; their tooltip says to change the predator type instead.
- **One record at a time.** Edits now change one bonus record at a time and leave the rest of the skill's bonuses untouched.

### Pool constructor
- **Specialty chips.** The specialty checkbox is replaced by a row of chips: None plus every specialty of every skill in the pool, grouped by skill when there are two. The chat card names the one used: "Specialty (Grappling) +1".
- **Odds.** A new Odds button shows exact chances for the current pool: win, critical win, messy critical, bestial failure, total failure, and a table by number of successes. Beside the dialog it stays open and updates as the pool and difficulty change. Willpower rerolls are not counted.
- **Footer.** Modifier and Difficulty are steppers next to the buttons; Cancel and Roll are the same size.
- **Blood surge** turns red when ticked.

### Inventory
- **Armour dialog.** Armour is added and edited through a dialog like weapons: four classes from the corebook table with examples and drawbacks (0 against bullets, −1 die to Dexterity pools). The rating shows beside the name in the list.
- **Older armour.** Armour made without a class is read from its rating when that is unambiguous.
- **Class lists.** Weapon and armour class lists are left-aligned, with larger, upright examples.

### Look and feel
- **One note size.** Every small italic note — specialties, merit details, toggle notes, picker and dialog notes — now uses one size, set by `--bo-size-note`.
- **Checkboxes.** They no longer show Foundry's grey square over the sheet's own, everywhere on the sheet.

### Fixes
- Rolling with a skill in the pool no longer fails with "skillSlot is not defined".

## 0.3.0

- **Predator type bonuses:** granted with a choice dialog, tracked in a journal, rolled back when the predator changes.
- **Derived trackers:** Health and Willpower are derived from attributes.
- **Rolls:** opposed pools for powers, and the Remorse check.
- **Merit picker:** browse by rubric; Background flaws are listed and written as flaws.
- **Weapon dialog** with damage classes.
- **Unavailable powers** greyed out: amalgam requirements, rituals by Blood Sorcery, ceremonies by Oblivion.
- **Dropdowns** drawn in the sheet's own style, with search and keyboard support.
- **Pool constructor:** grouped by heading, with dots and untrained skills listed last.
