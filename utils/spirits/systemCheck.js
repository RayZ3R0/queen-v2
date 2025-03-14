import { EmbedBuilder } from "discord.js";
import { BOND_ACTIVITIES } from "./emotionSystem.js";
import { QUEST_TYPES, QUEST_TIERS } from "./questManager.js";
import { LOCATIONS } from "./locationManager.js";
import { SPIRIT_POWERS } from "./spiritPowers.js";
import profileSchema from "../../schema/profile.js";
import questSchema from "../../schema/quests.js";
import seasonPass from "../../schema/seasonPass.js";
import spacequakeProgress from "../../schema/spacequakeProgress.js";

// System check result types
const CHECK_STATUS = {
  PASS: "✅",
  FAIL: "❌",
  WARN: "⚠️",
};

// Run comprehensive system checks
export const runSystemChecks = async () => {
  const results = {
    schema: await checkSchemas(),
    systems: checkSystems(),
    integrations: await checkIntegrations(),
  };

  return createSystemReport(results);
};

// Check database schemas and indexes
const checkSchemas = async () => {
  const checks = {
    profile: {
      status: CHECK_STATUS.FAIL,
      message: "Not checked",
    },
    quests: {
      status: CHECK_STATUS.FAIL,
      message: "Not checked",
    },
    seasonPass: {
      status: CHECK_STATUS.FAIL,
      message: "Not checked",
    },
    spacequake: {
      status: CHECK_STATUS.FAIL,
      message: "Not checked",
    },
  };

  try {
    // Check profile schema
    const profileFields = Object.keys(profileSchema.schema.paths);
    const requiredProfileFields = [
      "userid",
      "selected",
      "affinity",
      "spirits",
      "dateStreak",
    ];
    checks.profile.status = requiredProfileFields.every((field) =>
      profileFields.includes(field)
    )
      ? CHECK_STATUS.PASS
      : CHECK_STATUS.FAIL;
    checks.profile.message =
      checks.profile.status === CHECK_STATUS.PASS
        ? "All required fields present"
        : "Missing required fields";

    // Check quest schema
    const questFields = Object.keys(questSchema.schema.paths);
    const requiredQuestFields = [
      "userid",
      "quests",
      "lastQuestReset",
      "streak",
    ];
    checks.quests.status = requiredQuestFields.every((field) =>
      questFields.includes(field)
    )
      ? CHECK_STATUS.PASS
      : CHECK_STATUS.FAIL;
    checks.quests.message =
      checks.quests.status === CHECK_STATUS.PASS
        ? "All required fields present"
        : "Missing required fields";

    // Check season pass schema
    const seasonFields = Object.keys(seasonPass.schema.paths);
    const requiredSeasonFields = ["seasonId", "startDate", "endDate", "tiers"];
    checks.seasonPass.status = requiredSeasonFields.every((field) =>
      seasonFields.includes(field)
    )
      ? CHECK_STATUS.PASS
      : CHECK_STATUS.FAIL;
    checks.seasonPass.message =
      checks.seasonPass.status === CHECK_STATUS.PASS
        ? "All required fields present"
        : "Missing required fields";

    // Check spacequake schema
    const spacequakeFields = Object.keys(spacequakeProgress.schema.paths);
    const requiredSpacequakeFields = [
      "userid",
      "seasonLevel",
      "seasonXP",
      "dailyExplorations",
    ];
    checks.spacequake.status = requiredSpacequakeFields.every((field) =>
      spacequakeFields.includes(field)
    )
      ? CHECK_STATUS.PASS
      : CHECK_STATUS.FAIL;
    checks.spacequake.message =
      checks.spacequake.status === CHECK_STATUS.PASS
        ? "All required fields present"
        : "Missing required fields";
  } catch (error) {
    console.error("Error during schema checks:", error);
    Object.keys(checks).forEach((key) => {
      if (checks[key].status === CHECK_STATUS.FAIL) {
        checks[key].message = "Error during check";
      }
    });
  }

  return checks;
};

