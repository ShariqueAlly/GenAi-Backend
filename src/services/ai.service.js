require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { z } = require("zod/v3");
const isProduction = process.env.NODE_ENV === "production";
const puppeteer = isProduction ? require("puppeteer-core") : require("puppeteer");
const chromium = isProduction ? require("@sparticuz/chromium") : null;
const genAiApiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_AI_API_KEY;

if (!genAiApiKey) {
  throw new Error(
    "Google API key is missing. Set GOOGLE_GENAI_API_KEY (preferred) or GOOGLE_AI_API_KEY in backend/.env"
  );
}
const genAI = new GoogleGenerativeAI(genAiApiKey);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableAiError(error) {
  const status = Number(error?.status);
  if (status === 429 || status === 503) return true;
  const message = String(error?.message || "");
  return message.includes("high demand") || message.includes("RESOURCE_EXHAUSTED");
}

function isQuotaExceededError(error) {
  const status = Number(error?.status);
  const message = String(error?.message || "").toLowerCase();
  const reason = error?.errorDetails?.find?.((d) => d?.reason)?.reason;
  return (
    status === 429 ||
    reason === "RESOURCE_EXHAUSTED" ||
    message.includes("too many requests") ||
    message.includes("quota exceeded")
  );
}

function normalizeModelName(modelName) {
  const normalized = String(modelName || "").trim();
  // Gemini model ids do not contain whitespace. Ignore accidental sentences like "You can use flash 2.5".
  if (!normalized || /\s/.test(normalized)) return null;
  return normalized;
}

function getModelCandidates() {
  const primaryModel = normalizeModelName(process.env.GEMINI_MODEL) || "gemini-2.5-flash";
  const candidates = [
    primaryModel,
    normalizeModelName(process.env.GEMINI_FALLBACK_MODEL),
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite-001",
    "gemini-2.0-flash-lite",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
  ]
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
  return { primaryModel, candidates };
}

async function generateJsonFromModels({ prompt, responseSchema }) {
  const { primaryModel, candidates } = getModelCandidates();
  let result;
  let lastError;

  for (const modelName of candidates) {
    const model = genAI.getGenerativeModel({ model: modelName });
    const maxAttempts = modelName === primaryModel ? 3 : 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema,
          },
        });
        break;
      } catch (error) {
        lastError = error;
        if (isQuotaExceededError(error)) {
          break;
        }
        const shouldRetry = isRetryableAiError(error) && attempt < maxAttempts;
        if (!shouldRetry) {
          break;
        }
        await wait(700 * attempt);
      }
    }
    if (result) break;
  }

  if (!result) {
    throw lastError || new Error("Failed to generate content with all configured models.");
  }

  const text = result.response.text();
  return parseJsonResponse(text);
}

function parseJsonResponse(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      const sliced = text.slice(first, last + 1);
      return JSON.parse(sliced);
    }
    throw new Error("Model returned invalid JSON response");
  }
}

const interviewReportSchema = z.object({
    matchScore: z.number().min(0).max(100).describe("A score between 0 and 100 indicating how well the candidate's resume and self-description match the job description, with a higher score indicating a better match."),
    
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked during the interview"),
        intention: z.string().describe("The intention of the interviewer behind asking the question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take, etc.")
    })).describe("A list of technical questions that can be asked during the interview, along with the intention behind asking each question and how to answer them effectively."),

    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The behavioral question can be asked during the interview"),
        intention: z.string().describe("The intention of the interviewer behind asking the question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take, etc.")
    })).describe("A list of behavioral questions that can be asked during the interview, along with the intention behind asking each question and how to answer them effectively."),
    
    skillGaps: z.array(z.object({
      skill: z.string().describe("The skill that the candidate is lacking based on the resume, job description, and self-description"), 
      severity: z.enum(["low", "medium", "high"]).describe("The severity of the skill gap, indicating how critical it is for the candidate to address this gap in order to be successful in the role"),
    })),

    preparationPlan: z.array(z.object({
     day: z.number().int().min(1).describe("The day number in the preparation plan, starting from 1"),
     focusArea: z.string().describe("The specific area of focus for this day, such as a particular technical skill, a behavioral topic, or general interview preparation strategies"),
     tasks: z.array(z.string()).describe("A list of specific tasks or activities that the candidate should complete on this day to effectively prepare for the interview, such as practicing coding problems, researching the company, or conducting mock interviews.")   
    }))
});

