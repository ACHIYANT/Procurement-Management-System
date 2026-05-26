"use strict";

const validateUserAuth = (req, res, next) => {
  const mobileno = String(req.body?.mobileno || "").trim();
  const password = String(req.body?.password || "");

  if (!mobileno || !password) {
    return res.status(400).json({
      success: false,
      data: {},
      message: "Validation failed",
      err: {
        code: "LOGIN_FIELDS_MISSING",
        message: "Mobile number and password are required.",
      },
    });
  }

  return next();
};

module.exports = {
  validateUserAuth,
};
