export type QuizQuestionType = 'single' | 'multiple';

export interface QuizOptionDefinition {
  id: string;
  text: string;
  correct: boolean;
}

export interface QuizQuestionDefinition {
  id: string;
  text: string;
  type: QuizQuestionType;
  points: number;
  /** Shown after submitting, prefixed with "Correct." or "Incorrect." — so it must read right either way. */
  explanation: string;
  options: QuizOptionDefinition[];
}

export interface QuizDefinition {
  id: string;
  title: string;
  subtitle: string;
  passingScore: number;
  questions: QuizQuestionDefinition[];
}

// Option ids are a, b, c... in the order given. Pass the correct options' texts in `correct`.
const question = (
  id: string,
  text: string,
  type: QuizQuestionType,
  options: string[],
  correct: string[],
  explanation: string,
): QuizQuestionDefinition => ({
  id,
  text,
  type,
  points: 1,
  explanation,
  options: options.map((optionText, index) => ({
    id: String.fromCharCode(97 + index),
    text: optionText,
    correct: correct.includes(optionText),
  })),
});

// Quizzes live in code for now (no admin tool yet). The answer key never leaves the server.
export const QUIZZES: QuizDefinition[] = [
  {
    id: 'week-2-pricing-your-product',
    title: 'Week 2 Quiz: Pricing Your Product',
    subtitle: 'Practice Assignment',
    passingScore: 7,
    questions: [
      question(
        'q1',
        'What should you check first if a customer says your price is too high?',
        'single',
        [
          'Whether it matches a competitor’s price',
          'Whether the price reflects the value delivered',
          'Whether you can afford to lower it',
          'Whether the customer is generally price-sensitive',
        ],
        ['Whether the price reflects the value delivered'],
        'Start with value.',
      ),
      question(
        'q2',
        'Which of these are valid pricing models? (Select all that apply.)',
        'multiple',
        [
          'Cost-plus pricing',
          'Value-based pricing',
          'Guesswork pricing',
          'Competitor-matched pricing',
        ],
        [
          'Cost-plus pricing',
          'Value-based pricing',
          'Competitor-matched pricing',
        ],
        'Guesswork pricing is not a valid model.',
      ),
      question(
        'q3',
        'What is the main risk of underpricing a product?',
        'single',
        [
          'Customers may doubt its quality',
          'You always sell more units',
          'Investors prefer lower prices',
          'It has no real downside',
        ],
        ['Customers may doubt its quality'],
        'Low prices can erode perceived quality.',
      ),
      question(
        'q4',
        'Which pricing signal is most likely to anchor a higher perceived value?',
        'single',
        [
          'A lower introductory offer',
          'A premium tier with extra support',
          'A discount for annual billing',
          'A free trial with limited features',
        ],
        ['A premium tier with extra support'],
        'Premium tiers can anchor higher perceived value.',
      ),
      question(
        'q5',
        'Which of these should pricing teams monitor closely? (Select all that apply.)',
        'multiple',
        [
          'Competitor pricing changes',
          'Customer acquisition cost',
          'Lifetime value',
          'Marketing spend only',
        ],
        [
          'Competitor pricing changes',
          'Customer acquisition cost',
          'Lifetime value',
        ],
        'Marketing spend is one input, not the only metric.',
      ),
      question(
        'q6',
        'What usually happens when a product is priced too low?',
        'single',
        [
          'Customers always trust the product more',
          'Revenue always increases',
          'Customers may doubt its quality',
          'The business loses no revenue',
        ],
        ['Customers may doubt its quality'],
        'Low prices don’t guarantee more revenue and can make customers doubt quality.',
      ),
      question(
        'q7',
        'Which of these are common objections to a higher price? (Select all that apply.)',
        'multiple',
        [
          'It is higher than the competitor',
          'It is higher than the customer expected',
          'It is higher than the budget',
          'It is lower than the budget',
        ],
        [
          'It is higher than the competitor',
          'It is higher than the customer expected',
          'It is higher than the budget',
        ],
        'Lower-than-budget is not a common objection.',
      ),
      question(
        'q8',
        'What should you do when a customer asks for a discount?',
        'single',
        [
          'Immediately lower the price',
          'Ask what value they want in return',
          'Tell them the price is already final',
          'Offer a discount without a reason',
        ],
        ['Ask what value they want in return'],
        'Trade a discount for something of value instead of giving it away.',
      ),
      question(
        'q9',
        'Which of these are good reasons to raise a price? (Select all that apply.)',
        'multiple',
        [
          'Your costs have increased',
          'Demand is higher than your supply',
          'The product delivers more value than before',
          'A competitor had a bad week',
        ],
        [
          'Your costs have increased',
          'Demand is higher than your supply',
          'The product delivers more value than before',
        ],
        'A competitor’s bad week is not a reason to change your price.',
      ),
      question(
        'q10',
        'What is the best way to test a new price?',
        'single',
        [
          'Change it for every customer at once',
          'Run a small controlled test and compare results',
          'Ask friends what they think',
          'Copy the closest competitor',
        ],
        ['Run a small controlled test and compare results'],
        'Small controlled tests show the effect before you commit.',
      ),
    ],
  },
];

export const findQuiz = (quizId: string) =>
  QUIZZES.find((quiz) => quiz.id === quizId);
