// Workshop Shop - a deliberately simple Express server.
// No database, no sessions, no real payments - everything the browser
// needs (cart contents) lives in localStorage on the client side.

const express = require("express");
const path = require("path");
const products = require("./products.json");

const app = express();
const PORT = 3000;

// Bump this when you change the app so students can see a new version
// roll out through the pipeline during the workshop.
const APP_VERSION = "1.0.0";

// Edit this banner to change the message shown at the top of the store.
// This is the easiest, safest field to change live during the workshop
// to demonstrate the full CI/CD -> Argo CD pipeline.
const STORE_BANNER = "Welcome to Workshop Shop - everything 20% off today!";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Used by Kubernetes readiness/liveness probes - must stay fast and simple.
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", version: APP_VERSION });
});

// The frontend fetches products, banner, and version from this single
// endpoint so there is one source of truth for "what does the page show".
app.get("/api/store-info", (req, res) => {
  res.json({
    banner: STORE_BANNER,
    version: APP_VERSION,
    products,
  });
});

app.listen(PORT, () => {
  console.log(`Workshop Shop v${APP_VERSION} listening on port ${PORT}`);
});
