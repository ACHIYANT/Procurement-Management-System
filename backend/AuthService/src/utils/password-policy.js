"use strict";

const PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&^_\-])[A-Za-z\d@$!%*#?&^_\-]{8,100}$/;

const PASSWORD_POLICY_MESSAGE =
  "Password must be 8-100 characters and include uppercase, lowercase, number, and special character.";

module.exports = {
  PASSWORD_POLICY_REGEX,
  PASSWORD_POLICY_MESSAGE,
};
