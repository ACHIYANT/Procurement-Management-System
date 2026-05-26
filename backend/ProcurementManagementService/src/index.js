require("dotenv").config();

const express = require("express");
const cors = require("cors");
const routes = require("./routes");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.disable("x-powered-by");
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1", routes);

app.use((error, _req, res, _next) => {
  return res.status(Number(error?.statusCode || 500)).json({
    success: false,
    message: error?.message || "Internal server error",
    data: {},
    err: {},
  });
});

app.listen(PORT, () => {
  console.log(`ProcurementManagementService started on port ${PORT}`);
});
