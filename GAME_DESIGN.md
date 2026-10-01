# SpellCrafter — Game Design Doc (v0.1)

**Genre:** Single-player roguelike deckbuilder (digital)
**Hook:** You don't draft cards, you *craft* them. Every spell in your deck is built from ingredients you collect over a run.
**Setting:** Dark fantasy. Card crafting *is* the magic system.

## Premise

The old gods wrote the world into being. When they died, their pens fell to the rest of us.

You are an **Inkbinder** (working title), a mage whose magic is writing. What you inscribe on a card becomes true for as long as the card holds together. Ink is mixed from ash, silver, gold and blood; cards are cut from paper, wood, stone and precious metal. Every spell wears its page down, and the strongest inks take something from you.

Somewhere past the chapel ruins, the first book, the **Unbound Grimoire**, has woken. It wants a new hand to hold it.

Other names considered for the player class: Glyphwright, Scrivener, Hexscribe, Folio Mage, Cardwright.

---

## 1. Core Loop

```
Explore a floor ──→ Scavenge raw materials ──→ Writing desk: refine → craft → re-inscribe
      │                     ↑                                   │
      └── random encounters ┘  (monster parts = enchantments)   ↓
                                                   Stairs down → next floor → the Grimoire
```

1. Explore a procedurally generated, top-down dungeon floor by lantern light.
2. Scavenge **raw materials** from the environment (ash heaps, ossuaries, silver veins, gilded tomes).
3. Wandering builds **Dread**, and random encounters get more likely. Monsters drop **monster parts**, which are enchantments.
4. At a **writing desk**, refine raws into ingredients, craft new cards, add enchantments to existing cards, mend worn ones, and rest.
5. Find the stairs and descend. The third floor holds the Unbound Grimoire.
6. Die → run ends. Discovered recipes carry over (planned).

---

## 2. Anatomy of a Crafted Card

Every crafted card needs four components:

| Slot | Required? | What it decides |
|---|---|---|
| **Card Material** | Yes | Base mana cost, durability, how many enchantments it can hold |
| **Ink Color** | Yes | The card's effect type (what it *does*) |
| **Ink Material** | Yes | Power multiplier plus a side effect |
| **Enchantments** | 0–N (limited by material) | Keywords that change how the card plays |

**Card power = Color base value × Ink material multiplier (+ enchantment modifiers)**

---

## 3. Ingredients (first-pass numbers, all tunable)

### 3.1 Ink Colors: *what the card does*

| Color | Effect | Base value |
|---|---|---|
| Red | Deal damage | 6 |
| White | Gain Block (shield) | 5 |
| Blue | Draw cards | 1 card per 3 value (rounded) |
| Green | Heal / Regen | 3 heal |
| Black | Apply Curse (Weak / Poison) | 3 stacks |
| Violet *(mixed: Red + Blue)* | Damage + draw | 4 dmg + 1 draw |
| Amber *(mixed: Red + White)* | Damage + block | 3 dmg + 3 block |

> **Ink mixing:** Combine two inks at the bench to make a hybrid color. Hybrids are weaker per effect but more flexible.

### 3.2 Ink Materials: *how strong the card is and at what price*

| Material | Multiplier | Side effect |
|---|---|---|
| Charcoal | ×0.75 | Cheap and common. No side effect. |
| Silver | ×1.0 | **Purify:** removes 1 debuff from you when played. |
| Gold | ×1.5 | +1 mana cost. |
| Blood | ×2.0 | Costs 3 HP to play. |

### 3.3 Card Materials: *durability and cost*

| Material | Base cost | Durability | Enchant slots | Special |
|---|---|---|---|---|
| Paper | 0 | 3 uses | 0 | Burns after its uses run out |
| Wood | 1 | 8 uses | 1 | — |
| Stone | 2 | Permanent | 1 | **Heavy:** x1.5 power |
| Silver | 1 | Permanent | 2 | — |
| Gold | 1 | Permanent | 3 | +2 gold every time it's played |

> **Durability** tracks uses across the whole run, not per fight. When a card breaks you get a salvage roll (see §4.3).
> This constant wear is what drives the crafting loop: cheap cards come and go, and permanent cards become heirlooms.

### 3.4 Enchantments: *keywords, harvested from monsters*

Enchantments are **monster parts**. You can only get one by killing (or finding) the creature it comes from, so hunting a specific enemy is a strategy.

