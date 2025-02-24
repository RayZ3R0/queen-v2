import mongoose from "mongoose";

const invitedMemberSchema = new mongoose.Schema(
  {
    memberId: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date },
  },
  { _id: false }
);

const inviteSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    inviterId: { type: String, required: true },
    inviteCode: { type: String }, // Optional: store an invite code if needed.
    invites: { type: Number, default: 0 }, // Count of members who joined.
    left: { type: Number, default: 0 }, // Count of members who left.
    bonus: { type: Number, default: 0 }, // Additional invites (if any).
    invitedMembers: [invitedMemberSchema], // Detailed logging of invited members.
  },
  { timestamps: true }
);

// Create a compound index so that there is one record per guild/inviter pair.
inviteSchema.index({ guildId: 1, inviterId: 1 }, { unique: true });

// Virtual to compute total invites (net invites)
inviteSchema.virtual("totalInvites").get(function () {
  return this.invites + this.bonus - this.left;
});

export default mongoose.model("InviteData", inviteSchema);