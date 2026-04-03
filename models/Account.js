const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    skills: {
      type: String,
      default: "",
      trim: true,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    build_goal: {
      type: String,
      default: "",
      trim: true,
    },
    open_to_collab: {
      type: Boolean,
      default: true,
    },
    social: {
      type: String,
      default: "",
      trim: true,
    },
    availability: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

accountSchema.index({ email: 1 }, { unique: true });

module.exports =
  mongoose.models.Account || mongoose.model("Account", accountSchema);