// Check core systems and configurations
const checkSystems = () => {
  const checks = {
    bondActivities: {
      status: CHECK_STATUS.FAIL,
      message: "Not checked",
    },
    questSystem: {
      status: CHECK_STATUS.FAIL,
      message: "Not checked",
    },
    locations: {
      status: CHECK_STATUS.FAIL,
      message: "Not checked",
    },
    spiritPowers: {
      status: CHECK_STATUS.FAIL,
      message: "Not checked",
    },
  };

  try {
    // Check bond activities
    checks.bondActivities.status =
      BOND_ACTIVITIES &&
      Object.keys(BOND_ACTIVITIES).length >= 3 &&
      BOND_ACTIVITIES.date &&
      BOND_ACTIVITIES.chat &&
      BOND_ACTIVITIES.gift
        ? CHECK_STATUS.PASS
        : CHECK_STATUS.FAIL;
    checks.bondActivities.message =
      checks.bondActivities.status === CHECK_STATUS.PASS
        ? "All activity types present"
        : "Missing required activities";

    // Check quest system
    checks.questSystem.status =
      QUEST_TYPES &&
      QUEST_TIERS &&
      Object.keys(QUEST_TYPES).length >= 4 &&
      Object.keys(QUEST_TIERS).length >= 3
        ? CHECK_STATUS.PASS
        : CHECK_STATUS.FAIL;
    checks.questSystem.message =
      checks.questSystem.status === CHECK_STATUS.PASS
        ? "Quest types and tiers configured"
        : "Missing quest configurations";

    // Check locations
    checks.locations.status =
      LOCATIONS && Object.keys(LOCATIONS).length >= 4
        ? CHECK_STATUS.PASS
        : CHECK_STATUS.FAIL;
    checks.locations.message =
      checks.locations.status === CHECK_STATUS.PASS
        ? "Required locations present"
        : "Missing required locations";

    // Check spirit powers
    checks.spiritPowers.status =
      SPIRIT_POWERS && Object.keys(SPIRIT_POWERS).length >= 5
        ? CHECK_STATUS.PASS
        : CHECK_STATUS.FAIL;
    checks.spiritPowers.message =
      checks.spiritPowers.status === CHECK_STATUS.PASS
        ? "Spirit powers configured"
        : "Missing spirit power configurations";
  } catch (error) {
    console.error("Error during system checks:", error);
    Object.keys(checks).forEach((key) => {
      if (checks[key].status === CHECK_STATUS.FAIL) {
        checks[key].message = "Error during check";
      }
    });
  }

  return checks;
};

// Check system integrations
const checkIntegrations = async () => {
  const checks = {
    eventHandlers: {
      status: CHECK_STATUS.FAIL,
      message: "Not checked",
    },
    commands: {
      status: CHECK_STATUS.FAIL,
      message: "Not checked",
    },
    database: {
      status: CHECK_STATUS.FAIL,
      message: "Not checked",
    },
  };

  try {
    // Check event handlers
    const requiredEvents = [
      "spiritAction",
      "questCompleted",
      "spacequakeAlert",
      "seasonUpdate",
    ];
    // This check will need to be adapted based on your event system implementation
    checks.eventHandlers.status = CHECK_STATUS.WARN;
    checks.eventHandlers.message = "Manual verification required";

    // Check commands
    const requiredCommands = [
      "bond",
      "quests",
      "emotion",
      "spacequake",
      "profile",
    ];
    // This check will need to be adapted based on your command handling system
    checks.commands.status = CHECK_STATUS.WARN;
    checks.commands.message = "Manual verification required";

    // Check database connection
    try {
      await profileSchema.findOne();
      checks.database.status = CHECK_STATUS.PASS;
      checks.database.message = "Database connection successful";
    } catch (error) {
      checks.database.status = CHECK_STATUS.FAIL;
      checks.database.message = "Database connection failed";
    }
  } catch (error) {
    console.error("Error during integration checks:", error);
    Object.keys(checks).forEach((key) => {
      if (checks[key].status === CHECK_STATUS.FAIL) {
        checks[key].message = "Error during check";
      }
    });
  }

  return checks;
};

// Create system check report embed
const createSystemReport = (results) => {
  const embed = new EmbedBuilder()
    .setTitle("Spirit System Check Report")
    .setColor("#00ff00")
    .setDescription("System diagnostic results:")
    .setTimestamp();

  // Add schema check results
  embed.addFields({
    name: "Database Schemas",
    value: Object.entries(results.schema)
      .map(([name, check]) => `${check.status} ${name}: ${check.message}`)
      .join("\n"),
  });

  // Add system check results
  embed.addFields({
    name: "Core Systems",
    value: Object.entries(results.systems)
      .map(([name, check]) => `${check.status} ${name}: ${check.message}`)
      .join("\n"),
  });

  // Add integration check results
  embed.addFields({
    name: "System Integrations",
    value: Object.entries(results.integrations)
      .map(([name, check]) => `${check.status} ${name}: ${check.message}`)
      .join("\n"),
  });

  // Calculate overall system status
  const totalChecks = Object.values(results).reduce(
    (acc, curr) => acc + Object.keys(curr).length,
    0
  );
  const passedChecks = Object.values(results).reduce(
    (acc, curr) =>
      acc +
      Object.values(curr).filter((check) => check.status === CHECK_STATUS.PASS)
        .length,
    0
  );

  embed.setFooter({
    text: `System Status: ${Math.floor(
      (passedChecks / totalChecks) * 100
    )}% operational`,
  });

  return embed;
};

// Export helper function for command use
export const runDiagnostics = async (interaction) => {
  try {
    const report = await runSystemChecks();
    await interaction.reply({ embeds: [report] });
  } catch (error) {
    console.error("Error running diagnostics:", error);
    await interaction.reply({
      content: "An error occurred while running system diagnostics.",
      ephemeral: true,
    });
  }
};
