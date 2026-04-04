const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
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
    location: {
      type: String,
      required: true,
      trim: true,
    },
    /** Normalized GitHub profile URL (https://github.com/<username>) */
    githubProfileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    githubRepoUrl: {
      type: String,
      default: "",
      trim: true,
    },
    /** User-declared at registration (README-style; merged into projectSummary + Project keywords) */
    skills: {
      type: [String],
      default: [],
    },
    userLanguages: {
      type: [String],
      default: [],
    },
    projectNotes: {
      type: String,
      default: "",
      trim: true,
    },
    projectSummary: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    /** Cached GitHub profile signals (followers, repos, stars, top languages, etc.) */
    profileStats: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    /** Profile-based score (0-100) used for leaderboard ranking */
    profileScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      index: true,
    },
    /** Latest submitted project difficulty (1–10) */
    difficultyScore: {
      type: Number,
      min: 1,
      max: 10,
      default: 1,
      index: true,
    },
    /** Sum of difficulty (1–10 per project from AI/context) across all submitted projects */
    totalDifficulty: {
      type: Number,
      min: 0,
      default: 0,
      index: true,
    },
    tokens: {
      type: Number,
      min: 0,
      default: 0,
    },
    projectCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    highestRankReached: {
      type: Number,
      default: 1000000,
    },
    minTokensToHire: {
      type: Number,
      default: 10,
      min: 0,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
