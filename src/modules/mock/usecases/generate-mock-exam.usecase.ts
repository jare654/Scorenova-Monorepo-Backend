import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ILlmProvider, LLM_PROVIDER } from "../../ai/providers/llm.provider";
import { SubjectEntity } from "../../subject/models/subjects/subject.entity";
import { TopicEntity } from "../../topic/models/topics/topic.entity";
import {
  MockExamEntity,
  MockExamQuestion,
  MockExamStatus,
} from "../models/mock-exam.entity";

// ─── Tuning constants ─────────────────────────────────────────────────────────

/**
 * How many questions to request per LLM call.
 * 25 is the sweet spot: large enough to minimise round-trips,
 * small enough to stay well within Mistral's context window and timeout.
 */
const BATCH_SIZE = 25;

/**
 * Maximum number of parallel LLM calls in a single wave.
 * Mistral free-tier allows ~5 concurrent requests; keep at 3 to be safe.
 */
const MAX_PARALLEL = 3;

/**
 * Maximum retry waves before giving up.
 * With parallel batches a single wave can produce 75 questions,
 * so 4 waves is more than enough for any exam size ≤ 100.
 */
const MAX_WAVES = 4;

// ─── Subject-specific EUEE system prompts ─────────────────────────────────────

const BASE_RULES = `
Rules you MUST follow:
- Every question must have one clear question stem, four answer choices labeled A, B, C, and D, exactly one correct answer, and a concise explanation
- Questions must strictly follow the Ethiopian MoE Grade 11–12 syllabus
- Difficulty must match real EUEE standard — not too easy, not beyond the curriculum
- Cover a variety of topics within the subject; do not cluster all questions around one topic
- Never repeat or paraphrase any question from the existing question list provided
- Return ONLY a valid JSON array — no markdown, no explanation outside the JSON, no preamble

Output schema (strict):
[
  {
    "question": "Question text here",
    "choices": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "answer": "A",
    "explanation": "Clear explanation of why A is correct"
  }
]`;

