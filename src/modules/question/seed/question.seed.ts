import { DataSource, In } from "typeorm";
import {
  QuestionDifficulty,
  QuestionEntity,
} from "../models/questions/question.entity";
import { SubjectEntity } from "../../subject/models/subjects/subject.entity";
import { TopicEntity } from "../../topic/models/topics/topic.entity";

interface SeedQuestion {
  subjectName: string;
  text: string;
  options: string[] | null;
  correctAnswer: string;
  difficulty: QuestionDifficulty;
  explanation?: string | null;
}

const SEED_QUESTIONS: SeedQuestion[] = [
  {
    subjectName: "Physics",
    text: "What is the SI unit of electric current?",
    options: ["Volt", "Ampere", "Ohm", "Watt"],
    correctAnswer: "Ampere",
    difficulty: QuestionDifficulty.Easy,
    explanation: "Electric current is measured in amperes.",
  },
  {
    subjectName: "Chemistry",
    text: "What is the chemical formula for water?",
    options: ["H2O", "CO2", "NaCl", "O2"],
    correctAnswer: "H2O",
    difficulty: QuestionDifficulty.Easy,
    explanation: "Water is composed of two hydrogen atoms and one oxygen atom.",
  },
  {
    subjectName: "Biology",
    text: "Which organelle is known as the powerhouse of the cell?",
    options: ["Nucleus", "Mitochondrion", "Ribosome", "Golgi apparatus"],
    correctAnswer: "Mitochondrion",
    difficulty: QuestionDifficulty.Medium,
    explanation: "Mitochondria generate ATP through cellular respiration.",
  },
  {
    subjectName: "Geography",
    text: "Which of the following is the longest river in the world?",
    options: ["Amazon", "Nile", "Yellow", "Mississippi"],
    correctAnswer: "Nile",
    difficulty: QuestionDifficulty.Medium,
    explanation:
      "The Nile is generally accepted as the longest river in the world.",
  },
  {
    subjectName: "History",
    text: "Which empire was ruled by Emperor Haile Selassie?",
    options: [
      "Ottoman Empire",
      "Ethiopian Empire",
      "Roman Empire",
      "Mughal Empire",
    ],
    correctAnswer: "Ethiopian Empire",
    difficulty: QuestionDifficulty.Medium,
    explanation:
      "Haile Selassie was the Emperor of Ethiopia from 1930 to 1974.",
  },
];

export async function seedQuestionData(dataSource: DataSource): Promise<void> {
  const subjectRepo = dataSource.getRepository(SubjectEntity);
  const questionRepo = dataSource.getRepository(QuestionEntity);
  const forceReseed = process.env.FORCE_RESEED === "true";

  if (forceReseed) {
    console.log("  ▸ FORCE_RESEED=true — deleting existing questions...");
    await questionRepo.delete({});
  }

  const subjectNames = [...new Set(SEED_QUESTIONS.map((q) => q.subjectName))];
  const subjects = await subjectRepo.find({
    where: { name: In(subjectNames) },
  });
  const subjectMap = new Map(
    subjects.map((subject) => [subject.name, subject.id]),
  );

  let createdCount = 0;

  const topicRepo = dataSource.getRepository(TopicEntity);

  for (const question of SEED_QUESTIONS) {
    const subjectId = subjectMap.get(question.subjectName);
    if (!subjectId) {
      console.warn(
        `  ⚠ Subject not found, skipping question: ${question.subjectName}`,
      );
      continue;
    }

    const firstTopic = await topicRepo.findOne({
      where: { subjectId },
      order: { createdAt: "ASC" },
    });

    const existing = await questionRepo.findOne({
      where: {
        text: question.text,
        subjectId,
      },
    });
    if (existing) {
      console.log(`    · Question already exists, skipped: ${question.text}`);
      continue;
    }

    const questionEntity = questionRepo.create({
      subjectId,
      topicId: firstTopic?.id ?? null,
      text: question.text,
      options: question.options,
      correctAnswer: question.correctAnswer,
      difficulty: question.difficulty,
      explanation: question.explanation ?? null,
    });

    await questionRepo.save(questionEntity);
    createdCount += 1;
    console.log(
      `    ✓ Created question for ${question.subjectName}: ${question.text}`,
    );
  }

  console.log(
    `  ▸ Question seed complete. Created ${createdCount} new question(s).`,
  );
}
