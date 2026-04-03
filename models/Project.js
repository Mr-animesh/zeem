const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    /** github: repo-backed registration/submit; collab: user-posted help-wanted (no GitHub URL). */
    source: {
      type: String,
      enum: ["github", "collab"],
      default: "github",
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    /** Set for source=collab; searchable with name/keywords */
    description: {
      type: String,
      trim: true,
      default: "",
    },
    keywords: {
      type: [String],
      default: [],
      index: true,
    },
    /** 1–10 from project context at submit time; summed into User.totalDifficulty (github only). */
    difficulty: {
      type: Number,
      min: 1,
      max: 10,
      default: 5,
    },
    githubRepoUrl: {
      type: String,
      trim: true,
      default: "",
    },
    /** Only used when source=collab */
    helpers: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Project || mongoose.model("Project", projectSchema);
