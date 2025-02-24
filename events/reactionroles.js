import { ButtonInteraction } from "discord.js";
import { client } from "../bot.js";

// Mapping for basic role toggles.
const basicRoleMap = {
  nsfw: "942294539668963330",
  announcement: "747720214912827402",
  botupdate: "901408085191577610",
  bumpers: "903144348647055410",
  poll: "937277257989378068",
  deadc: "937277290038038559",
  watcht: "981444575631646770",
  event: "981256277164458045",
  giveaway: "981444513493053525",
  male: "901408476130050049",
  female: "901408508497518664",
  asia: "901408545617113088",
  southamerica: "901408576650764308",
  northamerica: "901408620263116800",
  africa: "901408638864850995",
  australia: "901408661107277844",
  europe: "901408693130768404",
};

// Mapping for age role buttons with conflict checks.
const ageRoleMap = {
  1317: "901408171627778088", // Underage group
  18: "901411803576270878", // Adult group
};

client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isButton()) return;

    const member = interaction.guild.members.cache.get(interaction.user.id);
    if (!member) return;

    const customId = interaction.customId;

    // Special: "blank" button just defers update.
    if (customId === "blank") {
      await interaction.deferUpdate();
      await interaction.followUp({
        content: "No changes made.",
        ephemeral: true,
      });
      return;
    }

    // Handle basic role toggles.
    if (basicRoleMap[customId]) {
      await interaction.deferUpdate();
      const roleId = basicRoleMap[customId];
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId);
        await interaction.followUp({
          content: `Removed role <@&${roleId}>.`,
          ephemeral: true,
        });
      } else {
        await member.roles.add(roleId);
        await interaction.followUp({
          content: `Added role <@&${roleId}>.`,
          ephemeral: true,
        });
      }
      return;
    }

    // Handle age roles with conflict checks.
    if (ageRoleMap[customId]) {
      await interaction.deferUpdate();
      const selectedRoleId = ageRoleMap[customId];
      // Determine the alternate age role.
      const alternateRoleId =
        customId === "1317" ? ageRoleMap["18"] : ageRoleMap["1317"];

      if (member.roles.cache.has(selectedRoleId)) {
        await member.roles.remove(selectedRoleId);
        await interaction.followUp({
          content: `Removed age role <@&${selectedRoleId}>.`,
          ephemeral: true,
        });
      } else if (member.roles.cache.has(alternateRoleId)) {
        await interaction.followUp({
          content:
            "You can only have one age role. Remove the current age role first.",
          ephemeral: true,
        });
      } else {
        await member.roles.add(selectedRoleId);
        await interaction.followUp({
          content: `Added age role <@&${selectedRoleId}>.`,
          ephemeral: true,
        });
      }
      return;
    }
  } catch (error) {
    console.error("Error in reaction roles handler:", error);
    // If the interaction has been deferred already, use followUp.
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        content: "An error occurred while processing your role update.",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "An error occurred while processing your role update.",
        ephemeral: true,
      });
    }
  }
});
