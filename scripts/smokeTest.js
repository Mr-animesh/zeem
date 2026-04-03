const User = require("../models/User");
const { registerUser, matchUsers } = require("../controllers/matchController");

const run = async () => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.MOCK_LLM_RESPONSE = JSON.stringify([
    {
      userId: "placeholder-id",
      name: "Jane Dev",
      email: "jane@example.com",
      location: "Brooklyn",
      fitScore: 92,
      reasoning:
        "Strong full-stack JavaScript background and nearby NYC location with relevant API optimization work.",
    },
  ]);

  const registerPayload = {
    name: "Jane Dev",
    email: "jane@example.com",
    location: "Brooklyn",
    projectSummary: {
      languages: ["JavaScript", "TypeScript"],
      frameworks: ["Node.js", "React"],
      highlights: ["Optimized API throughput"],
    },
  };

  const matchPayload = {
    targetLocation: "Lower Manhattan",
    missionDescription:
      "Need a full-stack JavaScript engineer who improved API performance and built production services.",
  };

  const fakeDb = [];
  const originalCreate = User.create;
  const originalFind = User.find;

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
      },
      null,
      2
    )
  );

  User.create = originalCreate;
  User.find = originalFind;
};

run().catch((error) => {
  console.error("Smoke test failed:", error.message);
  process.exit(1);
});
