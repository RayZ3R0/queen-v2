import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import trollmutedb from "../../../schema/trollmutedb.js";
import ms from "ms"; // Make sure to install this package if not already available

export default {
  name: "trollmute",
  description: "Repeatedly mute and unmute a user with brief speaking windows.",
  cooldown: 5,
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  botPermissions: [PermissionFlagsBits.ModerateMembers],
  category: "Moderation",

  run: async ({ client, message, args, prefix }) => {
    try {
      // Parse arguments
      const targetMember =
        message.mentions.members.first() ||
        message.guild.members.cache.get(args[0]);
      if (!targetMember) {
        return message.channel.send({
          content: "Please provide a valid user to troll mute.",
        });
      }

      // Check if we can moderate this member
      if (!targetMember.moderatable) {
        return message.channel.send({
          content: "I cannot moderate this user due to role hierarchy.",
        });
      }

      // Check if user is already being troll-muted
      const existingTrollMute = await trollmutedb.findOne({
        guild: message.guild.id,
        user: targetMember.id,
        active: true,
      });

      // If no additional args, just toggle the trollmute
      if (args.length === 1) {
        if (existingTrollMute) {
          // Turn off existing trollmute
          existingTrollMute.active = false;
          await existingTrollMute.save();

          // Remove timeout if currently applied
          if (
            existingTrollMute.currentlyMuted &&
            targetMember.communicationDisabledUntil
          ) {
            await targetMember.timeout(null, "TrollMute deactivated");
          }

          return message.channel.send({
            content: `TrollMute has been deactivated for ${targetMember}.`,
          });
        } else {
          // Set default indefinite trollmute
          const defaultTrollMute = new trollmutedb({
            guild: message.guild.id,
            user: targetMember.id,
            active: true,
            totalDuration: 0, // indefinite
            speakDuration: 30000, // 30 seconds to speak
            muteDuration: 120000, // 2 minutes muted
            startTime: Date.now(),
            expiresAt: 0, // indefinite
            lastCycleTime: Date.now(),
            currentlyMuted: true,
            channelId: message.channel.id, // Store the channel ID
          });

          await defaultTrollMute.save();

          // Apply initial timeout
          await targetMember.timeout(
            defaultTrollMute.muteDuration,
            "TrollMute activated"
          );

          return message.channel.send({
            content: `TrollMute activated for ${targetMember}. They will be muted for 2 minutes, then allowed to speak for 30 seconds, repeating indefinitely.`,
          });
        }
      }

      // Parse custom durations
      let totalDuration = 0;
      let speakDuration = 30000; // Default: 30 seconds
      let muteDuration = 120000; // Default: 2 minutes

      if (args[1]) {
        try {
          totalDuration = args[1].toLowerCase() === "forever" ? 0 : ms(args[1]);
          if (isNaN(totalDuration) && args[1].toLowerCase() !== "forever") {
            return message.channel.send({
              content: "Invalid total duration format. Use 1d, 10h, 30m, etc.",
            });
          }
        } catch (e) {
          return message.channel.send({
            content: "Invalid total duration format. Use 1d, 10h, 30m, etc.",
          });
        }
      }

      if (args[2]) {
        try {
          speakDuration = ms(args[2]);
          if (isNaN(speakDuration)) {
            return message.channel.send({
              content: "Invalid speak duration format. Use 30s, 1m, etc.",
            });
          }
        } catch (e) {
          return message.channel.send({
            content: "Invalid speak duration format. Use 30s, 1m, etc.",
          });
        }
      }

      if (args[3]) {
        try {
          muteDuration = ms(args[3]);
          if (isNaN(muteDuration)) {
            return message.channel.send({
              content: "Invalid mute duration format. Use 2m, 5m, etc.",
            });
          }
        } catch (e) {
          return message.channel.send({
            content: "Invalid mute duration format. Use 2m, 5m, etc.",
          });
        }
      }

      // Ensure durations make sense
      if (speakDuration < 5000) {
        return message.channel.send({
          content: "Speak duration must be at least 5 seconds.",
        });
      }

      if (muteDuration < 10000) {
        return message.channel.send({
          content: "Mute duration must be at least 10 seconds.",
        });
      }

      // If there's an existing trollmute, update it, otherwise create a new one
      if (existingTrollMute) {
        existingTrollMute.active = true;
        existingTrollMute.totalDuration = totalDuration;
        existingTrollMute.speakDuration = speakDuration;
        existingTrollMute.muteDuration = muteDuration;
        existingTrollMute.startTime = Date.now();
        existingTrollMute.expiresAt = totalDuration
          ? Date.now() + totalDuration
          : 0;
        existingTrollMute.lastCycleTime = Date.now();
        existingTrollMute.currentlyMuted = true;
        existingTrollMute.channelId = message.channel.id; // Update the channel ID

        await existingTrollMute.save();
      } else {
        const newTrollMute = new trollmutedb({
          guild: message.guild.id,
          user: targetMember.id,
          active: true,
          totalDuration: totalDuration,
          speakDuration: speakDuration,
          muteDuration: muteDuration,
          startTime: Date.now(),
          expiresAt: totalDuration ? Date.now() + totalDuration : 0,
          lastCycleTime: Date.now(),
          currentlyMuted: true,
          channelId: message.channel.id, // Store the channel ID
        });

        await newTrollMute.save();
      }

      // Apply initial timeout
      await targetMember.timeout(muteDuration, "TrollMute activated");

      // Create info embed
      const embed = new EmbedBuilder()
        .setColor("Purple")
        .setTitle("TrollMute Activated")
        .setDescription(`TrollMute has been activated for ${targetMember}`)
        .addFields(
          {
            name: "Total Duration",
            value: totalDuration
              ? `${ms(totalDuration, { long: true })}`
              : "Indefinite",
          },
          {
            name: "Speaking Window",
            value: `${ms(speakDuration, { long: true })}`,
          },
          {
            name: "Mute Duration",
            value: `${ms(muteDuration, { long: true })}`,
          }
        )
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL({ dynamic: true }),
        })
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error("Error in trollmute command:", error);
      return message.channel.send({
        content:
          "An error occurred while processing the trollmute. Please try again later.",
      });
    }
  },
};