| Monster part | Enchantment | Effect | Main source |
|---|---|---|---|
| Acolyte's Bell | Echo | Casts a second time at 50% power | Hollow Acolyte, Bell Warden |
| Moth Wing | Swift | Costs 0 the first time it's cast each fight | Gravemoth |
| Scrivener's Quill | Bound | Stays in your hand at end of turn | Drowned Scribe, Pale Scrivener |
| Ember Heart | Volatile | ×2 power, then Exhausts for the fight | Ashen Hound, chests |
| Hound Fang | Leech | Heal for 25% of the damage this card deals | Ashen Hound |
| Grave Candle | Siphon | Refund 1 mana if this card kills an enemy | Candle Ghoul |
| Ghoul Tongue | Hungering | +2 power each time it's cast in the same fight | Candle Ghoul |
| Weaver's Needle | Piercing | Damage ignores Block | Bone Weaver |
| Saint's Knucklebone | Hallowed | Also gain 4 Block when cast | The Ossuary Saint |

---

## 4. Getting Ingredients

### 4.1 Scavenging (exploration)
Each floor is a top-down dungeon with fog of war and a lantern radius. Scavenge spots hold **raw materials** themed to the floor:

| Floor | Common finds | Rare finds | Elite | Merchant |
|---|---|---|---|---|
| The Chapel Ruins | Ash, Bone Shards, Rotten Vestments, Old Timber, Grave Soil | Bloodroot, Grave Moss | The Bell Warden | Yes |
| The Drowned Archive | Drowned Kelp, Grave Moss, Rotten Vestments | Slate, Silver Ore | The Pale Scrivener | Yes |
| The Catacombs | Bone Shards, Grave Soil, Ash | Slate, Silver Ore | The Ossuary Saint | Yes |
| The Last Library | Bloodroot, Grave Soil | Gold Leaf, Silver Ore, Slate | (Boss) | No |

Reliquary boxes (chests) hold gold plus rare raws or monster parts. The elite guards a room and drops rare materials, including **Heartblood**.

### 4.2 Refining (at a writing desk)
Raw materials must be refined before they can be crafted. Some refining is a real choice.

| Raw | Becomes |
|---|---|
| Ash | Charcoal Ink ×2 |
| Bone Shards / Bloodroot / Drowned Kelp / Grave Moss / Grave Soil | White / Red / Blue / Green / Black ink |
| Rotten Vestments | Paper Card ×2 |
| Old Timber | Wood Card |
| Slate ×2 | Stone Card |
| Silver Ore | Silver Ink, **or** 2 ore → Silver Card |
| Gold Leaf | Gold Ink, **or** 2 leaf → Gold Card |
| Heartblood | Blood Ink ×2 |
| *6 of your own HP* | Blood Ink (always available) |

### 4.3 Random encounters and Dread
- Every step on open floor adds 1 **Dread**. After a short grace period, each step has a chance to trigger a fight: 2% + 0.03% per Dread, capped at 9%.
- Resting at a desk calms Dread by 30. Descending halves it.
- Monsters drop their monster part and themed raws.

### 4.4 Lantern oil
Your lantern is your light radius, and it runs on oil.

| Oil | Light radius |
|---|---|
| 60–100 | 5 tiles |
| 30–59 | 4 |
| 12–29 | 3 |
| 1–11 | 2 |
| 0 | 1, and random encounters are twice as likely |

- Oil drains very slowly: 1 point every 5 steps, so a full lantern lasts about 500 steps (roughly 2–3 floors).
- **Burn a card** (anytime while exploring): starter cards give 8 oil, paper 15, wood 30. Stone, silver and gold will not burn. You can't burn below 5 cards.
- **Resurface** from the up-stairs where you arrived on each floor: a full refill, but the climb back down costs 30 Dread. You return to the same floor.
- This makes cheap cards double as fuel, and it gives every card a second use once it has served its purpose.

### 4.5 Events
Each floor has 1–2 events, marked on the map with a purple glow. Every event offers a choice with a cost.

