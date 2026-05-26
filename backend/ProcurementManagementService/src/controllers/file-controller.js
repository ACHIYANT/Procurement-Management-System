"use strict";

const { PassThrough } = require("stream");

const { readStoredEncryptedFile, saveEncryptedUpload } = require("../utils/file-storage");

const sendError = (res, error, fallbackMessage) =>
  res.status(Number(error.statusCode || 500)).json({
    success: false,
    message: error.message || fallbackMessage,
    data: {},
    err: {},
  });

const uploadEncryptedFile = (req, res) => {
  try {
    const file = saveEncryptedUpload({
      file: req.file,
      scope: req.params.scope,
      filenameBase: req.body?.filename_base || req.body?.filenameBase,
    });

    return res.status(201).json({
      success: true,
      message: "File uploaded successfully.",
      data: file,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to upload file.");
  }
};

const streamStoredFile = (req, res, disposition = "inline") => {
  try {
    const file = readStoredEncryptedFile(req.query.path);
    const readable = new PassThrough();
    readable.end(file.decryptedBuffer);

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${encodeURIComponent(file.downloadName)}"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    return readable.pipe(res);
  } catch (error) {
    return sendError(res, error, "Unable to access file.");
  }
};

const viewStoredFile = (req, res) => streamStoredFile(req, res, "inline");

const downloadStoredFile = (req, res) => streamStoredFile(req, res, "attachment");

module.exports = {
  downloadStoredFile,
  uploadEncryptedFile,
  viewStoredFile,
};
