window.SYNERGY_DEFS = [
  {
    name: "Elf",
    type: "race",
    levels: [
      { required: 3, perk: "30% evasion" },
      { required: 6, perk: "another 30% evasion" }
    ]
  },
  {
    name: "Mage",
    type: "class",
    levels: [
      { required: 3, perk: "-30% magic resistance to enemies" },
      { required: 6, perk: "another -30% magic resistance to enemies" },
      { required: 9, perk: "enemies freeze when taking magic damage" }
    ]
  },
  {
    name: "Hunter",
    type: "class",
    levels: [
      { required: 3, perk: "50% chance to proc another hit" },
      { required: 6, perk: "another 50% chance to proc another hit" },
      { required: 9, perk: "hunters push targets 2 squares back on hit" }
    ]
  },
  {
    name: "Warlock",
    type: "class",
    levels: [
      { required: 2, perk: "5% lifesteal for all units" },
      { required: 4, perk: "another 25% lifesteal for all units" },
      { required: 6, perk: "when a warlock attacks, he steals 5% max HP and gains it" }
    ]
  },
  {
    name: "Warrior",
    type: "class",
    levels: [
      { required: 3, perk: "+5 armor" },
      { required: 6, perk: "+10 armor" }
    ]
  },
  {
    name: "Demon",
    type: "race",
    levels: [{ required: 1, perk: "the unit gets pure damage if it is the only demon on the board" }]
  },
  {
    name: "Demon Hunter",
    type: "class",
    levels: [
      { required: 2, perk: "all demons get pure damage" },
      { required: 4, perk: "all units deal only pure damage" }
    ]
  },
  {
    name: "Undead",
    type: "race",
    levels: [
      { required: 3, perk: "-30% max HP to all non-undead units (including your own)" },
      { required: 6, perk: "another -30% max HP to all non-undead units" },
      { required: 9, perk: "all non-undead units lose 5% max HP per second" }
    ]
  },
  {
    name: "Dragon",
    type: "race",
    levels: [
      { required: 3, perk: "all dragons start fights with full mana" },
      { required: 5, perk: "all units start fights with full mana" }
    ]
  },
  {
    name: "Wizard",
    type: "class",
    levels: [{ required: 2, perk: "all synergies' second level requires one less unit" }]
  },
  {
    name: "Beast",
    type: "race",
    levels: [
      { required: 2, perk: "all units get 10% bonus attack damage" },
      { required: 4, perk: "all units get another 15% bonus attack damage" },
      { required: 6, perk: "all attacks grant stacking damage up to 10 stacks" }
    ]
  }
];
