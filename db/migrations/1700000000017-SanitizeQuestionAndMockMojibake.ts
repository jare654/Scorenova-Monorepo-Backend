import { MigrationInterface, QueryRunner } from "typeorm";

export class SanitizeQuestionAndMockMojibake1700000000017 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const replacements: [string, string][] = [
      // Subscripts and chemicals
      ['COâ\x82\x82', 'CO₂'],
      ['COâ‚‚', 'CO₂'],
      ['Hâ\x82\x82O', 'H₂O'],
      ['Hâ‚‚O', 'H₂O'],
      ['â\x82\x80', '₀'],
      ['â\x82\x81', '₁'],
      ['â\x82\x82', '₂'],
      ['â\x82\x83', '₃'],
      ['â\x82\x84', '₄'],
      ['â\x82\x85', '₅'],
      ['â\x82\x86', '₆'],
      ['â\x82\x87', '₇'],
      ['â\x82\x88', '₈'],
      ['â\x82\x89', '₉'],
      ['â‚‚', '₂'],
      ['â‚ƒ', '₃'],
      ['â‚„', '₄'],
      ['â‚…', '₅'],
      ['â‚†', '₆'],
      ['â‚‡', '₇'],
      ['â‚ˆ', '₈'],
      ['â‚‰', '₉'],
      ['â‚€', '₀'],
      ['â‚ ', '₁'],
      // Superscripts
      ['Â²', '²'],
      ['Â³', '³'],
      ['Â¹', '¹'],
      ['Â⁰', '⁰'],
      ['Â⁴', '⁴'],
      ['Â⁵', '⁵'],
      // Math & symbols
      ['Â°', '°'],
      ['Â±', '±'],
      ['Ã—', '×'],
      ['Ã·', '÷'],
      ['âˆš', '√'],
      ['â‰¤', '≤'],
      ['â‰¥', '≥'],
      ['â‰ ', '≠'],
      ['â‰ ', '≠'],
      ['â‰ˆ', '≈'],
      ['âˆž', '∞'],
      ['âˆ«', '∫'],
      ['â†’', '→'],
      ['â†', '←'],
      ['â†‘', '↑'],
      ['â†“', '↓'],
      ['â†”', '↔'],
      ['â‡Œ', '⇌'],
      ['âˆ†', '∆'],
      ['âˆˆ', '∈'],
      ['âˆ‰', '∉'],
      ['âŠ‚', '⊂'],
      ['âŠƒ', '⊃'],
      ['âˆª', '∪'],
      ['âˆ©', '∩'],
      ['Âµ', 'µ'],
      // Greek
      ['Ï€', 'π'],
      ['Î¸', 'θ'],
      ['Î±', 'α'],
      ['Î²', 'β'],
      ['Î»', 'λ'],
      ['Î¼', 'μ'],
      ['Î©', 'Ω'],
      ['Î”', 'Δ'],
      // Punctuation & Quotes
      ['â€œ', '“'],
      ['â€', '”'],
      ['â€™', '’'],
      ['â€˜', '‘'],
      ['â€“', '–'],
      ['â€”', '—'],
      ['â€¦', '…'],
    ];

    console.log("  ▸ Sanitizing mojibake symbols in questions and mock_exams tables...");

    for (const [bad, good] of replacements) {
      await queryRunner.query(
        `UPDATE questions 
         SET text = REPLACE(text, $1, $2),
             correct_answer = REPLACE(correct_answer, $1, $2),
             explanation = CASE WHEN explanation IS NOT NULL THEN REPLACE(explanation, $1, $2) ELSE NULL END,
             options = CASE WHEN options IS NOT NULL THEN REPLACE(options::text, $1, $2)::jsonb ELSE NULL END
         WHERE text LIKE '%' || $1 || '%' 
            OR correct_answer LIKE '%' || $1 || '%' 
            OR (explanation IS NOT NULL AND explanation LIKE '%' || $1 || '%')
            OR (options IS NOT NULL AND options::text LIKE '%' || $1 || '%')`,
        [bad, good],
      );

      await queryRunner.query(
        `UPDATE mock_exams
         SET questions = CASE WHEN questions IS NOT NULL THEN REPLACE(questions::text, $1, $2)::jsonb ELSE NULL END
         WHERE questions IS NOT NULL AND questions::text LIKE '%' || $1 || '%'`,
        [bad, good],
      );
    }

    console.log("  ✅ Questions and mock exams mojibake sanitized successfully.");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op
  }
}
