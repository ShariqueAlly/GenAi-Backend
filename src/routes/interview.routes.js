const express = require("express");
const interviewController = require("../controllers/interview.controller");
const authMiddleware = require("../middleware/auth.middleware");
const upload = require("../middleware/file.middleware");

const interviewRouter = express.Router();

/**
 * @route POST /api/interview
 * @description Generate interview report based on resume, job description, and self description
 * @access Private
 */
interviewRouter.post("/", authMiddleware.authUser, upload.single("resume"), interviewController.generateInterviewReportController);

/**
 * @route GET /api/interview/reports
 * @description Get all interview reports for the authenticated user
 * @access Private
 */
interviewRouter.get("/reports", authMiddleware.authUser, interviewController.getAllInterviewReportsController);

/**
 * @route GET /api/interview/report/:interviewId
 * @description Get a specific interview report by ID
 * @access Private
 */
interviewRouter.get("/report/:interviewId", authMiddleware.authUser, interviewController.getInterviewReportByIdController);

/**
 * @route GET /api/interview/report/:interviewId/pdf
 * @description Download interview report as PDF
 * @access Private
 */
interviewRouter.get("/report/:interviewId/pdf", authMiddleware.authUser, interviewController.downloadInterviewReportPdfController);

module.exports = interviewRouter;
