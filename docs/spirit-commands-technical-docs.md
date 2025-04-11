# Spirit Commands System Technical Documentation

## System Architecture Overview

### Core Components

- Command System: Slash commands (Discord.js)
- Database: MongoDB with Mongoose schemas
- Battle System: InteractiveBattleEngine
- Spirit Management: Collection and stats
- Emotion System: Affinity and interaction mechanics

## Data Models

### 1. Spirit Schema (`schema/spirits.js`)

```javascript
{
  name: String,          // Spirit's name
  husband: String,       // Owner's user ID
  stars: Number,         // Rarity/power level (1-5)
  happiness: Number,     // Current happiness level
  id: String,           // Unique identifier
  skin: String,         // Cosmetic variant
  attackboost: Number,  // Combat stat modifier
  defenceboost: Number, // Combat stat modifier
  agilityboost: Number, // Combat stat modifier
  spiritPowerBoost: Number, // Special ability modifier
  items: Array,         // Equipped/owned items
  nickname: String      // Custom name
}
```

### 2. Profile Schema (`schema/profile.js`)

Notable features:

- Spirit collection tracking
- Affinity system
- Achievement tracking
- Dating streak system
- Spirit interaction history

### 3. Quest Schema (`schema/quests.js`)

Implements:

- Daily quest system
- Progress tracking
- Reward distribution
- Streak bonuses

## Core Systems Implementation

### 1. Spirit Summoning (`Commands/Slash/Spirits/summon.js`)

- Cost: 2500 Spirit Coins
- Star rating probabilities:
  - 1★: 40%
  - 2★: 30%
  - 3★: 20%
  - 4★: 8%
  - 5★: 2%

Error handling:

```javascript
try {
  // Profile validation
  if (!userProfile) {
    return "Not started - use /start command";
  }
  // Balance check
  if (userProfile.balance < SUMMON_COST) {
    return "Insufficient funds";
  }
} catch (error) {
  console.error("Summon error:", error);
}
```

### 2. Combat Systems

#### Battle Engine (`utils/InteractiveBattleEngine.js`)

Key classes:

```javascript
class Character {
  constructor(name, stats, abilities, user, stars) {
    this.currentHP = stats.hp;
    this.energy = 0;
    this.stunTurns = 0;
    this.tempBoost = 0;
  }
}

class InteractiveBattleEngine {
  constructor(player, enemy, interaction) {
    this.round = 1;
    this.initiative = calculateInitiative();
  }
}
```

Combat mechanics:

- Turn-based system
- Ability energy management
- Status effects (stun, boost)
- Evasion calculation

### 3. Mini-Game Systems

#### Blackjack Implementation (`Commands/Slash/Spirits/blackjack.js`)

Card System:

```javascript
const cardImages = {
  AS: "../../../Cards/ace_of_spades.png",
  "2S": "../../../Cards/2_of_spades.png",
  // ... other cards
};

const ranks = [
  { rank: "A", value: 11 },
  // 2-10 have face value
  { rank: "J", value: 10 },
  { rank: "Q", value: 10 },
  { rank: "K", value: 10 },
];
```

Game Logic:

```javascript
const calculateHandTotal = (hand) => {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    total += card.value;
    if (card.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
};
```

Session Management:

```javascript
{
  gambling: true,
  autoEndGamblingSession: false,
  // Balance handling
  if (userProfile.balance < bet) {
    client.endGamblingSession(interaction.user.id);
    return "Insufficient funds";
  }
}
```

User Interaction:

```javascript
const filter = (m) =>
  m.author.id === interaction.user.id &&
  ["hit", "stand"].includes(m.content.toLowerCase());

collector.on("collect", async (m) => {
  const command = m.content.toLowerCase();
  if (command === "hit") {
    // Draw card logic
  } else if (command === "stand") {
    // End turn logic
  }
});
```

Visual Feedback:

```javascript
const gameEmbed = new EmbedBuilder()
  .setColor("#0099ff")
  .setTitle("Blackjack")
  .setDescription(
    `**Your Hand:** ${cards}
     Total: **${total}**
     **Dealer's Card:** ${visibleCard}`
  );
```

Error Recovery:

```javascript
try {
  // Game logic
} catch (error) {
  console.error("Blackjack error:", error);
  client.endGamblingSession(interaction.user.id);
  return false;
} finally {
  client.endGamblingSession(interaction.user.id);
}
```

#### Duel System (`Commands/Slash/Spirits/duel.js`)

Spirit Stats Structure:

```javascript
const defaultStats = {
  hp: 500,
  strength: 100,
  defence: 30,
  agility: 20,
  abilities: ["PowerStrike"],
};
```

Character Creation and Battle Setup:

```javascript
// Create battle character with stats
const playerCharacter = new Character(
  playerName,
  playerStats,
  playerStats.abilities,
  interaction.user,
  playerStars
);

