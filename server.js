require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const {
  registerUser,
  matchUsers,
  getLeaderboard,
  searchProjects,
  submitProject,
  createCollabProject,
  offerHelpOnCollabProject,
} = require("./controllers/matchController");

const authRouter = require("./routes/auth");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    uptime: process.uptime(),
  });
});

app.use("/api/auth", authRouter);

app.post("/api/users/register", registerUser);
app.post("/api/match", matchUsers);
app.get("/api/leaderboard", getLeaderboard);
app.get("/api/projects/search", searchProjects);
app.post("/api/projects/submit", submitProject);
app.post("/api/collab-projects", createCollabProject);
app.post("/api/collab-projects/:id/help", offerHelpOnCollabProject);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    message: "Internal server error.",
    error: err.message,
  });
});

const PORT = Number(process.env.PORT) || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

const startServer = async () => {
  if (!MONGODB_URI) {
    console.error("Missing MONGODB_URI in environment.");
    process.exit(1);
  }
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connected.");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
