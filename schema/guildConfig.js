import mongoose from "mongoose";

const guildConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true },
    ignoredChannels: {
      type: [String],
      default: [],
      validate: {
        validator: function (channels) {
          // Ensure all channel IDs are strings and unique
          const uniqueChannels = new Set(channels);
          return (
            channels.every(
              (id) => typeof id === "string" && /^\d+$/.test(id)
            ) && uniqueChannels.size === channels.length
          );
        },
        message: "Invalid channel ID format or duplicate channels detected",
      },
    },
    ignoredLockdownRoles: {
      type: [String],
      default: [],
      validate: {
        validator: function (roles) {
          // Ensure all role IDs are strings and unique
          const uniqueRoles = new Set(roles);
          return (
            roles.every((id) => typeof id === "string" && /^\d+$/.test(id)) &&
            uniqueRoles.size === roles.length
          );
        },
        message: "Invalid role ID format or duplicate roles detected",
      },
    },
    lockdownState: {
      type: Map,
      of: {
        channelId: String,
        permissions: [
          {
            roleId: String,
            allowed: [String],
            denied: [String],
          },
        ],
      },
      default: new Map(),
    },
    isLockedDown: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    // Add index on guildId for faster lookups
    indexes: [{ guildId: 1 }],
  }
);

// Add methods for channel management
guildConfigSchema.methods.addIgnoredChannel = async function (channelId) {
  if (!this.ignoredChannels.includes(channelId)) {
    this.ignoredChannels.push(channelId);
    return await this.save();
  }
  return this;
};

guildConfigSchema.methods.removeIgnoredChannel = async function (channelId) {
  this.ignoredChannels = this.ignoredChannels.filter((id) => id !== channelId);
  return await this.save();
};

guildConfigSchema.methods.isChannelIgnored = function (channelId) {
  return this.ignoredChannels.includes(channelId);
};

// Lockdown role management methods
guildConfigSchema.methods.addIgnoredLockdownRole = async function (roleId) {
  if (!this.ignoredLockdownRoles.includes(roleId)) {
    this.ignoredLockdownRoles.push(roleId);
    return await this.save();
  }
  return this;
};

guildConfigSchema.methods.removeIgnoredLockdownRole = async function (roleId) {
  this.ignoredLockdownRoles = this.ignoredLockdownRoles.filter(
    (id) => id !== roleId
  );
  return await this.save();
};

guildConfigSchema.methods.isRoleIgnoredInLockdown = function (roleId) {
  return this.ignoredLockdownRoles.includes(roleId);
};

// Lockdown state management methods
guildConfigSchema.methods.storeLockdownState = async function (
  channelId,
  permissions
) {
  this.lockdownState.set(channelId, permissions);
  this.isLockedDown = true;
  return await this.save();
};

guildConfigSchema.methods.getLockdownState = function (channelId) {
  return this.lockdownState.get(channelId);
};

guildConfigSchema.methods.clearLockdownState = async function () {
  this.lockdownState.clear();
  this.isLockedDown = false;
  return await this.save();
};

// Static method to get or create guild config
guildConfigSchema.statics.getOrCreate = async function (guildId) {
  let config = await this.findOne({ guildId });
  if (!config) {
    config = new this({ guildId });
    await config.save();
  }
  return config;
};

const GuildConfig = mongoose.model("GuildConfig", guildConfigSchema);

export default GuildConfig;