const SUBJECT_PROMPTS: Record<string, string> = {
  "mathematics (natural science)": `You are an expert Ethiopian University Entrance Exam (EUEE) Mathematics question generator for Natural Science stream students.
Focus areas: Calculus (limits, derivatives, integrals), Trigonometry, Vectors, Statistics and Probability, Logarithms and Exponentials, Sequences and Series, Matrices and Determinants, Complex Numbers, Coordinate Geometry.
Questions should require multi-step reasoning and calculation. Include numerical computation, proof-based, and application questions.
${BASE_RULES}`,

  "mathematics (social science)": `You are an expert Ethiopian University Entrance Exam (EUEE) Mathematics question generator for Social Science stream students.
Focus areas: Statistics and Probability, Linear Programming, Financial Mathematics (interest, depreciation), Sets and Logic, Functions and Graphs, Sequences and Series, Basic Calculus concepts.
Questions should be more applied and less theoretical than Natural Science math. Include real-world scenarios involving economics, business, and social data.
${BASE_RULES}`,

  "physics (natural science)": `You are an expert Ethiopian University Entrance Exam (EUEE) Physics question generator.
Focus areas: Mechanics (kinematics, dynamics, work-energy, momentum), Waves and Sound, Optics, Electricity and Magnetism, Thermodynamics, Modern Physics (atomic structure, radioactivity), Fluid Mechanics.
Include both conceptual questions and numerical calculations. Use SI units. Reference Ethiopian Grade 11–12 Physics textbook content.
${BASE_RULES}`,

  "chemistry (natural science)": `You are an expert Ethiopian University Entrance Exam (EUEE) Chemistry question generator.
Focus areas: Atomic Structure and Periodic Table, Chemical Bonding, Stoichiometry and Mole Concept, Acids, Bases and Salts, Electrochemistry, Organic Chemistry (hydrocarbons, functional groups), Thermochemistry, Chemical Equilibrium, Reaction Rates.
Include both conceptual and calculation-based questions. Reference Ethiopian Grade 11–12 Chemistry curriculum.
${BASE_RULES}`,

  "biology (natural science)": `You are an expert Ethiopian University Entrance Exam (EUEE) Biology question generator.
Focus areas: Cell Biology (structure, organelles, division), Genetics and Heredity (Mendelian genetics, DNA, mutations), Evolution, Ecology and Environment, Human Physiology (digestive, circulatory, respiratory, nervous systems), Plant Biology, Microbiology, Biotechnology.
Questions should test understanding of biological concepts, processes, and their applications. Reference Ethiopian Grade 11–12 Biology curriculum.
${BASE_RULES}`,

  "english (natural science)": `You are an expert Ethiopian University Entrance Exam (EUEE) English Language question generator.
Focus areas: Reading Comprehension (passages with inference, main idea, vocabulary in context), Grammar (tenses, conditionals, passive voice, reported speech, articles, prepositions), Vocabulary (synonyms, antonyms, word forms, collocations), Writing Skills (paragraph coherence, sentence ordering, topic sentences), Communicative Activities (dialogues, appropriate responses, functions).
Mix question types: reading comprehension passages (3–5 questions per passage), grammar fill-in-the-blank, vocabulary, and dialogue completion.
${BASE_RULES}`,

  "english (social science)": `You are an expert Ethiopian University Entrance Exam (EUEE) English Language question generator.
Focus areas: Reading Comprehension (passages with inference, main idea, vocabulary in context), Grammar (tenses, conditionals, passive voice, reported speech, articles, prepositions), Vocabulary (synonyms, antonyms, word forms, collocations), Writing Skills (paragraph coherence, sentence ordering, topic sentences), Communicative Activities (dialogues, appropriate responses, functions).
Mix question types: reading comprehension passages (3–5 questions per passage), grammar fill-in-the-blank, vocabulary, and dialogue completion.
${BASE_RULES}`,

  "civics (natural science)": `You are an expert Ethiopian University Entrance Exam (EUEE) Civics and Ethical Education question generator.
Focus areas: Ethiopian Constitution and Government Structure, Democracy and Human Rights, Ethiopian History and National Identity, Civic Responsibilities and Duties, Ethics and Moral Values, Regional and Global Citizenship, Rule of Law and Justice, Economic Development and Governance.
Questions should test knowledge of Ethiopian civic institutions, constitutional rights, and ethical principles. Reference Ethiopian Grade 11–12 Civics curriculum.
${BASE_RULES}`,

  "civics (social science)": `You are an expert Ethiopian University Entrance Exam (EUEE) Civics and Ethical Education question generator.
Focus areas: Ethiopian Constitution and Government Structure, Democracy and Human Rights, Ethiopian History and National Identity, Civic Responsibilities and Duties, Ethics and Moral Values, Regional and Global Citizenship, Rule of Law and Justice, Economic Development and Governance.
Questions should test knowledge of Ethiopian civic institutions, constitutional rights, and ethical principles. Reference Ethiopian Grade 11–12 Civics curriculum.
${BASE_RULES}`,

  "aptitude (natural science)": `You are an expert Ethiopian University Entrance Exam (EUEE) Aptitude Test question generator.
The EUEE Aptitude test is a mixed general ability test. It covers:
- Verbal Reasoning: analogies, sentence completion, reading comprehension, vocabulary
- Quantitative Reasoning: arithmetic, number series, basic algebra, data interpretation, percentages, ratios
- Abstract/Logical Reasoning: pattern recognition, figure series, logical deduction
- General Knowledge: basic science facts, Ethiopian geography, history, current affairs
- English Language: grammar, vocabulary, reading comprehension
Generate a balanced mix across ALL these categories. Do NOT focus only on mathematics. Each question should test a different skill area.
${BASE_RULES}`,

  "aptitude (social science)": `You are an expert Ethiopian University Entrance Exam (EUEE) Aptitude Test question generator.
The EUEE Aptitude test is a mixed general ability test. It covers:
- Verbal Reasoning: analogies, sentence completion, reading comprehension, vocabulary
- Quantitative Reasoning: arithmetic, number series, basic algebra, data interpretation, percentages, ratios
- Abstract/Logical Reasoning: pattern recognition, figure series, logical deduction
- General Knowledge: basic science facts, Ethiopian geography, history, current affairs
- English Language: grammar, vocabulary, reading comprehension
Generate a balanced mix across ALL these categories. Do NOT focus only on mathematics. Each question should test a different skill area.
${BASE_RULES}`,

  "geography (social science)": `You are an expert Ethiopian University Entrance Exam (EUEE) Geography question generator for Social Science stream students.
Focus areas: Physical Geography (landforms, climate, soils, water bodies), Human Geography (population, urbanization, migration), Economic Geography (agriculture, industry, trade), Ethiopian Geography (regions, rivers, climate zones, resources), Map Reading and Interpretation, Environmental Issues and Conservation, World Geography.
Reference Ethiopian Grade 11–12 Geography curriculum.
${BASE_RULES}`,

  "history (social science)": `You are an expert Ethiopian University Entrance Exam (EUEE) History question generator for Social Science stream students.
Focus areas: Ancient Ethiopian Civilizations (Axum, Zagwe), Medieval Ethiopian History, Ethiopian Modernization (19th–20th century), Resistance Against Colonialism (Battle of Adwa), Italian Occupation and Liberation, Post-1974 Ethiopian History, African History, World History (major events, revolutions, world wars), Historical Analysis and Interpretation.
Reference Ethiopian Grade 11–12 History curriculum.
${BASE_RULES}`,
};

