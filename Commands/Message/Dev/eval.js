import { EmbedBuilder } from "discord.js";
import util from "node:util";

export default {
  name: "eval",
  description: "Evaluates JavaScript code and returns the output. (Owner Only)",
  owneronly: true,
  aliases: [],
  cooldown: 0,
  userPermissions: [],
  botPermissions: [],
  category: "Dev",
  run: async ({ client, message, args, prefix }) => {
    if (!args[0]) {
      return message.channel.send({
        content: "Please provide code to evaluate.",
      });
    }

    const code = args.join(" ");
    try {
      // Evaluate the code. Wrap the code to allow top-level await.
      let evaled = await eval(`(async () => { ${code} })()`);
      if (typeof evaled !== "string")
        evaled = util.inspect(evaled, { depth: 0 });

      const successEmbed = new EmbedBuilder()
        .setTitle("Eval Result")
        .addFields(
          { name: "Input", value: `\`\`\`js\n${code}\n\`\`\`` },
          { name: "Output", value: `\`\`\`js\n${clean(evaled)}\n\`\`\`` }
        )
        .setColor("Green")
        .setTimestamp();
      return message.channel.send({ embeds: [successEmbed] });
    } catch (error) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("Evaluation Error")
        .setDescription(`\`\`\`js\n${clean(error)}\n\`\`\``)
        .setColor("Red")
        .setTimestamp();
      return message.channel.send({ embeds: [errorEmbed] });
    }
  },
};

function clean(text) {
  if (typeof text === "string")
    return text
      .replace(/`/g, "`" + String.fromCharCode(8203))
      .replace(/@/g, "@" + String.fromCharCode(8203));
  else return text;
}
