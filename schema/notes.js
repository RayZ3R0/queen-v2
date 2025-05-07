import mongoose from "mongoose";

const notesSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  guildId: {
    type: String,
    required: true,
  },
  noteName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  noteContent: {
    type: String,
    required: true,
    trim: true,
    maxlength: 4000, // Discord embed description limit
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

// Compound index to ensure note names are unique per user per guild
notesSchema.index({ userId: 1, guildId: 1, noteName: 1 }, { unique: true });

export default mongoose.model("Notes", notesSchema);
