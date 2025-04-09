import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import helmet from "helmet";
import multer from "multer";
import fs from "fs";

import atsRoutes from "./routes/atsRoutes.js";
import internshipRoutes from "./routes/internshipRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import recommendRoute from "./routes/recommend.js";

dotenv.config();
const app = express();

// 🛡️ Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// 🧩 Middlewares
app.use(express.json());
app.use(morgan("dev"));

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://internmate.netlify.app",
];


// 🌐 CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// 🔧 Development CORS Headers
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  next();
});

// 🔗 API Routes
app.use("/api/internships", internshipRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", recommendRoute);
app.use("/api/ats", atsRoutes);

// 📄 ATS Dummy Score
const upload = multer({ dest: "uploads/" });
app.post("/api/ats-check", upload.single("resume"), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No resume uploaded" });

  const score = Math.floor(Math.random() * 41) + 60;
  const suggestions = [
    "Add job-specific keywords.",
    "Include quantifiable achievements.",
    "Use proper headings like 'Experience', 'Education'.",
    "Avoid tables/images in resume.",
    "Upload PDF only.",
  ];

  fs.unlink(file.path, (err) => {
    if (err) console.error("❌ Failed to delete uploaded file:", err);
  });

  res.json({ score, recommendations: suggestions });
});

// ✅ Health Check
app.get("/", (req, res) => {
  res.send("✅ Internship Recommender Backend is Running!");
});

// 🌍 MongoDB Atlas Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI); // No need for deprecated options now
    console.log("✅ MongoDB Atlas Connected");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    setTimeout(connectDB, 5000); // Retry after 5 seconds
  }
};

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB Disconnected");
});
mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB Error:", err);
});

// 🛠️ Error Handler
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

// 🚀 Start Express Server
const startServer = async () => {
  await connectDB();
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
};

startServer();
