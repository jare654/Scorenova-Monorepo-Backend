import { Body, Controller, Post, HttpCode, HttpStatus, Req, Inject, Logger } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { DataSource } from "typeorm";
import { Request } from "express";
import { AiService } from "../ai.service";
import { ExplainRequestDto } from "../usecases/explain/explain.commands";
import { ExplainResponseDto } from "../usecases/explain/explain.response";
import { AllowAnonymous } from "@account/auth/decorators/allow-anonymous.decorator";
import { ILlmProvider, LLM_PROVIDER } from "../providers/llm.provider";

// ─── DTO ──────────────────────────────────────────────────────────────────────

export class ScanQuestionDto {
  @ApiProperty({
    description:
      "Raw text extracted from the scanned image (from device OCR). " +
      "The backend will detect the question type and return a fully structured response.",
    example:
      "What is the capital of Ethiopia?\nA) Nairobi\nB) Addis Ababa\nC) Cairo\nD) Lagos",
  })
  @IsString()
  @IsNotEmpty()
  rawText: string;
}

// ─── Question types ────────────────────────────────────────────────────────────

type QuestionType =
  | "mcq"
  | "true_false"
  | "fill_blank"
  | "short_answer"
  | "calculation"
  | "essay";

// ─── Heuristic pre-classifier (fast path before hitting Mistral) ───────────────

function preClassify(text: string): QuestionType | null {
  const t = text.trim();

  // fill_blank: contains a visible blank marker
  if (/_{2,}|\[blank\]/i.test(t)) return "fill_blank";

  // mcq: contains 2+ lettered / numbered option markers
  if (/\b[A-Da-d][.)]\s+\S/.test(t)) {
    const matches = t.match(/\b[A-Da-d][.)]\s+\S/g);
    if (matches && matches.length >= 2) return "mcq";
  }

  // true_false: ends with or contains "True/False" / "True or False"
  if (/true\s*(\/|or)\s*false/i.test(t) || /\bTrue\b.*\bFalse\b/i.test(t))
    return "true_false";

  // calculation: numeric values + calculation keyword
  if (
    /\d/.test(t) &&
    /\b(find|calculate|compute|solve|determine|what is the value|how many|speed|distance|time|mass|force|pressure|voltage|current|resistance|acceleration|velocity|work|energy|power|rate)\b/i.test(
      t,
    )
  )
    return "calculation";

  // essay: explain/discuss/describe/compare keywords
  if (
    /\b(explain|discuss|describe|compare|analyse|analyze|evaluate|assess|examine|outline|justify|elaborate|why|how does|what are the (causes|effects|reasons|impacts|consequences))\b/i.test(
      t,
    )
  )
    return "essay";

  return null; // let Mistral decide
}

function isLikelyQuestion(rawText: string): { isQuestion: boolean; reason?: string } {
  if (!rawText || typeof rawText !== "string") {
    return { isQuestion: false, reason: "No text provided" };
  }
  const text = rawText.trim();
  if (text.length < 5) {
    return { isQuestion: false, reason: "The scanned text is too short to be an exam question." };
  }

  // 1. Definite non-question disqualifiers (receipts, bills, transaction logs)
  const billKeywords = /\b(outstanding bill|unpaid bill|invoice no|account number|bill payment|telebirr|settle your bill|complaint on the invoice|tax invoice|payment due|subtotal|billing receipt|bank statement)\b/i;
  if (billKeywords.test(text)) {
    return { isQuestion: false, reason: "The scanned document appears to be a bill or receipt, not an exam question." };
  }

  // 2. Question signals
  const hasQuestionMark = /\?/.test(text);
  const hasOptions = /\b[A-Da-d][.)]\s+\S/.test(text);
  const hasBlank = /_{2,}|\[blank\]|\.{3,}/i.test(text);
  const hasTrueFalse = /\b(true\s*(\/|or)\s*false|True\b.*\bFalse)\b/i.test(text);
  const hasQuestionVerbs = /\b(what|which|how|why|where|when|who|whom|whose|calculate|find|solve|evaluate|determine|derive|prove|simplify|compute|explain|describe|discuss|compare|define|identify|match|state|list|classify|name|show that)\b/i.test(text);
  const hasMathEquation = /[\d\w]\s*[\=\<\>\+\-\*\/]\s*[\d\w]/.test(text) && /\b(x|y|z|f\(x\)|\d)\b/i.test(text);

  if (hasQuestionMark || hasOptions || hasBlank || hasTrueFalse || hasQuestionVerbs || hasMathEquation) {
    return { isQuestion: true };
  }

  return {
    isQuestion: false,
    reason: "The scanned text does not appear to contain a study or exam question.",
  };
}

