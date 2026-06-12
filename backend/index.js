import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { createSocialRoutes } from "./routes/social.routes.js";
import { createAiRoutes } from "./routes/ai.routes.js";
import { createScheduleRoutes } from "./routes/schedule.routes.js";
import { createLinkPreviewRoutes } from "./routes/linkPreview.routes.js";
import { startScheduledPostWorker } from "./jobs/scheduledPostWorker.js";
import { getProviderEnvStatus, getRequiredEnvStatus, getAppConfig } from "./config/social.config.js";
import {
  getGoogleOAuthRedirectWarnings,
  getInstagramOAuthRedirectWarnings,
  resolveProviderRedirectUri,
} from "./utils/redirectUri.util.js";
import { registerGoogleAuthRoutes } from "./routes/authGoogle.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);
const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "engagehub";
const jwtSecret = process.env.JWT_SECRET;
const jwtExpiry = "7d";

if (!mongoUri) {
  throw new Error("MONGODB_URI is required. Add it to your .env file.");
}
if (!jwtSecret) {
  throw new Error("JWT_SECRET is required. Add it to your .env file.");
}

const appConfig = getAppConfig();
console.info("[startup:env]", {
  required: getRequiredEnvStatus(),
  providers: getProviderEnvStatus(),
  googleOAuth: {
    youtubeRedirectUri: resolveProviderRedirectUri("youtube") || "missing",
    googleBusinessRedirectUri: resolveProviderRedirectUri("googleBusiness") || "missing",
    appBaseUrl: appConfig.appBaseUrl,
  },
  instagramOAuth: {
    redirectUri: resolveProviderRedirectUri("instagram") || "missing",
    appBaseUrl: appConfig.appBaseUrl,
  },
});
for (const warning of getGoogleOAuthRedirectWarnings()) {
  console.warn("[startup:google-oauth]", warning);
}
for (const warning of getInstagramOAuthRedirectWarnings()) {
  console.warn("[startup:instagram-oauth]", warning);
}

const client = new MongoClient(mongoUri);
await client.connect();
await mongoose.connect(mongoUri, { dbName });

const db = client.db(dbName);
const usersCollection = db.collection("users");

await usersCollection.createIndex({ email: 1 }, { unique: true });
await usersCollection.createIndex({ googleId: 1 }, { unique: true, sparse: true });

