import profileSchema from "../schema/profile.js";

class BalanceManager {
  // Safely fetch user's current balance
  static async getBalance(userId) {
    try {
      const profile = await profileSchema.findOne({ userid: userId });
      if (!profile) {
        console.error("No profile found for user:", userId);
        return null;
      }
      return profile.balance;
    } catch (error) {
      console.error("Error fetching balance:", error);
      return null;
    }
  }

  // Update balance with validation and safety checks
  static async updateBalance(userId, balanceChange, currentBalance = null) {
    try {
      // Re-fetch profile to get latest balance if not provided
      let startingBalance = currentBalance;
      if (startingBalance === null) {
        const profile = await profileSchema.findOne({ userid: userId });
        if (!profile) {
          console.error("No profile found for balance update:", userId);
          return null;
        }
        startingBalance = profile.balance;
      }

      // Validate numbers
      if (isNaN(balanceChange) || isNaN(startingBalance)) {
        console.error("Invalid balance values:", {
          balanceChange,
          startingBalance,
        });
        return startingBalance;
      }

      // Calculate new balance with floor and safety checks
      const newBalance = Math.floor(startingBalance + balanceChange);
      const safeBalance = Math.max(0, newBalance);

      // Update in database
      const updatedProfile = await profileSchema.findOneAndUpdate(
        { userid: userId },
        { balance: safeBalance },
        { new: true }
      );

      return updatedProfile.balance;
    } catch (error) {
      console.error("Balance update error:", error);
      return currentBalance;
    }
  }

  // Validate if user can afford a bet amount
  static async canAffordBet(userId, betAmount, includeExtra = true) {
    try {
      const profile = await profileSchema.findOne({ userid: userId });
      if (!profile) return false;

      let requiredBalance = betAmount;
      if (includeExtra) {
        // Account for potential double down (2x) and insurance (0.5x)
        requiredBalance = betAmount * 2.5;
      }

      return profile.balance >= requiredBalance;
    } catch (error) {
      console.error("Error checking bet affordability:", error);
      return false;
    }
  }

  // Get formatted balance string
  static format(balance) {
    return balance?.toLocaleString() ?? "0";
  }
}

export default BalanceManager;