function getSystemPrompt(subjectName: string): string {
  const key = subjectName.toLowerCase().trim();
  if (SUBJECT_PROMPTS[key]) return SUBJECT_PROMPTS[key];
  for (const [k, v] of Object.entries(SUBJECT_PROMPTS)) {
    if (k.startsWith(key.split(" ")[0].toLowerCase())) return v;
  }
  return `You are an expert Ethiopian University Entrance Exam (EUEE) question generator for ${subjectName}.
Generate questions strictly based on the Ethiopian MoE Grade 11–12 curriculum for ${subjectName}.
${BASE_RULES}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Truncate question text to 80 chars for the avoid-list.
 * Sending full question text in every prompt wastes tokens and slows inference.
 * 80 chars is enough for the model to recognise a duplicate.
 */
function toAvoidSnippet(q: string): string {
  return q.length > 80 ? q.slice(0, 80) + "…" : q;
}

// ─── Usecase ──────────────────────────────────────────────────────────────────

@Injectable()
export class GenerateMockExamUsecase {
  private readonly logger = new Logger(GenerateMockExamUsecase.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: ILlmProvider,
    @InjectRepository(SubjectEntity)
    private readonly subjectRepo: Repository<SubjectEntity>,
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
    @InjectRepository(MockExamEntity)
    private readonly mockExamRepo: Repository<MockExamEntity>,
  ) {}

  // ── Public entry point ────────────────────────────────────────────────────

  async run(
    subjectId: string | undefined,
    questionCount: number,
    topicId?: string,
  ): Promise<MockExamEntity> {
    let resolvedSubjectId = subjectId?.trim() ?? "";
    let topicName: string | undefined = undefined;

    if (topicId?.trim()) {
      const topic = await this.topicRepo.findOne({
        where: { id: topicId.trim() },
      });
      if (!topic) throw new NotFoundException("Topic not found");
      resolvedSubjectId = topic.subjectId;
      topicName = topic.name;
    }

    if (!resolvedSubjectId) {
      throw new BadRequestException("Either subjectId or topicId must be provided.");
    }

    const subject = await this.subjectRepo.findOne({
      where: { id: resolvedSubjectId },
    });
    if (!subject) throw new NotFoundException("Subject not found");

    const n = Math.min(100, Math.max(5, questionCount));

    // Use MAX of existing label numbers to avoid duplicate labels
    const maxLabelResult = await this.mockExamRepo
      .createQueryBuilder("m")
      .select("MAX(CAST(REGEXP_REPLACE(m.label, '[^0-9]', '', 'g') AS INTEGER))", "maxNum")
      .where("m.subjectId = :subjectId", { subjectId: resolvedSubjectId })
      .andWhere("m.label ~ :pattern", { pattern: "^Mock Exam [0-9]+" })
      .getRawOne();

    const nextNum = ((maxLabelResult?.maxNum as number) ?? 0) + 1;
    const label = topicName
      ? `Mock Exam ${nextNum} - ${topicName}`
      : `Mock Exam ${nextNum}`;

    const exam = await this.mockExamRepo.save(
      this.mockExamRepo.create({
        subjectId: resolvedSubjectId,
        topicId: topicId?.trim() ?? null,
        label,
        questionCount: n,
        durationMinutes: Math.ceil(n * 1.5),
        questions: [],
        status: MockExamStatus.Pending,
        errorMessage: null,
      }),
    );

    // Fire-and-forget — response returns immediately with status=pending
    this.generateInBackground(exam.id, subject.name, resolvedSubjectId, n, topicName).catch(
      (err) =>
        this.logger.error(
          `Background generation failed for exam ${exam.id}: ${(err as Error).message}`,
        ),
    );

    return exam;
  }

  // ── Background generation ─────────────────────────────────────────────────

  private async generateInBackground(
    examId: string,
    subjectName: string,
    subjectId: string,
    n: number,
    topicName?: string,
  ): Promise<void> {
    const startMs = Date.now();
    console.log(
      `[MockExam] ⏱  START  exam=${examId} subject="${subjectName}" ${topicName ? `topic="${topicName}"` : ""} target=${n} questions`,
    );

    try {
      // Load existing question snippets once — used to build the avoid-list.
      const existingExams = await this.mockExamRepo
        .createQueryBuilder("m")
        .select("m.questions")
        .where("m.subjectId = :subjectId AND m.id != :examId", { subjectId, examId })
        .getMany();

      const existingSnippets = existingExams.flatMap((e) =>
        e.questions.map((q) => toAvoidSnippet(q.question)),
      );

      const systemPrompt = getSystemPrompt(subjectName);
      const collected: MockExamQuestion[] = [];
      const seenKeys = new Set<string>(
        existingExams.flatMap((e) =>
          e.questions.map((q) => q.question.toLowerCase().trim()),
        ),
      );

      for (let wave = 0; wave < MAX_WAVES && collected.length < n; wave++) {
        const waveStart = Date.now();
        const remaining = n - collected.length;

        const batchCount = Math.min(
          MAX_PARALLEL,
          Math.ceil(remaining / BATCH_SIZE),
        );

        const avoidSnippets = [
          ...existingSnippets,
          ...collected.map((q) => toAvoidSnippet(q.question)),
        ];

        console.log(
          `[MockExam] 🔄 WAVE ${wave}  exam=${examId}  remaining=${remaining}  batches=${batchCount}  avoid-list=${avoidSnippets.length}`,
        );

        const batchPromises = Array.from({ length: batchCount }, (_, i) => {
          const batchSize = Math.min(
            BATCH_SIZE,
            Math.ceil(remaining / batchCount),
          );
          return this.fetchBatch(
            systemPrompt,
            subjectName,
            batchSize,
            avoidSnippets,
            wave,
            i,
            topicName,
          );
        });

        const waveResults = await Promise.allSettled(batchPromises);

        let waveAdded = 0;
        let has429 = false;

        for (const result of waveResults) {
          if (result.status === "rejected") {
            const msg = String(result.reason?.message ?? result.reason);
            console.warn(`[MockExam] ⚠️  WAVE ${wave} batch rejected: ${msg}`);
            if (msg.includes("429") || msg.includes("rate limit") || msg.includes("capacity")) {
              has429 = true;
            }
            continue;
          }

          for (const q of result.value) {
            const key = q.question.toLowerCase().trim();
            if (!seenKeys.has(key) && collected.length < n) {
              seenKeys.add(key);
              collected.push(q);
              waveAdded++;
            }
          }
        }

        const waveMs = Date.now() - waveStart;
        console.log(
          `[MockExam] ✅ WAVE ${wave} done  added=${waveAdded}  total=${collected.length}/${n}  wave_time=${(waveMs / 1000).toFixed(1)}s`,
        );

        if (has429 && collected.length < n) {
          console.log(`[MockExam] 🚦 Rate limit hit — waiting 15s before next wave`);
          await sleep(15_000);
        }
      }

      const finalQuestions = collected.slice(0, n);
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

      if (finalQuestions.length === 0) {
        await this.mockExamRepo.update(examId, {
          status: MockExamStatus.Failed,
          errorMessage: "AI returned no valid questions after all attempts.",
        });
        console.error(`[MockExam] ❌ FAILED exam=${examId}  elapsed=${elapsed}s  reason=no questions`);
        return;
      }

      await this.mockExamRepo.update(examId, {
        questions: finalQuestions,
        questionCount: finalQuestions.length,
        status: MockExamStatus.Completed,
        errorMessage: null,
      });

      console.log(
        `[MockExam] 🎉 COMPLETE exam=${examId}  questions=${finalQuestions.length}  total_time=${elapsed}s`,
      );
    } catch (err) {
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      console.error(
        `[MockExam] ❌ ERROR exam=${examId}  elapsed=${elapsed}s  error=${(err as Error).message}`,
      );
      await this.mockExamRepo.update(examId, {
        status: MockExamStatus.Failed,
        errorMessage: (err as Error).message,
      });
    }
  }

  // ── Single batch LLM call ─────────────────────────────────────────────────

  private async fetchBatch(
    systemPrompt: string,
    subjectName: string,
    batchSize: number,
    avoidSnippets: string[],
    wave: number,
    batchIndex: number,
    topicName?: string,
  ): Promise<MockExamQuestion[]> {
    const t0 = Date.now();
    const avoidJson =
      avoidSnippets.length > 0 ? JSON.stringify(avoidSnippets) : "[]";

    const topicLine = topicName
      ? `Topic Focus Area: ${topicName}\nFocus specifically on questions under the topic "${topicName}" within ${subjectName}.\n`
      : "";

    const userPrompt =
      `Subject: ${subjectName}\n` +
      topicLine +
      `Generate EXACTLY ${batchSize} unique EUEE-style questions.\n\n` +
      `Avoid questions similar to these (do not repeat or rephrase):\n${avoidJson}\n\n` +
      `Return ONLY the JSON array with exactly ${batchSize} items. No preamble.`;

    const raw = await this.llm.generate(`${systemPrompt}\n\n${userPrompt}`, {
      maxTokens: Math.max(1024, batchSize * 260),
      temperature: 0.75,
    });

    const questions = this.parseQuestions(raw);
    const ms = Date.now() - t0;
    console.log(
      `[MockExam] 📦 BATCH wave=${wave} idx=${batchIndex}  asked=${batchSize}  got=${questions.length}  llm_time=${(ms / 1000).toFixed(1)}s`,
    );
    return questions;
  }

  // ── JSON parser ───────────────────────────────────────────────────────────

  private parseQuestions(raw: string): MockExamQuestion[] {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: extract the first JSON array from the response
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (!match) throw new BadRequestException("AI returned invalid JSON.");
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        throw new BadRequestException("AI returned malformed JSON.");
      }
    }

    if (!Array.isArray(parsed)) {
      throw new BadRequestException("AI response is not an array.");
    }

    return parsed
      .filter(
        (item): item is MockExamQuestion =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as any).question === "string" &&
          Array.isArray((item as any).choices) &&
          typeof (item as any).answer === "string",
      )
      .map((item) => ({
        question:    String(item.question).trim(),
        choices:     (item.choices as string[]).map((c) => String(c).trim()),
        answer:      String(item.answer).trim().toUpperCase().charAt(0),
        explanation: String((item as any).explanation ?? "").trim(),
      }));
  }
}
