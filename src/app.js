import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

dotenv.config({
    path: "./.env",
});

// Common middlewares.
app.use(
    cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true,
    })
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Importing route.
import healthCheckRouter from "./routes/healthCheck.routes.js";

// Routes
app.use("/api/v1/healthCheck", healthCheckRouter);

export { app };
