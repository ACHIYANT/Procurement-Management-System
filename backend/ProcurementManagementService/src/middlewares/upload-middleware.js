"use strict";

const multer = require("multer");

const { DEFAULT_UPLOAD_MAX_BYTES, assertAllowedUploadFile } = require("../utils/file-storage");

const secureMemoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: Number(process.env.UPLOAD_MAX_FILE_BYTES || DEFAULT_UPLOAD_MAX_BYTES),
    fields: 20,
  },
  fileFilter: (_req, file, cb) => {
    try {
      assertAllowedUploadFile(file);
      return cb(null, true);
    } catch (error) {
      return cb(error);
    }
  },
});

module.exports = {
  uploadSingleEncryptedFile: secureMemoryUpload.single("file"),
};