async function generateInterviewReport({resume, jobDescription, selfDescription}){
 const prompt = `Generate an interview report for a candidate based on the following information:
    Resume: ${resume}
    Job Description: ${jobDescription}
    Self-description: ${selfDescription} `;

 const responseSchema = {
    type: "object",
    properties: {
      matchScore: { type: "number" },
      technicalQuestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            intention: { type: "string" },
            answer: { type: "string" },
          },
          required: ["question", "intention", "answer"],
        },
      },
      behavioralQuestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            intention: { type: "string" },
            answer: { type: "string" },
          },
          required: ["question", "intention", "answer"],
        },
      },
      skillGaps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            skill: { type: "string" },
            severity: { type: "string", enum: ["low", "medium", "high"] },
          },
          required: ["skill", "severity"],
        },
      },
      preparationPlan: {
        type: "array",
        items: {
          type: "object",
          properties: {
            day: { type: "integer" },
            focusArea: { type: "string" },
            tasks: { type: "array", items: { type: "string" } },
          },
          required: ["day", "focusArea", "tasks"],
        },
      },
    },
    required: ["matchScore", "technicalQuestions", "behavioralQuestions", "skillGaps", "preparationPlan"],
 };

 const parsed = await generateJsonFromModels({ prompt, responseSchema });
 return interviewReportSchema.parse(parsed);
}

async function generatePdfFromHtml(htmlContent){
   const launchOptions = isProduction
      ? {
         args: chromium.args,
         defaultViewport: chromium.defaultViewport,
         executablePath: await chromium.executablePath(),
         headless: chromium.headless,
        }
      : {
         args: ["--no-sandbox", "--disable-setuid-sandbox"],
         headless: "new",
        };

   const browser = await puppeteer.launch(launchOptions);
   const page = await browser.newPage();
   await page.setContent(htmlContent, { waitUntil: "networkidle0", timeout: 30000 });
   const pdfOutput = await page.pdf({ format: "A4", printBackground: true });
   await browser.close();
   return Buffer.isBuffer(pdfOutput) ? pdfOutput : Buffer.from(pdfOutput);
}

async function generateResumePdf({resume, selfDescription, jobDescription}){
    const prompt = `You are a senior resume designer. Generate a single-page, corporate, ATS-friendly resume in clean HTML + inline CSS.
Requirements:
1) Use a two-column layout with a narrow left sidebar for contact + skills, and a wider right column for summary, experience, education, and projects.
2) Typography: professional (use "Helvetica, Arial, sans-serif"), consistent sizes, strong hierarchy, no playful fonts.
3) Colors: black text, subtle gray accents (#666, #999). No bright colors, no gradients, no icons.
4) Sections must be clearly labeled with uppercase headings and thin dividers.
5) Use bullet points for experience and projects; each bullet concise and action-oriented.
6) Ensure clean spacing and alignment. No external assets or links.
7) Return only valid HTML in a JSON object { "html": "..." }.

Data:
Resume: ${resume}
Self-description: ${selfDescription}
Job Description: ${jobDescription}`;
    
    const parsed = await generateJsonFromModels({
      prompt,
      responseSchema: {
        type: "object",
        properties: {
          html: { type: "string" },
        },
        required: ["html"],
      },
    });
     const html = typeof parsed?.html === "string" ? parsed.html : "";
     if (!html.trim()) {
      throw new Error("AI returned empty HTML for resume PDF generation.");
     }
     const pdfBuffer = await generatePdfFromHtml(html);
     return { html, pdfBuffer };

}

module.exports = { generateInterviewReport, generateResumePdf, generatePdfFromHtml };