// Load spirit data from JSON
const playerData = spiritJson[playerName] || defaultStats;
const enemyData = spiritJson[enemyName] || enemyDefaultStats;

// Initialize battle
const battle = new InteractiveBattleEngine(
  playerCharacter,
  enemyCharacter,
  interaction
);
```

Key Features:

- Star-based power scaling
- Dynamic stat loading from JSON/DB
- Fallback stats for missing data
- PvP combat system integration
- Persistent spirit data

Error Handling:

```javascript
try {
  await interaction.deferReply();
  // Battle setup
  battle.start();
} catch (error) {
  console.error("Duel command error:", error);
  await interaction.editReply({
    content: "An error occurred while starting the duel.",
  });
}
```

### 4. Collection Systems

#### Inventory Management (`Commands/Slash/Spirits/inventory.js`)

[Previous inventory content remains unchanged...]

### 5. Progression Systems

#### Achievement System (`Commands/Slash/Spirits/achievements.js`)

Categories:

```javascript
// Achievement categories
{
  bonding: "💝",     // Spirit interaction achievements
  affection: "❤️",   // Affinity-based achievements
  spacequake: "⚡",  // Event-based achievements
  quests: "📜",      // Quest completion achievements
  collection: "✨"   // Spirit collection achievements
}
```

Achievement Structure:

```javascript
{
  id: String,
  title: String,
  description: String,
  reward: {
    coins: Number,
    affinity: Number,
    energy: Number,
    seasonXP: Number,
    title: String
  }
}
```

Progress Tracking:

```javascript
// Calculate completion stats
Object.entries(ACHIEVEMENTS).forEach(([categoryName, achievements]) => {
  const totalAchievements = Object.keys(achievements).length;
  const completedAchievements = Object.values(achievements).filter(
    (achievement) => profile.achievements?.[achievement.id]
  ).length;
});
```

#### Quest System (`Commands/Slash/Spirits/quests.js`)

Daily Quest Management:

```javascript
// Quest generation and reset
if (!questData || questData.shouldResetQuests()) {
  const newQuests = generateDailyQuests(userProfile.selected);
  questData = await questData.resetQuests(newQuests);
}
```

Streak System:

```javascript
// Streak bonus calculation
const streakBonus = questData.getStreakBonus(); // Up to 1.5x
// Apply bonus to rewards
for (const [key, value] of Object.entries(rewards)) {
  totalRewards[key] += Math.floor(value * streakBonus);
}
```

Reward Structure:

```javascript
let totalRewards = {
  coins: Number, // Spirit coins earned
  affinity: Number, // Affinity points gained
  seasonXP: Number, // Season pass progression
};
```

Key Features:

- Daily quest reset system
- Streak bonuses (up to 50%)
- Multiple quest categories
- Automatic progress tracking
- Reward claim management
- Quest completion validation

Error Handling:

```javascript
// Validation checks
if (!userProfile?.selected) {
  return "Select a spirit first using /select";
}

// Transaction safety
try {
  await profileSchema.findOneAndUpdate(
    { userid: interaction.user.id },
    { $inc: { balance, affinity } }
  );
  await questData.claimRewards(quest.id);
} catch (error) {
  console.error("Error claiming rewards:", error);
}
```

#### Inventory Management (`Commands/Slash/Spirits/inventory.js`)

Data Structure:

```javascript
// Item storage in profile schema
items: {
  type: Array,
  default: []
}

// Item format
{
  name: String,    // Item name
  count: Number    // Quantity owned
}
```

Display Implementation:

```javascript
const itemLines = profileData.items.map(
  (item, index) => `**${index + 1}.** ${item.name} \`x${item.count}\``
);

const embed = new EmbedBuilder()
  .setColor("Red")
  .setDescription(itemLines.join("\n"))
  .setFooter({
    text: "Use /use to use an item from your inventory",
  });
```

#### Spirit Collection (`Commands/Slash/Spirits/harem.js`)

Collection Features:

```javascript
// Fetch and sort spirits by rarity
const spiritsData = await spiritSchema.find({ husband: targetUser.id });
const sortedSpirits = spiritsData.sort((a, b) => b.stars - a.stars);

