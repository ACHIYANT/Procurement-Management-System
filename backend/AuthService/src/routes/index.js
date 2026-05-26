const express = require("express");
const authRoutes = require("./auth-routes");

const router = express.Router();

router.get("/healthz", (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "Auth service healthy",
    data: {},
    err: {},
  });
});

router.use("/", authRoutes);

module.exports = router;