// ─── Build the prompt ──────────────────────────────────────────────────────────

function buildPrompt(rawText: string, hint: QuestionType | null): string {
  const typeGuide = hint
    ? `The question appears to be of type "${hint}". Use this as your primary classification unless the text clearly contradicts it.`
    : `Determine the question type from the text. Choose exactly ONE from: mcq | true_false | fill_blank | short_answer | calculation | essay.`;

  return `You are an expert exam question parser and tutor for Ethiopian Grade 12 EUEE (Ethiopian University Entrance Examination) style content. Your job is to:
1. Extract the question from the raw OCR text. If multiple questions appear on the scanned document (e.g. Question 1, 2, 3...), focus on Question 1 as the primary question. You may include the answers and solutions for any subsequent questions inside the explanation field.
2. Determine its type.
3. Provide the correct answer (and reasoning steps for calculation questions).
4. Write a thorough EXPLANATION — this is MANDATORY and must NEVER be empty.

${typeGuide}

Question type definitions:
- mcq: Multiple-choice with 2+ lettered options. Return choices array + correctAnswer (e.g. "B").
- true_false: Binary true/false question. Return choices: ["True","False"] + correctAnswer.
- fill_blank: Sentence with a blank (___). Return the answer that fills the blank.
- short_answer: Direct question, no options, expects a brief factual answer.
- calculation: Involves numbers and asks to find/calculate/solve. Return answer + steps array.
- essay: Open-ended — explain/discuss/describe. Return a complete written answer.

Raw OCR text:
"""
${rawText}
"""

STRICT RULES:
- Return exactly ONE single JSON object for the primary question. Never return a JSON array, never return multiple separate objects.
- explanation is REQUIRED. It must be non-empty and explain WHY the answer is correct.
- If the text is garbled or unreadable (random characters, no coherent meaning), return exactly: {"error":"LOW_QUALITY_TEXT"}
- If the text does not contain a question at all, return exactly: {"error":"NOT_A_QUESTION"}
- Do NOT wrap output in markdown. Respond ONLY with a single valid JSON object.
- In JSON strings, if using LaTeX or math symbols, escape backslashes with double backslash (e.g. \\frac, \\Delta, \\times) or write formulas in clear text (e.g. sqrt(x), Delta t, v * t).

Required JSON structure (include only fields relevant to the type):

For mcq:
{"type":"mcq","question":"...","choices":["A) ...","B) ..."],"correctAnswer":"B","confidence":0.95,"explanation":"..."}

For true_false:
{"type":"true_false","question":"...","choices":["True","False"],"correctAnswer":"True","confidence":0.95,"explanation":"..."}

For fill_blank:
{"type":"fill_blank","question":"...","answer":"...","confidence":0.9,"explanation":"..."}

For short_answer:
{"type":"short_answer","question":"...","answer":"...","confidence":0.9,"explanation":"..."}

For calculation:
{"type":"calculation","question":"...","answer":"30 km/h","steps":["Step 1: ...","Step 2: ...","Step 3: ..."],"confidence":0.95,"explanation":"Brief summary of the approach and why this method is correct"}

For essay:
{"type":"essay","question":"...","answer":"Full written response...","confidence":0.85,"explanation":"This response should cover: [list main points a good answer addresses]"}

Now parse the text above and respond with valid JSON only.`;
}

// ─── JSON extraction helper ────────────────────────────────────────────────────

function sanitizeJsonText(s: string): string {
  // 1. Fix raw unescaped newlines/tabs inside string literals (ES2017 compatible)
  let fixed = s.replace(/"(?:[^"\\]|\\[\s\S])*"/g, (m) =>
    m.replace(/\r?\n/g, "\\n").replace(/\t/g, "\\t"),
  );

  // 2. Fix unescaped backslashes (e.g. \Delta, \frac, \times in LaTeX math expressions)
  fixed = fixed.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\");

  // 3. Remove trailing commas before closing braces/brackets
  fixed = fixed.replace(/,\s*([\}\]])/g, "$1");

  return fixed;
}

