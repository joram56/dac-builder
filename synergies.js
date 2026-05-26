window.SYNERGY_DEFS = [
  {
    name: "Elf",
    type: "race",
    levels: [
      { required: 3, perk: "elves gain 30% evasion" },
      { required: 6, perk: "elves gain another 30% evasion" }
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
      { required: 3, perk: "hunters have 50% chance to proc an extra hit" },
      { required: 6, perk: "hunters have another 50% chance to proc an extra hit" },
      { required: 9, perk: "hunters push targets 2 squares back on hit" }
    ]
  },
  {
    name: "Assassin",
    type: "class",
    levels: [
      { required: 3, perk: "assassins crit after a leap and have a 20% chance to deal 300% damage" },
      { required: 6, perk: "assassins gain an additional 20% chance to deal 400% damage" },
      { required: 9, perk: "assassins get a guaranteed crit again after 15s" }
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
    name: "Monk",
    type: "class",
    levels: [
      { required: 2, perk: "monks have a 50% chance to cull a low-health enemy when dealing damage" },
      { required: 4, perk: "monks have a 50% chance to halve an enemy's HP when dealing damage" }
    ]
  },
  {
    name: "Priest",
    type: "class",
    levels: [
      { required: 2, perk: "gain a Tango if you are playing allowed_slots -1 and take damage" },
      {
        required: 4,
        perk: "for every slot available, a priest converts an enemy of the same or lower level to fight for you"
      }
    ]
  },
  {
    name: "Warrior",
    type: "class",
    levels: [
      { required: 3, perk: "+5 armor for warriors" },
      { required: 6, perk: "+10 armor for warriors" }
      { required: 9, perk: "Warriors reflect physical/magical damage, based on armour" }
    ]
  },
  {
    name: "Demon",
    type: "race",
    levels: [{ required: 1, perk: "the demon gets pure attack damage if it is the only demon on the board" }]
  },
  {
    name: "Demon Hunter",
    type: "class",
    levels: [
      { required: 2, perk: "all demons get pure attack damage" },
      { required: 4, perk: "all units deal only pure damage" }
    ]
  },
  {
    name: "Knight",
    type: "class",
    levels: [
      { required: 2, perk: "knights start battle with a shield" },
      { required: 4, perk: "knights have a chance to gain a shield every 4s" },
      { required: 6, perk: "knights heal for 400 whenever they gain a shield" }
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
    name: "Aqir",
    type: "race",
    levels: [
      {
        required: 2,
        perk: "if a duplicate non-Aqir unit dies while another copy survives, summon an Aqir of the surviving unit's level"
      },
      {
        required: 4,
        perk: "if an Aqir dies while another duplicate Aqir survives, summon an Aqir 2 levels above the surviving duplicate"
      }
    ]
  },
  {
    name: "Centaur",
    type: "race",
    levels: [
      { required: 2, perk: "centaurs charge the furthest enemy at battle start and stun all enemies in their path" },
      { required: 4, perk: "all melee allies also charge whenever they move" }
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
    name: "Elemental",
    type: "race",
    levels: [
      { required: 2, perk: "when attacked, elementals have a 10% chance to turn the attacker to stone" },
      { required: 4, perk: "all allies gain a 15% chance to turn their attacker to stone" },
      { required: 6, perk: "stoned units take increased damage" }
    ]
  },
  {
    name: "Faceless",
    type: "race",
    levels: [{ required: 2, perk: "if you have no other synergies active, your units are immune to negative effects" }]
  },
  {
    name: "God",
    type: "race",
    levels: [
      { required: 2, perk: "all unit cooldowns are reduced by 10%" },
      { required: 4, perk: "all unit cooldowns are reduced by another 20%" },
      { required: 6, perk: "casts reduce remaining cooldowns by additional seconds" }
    ]
  },
  {
    name: "Harpy",
    type: "race",
    levels: [
      { required: 2, perk: "single-target spells hit 1 additional unit" },
      { required: 4, perk: "single-target spells hit 1 more additional unit" }
    ]
  },
  {
    name: "Kobold",
    type: "race",
    levels: [
      { required: 2, perk: "duplicate units summon an additional copy of that unit" },
      { required: 4, perk: "unpaired Kobolds transform into another unit of the same star level" }
    ]
  },
  {
    name: "Naga",
    type: "race",
    levels: [
      { required: 2, perk: "all units gain 10% magic resistance" },
      { required: 4, perk: "all units gain another 15% magic resistance" },
      { required: 6, perk: "units absorb magic damage and explode it back out" }
    ]
  },
  {
    name: "Ogre",
    type: "race",
    levels: [{ required: 2, perk: "ogres eat adjacent enemy units of the same or lower level" }]
  },
  {
    name: "Pandaren",
    type: "race",
    levels: [
      {
        required: 1,
        perk: "has a chance to drop a random unit of the same race as a board unit, excluding units already on the board"
      },
      {
        required: 2,
        perk: "has a higher chance to drop another Pandaren that is already on the board"
      }
    ]
  },
  {
    name: "Satyr",
    type: "race",
    levels: [{ required: 2, perk: "Satyrs fear nearby enemies when multiple enemies surround a Satyr unit" }]
  },
  {
    name: "Tauren",
    type: "race",
    levels: [
      { required: 2, perk: "summon a taunting totem in the middle of the board" },
      {
        required: 4,
        perk: "summon 2 more totems in the back line: one prevents attacks and one silences; their cooldowns are reduced by God"
      }
    ]
  },
  {
    name: "Wizard",
    type: "class",
    levels: [{ required: 2, perk: "all synergies' second level requires one less unit" }]
  },
  {
    name: "Troll",
    type: "race",
    levels: [
      { required: 2, perk: "all units gain 15 attack speed" },
      { required: 4, perk: "all units gain 45 attack speed" },
      { required: 6, perk: "units gain attack speed stacks per attack" }
    ]
  },
  {
    name: "Beast",
    type: "race",
    levels: [
      { required: 2, perk: "all units get 10% bonus attack damage" },
      { required: 4, perk: "all units get another 15% bonus attack damage" },
      { required: 6, perk: "all attacks grant stacking damage up to 10 stacks" }
    ]
  },
  {
    name: "Draenei",
    type: "race",
    levels: [
      { required: 2, perk: "all Draenei steal 100 HP from a random unit every 4s" },
      { required: 4, perk: "whenever a unit heals for 100, it deals 100 pure damage in an area around it" }
    ]
  },
  {
    name: "Dwarf",
    type: "race",
    levels: [{ required: 2, perk: "dwarves gain 200 attack range and deal more damage to distant units" }]
  },
  {
    name: "Orc",
    type: "race",
    levels: [
      { required: 2, perk: "all units get 100 HP" },
      { required: 4, perk: "all units get another 300 HP" },
      { required: 6, perk: "all units get HP equal to (100 minus courier health) times 9" }
    ]
  },
  {
    name: "Goblin",
    type: "race",
    levels: [
      { required: 3, perk: "a random unit gets 10 armor and 10 HP regen" },
      { required: 6, perk: "all units gain 10 armor and 10 HP regen" }
    ]
  },
  {
    name: "Human",
    type: "race",
    levels: [
      { required: 3, perk: "gain 2 experience every round" },
      {
        required: 6,
        perk: "gain courier level minus 2 experience every round if the round was won and a human stayed alive"
      }
    ]
  },
  {
    name: "Druid",
    type: "class",
    levels: [
      { required: 2, perk: "2 one-star Druids combine into a 2-star Druid" },
      { required: 4, perk: "2 two-star Druids combine into a 3-star Druid" }
    ]
  }
];
