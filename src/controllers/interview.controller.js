const pdfParseModule = require("pdf-parse");
const pdfParseDefault = pdfParseModule?.default;
const mongoose = require("mongoose");

async function getPdfText(buffer) {
   if (typeof pdfParseModule === "function") {
      return pdfParseModule(buffer);
   }
   if (typeof pdfParseDefault === "function") {
      return pdfParseDefault(buffer);
   }
   const PDFParseClass = pdfParseModule?.PDFParse || pdfParseDefault?.PDFParse;
   if (PDFParseClass) {
      const parser = new PDFParseClass({ data: buffer });
      try {
         return await parser.getText();
      } finally {
         if (typeof parser.destroy === "function") {
            await parser.destroy();
         }
      }
   }
   throw new Error("Unsupported pdf-parse export. Unable to parse PDF.");
}
const { generateInterviewReport, generateResumePdf, generatePdfFromHtml } = require("../services/ai.service");
const InterviewReportModel = require("../model/interviewReport.model")

   
/**
 * @description controller to generate interview report based on resume, job description and self description. The report includes a match score, technical questions, behavioral questions, skill gaps, and a preparation plan.
 * @access private
 * @route POST /api/interview 
 */
async function generateInterviewReportController(req, res){
   const resumeFile = req.file;
   if (!resumeFile) {
      return res.status(400).json({ message: "Resume file is required" });
   }
   if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized request. Please login again." });
   }
   const { selfDescription, jobDescription } = req.body;
   if (!jobDescription?.trim() || !selfDescription?.trim()) {
      return res.status(400).json({ message: "jobDescription and selfDescription are required." });
   }

   try {
      const resumeContent = await getPdfText(resumeFile.buffer);
      const resumeText = (resumeContent?.text || "").trim();
      if (!resumeText) {
         return res.status(400).json({ message: "Unable to read text from the uploaded PDF." });
      }

      const interviewReportByAi = await generateInterviewReport({
       resume:resumeText,
       jobDescription,
       selfDescription
      })

      const interviewReport = await InterviewReportModel.create({
       user:req.user.id,
       jobDescription,
       title: (jobDescription || selfDescription || "Interview Report").slice(0, 80),
       resumeText,
       selfDescription,
       matchScore: interviewReportByAi.matchScore,
       technicalQuestions: interviewReportByAi.technicalQuestions,
       behavirolQuestions: interviewReportByAi.behavioralQuestions,
       skillGaps: interviewReportByAi.skillGaps,
       preprationPlan: interviewReportByAi.preparationPlan,
      })

      return res.status(201).json({    
         message: "Interview report generated successfully",
         data: interviewReport,
      });
   } catch (error) {
      console.error("Error generating interview report:", error);
      const aiReason = error?.errorDetails?.find((detail) => detail?.reason)?.reason;
      const aiMessage = String(error?.message || "");
      const isInvalidApiKey = aiReason === "API_KEY_INVALID" || aiMessage.includes("API_KEY_INVALID");
      const isInvalidAuthCredential =
         Number(error?.status) === 401 ||
         aiReason === "ACCESS_TOKEN_TYPE_UNSUPPORTED" ||
         aiMessage.toLowerCase().includes("invalid authentication credentials") ||
         aiMessage.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED");
      const isHighDemand = Number(error?.status) === 503 || aiMessage.toLowerCase().includes("high demand");
      const isRateLimited =
         Number(error?.status) === 429 ||
         aiReason === "RESOURCE_EXHAUSTED" ||
         aiMessage.toLowerCase().includes("too many requests") ||
         aiMessage.toLowerCase().includes("quota exceeded");
      const isUnsupportedModel = Number(error?.status) === 404 || aiMessage.includes("is not found for API version");
      const isPdfParseFailure = aiMessage.includes("Unsupported pdf-parse export") || aiMessage.includes("Unable to parse PDF");
      const isNodeRuntimeMismatch =
         aiMessage.includes("Promise.withResolvers") ||
         aiMessage.includes("DOMMatrix is not defined") ||
         aiMessage.includes("node") && aiMessage.includes(">=20.16.0");

      if (isInvalidApiKey) {
         return res.status(502).json({
            message: "AI provider rejected the API key. Update GOOGLE_GENAI_API_KEY in backend/.env and restart backend.",
            error: error.message
         });
      }
      if (isInvalidAuthCredential) {
         return res.status(502).json({
            message: "Google AI authentication failed. Set GOOGLE_GENAI_API_KEY to a valid Gemini API key from Google AI Studio (not OAuth/access token), then redeploy backend.",
            error: error.message
         });
      }
      if (isHighDemand) {
         return res.status(503).json({
            message: "AI service is temporarily overloaded. Please retry in a few seconds.",
            error: error.message
         });
      }
      if (isRateLimited) {
         const retryMatch = aiMessage.match(/retry in\s+([0-9.]+)s/i);
         const retryAfter = retryMatch ? Math.ceil(Number(retryMatch[1])) : null;
         if (retryAfter) {
            res.set("Retry-After", String(retryAfter));
         }
         return res.status(429).json({
            message: retryAfter
               ? `AI request limit reached. Please retry in about ${retryAfter} seconds.`
               : "AI request limit reached. Please retry shortly.",
            error: error.message
         });
      }
      if (isUnsupportedModel) {
         return res.status(502).json({
            message: "Configured Gemini model is unsupported. Update GEMINI_MODEL to a valid model (for example: gemini-2.5-flash).",
            error: error.message
         });
      }
      if (isPdfParseFailure) {
         return res.status(400).json({
            message: "Uploaded PDF could not be parsed. Try another PDF export of your resume.",
            error: error.message
         });
      }
      if (isNodeRuntimeMismatch) {
         return res.status(500).json({
            message: "Server runtime is incompatible with current PDF parser. Deploy backend on Node 20.16+ (recommended: Node 20 LTS latest).",
            error: error.message
         });
      }
      if (error?.name === "ZodError") {
         return res.status(502).json({
            message: "AI response format was invalid. Please retry.",
            error: error.message
         });
      }
      if (error?.name === "ValidationError") {
         return res.status(422).json({
            message: "Generated report failed validation. Please retry.",
            error: error.message
         });
      }

      return res.status(500).json({
         message: error?.message || "Error generating interview report",
         error: error?.stack || error?.message || "Unknown error"
      });
   }
}