function extractMultipleObjects(text: string): string[] {
  const results: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0 && start !== -1) {
          results.push(text.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }
  return results;
}

function extractQuestionText(obj: any): string | null {
  if (!obj || typeof obj !== "object") return null;
  const q =
    obj.question ||
    obj.questionText ||
    obj.question_text ||
    obj.problem ||
    obj.prompt ||
    obj.text ||
    obj.title;
  return q ? String(q).trim() : null;
}

function getExplanationText(q: any): string {
  if (!q || typeof q !== "object") return "";
  const raw =
    q.explanation ||
    q.reasoning ||
    q.rationale ||
    q.solution ||
    q.description ||
    (Array.isArray(q.steps) ? q.steps.join("\n") : "");
  if (raw && String(raw).trim().length > 0) {
    return String(raw).trim();
  }
  const ans = q.correctAnswer || q.answer || q.correct_answer;
  if (ans) {
    return `The correct answer is ${ans}.`;
  }
  return "Correct answer identified based on standard curriculum syllabus.";
}

function normalizeChoices(rawChoices: any): string[] {
  if (!rawChoices) return [];
  if (Array.isArray(rawChoices)) {
    return rawChoices.map((c, i) => {
      if (typeof c === "string") return c;
      if (c && typeof c === "object") {
        const label = c.option || c.label || c.key || c.letter || String.fromCharCode(65 + i);
        const text = c.text || c.value || c.choice || c.content || JSON.stringify(c);
        return `${label}) ${text}`;
      }
      return String(c);
    });
  }
  if (typeof rawChoices === "object") {
    return Object.entries(rawChoices).map(([k, v]) => `${k}) ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
  return [];
}

function isQuestionObject(obj: any): boolean {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const hasQ = obj.question || obj.questionText || obj.question_text || obj.problem || obj.prompt;
  const hasAns = obj.correctAnswer || obj.answer || obj.choices || obj.options || obj.steps;
  return Boolean(hasQ && hasAns);
}

function unwrapQuestion(res: any): any {
  if (!res) return null;
  if (isQuestionObject(res)) return res;

  // If array of questions returned, use the first one and merge the rest into explanation
  if (Array.isArray(res) && res.length > 0) {
    const validQuestions = res.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        (item.question ||
          item.questionText ||
          item.prompt ||
          item.problem ||
          item.answer ||
          item.correctAnswer),
    );
    if (validQuestions.length === 0) return res;

    const first = { ...validQuestions[0] };
    first.question = extractQuestionText(first) || first.question;
    let primaryExp = getExplanationText(first);
    if (validQuestions.length > 1) {
      const additional = validQuestions
        .slice(1)
        .map((q: any, idx: number) => {
          const qText = extractQuestionText(q) || `Question ${idx + 2}`;
          const ans = q?.correctAnswer || q?.answer || q?.correct_answer || "";
          const exp = getExplanationText(q);
          return `\n\n---\n**Additional Scanned Question (${idx + 2}):**\n${qText}\n**Answer:** ${ans}\n${exp}`;
        })
        .join("");
      primaryExp += additional;
    }
    first.explanation = primaryExp;
    return first;
  }

  // Handle wrapper objects
  if (typeof res === "object") {
    const questionKeys = ["questions", "results", "data", "exam", "items", "practice_questions"];
    for (const key of questionKeys) {
      if (res[key] && Array.isArray(res[key]) && res[key].length > 0) {
        return unwrapQuestion(res[key]);
      }
    }

    const objectValues = Object.values(res).filter(
      (v) => v && typeof v === "object" && !Array.isArray(v) && isQuestionObject(v),
    );
    if (objectValues.length > 0 && !res.question && !res.type) {
      return unwrapQuestion(objectValues);
    }

    if (!res.error) {
      res.question = extractQuestionText(res) || res.question;
      res.explanation = getExplanationText(res);
    }
    return res;
  }

  return res;
}

function normalizeQuestion(parsed: any, fallbackRawText?: string, hint?: QuestionType | null): any {
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.error) return parsed;

  if (!parsed.question) {
    parsed.question = extractQuestionText(parsed) || (fallbackRawText ? fallbackRawText.trim() : "Scanned Question");
  }

  let type = parsed.type || parsed.questionType || parsed.kind || parsed.category;
  if (!type || typeof type !== "string") {
    if (Array.isArray(parsed.choices) && parsed.choices.length > 0) {
      type = "mcq";
    } else if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      type = "calculation";
    } else if (hint) {
      type = hint;
    } else {
      type = "mcq";
    }
  }
  parsed.type = String(type).toLowerCase().trim();

  parsed.choices = normalizeChoices(parsed.choices || parsed.options);

  if (!parsed.correctAnswer && (parsed.answer || parsed.correct_answer)) {
    parsed.correctAnswer = parsed.answer || parsed.correct_answer;
  }

  if (!parsed.explanation || String(parsed.explanation).trim().length === 0) {
    parsed.explanation = getExplanationText(parsed);
  }

  return parsed;
}

function extractJson(raw: string): any {
  if (!raw || typeof raw !== "string") return null;

  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  // 1. Direct parse
  try {
    const parsed = JSON.parse(cleaned);
    return unwrapQuestion(parsed);
  } catch {
    /* continue to sanitization */
  }

  // 2. Sanitize and direct parse
  try {
    const fixed = sanitizeJsonText(cleaned);
    const parsed = JSON.parse(fixed);
    return unwrapQuestion(parsed);
  } catch {
    /* continue */
  }

  // 3. Determine if array or object comes first
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");

  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    const lastBracket = cleaned.lastIndexOf("]");
    if (lastBracket > firstBracket) {
      try {
        const arrText = cleaned.slice(firstBracket, lastBracket + 1);
        const fixed = sanitizeJsonText(arrText);
        const parsed = JSON.parse(fixed);
        if (Array.isArray(parsed)) return unwrapQuestion(parsed);
      } catch {
        /* continue */
      }
    }
  }

  if (firstBrace !== -1) {
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace > firstBrace) {
      try {
        const objText = cleaned.slice(firstBrace, lastBrace + 1);
        const fixed = sanitizeJsonText(objText);
        const parsed = JSON.parse(fixed);
        return unwrapQuestion(parsed);
      } catch {
        /* continue */
      }
    }
  }

  // 4. Check for multiple consecutive object blocks
  const objects = extractMultipleObjects(cleaned);
  if (objects.length > 0) {
    const parsedObjects: any[] = [];
    for (const objStr of objects) {
      try {
        const fixed = sanitizeJsonText(objStr);
        const parsed = JSON.parse(fixed);
        if (parsed && typeof parsed === "object") {
          parsedObjects.push(parsed);
        }
      } catch {
        /* skip malformed object */
      }
    }
    if (parsedObjects.length > 0) {
      return unwrapQuestion(parsedObjects);
    }
  }

  return null;
}

// ─── Validate parsed result ────────────────────────────────────────────────────

function isValidResult(parsed: any): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  if (parsed.error) return true; // error sentinel is valid
  return Boolean(parsed.type && parsed.question);
}

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags("ai")
@Controller("ai")
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly aiService: AiService,
    @Inject(LLM_PROVIDER) private readonly llm: ILlmProvider,
    private readonly dataSource: DataSource,
  ) {}

  // ── Explain endpoint ───────────────────────────────────────────────────────

  @Post("explain")
  @AllowAnonymous()
  @ApiOperation({
    summary: "Get AI explanation",
    description:
      "Returns step-by-step, clear, and simplified explanations for a question and its correct answer.",
  })
  async explain(@Body() body: ExplainRequestDto): Promise<ExplainResponseDto> {
    return this.aiService.explain(body);
  }

  // ── Scan-question endpoint ─────────────────────────────────────────────────

  @Post("scan-question")
  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Parse any scanned exam question into structured format",
    description:
      "Takes raw OCR text from a scanned/photographed question and uses Mistral AI to " +
      "detect the question type (mcq, true_false, fill_blank, short_answer, calculation, essay) " +
      "and return a fully structured response with mandatory explanation.",
  })
  async scanQuestion(@Body() dto: ScanQuestionDto, @Req() req: Request) {
    const check = isLikelyQuestion(dto.rawText);
    if (!check.isQuestion) {
      this.logger.warn(`scan-question: rejected non-question without calling LLM: "${dto.rawText.slice(0, 50)}..."`);
      return {
        success: false,
        errorCode: "NOT_A_QUESTION",
        error: check.reason ?? "The scanned text does not appear to contain a study or exam question.",
      };
    }

    // ── 1. Check PostgreSQL Scanner Parameters (/settings/scanner) ───────────
    let scannerEnabled = true;
    let freeDailyLimit = 1;
    try {
      const settingRow = await this.dataSource.query(
        `SELECT data FROM settings WHERE section = 'scanner' LIMIT 1`
      );
      if (settingRow && settingRow.length > 0 && settingRow[0]?.data) {
        const sData = settingRow[0].data;
        if (sData.scannerEnabled !== undefined) {
          scannerEnabled = Boolean(sData.scannerEnabled);
        }
        if (sData.freeUserLimit !== undefined) {
          freeDailyLimit = Number(sData.freeUserLimit);
        }
      }
    } catch (e: any) {
      this.logger.warn(`Failed to read scanner settings: ${e?.message}`);
    }

    if (!scannerEnabled) {
      return {
        success: false,
        errorCode: "SCANNER_DISABLED",
        error: "The AI Scanner is temporarily undergoing maintenance. Please try again later.",
      };
    }

    // ── 2. Determine User Identity & Premium Status ────────────────────────────
    let userId: string | null = null;
    let isPremium = false;
    let isAdmin = false;

    const authHeader = (req?.headers?.authorization ?? "") as string;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
          if (payload?.id) {
            userId = payload.id;
          }
        }
      } catch (e: any) {
        this.logger.warn(`Could not decode JWT in scanQuestion: ${e?.message}`);
      }
    }

    if (userId) {
      try {
        const accounts = await this.dataSource.query(
          `SELECT id, type, is_premium, premium_end_date FROM accounts WHERE id = $1 LIMIT 1`,
          [userId]
        );
        if (accounts && accounts.length > 0) {
          const acc = accounts[0];
          if (acc.type === "admin") {
            isAdmin = true;
          }
          if (
            acc.is_premium === true &&
            (!acc.premium_end_date || new Date(acc.premium_end_date) > new Date())
          ) {
            isPremium = true;
          }
        }
      } catch (e: any) {
        this.logger.warn(`Failed to check account premium status: ${e?.message}`);
      }
    }

    const trackingId = userId || `anon_${req?.ip || req?.headers?.["x-forwarded-for"] || "client"}`;

    // ── 3. Enforce Free Tier Daily Scan Limit ─────────────────────────────────
    if (!isAdmin && !isPremium) {
      try {
        const dailyRows = await this.dataSource.query(
          `SELECT scan_count FROM user_daily_scans WHERE user_id = $1 AND scan_date = CURRENT_DATE LIMIT 1`,
          [trackingId]
        );
        const currentScanCount = dailyRows.length > 0 ? Number(dailyRows[0].scan_count) : 0;

        if (currentScanCount >= freeDailyLimit) {
          this.logger.warn(
            `scan-question: daily limit reached for user=${trackingId} (used=${currentScanCount}, limit=${freeDailyLimit})`
          );
          return {
            success: false,
            errorCode: "SCAN_LIMIT_REACHED",
            error: `You have reached your daily limit of ${freeDailyLimit} free camera scan${freeDailyLimit === 1 ? "" : "s"}. Upgrade to Premium for unlimited camera scans.`,
            dailyLimit: freeDailyLimit,
            scansUsed: currentScanCount,
          };
        }
      } catch (e: any) {
        this.logger.warn(`Failed to check user_daily_scans: ${e?.message}`);
      }
    }

    const hint = preClassify(dto.rawText);
    this.logger.log(`scan-question: pre-classify hint="${hint ?? "none"}" len=${dto.rawText.length}`);

    const MAX_ATTEMPTS = 2;
    let lastError: string | null = null;
    let lastRaw: string = "";
    let parsed: any = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let raw: string;
      try {
        raw = await this.llm.generate(buildPrompt(dto.rawText, hint), {
          maxTokens: 2048,
          temperature: attempt === 1 ? 0.1 : 0.2, // slightly higher on retry
        });
        lastRaw = raw;
      } catch (err: any) {
        const message: string = err?.message ?? "AI service unavailable";
        this.logger.error(`scan-question: LLM call failed (attempt=${attempt}): ${message}`);

        const isAuth =
          message.toLowerCase().includes("unauthorized") ||
          message.toLowerCase().includes("401") ||
          message.toLowerCase().includes("authentication");

        return {
          success: false,
          errorCode: isAuth ? "AUTH_ERROR" : "LLM_UNAVAILABLE",
          error: isAuth
            ? "AI service authentication failed. Please check MISTRAL_API_KEY."
            : message,
        };
      }

      parsed = normalizeQuestion(extractJson(raw), dto.rawText, hint);

      // Explicit error sentinels from Mistral (LOW_QUALITY_TEXT, NOT_A_QUESTION)
      if (parsed?.error) {
        return {
          success: false,
          errorCode: parsed.error,
          error:
            parsed.error === "LOW_QUALITY_TEXT"
              ? "The scanned text is unclear. Please rescan with better lighting."
              : parsed.error === "NOT_A_QUESTION"
                ? "The scanned text does not appear to be an exam question."
                : parsed.error,
        };
      }

      // Validate: must have type, question, and non-empty explanation
      if (isValidResult(parsed)) {
        this.logger.log(
          `scan-question: success type="${parsed.type}" attempt=${attempt}`,
        );
        break; // good result — exit retry loop
      }

      // Missing explanation (or completely unparseable) — retry with stricter prompt
      const diagMsg = !parsed
        ? "JSON parse failed"
        : !parsed.explanation || String(parsed.explanation).trim().length < 5
          ? "explanation was empty or too short"
          : "missing required fields";

      this.logger.warn(
        `scan-question: attempt=${attempt} invalid result (${diagMsg}), retrying…`,
      );
      lastError = diagMsg;
      parsed = null;
    }

    if (!parsed) {
      return {
        success: false,
        errorCode: "GENERATION_FAILED",
        error: `Failed to generate a valid response after ${MAX_ATTEMPTS} attempts: ${lastError ?? "unknown reason"}`,
      };
    }

    // ── Normalise and return ─────────────────────────────────────────────────

    // Ensure confidence is a valid 0–1 number
    const confidence =
      typeof parsed.confidence === "number" && parsed.confidence >= 0 && parsed.confidence <= 1
        ? parsed.confidence
        : 0.8;

    // Build the data payload — include only relevant fields per type
    const base: Record<string, any> = {
      type:        parsed.type,
      question:    String(parsed.question ?? "").trim(),
      confidence,
      explanation: String(parsed.explanation ?? "").trim(),
    };

    switch (parsed.type as QuestionType) {
      case "mcq":
      case "true_false":
        base.choices      = Array.isArray(parsed.choices) ? parsed.choices : [];
        base.correctAnswer = parsed.correctAnswer ?? null;
        break;

      case "fill_blank":
      case "short_answer":
        base.answer = parsed.answer ?? null;
        break;

      case "calculation":
        base.answer = parsed.answer ?? null;
        base.steps  = Array.isArray(parsed.steps) ? parsed.steps : [];
        break;

      case "essay":
        base.answer = parsed.answer ?? null;
        break;

      default:
        // Unknown type — pass through whatever Mistral returned
        if (parsed.choices)       base.choices       = parsed.choices;
        if (parsed.correctAnswer) base.correctAnswer = parsed.correctAnswer;
        if (parsed.answer)        base.answer        = parsed.answer;
        if (parsed.steps)         base.steps         = parsed.steps;
    }

    // ── 4. Record Scan Usage for Free Users ──────────────────────────────────
    if (!isAdmin && !isPremium) {
      try {
        await this.dataSource.query(
          `INSERT INTO user_daily_scans (user_id, scan_date, scan_count, updated_at)
           VALUES ($1, CURRENT_DATE, 1, NOW())
           ON CONFLICT (user_id, scan_date)
           DO UPDATE SET scan_count = user_daily_scans.scan_count + 1, updated_at = NOW()`,
          [trackingId]
        );
      } catch (e: any) {
        this.logger.warn(`Failed to record scan usage: ${e?.message}`);
      }
    }

    return {
      success: true,
      data: base,
      dailyLimit: isPremium || isAdmin ? "unlimited" : freeDailyLimit,
    };
  }
}