const corsOrigins = [
  process.env.CLIENT_BASE_URL || "http://localhost:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

function verifyInstagramWebhookToken(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const expectedToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

  if (!expectedToken) {
    console.error("[instagram:webhook:verify:error] Missing INSTAGRAM_WEBHOOK_VERIFY_TOKEN.");
    return res.status(500).send("Webhook verify token is not configured.");
  }

  if (mode === "subscribe" && token === expectedToken && challenge) {
    console.info("[instagram:webhook:verify:success]");
    return res.status(200).send(challenge);
  }

  console.warn("[instagram:webhook:verify:failed]", {
    mode: mode || "missing",
    hasToken: Boolean(token),
  });
  return res.sendStatus(403);
}

function receiveInstagramWebhook(req, res) {
  console.info("[instagram:webhook:event]", {
    body: req.body,
  });
  return res.sendStatus(200);
}

function parseUserId(userId) {
  if (!ObjectId.isValid(userId)) {
    return null;
  }
  return new ObjectId(userId);
}

function createAuthResponse(user) {
  const token = jwt.sign({ userId: user._id.toString(), email: user.email }, jwtSecret, { expiresIn: jwtExpiry });
  return {
    token,
    user: {
      email: user.email,
      name: user.name,
      userType: user.userType || "",
      profileSetup: user.profileSetup || { completed: false },
      businessProfile: user.businessProfile || {},
      influencerProfile: user.influencerProfile || {},
      studentProfile: user.studentProfile || {},
      onboardingCompleted: Boolean(user.onboardingCompleted),
      onboardingSkippedPlatforms: Array.isArray(user.onboardingSkippedPlatforms) ? user.onboardingSkippedPlatforms : [],
    },
  };
}


function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    req.auth = jwt.verify(token, jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid authentication token." });
  }
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    const email = (req.body?.email || "").trim().toLowerCase();
    const password = req.body?.password || "";

    if (!name || !email || password.length < 6) {
      return res.status(400).json({ error: "Name, email, and password (min. 6 chars) are required." });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "Email is already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      email,
      name,
      passwordHash,
      onboardingCompleted: false,
      onboardingSkippedPlatforms: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const insertResult = await usersCollection.insertOne(user);
    user._id = insertResult.insertedId;

    return res.status(201).json(createAuthResponse(user));
  } catch (error) {
    return res.status(500).json({ error: "Failed to create account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = (req.body?.email || "").trim().toLowerCase();
    const password = req.body?.password || "";

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    if (!user.passwordHash) {
      return res.status(401).json({ error: "This account uses Google sign-in. Continue with Google." });
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    return res.json(createAuthResponse(user));
  } catch {
    return res.status(500).json({ error: "Failed to sign in." });
  }
});

app.post("/api/auth/register/complete", async (req, res) => {
  try {
    const {
      authDraftToken,
      selectedUserType,
      businessProfile,
      influencerProfile,
      studentProfile,
    } = req.body;

    if (!authDraftToken) {
      return res.status(400).json({ error: "Draft token is required." });
    }

    let decoded;
    try {
      decoded = jwt.verify(authDraftToken, jwtSecret);
    } catch (err) {
      return res.status(400).json({ error: "Invalid or expired draft signup session." });
    }

    const userId = parseUserId(decoded.userId);
    if (!userId) {
      return res.status(400).json({ error: "Invalid sign-in session." });
    }

    const user = await usersCollection.findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (
      selectedUserType !== "business" &&
      selectedUserType !== "influencer" &&
      selectedUserType !== "student"
    ) {
      return res.status(400).json({ error: "Invalid user type selected." });
    }

    const updates = {
      userType: selectedUserType,
      profileSetup: { completed: true },
      updatedAt: new Date(),
    };

    if (selectedUserType === "business") {
      updates.businessProfile = businessProfile || {};
    } else if (selectedUserType === "influencer") {
      updates.influencerProfile = influencerProfile || {};
    } else if (selectedUserType === "student") {
      updates.studentProfile = studentProfile || {};
    }

    const result = await usersCollection.findOneAndUpdate(
      { _id: userId },
      { $set: updates },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.json(createAuthResponse(result));
  } catch (error) {
    console.error("[auth:register:complete:error]", error);
    return res.status(500).json({ error: "Failed to complete setup." });
  }
});


registerGoogleAuthRoutes(app, { usersCollection, createAuthResponse, parseUserId });

app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const userId = parseUserId(req.auth.userId);
    if (!userId) {
      return res.status(401).json({ error: "Invalid authentication token." });
    }
    const user = await usersCollection.findOne({ _id: userId });
    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }
    return res.json({
      user: {
        email: user.email,
        name: user.name,
        userType: user.userType || "",
        profileSetup: user.profileSetup || { completed: false },
        businessProfile: user.businessProfile || {},
        influencerProfile: user.influencerProfile || {},
        studentProfile: user.studentProfile || {},
        onboardingCompleted: Boolean(user.onboardingCompleted),
        onboardingSkippedPlatforms: Array.isArray(user.onboardingSkippedPlatforms) ? user.onboardingSkippedPlatforms : [],
      },
    });
  } catch {
    return res.status(401).json({ error: "Invalid authentication token." });
  }
});

app.put("/api/users/me", requireAuth, async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    const email = (req.body?.email || "").trim().toLowerCase();
    const password = req.body?.password || "";

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required." });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    const updates = { name, email, updatedAt: new Date() };
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters." });
      }
      updates.passwordHash = await bcrypt.hash(password, 10);
    }

    const userId = parseUserId(req.auth.userId);
    if (!userId) {
      return res.status(401).json({ error: "Invalid authentication token." });
    }
    const result = await usersCollection.findOneAndUpdate({ _id: userId }, { $set: updates }, { returnDocument: "after" });

    if (!result) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.json({
      user: {
        email: result.email,
        name: result.name,
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: "Email is already used by another account." });
    }
    return res.status(500).json({ error: "Failed to save user profile." });
  }
});

app.put("/api/users/me/onboarding", requireAuth, async (req, res) => {
  try {
    const userId = parseUserId(req.auth.userId);
    if (!userId) {
      return res.status(401).json({ error: "Invalid authentication token." });
    }

    const onboardingCompleted = Boolean(req.body?.onboardingCompleted);
    const onboardingSkippedPlatforms = Array.isArray(req.body?.onboardingSkippedPlatforms)
      ? req.body.onboardingSkippedPlatforms.filter((item) => typeof item === "string")
      : [];

    const result = await usersCollection.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          onboardingCompleted,
          onboardingSkippedPlatforms,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.json({
      onboardingCompleted: Boolean(result.onboardingCompleted),
      onboardingSkippedPlatforms: Array.isArray(result.onboardingSkippedPlatforms) ? result.onboardingSkippedPlatforms : [],
    });
  } catch {
    return res.status(500).json({ error: "Unable to update onboarding state." });
  }
});

app.get("/api/webhooks/instagram", verifyInstagramWebhookToken);
app.post("/api/webhooks/instagram", receiveInstagramWebhook);

app.use("/api/social", createSocialRoutes(requireAuth));
app.use("/api/ai", createAiRoutes(requireAuth));
app.use("/api/schedule", createScheduleRoutes(requireAuth));
app.use("/api", createLinkPreviewRoutes(requireAuth));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    features: { auth: true, social: true, schedule: true, upload: true },
  });
});

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

startScheduledPostWorker();

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
