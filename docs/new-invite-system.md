# New Invite Tracking System

## Overview
Complete rebuild of the invite tracking system with accurate tracking, beautiful logging, and comprehensive management commands.

## Architecture

### 1. Database Schema (`schema/inviteSystem.js`)
- **InviteStats**: User invite statistics
  - Regular invites, bonus invites, leaves, fake accounts
  - Virtual field for total calculation
- **InviteUsage**: Individual join records
  - Tracks who invited whom, when they joined/left
  - Fake account detection (< 7 days old)
- **InviteCache**: Invite snapshot for comparison
  - Stores invite uses to detect changes

### 2. Core Tracker (`utils/inviteTracker.js`)
**Key Features:**
- Accurate invite detection by comparing before/after uses
- Vanity URL support
- Unknown invite handling (widget, discovery, etc.)
- Fake account detection (accounts < 7 days old)
- Leave tracking with stats updates
- Beautiful embed logging to channel 901818838381891624

**Main Methods:**
- `initialize()` - Cache invites for all guilds on startup
- `cacheInvites(guild)` - Snapshot all invites for a guild
- `findUsedInvite(guild)` - Compare snapshots to find which invite was used
- `handleJoin(member)` - Process member joins, update stats, log
- `handleLeave(member)` - Process member leaves, update stats, log
- `getStats(guildId, userId)` - Get user's invite statistics
- `getLeaderboard(guildId, limit)` - Get top inviters
- `addBonus(guildId, userId, amount)` - Admin: add/remove bonus invites
- `resetUser(guildId, userId)` - Admin: reset user's invites
- `resetAll(guildId)` - Admin: reset all server invites

### 3. Event Handler (`events/inviteTracker.js`)
Exports multiple event handlers:
- `ready` - Initialize tracker on bot startup
- `inviteCreate` - Recache when invite created
- `inviteDelete` - Recache when invite deleted
- `guildMemberAdd` - Track joins
- `guildMemberRemove` - Track leaves

### 4. Slash Command (`Commands/Slash/Utils/invites.js`)
**Subcommands:**
- `/invites check [user]` - View invite stats
- `/invites leaderboard [limit]` - View top inviters
- `/invites add-bonus <user> <amount>` - Add bonus invites (Admin)
- `/invites remove-bonus <user> <amount>` - Remove bonus invites (Admin)
- `/invites reset-user <user>` - Reset user's invites (Admin)
- `/invites reset-all` - Reset all server invites (Admin, requires confirmation)

## Logging Features

### Join Logs
- Member avatar and tag
- Who invited them
- Invite code used
- Account age
- Fake account warning (if < 7 days)
- Inviter's current stats (Total, Regular, Bonus, Leaves, Fake)
- Color: Green (normal) or Red (fake)

### Leave Logs
- Member avatar and tag
- Who invited them
- Original invite code
- How long they were a member
- When they joined
- Color: Red

## How It Works

1. **Initialization**: On bot startup, cache all invites for all guilds
2. **Member Joins**:
   - Fetch new invite list
   - Compare with cached list to find which invite gained a use
   - Check vanity URL if applicable
   - Fall back to "unknown" if no match found
   - Recache all invites
   - Detect fake accounts (< 7 days old)
   - Save usage record to database
   - Update inviter's stats
   - Log beautiful embed to channel
3. **Member Leaves**:
   - Find their join record
   - Mark as left in database
   - Update inviter's stats (decrement, mark as leave)
   - Log to channel
4. **Commands**: Query database for stats, leaderboards, admin actions

## Statistics Calculation

**Total Invites** = Regular + Bonus - Leaves - Fake

This ensures:
- Normal invites count positively
- Bonus invites from admins count positively
- Members who left are subtracted
- Fake accounts are subtracted

## Deleted Files
- ❌ `events/inviteEvents.js` (replaced with `events/inviteTracker.js`)
- ❌ `utils/inviteManager.js` (replaced with `utils/inviteTracker.js`)
- ❌ `schema/inviteTracker.js` (replaced with `schema/inviteSystem.js`)

## New Files
- ✅ `schema/inviteSystem.js` - Clean database models
- ✅ `utils/inviteTracker.js` - Core tracking logic
- ✅ `events/inviteTracker.js` - Event handlers
- ✅ `Commands/Slash/Utils/invites.js` - Rewritten command (replaced old)

## Advantages Over Old System
1. **Accurate Detection**: Proper before/after comparison
2. **Vanity Support**: Tracks vanity URL uses
3. **Unknown Handling**: Gracefully handles widget/discovery joins
4. **Fake Detection**: Automatically flags accounts < 7 days old
5. **Beautiful Logs**: Rich embeds with all relevant info
6. **Proper Leave Tracking**: Updates stats when members leave
7. **Admin Tools**: Bonus invites, resets, management
8. **Leaderboard**: Competition and recognition
9. **Clean Code**: Modular, maintainable, well-documented
10. **No Errors**: Proper error handling, no "No active invite usage found" spam