| Event | Choices |
|---|---|
| Candle Shrine | Pray: heal 12, +10 Dread. Take the candles: +30 oil, lose 4 max HP. |
| The Trapped Scribe | Lift the shelf: lose 8 HP, learn a spell for your Grimoire. Take his purse: +35 gold, +25 Dread. Walk on: +5 Dread. |
| The Ink Well | Drink: 50% two monster parts, 50% lose 10 HP. Fill your bottles: two random inks, +10 Dread. |
| Hanged Lanterns | Cut one down: +40 oil, then a fight. Climb for it: +25 oil, lose 6 HP. |
| The Chained Book | Read it: a rare ink (Ichor or Ghostlight), +2 Corruption. Burn it: +35 oil. |
| The Dead Peddler | Search his pack: three raws and 25 gold, but 40% of the time something in the pack attacks. Bury him: −20 Dread. |
| The Mirror Pool | Gaze: a copy of one of your crafted cards, +15 Dread. Drink: heal 15, +2 Corruption. |
| The Ink-Stained Altar | Offer a starter card: lose it, gain a relic. Offer blood: lose 10 HP, gain Ichor and a Pristine Essence. |

### 4.6 Merchant
- Sells raws, refined ingredients and monster parts. Prices are set by rarity.
- **Repair** a worn card for gold.

### 4.7 Salvage and breakage
- At a desk, dismantle one card per visit to recover one random component.
- Cards that break from wear have a 50% chance to leave a component behind.

---

## 5. Starting Deck ("common cards")

10 uncraftable basic cards:
- 5× **Strike**: 1 mana, deal 5
- 4× **Guard**: 1 mana, gain 5 Block
- 1× **Scribble**: 0 mana, draw 1

Starting inventory: 2 Charcoal, 1 Red ink, 1 White ink, 2 Paper, 1 Wood.
So the player can craft on turn one of the run, which teaches the main mechanic right away.

---

## 6. Recipe Discovery

Some exact combinations make **named spells** with unique effects beyond the formula.

| Recipe | Result |
|---|---|
| Black + Blood + Gold material | **Pact:** Deal 20, lose 5 max HP permanently |
| Blue + Silver + Silver material | **Clarity:** Draw 3, your next card costs 0 |
| Red + Blood + Paper | **Kindling:** Deal 10 to ALL enemies (still costs 3 HP) |
| Green + Gold + Wood | **Evergreen:** Heal 6, gain 4 Block; this card never loses durability |
| Red + White + Silver ink + Stone + Echo | **Bellstrike:** Deal 10, gain 10 Block (echoes) |
| Black + Blue + Blood + Silver card | **Mind Leech:** Apply 9 Poison, draw 2 |
| Black + Green + Charcoal + Wood | **Gravebloom:** Apply 5 Poison, heal 4 |
| Green + White + Silver ink + Silver card + Hallowed | **Saint's Litany:** Gain 12 Block, heal 5 |
| Black + Red + Blood + Wood + Piercing | **Needlestorm:** Deal 6 twice, apply 3 Poison (ignores Block) |
| Blue + White + Charcoal + Paper | **Drowned Hymn:** Draw 2, gain 5 Block |
| Red + Gold ink + Gold card | **Ember Rite:** Deal 9 to ALL enemies |

- Recipes are hidden until you craft them the first time, then saved to a **Grimoire** (per run in the prototype; persistent across runs is planned).
- Re-inscribing an existing card can complete a recipe that needs an enchantment (Bellstrike).
- Hint scrolls found in runs reveal partial recipes ("…Black ink and Blood…").

---

## 6.5 Ink Reactions

Casting an **inscribed** card right after one of a different ink sets off the reaction for that pair. A two-ink (hybrid) card always sets off its own reaction. Starter cards are plain ink: they never react and don't break a chain. Cards in hand that would react glow and show the reaction's name.

| Inks | Reaction | Effect |
|---|---|---|
| Red + Blue | Storm | Draw 1 card |
| Red + White | Brand | Deal damage equal to half your Block |
| Red + Green | Cautery | Heal 3 and cure your Poison |
| Red + Black | Hexfire | The target's Poison burns all at once |
| Blue + White | Aegis | Gain 5 Block |
| Blue + Green | Tide | Gain 1 mana |
| Blue + Black | Nightmare | Apply 2 Weak to the target |
| Green + White | Sanctuary | Heal 4 |
| White + Black | Shroud | Strip the target's Block |
| Green + Black | Rot | Spread the target's Poison to every other enemy |

This makes the order you cast in matter, and rewards crafting cards in inks that chain together.

---

## 6.6 Deeper Crafting

**Rare inks.** Refined from what elites and wraiths leave behind.

