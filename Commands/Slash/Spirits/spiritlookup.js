import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const sp = require("../../../spirits.json");

const spiritImages = {
  "Kurumi Tokisaki":
    "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/f5062197-3393-4855-978a-533d60157223/dd6qntw-cb907137-703b-49ad-adf7-9c07e53048e7.png/v1/fill/w_893,h_895,strp/kurumi_tokisaki_by_reinelumiere_dd6qntw-pre.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "Kotori Itsuka":
    "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/f5062197-3393-4855-978a-533d60157223/ddcv9jn-63d4d9fd-10bd-460b-822d-8d6dc240edac.png/v1/fill/w_819,h_975,strp/kotori_itsuka_by_reinelumiere_ddcv9jn-pre.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "Miku Izayoi":
    "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/f5062197-3393-4855-978a-533d60157223/df363k1-34bac577-c6e2-4775-96e6-b21240d2e075.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "Kyouno Natsumi":
    "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/f5062197-3393-4855-978a-533d60157223/dd6t44s-7d5e10cb-8af4-49a8-b735-9c804714039b.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "Nia Honjou":
    "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/f5062197-3393-4855-978a-533d60157223/ddxoprm-ffcb6548-a02b-4efd-8b6b-38b21eb08934.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "Kaguya Yamai":
    "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/f5062197-3393-4855-978a-533d60157223/df363f8-b1a3b00b-6528-49ee-9829-f564bab9120d.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "Yuzuru Yamai":
    "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/f5062197-3393-4855-978a-533d60157223/df363cx-7095bd31-daff-4f56-879a-d7e10c6eac21.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "Mukuro Hoshimiya":
    "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/f5062197-3393-4855-978a-533d60157223/ddl1k1n-68aaf824-c291-475a-85f3-c18338591bc0.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "Tobiichi Origami":
    "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/f5062197-3393-4855-978a-533d60157223/ddkhcdu-278571da-563c-4e8e-8be9-f6f998304a1b.png/v1/fill/w_826,h_968,strp/origami_tobiichi_by_reinelumiere_ddkhcdu-pre.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "Himekawa Yoshino":
    "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/f5062197-3393-4855-978a-533d60157223/df363i6-f1362580-e94d-4f7e-b468-ed258c18578c.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "Tohka Yatogami":
    "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/f5062197-3393-4855-978a-533d60157223/ddcv9h9-ed7b2254-c8f5-4192-b5d2-19608e9fac2d.png/v1/fill/w_1280,h_1831,strp/tohka_yatogami_by_reinelumiere_ddcv9h9-fullview.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
};

// Get all available spirit names from the JSON data
const availableSpirits = Object.keys(sp);

export default {
  name: "spiritlookup",
  category: "Spirits",
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName("spiritlookup")
    .setDescription("Check a spirit's base stats and information.")
    .addStringOption((option) =>
      option
        .setName("spirit")
        .setDescription("The spirit to look up")
        .setRequired(true)
        .addChoices(
          ...availableSpirits.map((spirit) => ({
            name: spirit,
            value: spirit,
          }))
        )
    ),

  run: async ({ client, interaction }) => {
    try {
      await interaction.deferReply();

      const spiritName = interaction.options.getString("spirit");
      const spiritData = sp[spiritName];

      if (!spiritData) {
        return interaction.editReply({
          content: "No data available for that spirit.",
        });
      }

      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle(spiritName)
        .addFields(
          { name: "HP", value: `${spiritData.hp}`, inline: true },
          { name: "Strength", value: `${spiritData.strength}`, inline: true },
          { name: "Defence", value: `${spiritData.defence}`, inline: true },
          { name: "Agility", value: `${spiritData.agility}`, inline: true },
          { name: "Abilities", value: spiritData.abilities.join(", ") }
        )
        .setImage(spiritImages[spiritName])
        .setFooter({ text: spiritData.quotes });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Spiritlookup command error:", error);
      await interaction.editReply({
        content: "An error occurred while looking up the spirit information.",
      });
      return false;
    }
  },
};
