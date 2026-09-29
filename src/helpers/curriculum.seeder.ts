import { DataSource } from "typeorm";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { StreamEntity } from "../modules/stream/models/streams/stream.entity";
import { GradeEntity } from "../modules/grade/models/grades/grade.entity";
import { SubjectEntity } from "../modules/subject/models/subjects/subject.entity";
import { TopicEntity } from "../modules/topic/models/topics/topic.entity";
import { QuestionEntity, QuestionDifficulty } from "../modules/question/models/questions/question.entity";
import { MockExamEntity, MockExamStatus } from "../modules/mock/models/mock-exam.entity";
import { AccountEntity } from "../modules/account/models/accounts/account.entity";
import { RoleEntity } from "../modules/account/models/roles/role.entity";
import { AccountRoleEntity } from "../modules/account/models/accounts/account-role.entity";
import { Util } from "../libs/common/util";

// ─── Seed data ────────────────────────────────────────────────────────────────

const STREAMS = [
  { name: "Natural Science", description: "Science and mathematics stream for Grade 11–12" },
  { name: "Social Science",  description: "Humanities and social studies stream for Grade 11–12" },
];

const GRADES = [
  { name: "9",  description: "Grade 9 — Ethiopian secondary education" },
  { name: "10", description: "Grade 10 — Ethiopian secondary education" },
  { name: "11", description: "Grade 11 — Ethiopian preparatory education" },
  { name: "12", description: "Grade 12 — Ethiopian preparatory education (entrance exam year)" },
];

// Subjects that belong to a specific stream only
const NATURAL_SCIENCE_SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology",
];

const SOCIAL_SCIENCE_SUBJECTS = [
  "Geography", "History", "Mathematics",
];

// Subjects that are common to both streams (stream_id = NULL)
const COMMON_SUBJECTS = [
  "English", "Civics", "Aptitude",
];