// Format spirit display
const spiritList = sortedSpirits.map(
  (spirit) =>
    `**${spirit.name} 【${"<a:starSpin:1006138461234937887>".repeat(
      spirit.stars
    )}】** | **ID:** \`${spirit.id}\``
);
```

Key Features:

- Spirit ownership tracking
- Star rating visualization
- Unique identifier system
- Cross-user collection viewing
- Sorted by rarity (highest first)
- Interactive display
- Error handling for empty collections

Implementation:

```javascript
// Collection validation
if (!spiritsData?.length) {
  return targetUser.id === interaction.user.id
    ? "Use /summon to get your first spirit"
    : `${targetUser.username} has no spirits`;
}

// Display format
const embed = new EmbedBuilder()
  .setColor("Random")
  .setTitle(`${targetUser.username}'s Spirits`)
  .setDescription(spiritList.join("\n"));
```

### 5. Emotion System (`utils/spirits/emotionSystem.js`)

Affection levels:

```javascript
const AFFECTION_LEVELS = {
  0: { title: "Suspicious", bonus: 1.0 },
  100: { title: "Cautious", bonus: 1.1 },
  250: { title: "Friendly", bonus: 1.2 },
  500: { title: "Trusting", bonus: 1.3 },
  1000: { title: "Affectionate", bonus: 1.5 },
};
```

Bond activities:

- Dating (12hr cooldown, +15 affinity)
- Chat (1hr cooldown, +5 affinity)
- Gift (6hr cooldown, +10 affinity)

Location bonuses:

```javascript
locations: [
  {
    name: "Tenguu City Shopping District",
    spirits: ["Tohka Yatogami", "Kotori Itsuka"],
    bonus: 1.2,
  },
];
```

## Database Interactions

### Spirit Operations

```javascript
// Create new spirit
const newSpirit = new spiritSchema({
  name: selectedSpirit,
  husband: interaction.user.id,
  stars: spiritStars,
  happiness: 100,
  id: Math.floor(Math.random() * Date.now()).toString(36),
});

// Update happiness
await spiritSchema.findOneAndUpdate(
  { id: userProfile.selected },
  { happiness: updatedHappiness }
);
```

### Profile Operations

```javascript
// Record interaction
profileSchema.methods.recordInteraction = async function (spiritName, type) {
  const spirit = await this.findOrCreateSpirit(spiritName);
  switch (type) {
    case "date":
      spirit.interactions.dates++;
      this.totalDates++;
      break;
  }
};
```

## Error Handling

1. Command-level error handling:

```javascript
try {
  // Command logic
} catch (error) {
  console.error(`${commandName} error:`, error);
  await interaction.editReply({
    content: "An error occurred while processing the command.",
  });
  return false;
}
```

2. Database error handling:

- Schema validation
- Required field checks
- Type validation
- Unique constraints

3. Battle system error recovery:

- State preservation
- Timeout handling
- Invalid action prevention

## Performance Considerations

1. Database Optimizations:

```javascript
// Indexed fields
userid: { type: String, required: true, index: true }
// Compound indexes
questSchema.index({ userid: 1, lastQuestReset: 1 })
```

2. Caching Strategies:

- Spirit data caching
- User profile caching
- Command cooldown tracking

3. Rate Limiting:

- Command cooldowns
- Activity cooldowns
- Daily limits

## Security Implementation

1. Input Validation:

```javascript
if (!interaction.isCommand()) return;
if (!interaction.guild) return;
```

2. Permission Checks:

- Command permissions
- Spirit ownership validation
- Action authorization

3. Rate Limiting:

- Command cooldowns
- Activity timeouts
- Anti-spam measures

## Development Guidelines

### Code Organization

1. Command Structure:

```javascript
export default {
  name: "commandName",
  category: "category",
  cooldown: cooldownInSeconds,
  data: new SlashCommandBuilder(),
  run: async ({ client, interaction }) => {},
};
```

2. Utility Functions:

- Placed in utils/ directory
- Grouped by functionality
- Exported as modules

### Testing Requirements

1. Unit Tests:

- Command validation
- Data model validation
- Utility function testing

2. Integration Tests:

- Command flow testing
- Database operations
- Battle system validation

### Maintenance

1. Error Logging:

```javascript
console.error("Error type:", error);
// Log to monitoring system
```

2. Performance Monitoring:

- Command execution times
- Database query performance
- Memory usage tracking

## Known Limitations

1. Rate Limits:

- Command cooldowns
- Activity timeouts
- Daily interaction limits

2. Technical Constraints:

- MongoDB document size limits
- Discord API rate limits
- Embed size restrictions

## Future Improvements

1. Potential Optimizations:

- Caching implementation
- Query optimization
- Batch operations

2. Feature Enhancements:

- Additional spirit interactions
- Extended battle mechanics
- Enhanced reward systems
