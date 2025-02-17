import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ComponentType, // <-- import ComponentType
} from "discord.js";

export default {
  name: "moderate",
  description: "Moderate a specific user.",
  timeout: 3,
  userPermissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],
  category: "Moderation",

  run: async ({ client, message, args, prefix }) => {
    if (!message.guild)
      return message.channel.send("This command can only be used in a guild.");

    const member =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!member)
      return message.channel.send("Please mention a valid user to moderate.");

    const reason = args.slice(1).join(" ") || "None provided.";

    // Check if invoking member has BAN permissions
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers))
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("Random")
            .setDescription(" | You don't have `Ban Members` permissions."),
        ],
      });

    // Prevent moderating users with BAN permissions (Council Members)
    if (member.permissions.has(PermissionFlagsBits.BanMembers))
      return message.channel.send(
        "You cannot moderate this user because they are a Council Member."
      );
    if (member.id === message.member.id)
      return message.channel.send("You cannot moderate yourself.");
    if (member.id === message.guild.members.me.id)
      return message.channel.send("I cannot moderate myself.");

    const kickEmbed = new EmbedBuilder()
      .setColor("#ff0000")
      .setDescription(
        `You have been kicked from **Kurumi's Empire**.\n**Reason:** ${reason}`
      );

    const appealEmbed = new EmbedBuilder()
      .setColor("#ff0000")
      .setDescription(
        `You have been banned from **Kurumi's Empire**.\n**Reason:** ${reason}\nIf you want to appeal, click the button below and explain your reasons and why we should unban you.`
      );

    const kickButton = new ButtonBuilder()
      .setCustomId("kick")
      .setLabel("Kick")
      .setStyle(ButtonStyle.Danger);

    const banButton = new ButtonBuilder()
      .setCustomId("ban")
      .setLabel("Ban")
      .setStyle(ButtonStyle.Danger);

    const appealButton = new ButtonBuilder()
      .setCustomId("appeal")
      .setLabel("Appeal")
      .setStyle(ButtonStyle.Success);

    let actionRow = new ActionRowBuilder().addComponents(kickButton, banButton);
    let appealRow = new ActionRowBuilder().addComponents(appealButton);

    // Send initial reply for action selection
    const reply = await message.reply({
      content: "Select an action to perform.",
      components: [actionRow],
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button, // use ComponentType.Button instead of "BUTTON"
      time: 30000,
    });

    collector.on("collect", async (interaction) => {
      // Ensure only the command invoker can use the buttons
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({
          content: "This button is not for you.",
          ephemeral: true,
        });
      }
      try {
        if (interaction.customId === "kick") {
          await interaction.deferUpdate();
          try {
            await member.send({ embeds: [kickEmbed] });
          } catch (err) {
            // Member might have DMs disabled
          }
          await member.kick(reason);
          kickButton.setDisabled(true);
          banButton.setDisabled(true);
          actionRow = new ActionRowBuilder().addComponents(
            kickButton,
            banButton
          );
          interaction.editReply({
            content: `${member.user.tag} has been kicked.\n**Reason:** ${reason}`,
            components: [actionRow],
          });
        }
        if (interaction.customId === "ban") {
          await interaction.deferUpdate();
          try {
            await member.send({
              embeds: [appealEmbed],
              components: [appealRow],
            });
          } catch (err) {
            // Handle error if unable to send DM
          }
          await member.ban({ reason });
          kickButton.setDisabled(true);
          banButton.setDisabled(true);
          actionRow = new ActionRowBuilder().addComponents(
            kickButton,
            banButton
          );
          interaction.editReply({
            content: `${member.user.tag} has been banned.\n**Reason:** ${reason}`,
            components: [actionRow],
          });
        }
      } catch (error) {
        console.error(error);
      }
    });
  },
};