| Ink | Source | Effect |
|---|---|---|
| Ichor | Elites (Warden, Scrivener, Saint) | ×1.75 power; +1 Corruption every cast |
| Ghostlight | Choir Wraiths, Drowned Scribes | ×1 power; the card costs 1 less |

**Pristine finds.** 12% of scavenge spots glint. They give double materials and a **Pristine Essence**. Add the essence in the desk's Catalyst slot to make a Pristine card (×1.3 power).

**Cards grow with use.** Every crafted card counts its casts across the run. At 8 casts it becomes **Well-Worn** (+1 to damage, Block, healing and Poison); at 20 it becomes an **Heirloom** (+2 more). Re-inscribing keeps the wear.

**Corruption.** Builds from crafting with Blood ink (+2), bleeding at the desk (+1), and casting Ichor cards (+1 each). Resting at a desk lifts 2; praying at a Candle Shrine lifts up to 3.

| Level | Effect |
|---|---|
| 5+ Tainted | Black-ink and Blood-ink cards get +2 power, but you start every fight Weak |
| 10+ Forsaken | Forbidden recipes can be written, but enemies start every fight with +1 Strength |

Forbidden recipes: **The Unwriting** (Black + Blood + Stone: deal 30, lose 3 max HP) and **The Hollow Crown** (Black + White + Ichor + Gold card: 12 to ALL, gain 8 Block).

---

## 7. Combat Basics

- 3 mana per turn, draw 5 cards per turn.
- Enemies show their intent (attack / defend / buff) so the player can plan.
- Block resets each turn.
- HP carries over between fights. Heal at rest sites or with Green cards.

---

## 7.5 Relics

Passive trinkets. Each elite offers a choice of 3. Reliquary boxes have a 15% chance to hold one, and the merchant sells one for 70 gold.

| Relic | Effect |
|---|---|
| Cracked Inkwell | Blood ink costs 1 less HP to cast |
| Scrivener's Thimble | Paper cards last 2 casts longer |
| Moth Lantern | Oil burns half as fast, but Dread rises faster |
| Tolling Bell | Enemies start every fight with 1 Weak |
| Silver Needle | Your first attack each turn ignores Block |
| Chapel Candle | Heal 4 HP after every fight |
| Raven Quill | Draw 2 extra cards on the first turn of each fight |
| Heart Locket | +10 max HP |
| Bone Dice | Monsters drop an extra item a third of the time |
| Ink Prism | Ink reactions are twice as strong |

---

## 7.6 Elites, Guardians and the Boss

Each floor has an **elite** that wanders a side room and a **guardian** that stands on the stairs down. You can't descend until the guardian is beaten. Both drop a choice of 3 relics.

| Floor | Elite | Guardian (phase 2 at half HP) |
|---|---|---|
| The Chapel Ruins | The Gravedigger (40) | The Bell Warden (54): *The bell cracks* |
| The Drowned Archive | The Drowned Abbot (48) | The Pale Scrivener (62): *The Scrivener writes back* |
| The Catacombs | The Choirmaster (54) | The Ossuary Saint (68): *The Saint rises* |
| The Last Library | none | The Unbound Grimoire (110, boss): *The final page* |

- **Phase 2:** when a guardian or the boss drops to half HP, a banner announces the change. It gains Strength and Block and switches to a harder move set, starting from that set's first move.
- Phase changes can be triggered by direct damage, the Detonate reaction, or poison ticks.

---

## 8. Run Structure

- 4 floors: The Chapel Ruins → The Drowned Archive → The Catacombs → The Last Library (boss). Enemy HP scales ×1, ×1.1, ×1.2, ×1.3 by floor.
- Each floor: ~11 rooms, 12–14 scavenge spots, 2–3 reliquary boxes, a writing desk near the start, a merchant, an elite, and the stairs in the farthest room, held by the floor's guardian.
- **You can craft only at writing desks.** Each desk allows one rest (heal 30% max HP).
- Descending the stairs restores 20% max HP.

### 8.1 Writing desk actions
| Tab | What you can do |
|---|---|
| Inscribe | Craft a new card from refined ingredients (live preview) |
| Refine | Turn raw materials into ingredients, or bleed for Blood Ink |
| Deck | Re-inscribe (add a monster part to a card with a free slot), Mend (restore a worn card using its material), Salvage |

---

## 9. Art Direction