const CURRICULUM_TOPICS_MAP: Record<string, Array<{ name: string; description: string }>> = {
  Mathematics: [
    { name: "Algebra & Functions", description: "Polynomials, equations, inequalities, logarithmic and exponential functions" },
    { name: "Geometry & Measurement", description: "Euclidean geometry, coordinate geometry, vectors, and spatial measurements" },
    { name: "Trigonometry", description: "Trigonometric ratios, identities, equations, and applications" },
    { name: "Calculus & Analytical Geometry", description: "Limits, derivatives, integrals, and applications of calculus" },
    { name: "Statistics & Probability", description: "Data representation, central tendency, probability distributions" },
  ],
  Physics: [
    { name: "Mechanics & Motion", description: "Kinematics, dynamics, work, energy, momentum, and rotational motion" },
    { name: "Electricity & Magnetism", description: "Electric fields, circuits, magnetic fields, and electromagnetic induction" },
    { name: "Waves, Optics & Acoustics", description: "Wave properties, sound, reflection, refraction, and optical instruments" },
    { name: "Thermodynamics & Heat", description: "Temperature, heat transfer, gas laws, and laws of thermodynamics" },
    { name: "Modern & Atomic Physics", description: "Quantum physics, atomic structure, radioactivity, and nuclear reactions" },
  ],
  Chemistry: [
    { name: "General & Physical Chemistry", description: "Atomic structure, chemical bonding, states of matter, and stoichiometry" },
    { name: "Inorganic Chemistry", description: "Periodic table trends, main group elements, transition metals, and coordination compounds" },
    { name: "Organic Chemistry & Hydrocarbons", description: "Functional groups, alkanes, alkenes, alkynes, aromatics, and organic reactions" },
    { name: "Chemical Thermodynamics & Equilibrium", description: "Reaction kinetics, enthalpy, entropy, and chemical equilibrium" },
    { name: "Electrochemistry & Solutions", description: "Oxidation-reduction, galvanic cells, electrolysis, and solution concentration" },
  ],
  Biology: [
    { name: "Cell Biology & Biochemistry", description: "Cell structure, organelles, enzymes, respiration, and photosynthesis" },
    { name: "Human Biology & Physiology", description: "Digestive, circulatory, respiratory, nervous, and endocrine systems" },
    { name: "Genetics & Molecular Biology", description: "DNA, RNA, protein synthesis, Mendelian genetics, and biotechnology" },
    { name: "Plant Biology & Ecology", description: "Plant anatomy, transport, ecosystems, energy flow, and conservation" },
    { name: "Evolution & Biodiversity", description: "Natural selection, classification of organisms, and evolutionary evidence" },
  ],
  English: [
    { name: "Grammar & Vocabulary", description: "Parts of speech, tenses, active/passive voice, idioms, and word usage" },
    { name: "Reading Comprehension", description: "Passage analysis, main ideas, inferences, and contextual meanings" },
    { name: "Sentence Completion & Usage", description: "Contextual vocabulary, sentence correction, and error identification" },
    { name: "Writing & Composition", description: "Paragraph organization, essay structure, cohesion, and punctuation" },
  ],
  Civics: [
    { name: "Constitution & Democracy", description: "Democratic principles, constitutional foundation, and governance structures" },
    { name: "Human Rights & Rule of Law", description: "Fundamental freedoms, legal systems, and human rights conventions" },
    { name: "International Relations & Global Issues", description: "Foreign policy, international organizations, and global security" },
    { name: "Ethics & Civic Duties", description: "Patriotism, anti-corruption, civic responsibility, and work ethics" },
  ],
  Aptitude: [
    { name: "Verbal Reasoning", description: "Analogies, antonyms, synonyms, syllogisms, and logical passage completion" },
    { name: "Numerical & Quantitative Reasoning", description: "Number series, arithmetic word problems, speed/distance, and data interpretation" },
    { name: "Spatial & Diagrammatic Reasoning", description: "Pattern recognition, figure series, spatial visualization, and shape matching" },
    { name: "Logical Deduction & Critical Thinking", description: "Deductive reasoning, statement-assumption, argument evaluation, and coding-decoding" },
  ],
  Geography: [
    { name: "Physical Geography & Geomorphology", description: "Earth structure, plate tectonics, landforms, climate, and weather systems" },
    { name: "Human & Economic Geography", description: "Population dynamics, urbanization, agriculture, industry, and trade" },
    { name: "Map Reading & GIS", description: "Topographic maps, scale, grid references, GIS, and remote sensing" },
    { name: "Geography of Ethiopia & Horn of Africa", description: "Physical features, drainage systems, climate zones, and natural resources of Ethiopia" },
  ],
  History: [
    { name: "Ancient & Medieval History", description: "Early civilizations, rise of empires, trade routes, and medieval developments" },
    { name: "Ethiopian History", description: "Axumite period, Zagwe, Solomonic dynasty, Battle of Adwa, and modern Ethiopian history" },
    { name: "Modern World History", description: "Industrial revolution, World War I & II, Cold War, and decolonization" },
    { name: "African History & Pan-Africanism", description: "Pre-colonial states, scramble for Africa, liberation movements, and OAU/AU" },
  ],
};

const ADMIN_SEED = {
  phoneNumber: "952892414",
  password:    "12341234",
  name:        "Scorenova Admin",
  email:       "admin@scorenova.et",
  type:        "admin",
};

// ─── Seeder ───────────────────────────────────────────────────────────────────

