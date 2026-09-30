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

---

## 4. Getting Ingredients

### 4.1 Scavenging (exploration)
Each floor is a top-down dungeon with fog of war and a lantern radius. Scavenge spots hold **raw materials** themed to the floor:

| Floor | Common finds | Rare finds | Elite | Merchant |
|---|---|---|---|---|
| The Chapel Ruins | Ash, Bone Shards, Rotten Vestments, Old Timber, Grave Soil | Bloodroot, Grave Moss | The Bell Warden | Yes |
| The Drowned Archive | Drowned Kelp, Grave Moss, Rotten Vestments | Slate, Silver Ore | The Pale Scrivener | Yes |
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

### 4.4 Merchant
- Sells raws, refined ingredients and monster parts. Prices are set by rarity.
- **Repair** a worn card for gold.

### 4.5 Salvage and breakage
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

- Recipes are hidden until you craft them the first time, then saved to a **Grimoire** (per run in the prototype; persistent across runs is planned).
- Re-inscribing an existing card can complete a recipe that needs an enchantment (Bellstrike).
- Hint scrolls found in runs reveal partial recipes ("…Black ink and Blood…").

---

## 7. Combat Basics

- 3 mana per turn, draw 5 cards per turn.
- Enemies show their intent (attack / defend / buff) so the player can plan.
- Block resets each turn.
- HP carries over between fights. Heal at rest sites or with Green cards.

---

## 8. Run Structure

- 3 floors: The Chapel Ruins → The Drowned Archive → The Last Library (boss). Enemies get 15% and then 30% more HP on the lower floors.
- Each floor: ~11 rooms, 12–14 scavenge spots, 2–3 reliquary boxes, a writing desk near the start, a merchant, an elite, and the stairs in the farthest room.
- **You can craft only at writing desks.** Each desk allows one rest (heal 30% max HP).
- Descending the stairs restores 20% max HP.

### 8.1 Writing desk actions
| Tab | What you can do |
|---|---|
| Inscribe | Craft a new card from refined ingredients (live preview) |
| Refine | Turn raw materials into ingredients, or bleed for Blood Ink |
| Deck | Re-inscribe (add a monster part to a card with a free slot), Mend (restore a worn card using its material), Salvage |

---

## 9. Meta-Progression

- Grimoire (discovered recipes) persists.
- Unlock new ingredients into the loot pool (e.g., new ink colors, new enchantments) by reaching milestones.
- No permanent stat boosts, so each run stays fair.

---

## 10. Open Questions

1. **Engine:** stay on web, or move to Godot once the systems feel right?
2. **Deck size limits:** Should there be a maximum deck size to stop players crafting endlessly?
3. **Visible vs. random enemies:** Keep random encounters driven by Dread, or show wandering monsters on the map that you can sneak past?
4. **Fleeing:** Should you be able to run from a random encounter, at a cost (drop materials, lose HP, gain Dread)?
5. **Ingredient quality:** Should scavenged materials come in grades (crude / fine / pristine) that change their multiplier?
6. **Light as a resource:** Should lantern oil run down as you explore, shrinking your light radius?

---

## 11. Build Order

1. ~~Data model and card formula~~ (done)
2. ~~Combat prototype~~ (done)
3. ~~Crafting bench with live preview~~ (done)
4. ~~Exploration floors, scavenging, refining, monster parts, re-inscribe and mend~~ (done)
5. Persistent Grimoire and unlocks across runs.
6. More floors, enemies, recipes and events. Balance pass.
7. Art, sound, polish.
