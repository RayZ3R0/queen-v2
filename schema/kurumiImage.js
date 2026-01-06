import mongoose from "mongoose";

const kurumiImageSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true,
        unique: true, // Ensure no duplicate images
        index: true,
    },
    messageId: {
        type: String,
        required: true,
    },
    uploaderId: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export default mongoose.model("KurumiImage", kurumiImageSchema);