/**
 * @description controller to get the generated interview report by interviewId for the authenticated user.
 * @access private
 * @route GET /api/interview/report/:interviewId
 */

async function getInterviewReportByIdController(req, res){  
   const {interviewId} = req.params;
   const interviewReport = await InterviewReportModel.findOne({
      _id:interviewId,
      user:req.user.id
   })

   if(!interviewReport){
      return res.status(404).json({
         message:"Interview report not found"
      })
   }

   res.status(200).json({
      message:"Interview report fetched successfully",
      data: interviewReport
   })
}

/**
 * @description controller to get all the generated interview reports for the authenticated user.  
 * @access private
 * @route GET /api/interview/reports
 */

async function getAllInterviewReportsController(req, res){
   const interviewReports = await InterviewReportModel.find({
      user:req.user.id
   }).sort({createdAt:-1}).select("-resumeText -selfDescription -jobDescription -__v -technicalQuestions -behavirolQuestions -skillGaps -preprationPlan")

   res.status(200).json({
      message:"Interview reports fetched successfully",
      data: interviewReports
   })
}     

/**
 * @description controller to download the generated interview report as a PDF.
 * @access private
 * @route GET /api/interview/report/:interviewId/pdf
 */
async function downloadInterviewReportPdfController(req, res){
  const { interviewId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(interviewId)) {
    return res.status(400).json({ message: "Invalid interviewId." });
  }

  try {
    const interviewReport = await InterviewReportModel.findOne({
      _id: interviewId,
      user: req.user.id
    });

    if(!interviewReport){
      return res.status(404).json({
        message:"Interview report not found"
      })
    }

    let pdfBuffer = interviewReport.resumePdf;
    if (pdfBuffer && !Buffer.isBuffer(pdfBuffer)) {
      pdfBuffer = Buffer.from(pdfBuffer);
    }
    if(!pdfBuffer || pdfBuffer.length === 0){
      const { resumeText, jobDescription, selfDescription } = interviewReport;
      const generated = await generateResumePdf({
        resume: resumeText,
        jobDescription,
        selfDescription
      });
      pdfBuffer = Buffer.isBuffer(generated.pdfBuffer) ? generated.pdfBuffer : Buffer.from(generated.pdfBuffer);
      interviewReport.resumePdf = pdfBuffer;
      interviewReport.resumePdfGeneratedAt = new Date();
      await interviewReport.save();
    }

    const inline = req.query?.inline === "1";
    res.set({
      "Content-Type":"application/pdf",
      "Content-Disposition":`${inline ? "inline" : "attachment"}; filename=interview_report_${interviewId}.pdf`,
      "Cache-Control":"private, max-age=31536000, immutable"
    })
    return res.send(Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer));
  } catch (error) {
    console.error("Error generating interview PDF:", error);
    const aiReason = error?.errorDetails?.find((detail) => detail?.reason)?.reason;
    const aiMessage = String(error?.message || "");
    const isInvalidApiKey = aiReason === "API_KEY_INVALID" || aiMessage.includes("API_KEY_INVALID");
    const isInvalidAuthCredential =
      Number(error?.status) === 401 ||
      aiReason === "ACCESS_TOKEN_TYPE_UNSUPPORTED" ||
      aiMessage.toLowerCase().includes("invalid authentication credentials") ||
      aiMessage.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED");
    const isHighDemand = Number(error?.status) === 503 || aiMessage.toLowerCase().includes("high demand");
    const isRateLimited = Number(error?.status) === 429 || aiReason === "RESOURCE_EXHAUSTED";
    const isPuppeteerLaunchIssue = aiMessage.includes("Could not find Chrome") || aiMessage.includes("Failed to launch the browser process");

    if (isInvalidApiKey) {
      return res.status(502).json({
        message: "AI provider rejected the API key while generating the PDF.",
        error: error.message
      });
    }
    if (isInvalidAuthCredential) {
      return res.status(502).json({
        message: "Google AI authentication failed while generating PDF. Use a valid GOOGLE_GENAI_API_KEY from Google AI Studio and redeploy backend.",
        error: error.message
      });
    }
    if (isHighDemand) {
      return res.status(503).json({
        message: "AI service is temporarily overloaded while generating PDF. Please retry shortly.",
        error: error.message
      });
    }
    if (isRateLimited) {
      return res.status(429).json({
        message: "AI request limit reached during PDF generation. Please retry shortly.",
        error: error.message
      });
    }
    if (isPuppeteerLaunchIssue) {
      return res.status(503).json({
        message: "PDF renderer is unavailable on server. Please retry or restart backend.",
        error: error.message
      });
    }
    if (error?.name === "ZodError") {
      return res.status(502).json({
        message: "AI response format was invalid during PDF generation. Please retry.",
        error: error.message
      });
    }

    return res.status(500).json({
      message: error?.message || "Error generating interview PDF",
      error: error?.stack || error?.message || "Unknown error"
    });
  }
}  




module.exports = {generateInterviewReportController, getInterviewReportByIdController, getAllInterviewReportsController, downloadInterviewReportPdfController  } 