- **Hand-drawn 16×16 pixel art** for the Inkbinder, tiles, scavenge spots, props, enemies and elites. Map tiles are drawn at 3× on desktop and 2× on phones, always at whole-number scales so pixels stay crisp.
- Tiles are drawn once with numbered colors; each floor maps them to its own palette (chapel violet, archive teal, library umber).
- Enemy sprites double as fight portraits at 6×. Cards carry pixel ink glyphs: flame (red), ward (white), eye (blue), leaf (green), skull (black).
- Card frames show their material: paper, wood grain, speckled stone, silver and gold sheen.
- Lighting is drawn in stepped bands around the lantern, with a slight flicker.

### 9.1 Animation
- The Inkbinder glides between tiles with a step bob; the camera stays locked to the sprite-pixel grid so nothing shimmers.
- Elites, the boss and events hover gently. Pickups float up as text over the tile.
- In fights, cast cards fly out of your hand, enemies shake and flash white when hit and sink when killed, damage and Block numbers rise, and a red vignette flashes when you are hurt.
- Heavy hits shake the screen (bigger shakes for hits on you and for kills). Cast cards burst into sparks in their ink colors, and scavenging or opening a reliquary throws sparks on the map.
- Everything respects the reduced-motion setting.

### 9.3 Guided first run
Short tips appear once each, the first time they matter: exploring, the writing desk, the first fight, low lantern oil, Corruption, and the first guardian. Each one has "Got it" and "Turn off tips". What you've seen is saved with the rest of your progress.

### 9.2 Sound
All sound is synthesized in the browser (Web Audio), so there are no audio files. Effects cover footsteps, pickups, reliquaries, casting, hits, kills, Block, hurt, healing, crafting (quill scratch and chime), discovering a spell, burning a card, stairs, encounters, events, victory and defeat. Each floor has its own ambient drone with echoing water drips. A Sound on/off toggle sits in the top bar and is remembered.

---

## 10. Meta-Progression

- **The Grimoire persists.** Every recipe you discover, by crafting it or from the Trapped Scribe, is saved in the browser and known in every later run. The title screen opens the Grimoire and shows lifetime stats (runs, victories, deepest floor). "Forget everything" wipes it after a second tap.
- **Runs autosave** to the browser. The title screen offers Continue (showing the floor and HP). Closing the tab mid-fight restarts that fight from its beginning; an unresolved event or relic choice is waiting when you return. Starting a new run over a saved one needs a second tap.
- **Inkbinders.** Chosen on the title screen; unlocked by lifetime progress. Each has its own cloak color.

| Inkbinder | Starts with | Unlock |
|---|---|---|
| The Inkbinder | The standard kit | Always |
| The Bloodscribe | 70 max HP, 2 Blood Ink, the Cracked Inkwell, 2 Corruption | Reach the Drowned Archive |
| The Ash Monk | +3 Charcoal Ink, +2 Wood Cards, +2 Ash; 4 Block at the start of every fight; only 10 gold | Know 3 spells in the Grimoire |
| The Gilded Heretic | 120 gold, a Gold Card and Gold Ink; a 70-oil lantern | Reach the Catacombs |
- No permanent stat boosts, so each run stays fair.

---

## 11. Open Questions

1. **Engine:** stay on web, or move to Godot once the systems feel right?
2. **Deck size limits:** Should there be a maximum deck size to stop players crafting endlessly?
3. **Fleeing:** Should you be able to run from a random encounter, at a cost (drop materials, lose HP, gain Dread)?
4. ~~Ingredient quality~~ (done as Pristine finds and essence).

Decided: random encounters stay as they are (driven by Dread). Lantern oil is in (see 4.4).

---

## 12. Build Order

1. ~~Data model and card formula~~ (done)
2. ~~Combat prototype~~ (done)
3. ~~Crafting bench with live preview~~ (done)
4. ~~Exploration floors, scavenging, refining, monster parts, re-inscribe and mend~~ (done)
5. ~~Pixel art pass and lantern oil~~ (done)
6. ~~Persistent Grimoire~~, ~~a fourth floor, new creatures, enchantments, recipes and events~~, ~~animation and sound~~ (done)
7. ~~Ink reactions, relics, save and continue~~ (done)
8. ~~Unlockable Inkbinders, rare inks, pristine finds, card wear, Corruption and forbidden recipes~~ (done)
9. ~~More events, floor guardians with boss phases, new elites, polish (screen shake, particles, guided first run)~~ (done)
10. Next: playtesting feedback.
