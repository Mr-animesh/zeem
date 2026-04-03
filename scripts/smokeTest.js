const User = require("../models/User");
const Project = require("../models/Project");
const { registerUser, matchUsers } = require("../controllers/matchController");

const run = async () => {
  process.env.OPENAI_API_KEY = "";

  const registerPayload = {
    name: "Jane Dev",
    email: "jane@example.com",
    location: "Brooklyn",
    githubRepoUrl: "https://github.com/nodejs/node",
  };

  const matchPayload = {
    targetLocation: "Lower Manhattan",
    missionDescription:
      "Need a Node.js backend engineer who improved API performance and built production services in New York.",
  };

  const fakeDb = [];
  const originalCreate = User.create;
  const originalFind = User.find;
  const originalFindById = User.findById;
  const originalUpdateOne = User.updateOne;
  const originalProjectCreate = Project.create;
  const originalProjectFind = Project.find;

  Project.create = async (payload) => ({
    ...payload,
    _id: "mock-project",
    difficulty: payload.difficulty ?? 5,
  });

  Project.find = () => ({
    select: () => ({
      lean: async () => [{ difficulty: 5 }],
    }),
  });

  User.updateOne = async () => ({ acknowledged: true });

  User.findById = (id) => ({
    lean: async () => {
      const u = fakeDb.find((x) => String(x._id) === String(id));
      if (!u) return null;
      return {
        ...u,
        totalDifficulty: 5,
        projectCount: 1,
      };
    },
  });

  User.create = async (payload) => {
    const created = {
      _id: String(fakeDb.length + 1),
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    fakeDb.push(created);
    return created;
  };

  User.find = () => ({
    lean: async () => fakeDb,
  });

  const makeRes = () => {
    const response = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
    return response;
  };

  const registerReq = { body: registerPayload };
  const registerRes = makeRes();
  await registerUser(registerReq, registerRes, (e) => {
    throw e;
  });

  if (registerRes.statusCode !== 201 || !registerRes.body?.success) {
    throw new Error(`Register endpoint failed: ${registerRes.statusCode} ${JSON.stringify(registerRes.body)}`);
  }

  if (!registerRes.body.user?.githubRepoUrl || !registerRes.body.user?.projectSummary) {
    throw new Error("Register response missing githubRepoUrl or projectSummary");
  }

  const matchReq = { body: matchPayload };
  const matchRes = makeRes();
  await matchUsers(matchReq, matchRes, (e) => {
    throw e;
  });

  if (matchRes.statusCode !== 200 || !Array.isArray(matchRes.body?.results)) {
    throw new Error(`Match endpoint failed: ${matchRes.statusCode} ${JSON.stringify(matchRes.body)}`);
  }

  console.log("Smoke test passed.");
  console.log(
    JSON.stringify(
      {
        registerStatus: registerRes.statusCode,
        matchStatus: matchRes.statusCode,
        resultCount: matchRes.body.results.length,
        matchingMode: matchRes.body.matchingMode,
      },
      null,
      2,
    ),
  );

  User.create = originalCreate;
  User.find = originalFind;
  User.findById = originalFindById;
  User.updateOne = originalUpdateOne;
  Project.create = originalProjectCreate;
  Project.find = originalProjectFind;
};

run().catch((error) => {
  console.error("Smoke test failed:", error.message);
  process.exit(1);
});
