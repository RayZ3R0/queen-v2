import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} from 'discord.js';

export default {
  name: "moderate",
  description: "Moderate a user.",
  userPermissions: ["BanMembers"],
  botPermissions: ["BanMembers"],
  category: "Moderation",
  cooldown: 5,

  run: async ({ message, args }) => {
        if (!message.guild) return message.channel.send('This command can only be used in a guild.');
            const member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        const reason = args.slice(1).join(' ') || 'None provided.';

        const noPermissions = new EmbedBuilder()
            .setColor('Random')
            .setDescription(" | You Don't Have `Ban Members` permissions");

        const appealEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setDescription(`You have been banned from **Kurumi's Empire**.
**Reason:** ${reason}
If you want to appeal, click the button below and explain your reasons and why we should unban you.`);

        const kickEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setDescription(`You have been kicked from **Kurumi's Empire**.
**Reason:** ${reason}`);

        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.channel.send({ embeds: [noPermissions] });
        }
        if (member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.channel.send('You cannot moderate this user because they are a Council Member.');
        }
        if (member.id === message.member.id) return message.channel.send('You cannot moderate yourself.');
        if (member.id === message.guild.members.me.id) return message.channel.send('I cannot moderate myself.');

        const kickButton = new ButtonBuilder()
            .setCustomId('kick')
            .setLabel('Kick')
            .setStyle(ButtonStyle.Danger);

        const banButton = new ButtonBuilder()
            .setCustomId('ban')
            .setLabel('Ban')
            .setStyle(ButtonStyle.Danger);

        const appealButton = new ButtonBuilder()
            .setCustomId('appeal')
            .setLabel('Appeal')
            .setStyle(ButtonStyle.Success);

        let actionRow = new ActionRowBuilder().addComponents(kickButton, banButton);
        let appealRow = new ActionRowBuilder().addComponents(appealButton);

        const collector = message.channel.createMessageComponentCollector({
            componentType: 'BUTTON',
            time: 3000
        });

        message.reply({ content: 'Select an action to perform.', components: [actionRow] });

        collector.on('collect', async (interaction) => {
            try {
                if (interaction.customId === 'kick') {
                    await interaction.deferUpdate();
                    try {
                        await member.send({ embeds: [kickEmbed] });
                    } catch (err) {
                        // Member might have DMs disabled or blocked
                    }
                    await member.kick({ reason: reason });
                    kickButton.setDisabled(true);
                    banButton.setDisabled(true);
                    actionRow = new ActionRowBuilder().addComponents(kickButton, banButton);
                    interaction.update({
                        content: `${member.user.tag} has been kicked. **Reason:** ${reason}`,
                        components: [actionRow]
                    });
                }
                if (interaction.customId === 'ban') {
                    await interaction.deferUpdate();
                    try {
                        await member.send({ embeds: [appealEmbed], components: [appealRow] });
                        // await member.send({ embeds: [appealEmbed], components: [appealRow] });
                    } catch (err) {
                        // Handle error if unable to send DM
                    }
                    await member.ban({ reason: reason });
                    kickButton.setDisabled(true);
                    banButton.setDisabled(true);
                    actionRow = new ActionRowBuilder().addComponents(kickButton, banButton);
                    interaction.update({
                        content: `${member.user.tag} has been banned. **Reason:** ${reason}`,
                        components: [actionRow]
                    });
                }
            } catch (error) {
                console.error(error);
            }
        });
    }
};