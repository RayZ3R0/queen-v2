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
