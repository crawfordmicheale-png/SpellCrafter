# SpellCrafter — Game Design Doc (v0.1)

**Genre:** Single-player roguelike deckbuilder (digital)
**Hook:** You don't draft cards, you *craft* them. Every spell in your deck is built from ingredients you collect over a run.

---

## 1. Core Loop

```
Map node → Encounter → Rewards (ingredients) → Crafting Bench → next node
                                   ↑                   ↓
                              Shop / Salvage ←── Deck grows & evolves
```

1. Choose a path on a branching map (Slay the Spire-style).
2. Fight enemies with your deck.
3. Earn ingredients and gold.
4. Craft new cards at the Crafting Bench, buy materials at shops, or salvage old cards for parts.
5. Beat the act boss → next act. Die → run ends. Discovered recipes and some unlocks carry over.

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
| Stone | 2 | Permanent | 1 | **Heavy:** can't be discarded or destroyed by enemies |
| Silver | 1 | Permanent | 2 | — |
| Gold | 1 | Permanent | 3 | +1 gold every time it's played |

> **Durability** tracks uses across the whole run, not per fight. When a card breaks you get a salvage roll (see §4.3).
> This constant wear is what drives the crafting loop: cheap cards come and go, and permanent cards become heirlooms.

### 3.4 Enchantments: *keywords*

| Enchantment | Effect |
|---|---|
| Echo | Plays a second time at 50% power |
| Swift | Costs 0 the first time it's drawn each combat |
| Bound | Stays in your hand at end of turn |
| Volatile | ×2 power, then Exhausts (removed for the rest of combat) |
| Leech | Heal for 25% of the damage this card deals |
| Siphon | Refund 1 mana if this card kills an enemy |

---

## 4. Getting Ingredients (all three sources)

### 4.1 Combat Loot
- Normal fight: 1–2 common ingredients (Charcoal, basic colors, Paper, Wood) + gold.
- Elite fight: 1 rare ingredient (Gold ink, Blood, Silver or Gold material) or 1 enchantment.
- Boss: pick 1 of 3 rare bundles.
- **Enemy-themed drops:** each enemy type drops ingredients that match it (fire elementals drop Red ink, golems drop Stone). That lets players hunt for what they need.

### 4.2 Shops
- Sell individual ingredients, prices scaled by rarity.
- Sell a few **pre-crafted cards** at a premium.
- Service: **Repair** a card (restore durability) for gold.
- Service: **Reink** a card (swap the ink color) for gold.

### 4.3 Salvage (taking cards apart)
- At the bench, dismantle a card to recover **one random component** (or 2 with a relic/upgrade).
- Cards that break from durability also give a 50% chance to salvage one component.
- The Starter Cards (see §5) salvage into Charcoal + Paper.

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
| Red + Charcoal + Paper + Volatile | **Kindling:** Deal 12 to ALL enemies |
| Green + Gold + Wood | **Evergreen:** Heal 5; this card never loses durability |

- Recipes are hidden until you craft them the first time, then saved to a **Grimoire** that persists across runs.
- Hint scrolls found in runs reveal partial recipes ("…Black ink and Blood…").

---

## 7. Combat Basics

- 3 mana per turn, draw 5 cards per turn.
- Enemies show their intent (attack / defend / buff) so the player can plan.
- Block resets each turn.
- HP carries over between fights. Heal at rest sites or with Green cards.

---

## 8. Run Structure

- 3 acts × ~15 nodes, each act ending in a boss.
- Node types: Fight, Elite, Shop, **Crafting Bench** (free craft + 1 salvage), Rest, Event, Treasure.
- **You can craft only at Bench nodes** (and maybe after bosses). This keeps crafting a meaningful decision instead of something you do after every fight.

---

## 9. Meta-Progression

- Grimoire (discovered recipes) persists.
- Unlock new ingredients into the loot pool (e.g., new ink colors, new enchantments) by reaching milestones.
- No permanent stat boosts, so each run stays fair.

---

## 10. Open Questions

1. **Engine:** Godot, Unity, or web (TypeScript)?
2. **Deck size limits:** Should there be a maximum deck size to stop players crafting endlessly?
3. **Crafting frequency:** Is "only at Bench nodes" too restrictive? Playtest.
4. **Art direction:** Should card appearance visibly reflect its ingredients (paper looks worn, gold shines, blood ink drips)? Strongly recommended: it's the fantasy.
5. **Upgrades:** Can you add an enchantment to an existing card, or only when you first craft it?

---

## 11. Suggested Build Order

1. **Data model:** ingredients plus the card formula as plain data (JSON) and a function that calculates a card from its ingredients.
2. **Combat prototype:** one fight with the starting deck, no art.
3. **Crafting Bench UI:** drag ingredients into slots and preview the resulting card live.
4. **Run loop:** map, rewards, shop, salvage.
5. Recipes, Grimoire, meta-progression.
6. Art, sound, polish.
