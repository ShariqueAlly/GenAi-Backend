const pdfParseModule = require("pdf-parse");
const pdfParseDefault = pdfParseModule?.default;

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

   try {
      const resumeContent = await getPdfText(resumeFile.buffer);
      const {selfDescription, jobDescription} = req.body;

      const interviewReportByAi = await generateInterviewReport({
       resume:resumeContent.text,
       jobDescription,
       selfDescription
      })

      const interviewReport = await InterviewReportModel.create({
       user:req.user.id,
       jobDescription,
       title: (jobDescription || selfDescription || "Interview Report").slice(0, 80),
       resumeText: resumeContent.text,
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
      return res.status(500).json({ message: "Error generating interview report", error: error.message });
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
    if(!pdfBuffer || pdfBuffer.length === 0){
      const { resumeText, jobDescription, selfDescription } = interviewReport;
      const generated = await generateResumePdf({
        resume: resumeText,
        jobDescription,
        selfDescription
      });
      pdfBuffer = generated.pdfBuffer;
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
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating interview PDF:", error);
    return res.status(500).json({ message: "Error generating interview PDF", error: error.message });
  }
}  




module.exports = {generateInterviewReportController, getInterviewReportByIdController, getAllInterviewReportsController, downloadInterviewReportPdfController  } 