export async function seedCurriculum(dataSource: DataSource): Promise<void> {
  const streamRepo      = dataSource.getRepository(StreamEntity);
  const gradeRepo       = dataSource.getRepository(GradeEntity);
  const subjectRepo     = dataSource.getRepository(SubjectEntity);
  const topicRepo       = dataSource.getRepository(TopicEntity);
  const questionRepo    = dataSource.getRepository(QuestionEntity);
  const accountRepo     = dataSource.getRepository(AccountEntity);
  const roleRepo        = dataSource.getRepository(RoleEntity);
  const accountRoleRepo = dataSource.getRepository(AccountRoleEntity);

  const forceReseed = process.env.FORCE_RESEED === "true";

  // ── Optional: wipe and re-seed when FORCE_RESEED=true ────────────────────
  if (forceReseed) {
    console.log("  ▸ FORCE_RESEED=true — clearing curriculum data...");
    await topicRepo.delete({});
    await subjectRepo.delete({});
    await streamRepo.delete({});
    await gradeRepo.delete({});
    console.log("  ▸ Cleared streams, grades, subjects, topics.");
  }

  // ── Streams ───────────────────────────────────────────────────────────────
  console.log("  ▸ Seeding streams...");
  const streamMap = new Map<string, string>(); // name → id

  for (const s of STREAMS) {
    let stream = await streamRepo.findOne({ where: { name: s.name } });
    if (!stream) {
      stream = await streamRepo.save(streamRepo.create(s));
      console.log(`    ✓ Created stream: ${s.name}`);
    } else {
      console.log(`    · Stream exists: ${s.name}`);
    }
    streamMap.set(stream.name, stream.id);
  }

  // ── Grades ────────────────────────────────────────────────────────────────
  console.log("  ▸ Seeding grades...");
  for (const g of GRADES) {
    const existing = await gradeRepo.findOne({ where: { name: g.name } });
    if (!existing) {
      await gradeRepo.save(gradeRepo.create(g));
      console.log(`    ✓ Created grade: ${g.name}`);
    } else {
      console.log(`    · Grade exists: ${g.name}`);
    }
  }

  // ── Common subjects (no stream — shown to all students) ──────────────────
  console.log("  ▸ Seeding common subjects (English, Civics, Aptitude)...");
  for (const name of COMMON_SUBJECTS) {
    const existing = await subjectRepo.findOne({
      where: { name, streamId: null },
    });
    if (!existing) {
      await subjectRepo.save(subjectRepo.create({ name, streamId: null, isFree: false, accessType: "paid" }));
      console.log(`    ✓ Created subject: ${name} (Common)`);
    } else {
      console.log(`    · Subject exists: ${name} (Common)`);
    }
  }

  // ── Natural Science subjects ──────────────────────────────────────────────
  console.log("  ▸ Seeding Natural Science subjects...");
  const naturalScienceId = streamMap.get("Natural Science");
  if (naturalScienceId) {
    for (const name of NATURAL_SCIENCE_SUBJECTS) {
      const existing = await subjectRepo.findOne({
        where: { name, streamId: naturalScienceId },
      });
      if (!existing) {
        await subjectRepo.save(subjectRepo.create({ name, streamId: naturalScienceId, isFree: false, accessType: "paid" }));
        console.log(`    ✓ Created subject: ${name} (Natural Science)`);
      } else {
        console.log(`    · Subject exists: ${name} (Natural Science)`);
      }
    }
  }

  // ── Social Science subjects ───────────────────────────────────────────────
  console.log("  ▸ Seeding Social Science subjects...");
  const socialScienceId = streamMap.get("Social Science");
  if (socialScienceId) {
    for (const name of SOCIAL_SCIENCE_SUBJECTS) {
      const existing = await subjectRepo.findOne({
        where: { name, streamId: socialScienceId },
      });
      if (!existing) {
        await subjectRepo.save(subjectRepo.create({ name, streamId: socialScienceId, isFree: false, accessType: "paid" }));
        console.log(`    ✓ Created subject: ${name} (Social Science)`);
      } else {
        console.log(`    · Subject exists: ${name} (Social Science)`);
      }
    }
  }

  // ── Predefined Curriculum Topics ──────────────────────────────────────────
  console.log("  ▸ Seeding predefined curriculum topics for all subjects...");
  const allSubjects = await subjectRepo.find();
  for (const subject of allSubjects) {
    const topicDefs = CURRICULUM_TOPICS_MAP[subject.name] ?? [];
    for (const def of topicDefs) {
      const existing = await topicRepo.findOne({
        where: { subjectId: subject.id, name: def.name },
      });
      if (!existing) {
        await topicRepo.save(
          topicRepo.create({
            subjectId: subject.id,
            name: def.name,
            description: def.description,
            isFree: false,
            accessType: "paid",
          }),
        );
        console.log(`    ✓ Created topic: "${def.name}" under ${subject.name}`);
      }
    }
  }

  // ── Data Integrity Check: Assign Orphaned Questions to Valid Topics ───────
  console.log("  ▸ Checking for questions with NULL or invalid topic_id...");
  const orphanedQuestions = await questionRepo.query(`
    SELECT q.id, q.subject_id, q.text, s.name as subject_name
    FROM questions q
    LEFT JOIN subjects s ON s.id = q.subject_id
    WHERE q.topic_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM topics t WHERE t.id = q.topic_id)
  `);

  if (orphanedQuestions.length > 0) {
    console.log(`    Found ${orphanedQuestions.length} questions without valid topics. Assigning...`);
    let reassignedCount = 0;

    for (const q of orphanedQuestions) {
      if (!q.subject_id) continue;

      // Find first topic under this subject
      const firstTopic = await topicRepo.findOne({
        where: { subjectId: q.subject_id },
        order: { createdAt: "ASC" },
      });

      if (firstTopic) {
        await questionRepo.update({ id: q.id }, { topicId: firstTopic.id });
        reassignedCount += 1;
      }
    }
    console.log(`    ✓ Successfully assigned ${reassignedCount} orphaned questions to curriculum topics.`);
  } else {
    console.log("    · All questions have valid curriculum topics.");
  }

  // ── Admin account ─────────────────────────────────────────────────────────
  console.log("  ▸ Seeding admin account...");
  const username = `${ADMIN_SEED.type}_${ADMIN_SEED.phoneNumber}`;
  const existingAdmin = await accountRepo.findOne({ where: { username } });

  if (!existingAdmin) {
    let adminRole = await roleRepo.findOne({ where: { key: "admin" } });
    if (!adminRole) {
      adminRole = await roleRepo.save(
        roleRepo.create({ name: "Admin", key: "admin" }),
      );
      console.log(`    ✓ Created role: admin`);
    }

    const adminAccount = accountRepo.create({
      id:           crypto.randomUUID(),
      name:         ADMIN_SEED.name,
      email:        ADMIN_SEED.email,
      phoneNumber:  ADMIN_SEED.phoneNumber,
      username,
      type:         ADMIN_SEED.type,
      isActive:     true,
      otpVerified:  true,
      password:     await Util.hashPassword(ADMIN_SEED.password),
    });

    const saved = await accountRepo.save(adminAccount);

    await accountRoleRepo.save(
      accountRoleRepo.create({ accountId: saved.id, roleId: adminRole.id }),
    );

    console.log(`    ✓ Created admin: phone=${ADMIN_SEED.phoneNumber}`);
  } else {
    console.log(`    · Admin exists: phone=${ADMIN_SEED.phoneNumber}`);
  }

  // ── Seed Master Question Bank & Mock Exams ────────────────────────────────
  try {
    await seedMasterQuestionsAndMocks(dataSource);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  ⚠ Question/Mock seed warning: ${msg}`);
  }

  console.log("  ▸ Curriculum seed complete.");
}

async function seedMasterQuestionsAndMocks(dataSource: DataSource): Promise<void> {
  const questionRepo = dataSource.getRepository(QuestionEntity);
  const subjectRepo = dataSource.getRepository(SubjectEntity);
  const topicRepo = dataSource.getRepository(TopicEntity);
  const mockExamRepo = dataSource.getRepository(MockExamEntity);

  const currentQCount = await questionRepo.count();
  if (currentQCount < 500) {
    console.log(`  📦 Seeding master question bank (current count: ${currentQCount})...`);

    const possiblePaths = [
      path.join(__dirname, "../data/all_questions.json"),
      path.join(__dirname, "../../src/data/all_questions.json"),
      path.join(process.cwd(), "src/data/all_questions.json"),
      path.join(process.cwd(), "dist/src/data/all_questions.json"),
      path.join(process.cwd(), "dist/data/all_questions.json"),
    ];

    const questionsFilePath = possiblePaths.find((p) => fs.existsSync(p));
    if (questionsFilePath) {
      const rawQuestions: Array<{
        subjectName: string;
        topicName: string;
        text: string;
        options: string[];
        correctAnswer: string;
        correctIndex?: number;
        difficulty?: string;
        explanation?: string | null;
      }> = JSON.parse(fs.readFileSync(questionsFilePath, "utf8"));

      console.log(`  ▸ Found ${rawQuestions.length} questions in ${questionsFilePath}`);

      const subjects = await subjectRepo.find();
      const topics = await topicRepo.find();

      const subjectMap = new Map<string, SubjectEntity[]>();
      for (const s of subjects) {
        const key = s.name.toLowerCase();
        if (!subjectMap.has(key)) subjectMap.set(key, []);
        subjectMap.get(key)!.push(s);
      }

      const topicMap = new Map<string, TopicEntity>();
      for (const t of topics) {
        topicMap.set(`${t.subjectId}:::${t.name.toLowerCase()}`, t);
      }

      const rowsToInsert: Partial<QuestionEntity>[] = [];
      for (const q of rawQuestions) {
        const matchingSubjects = subjectMap.get((q.subjectName || "").toLowerCase()) || [];
        for (const sub of matchingSubjects) {
          let topic = topicMap.get(`${sub.id}:::${(q.topicName || "").toLowerCase()}`);
          if (!topic) {
            topic = topics.find((t) => t.subjectId === sub.id);
          }

          rowsToInsert.push({
            subjectId: sub.id,
            topicId: topic ? topic.id : null,
            text: q.text,
            options: q.options || [],
            correctAnswer: q.correctAnswer || (q.options && q.correctIndex !== undefined ? q.options[q.correctIndex] : "A"),
            difficulty: (q.difficulty as QuestionDifficulty) || QuestionDifficulty.Medium,
            explanation: q.explanation || null,
          });
        }
      }

      console.log(`  ▸ Batch inserting ${rowsToInsert.length} questions...`);
      for (let i = 0; i < rowsToInsert.length; i += 500) {
        const chunk = rowsToInsert.slice(i, i + 500);
        await dataSource
          .createQueryBuilder()
          .insert()
          .into(QuestionEntity)
          .values(chunk)
          .execute();
      }
      console.log(`  ✅ Successfully seeded ${rowsToInsert.length} questions into database!`);
    } else {
      console.warn("  ⚠ Could not find all_questions.json for question bank seeding.");
    }
  } else {
    console.log(`  · Question bank already seeded (${currentQCount} questions).`);
  }

  // Seed Mocks
  const currentMockCount = await mockExamRepo.count();
  if (currentMockCount < 5) {
    console.log(`  📦 Seeding mock exams (current count: ${currentMockCount})...`);
    const possibleMockPaths = [
      path.join(__dirname, "../data/all_mocks.json"),
      path.join(__dirname, "../../src/data/all_mocks.json"),
      path.join(process.cwd(), "src/data/all_mocks.json"),
      path.join(process.cwd(), "dist/src/data/all_mocks.json"),
      path.join(process.cwd(), "dist/data/all_mocks.json"),
    ];

    const mocksFilePath = possibleMockPaths.find((p) => fs.existsSync(p));
    if (mocksFilePath) {
      const rawMocks: Array<{
        subjectName: string;
        label: string;
        questionCount?: number;
        durationMinutes?: number;
        questions?: any[];
      }> = JSON.parse(fs.readFileSync(mocksFilePath, "utf8"));

      const subjects = await subjectRepo.find();
      const subjectMap = new Map<string, SubjectEntity[]>();
      for (const s of subjects) {
        const key = s.name.toLowerCase();
        if (!subjectMap.has(key)) subjectMap.set(key, []);
        subjectMap.get(key)!.push(s);
      }

      let seededMocksCount = 0;
      for (const m of rawMocks) {
        const matchingSubjects = subjectMap.get((m.subjectName || "").toLowerCase()) || [];
        for (const sub of matchingSubjects) {
          const entity = mockExamRepo.create({
            subjectId: sub.id,
            label: m.label,
            questionCount: m.questionCount || (m.questions?.length || 0),
            durationMinutes: m.durationMinutes || 120,
            questions: m.questions || [],
            status: MockExamStatus.Completed,
          });
          await mockExamRepo.save(entity);
          seededMocksCount++;
        }
      }
      console.log(`  ✅ Successfully seeded ${seededMocksCount} mock exams into database!`);
    }
  } else {
    console.log(`  · Mock exams already seeded (${currentMockCount} exams).`);
  }
}

