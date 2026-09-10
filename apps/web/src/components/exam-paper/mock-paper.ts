export type Difficulty = 'easy' | 'medium' | 'hard';

export type QuestionType =
  | 'Multiple Choice'
  | 'Multiple Select'
  | 'Short Answer'
  | 'Long Answer'
  | 'Fill in the Blank'
  | 'True / False'
  | 'Match the Following'
  | 'Assertion Reason';

export interface Question {
  id: string;
  number: number;
  text: string;
  type: QuestionType;
  marks: number;
  difficulty: Difficulty;
  chapter: string;
  topic: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  hint: string;
  learningObjective: string;
  learningOutcome: string;
  competency: string;
  cognitiveLevel: string;
  estimatedTime: string;
  negativeMarks: number;
  partialMarking: boolean;
  aiGenerated: boolean;
  generationSource: string;
  generationModel: string;
  createdAt: string;
  updatedAt: string;
  version: string;
  tags: string[];
  keywords: string[];
  sourceReference: string;
}

export interface PaperSection {
  id: string;
  label: string;
  name: string;
  questions: Question[];
}

export interface ExamPaperDoc {
  id: string;
  title: string;
  status: 'draft';
  subject: string;
  class: number;
  duration: string;
  sections: PaperSection[];
}

interface QuestionSeed {
  number: number;
  text: string;
  type: QuestionType;
  marks: number;
  difficulty: Difficulty;
  chapter: string;
  topic: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  hint: string;
  learningObjective: string;
  learningOutcome: string;
  competency: string;
  cognitiveLevel: string;
  estimatedTime: string;
  negativeMarks?: number;
  partialMarking?: boolean;
  version?: string;
  updatedAt?: string;
  tags?: string[];
  keywords?: string[];
}

function q(seed: QuestionSeed): Question {
  return {
    id: `q${seed.number}`,
    ...seed,
    negativeMarks: seed.negativeMarks ?? 0,
    partialMarking: seed.partialMarking ?? false,
    aiGenerated: true,
    generationSource: 'AI Draft v1',
    generationModel: 'Sarvam-L',
    createdAt: '9 Sep 2026',
    updatedAt: seed.updatedAt ?? '9 Sep 2026',
    version: seed.version ?? '1.2',
    tags: seed.tags ?? [seed.topic],
    keywords: seed.keywords ?? [],
    sourceReference: 'NCERT Science — Class 8',
  };
}

// Mock paper — the platform API does not exist yet. The editor renders this
// single authored draft regardless of the id in the URL; the list links to
// /exam-paper/<id> so the route shape is already right for the API.
// 14 questions, 3 sections, 30 marks, difficulty 5/6/3.
export const MOCK_PAPER: ExamPaperDoc = {
  id: 'paper-0',
  title: 'Biology Assessment',
  status: 'draft',
  subject: 'Biology',
  class: 8,
  duration: '3 Hours',
  sections: [
    {
      id: 'section-a',
      label: 'Section A',
      name: 'Multiple Choice',
      questions: [
        q({
          number: 1,
          text: 'Which gas do plants absorb from the air during photosynthesis?',
          type: 'Multiple Choice',
          marks: 1,
          difficulty: 'easy',
          chapter: 'Plant Biology',
          topic: 'Photosynthesis',
          options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'],
          correctAnswer: 'Carbon dioxide',
          explanation: 'Plants take in carbon dioxide through stomata and use it to make glucose.',
          hint: 'Think about what plants breathe in.',
          learningObjective: 'Identify the raw materials of photosynthesis.',
          learningOutcome: 'States the gas plants absorb.',
          competency: 'Scientific Reasoning',
          cognitiveLevel: 'Recall',
          estimatedTime: '30 seconds',
        }),
        q({
          number: 2,
          text: 'Which of the following is known as the basic structural unit of life?',
          type: 'Multiple Choice',
          marks: 1,
          difficulty: 'easy',
          chapter: 'Cell Biology',
          topic: 'Cell Structure',
          options: ['Cell', 'Tissue', 'Organ', 'Organ system'],
          correctAnswer: 'Cell',
          explanation: 'All living things are made of cells, the smallest unit of life.',
          hint: 'It is the smallest item on the list.',
          learningObjective: 'Recognise the cell as the unit of life.',
          learningOutcome: 'Defines a cell.',
          competency: 'Scientific Reasoning',
          cognitiveLevel: 'Recall',
          estimatedTime: '30 seconds',
        }),
        q({
          number: 3,
          text: 'A plant is placed in a room where light is provided only from the left side. After several days, the shoot bends towards the light. This response is called:',
          type: 'Multiple Choice',
          marks: 1,
          difficulty: 'medium',
          chapter: 'Plant Biology',
          topic: 'Phototropism',
          options: ['Phototropism', 'Geotropism', 'Hydrotropism', 'Thigmotropism'],
          correctAnswer: 'Phototropism',
          explanation: 'Bending towards light is phototropism, controlled by the hormone auxin.',
          hint: 'The stimulus is light.',
          learningObjective: 'Understand plant response to external stimuli.',
          learningOutcome: 'Names the tropic response to light.',
          competency: 'Scientific Reasoning',
          cognitiveLevel: 'Application',
          estimatedTime: '45 seconds',
        }),
        q({
          number: 4,
          text: 'Which organelle releases energy in a cell and is known as its powerhouse?',
          type: 'Multiple Choice',
          marks: 1,
          difficulty: 'medium',
          chapter: 'Cell Biology',
          topic: 'Cell Organelles',
          options: ['Ribosome', 'Nucleus', 'Mitochondrion', 'Chloroplast'],
          correctAnswer: 'Mitochondrion',
          explanation: 'Mitochondria carry out respiration and release energy.',
          hint: 'Respiration happens here.',
          learningObjective: 'Link organelles to their functions.',
          learningOutcome: 'Matches the organelle to respiration.',
          competency: 'Scientific Reasoning',
          cognitiveLevel: 'Understanding',
          estimatedTime: '45 seconds',
        }),
        q({
          number: 5,
          text: 'In humans, the actual exchange of oxygen and carbon dioxide takes place in the:',
          type: 'Multiple Choice',
          marks: 1,
          difficulty: 'hard',
          chapter: 'Human Physiology',
          topic: 'Respiration',
          options: ['Trachea', 'Bronchi', 'Alveoli', 'Diaphragm'],
          correctAnswer: 'Alveoli',
          explanation: 'Alveoli are thin-walled air sacs where gases diffuse into and out of the blood.',
          hint: 'The smallest structures at the end of the airway.',
          learningObjective: 'Explain gas exchange in humans.',
          learningOutcome: 'Locates the site of gas exchange.',
          competency: 'Scientific Reasoning',
          cognitiveLevel: 'Analysis',
          estimatedTime: '60 seconds',
        }),
      ],
    },
    {
      id: 'section-b',
      label: 'Section B',
      name: 'Short Answer',
      questions: [
        q({
          number: 6,
          text: 'Define photosynthesis and write its word equation.',
          type: 'Short Answer',
          marks: 2,
          difficulty: 'easy',
          chapter: 'Plant Biology',
          topic: 'Photosynthesis',
          correctAnswer:
            'Photosynthesis is the process by which green plants make glucose using sunlight, water and carbon dioxide. Sunlight + Carbon dioxide + Water → Glucose + Oxygen.',
          explanation: 'Award one mark for the definition and one for a correct word equation.',
          hint: 'Name the raw materials and the products.',
          learningObjective: 'Describe photosynthesis.',
          learningOutcome: 'Writes the word equation.',
          competency: 'Scientific Reasoning',
          cognitiveLevel: 'Recall',
          estimatedTime: '1 minute',
        }),
        q({
          number: 7,
          text: 'Name the two main types of reproduction seen in animals, with one example each.',
          type: 'Short Answer',
          marks: 2,
          difficulty: 'easy',
          chapter: 'Reproduction',
          topic: 'Types of Reproduction',
          correctAnswer: 'Asexual reproduction (e.g. budding in Hydra) and sexual reproduction (e.g. in humans).',
          explanation: 'One mark for each type with a correct example.',
          hint: 'One needs two parents; the other does not.',
          learningObjective: 'Classify types of reproduction.',
          learningOutcome: 'Distinguishes asexual from sexual reproduction.',
          competency: 'Scientific Reasoning',
          cognitiveLevel: 'Recall',
          estimatedTime: '1 minute',
        }),
        q({
          number: 8,
          text: 'Explain why the shoot of a potted plant kept near a window bends towards the light.',
          type: 'Short Answer',
          marks: 2,
          difficulty: 'medium',
          chapter: 'Plant Biology',
          topic: 'Phototropism',
          correctAnswer:
            'Auxin moves to the shaded side of the shoot and makes cells there grow longer, so the shoot bends towards the light.',
          explanation: 'Award marks for naming auxin and describing the uneven growth.',
          hint: 'Think about a plant hormone.',
          learningObjective: 'Understand plant response to external stimuli.',
          learningOutcome: 'Explains the role of auxin.',
          competency: 'Scientific Reasoning',
          cognitiveLevel: 'Understanding',
          estimatedTime: '2 minutes',
        }),
        q({
          number: 9,
          text: 'List two differences between a plant cell and an animal cell.',
          type: 'Short Answer',
          marks: 2,
          difficulty: 'medium',
          chapter: 'Cell Biology',
          topic: 'Cell Structure',
          correctAnswer:
            'Plant cells have a cell wall and chloroplasts, which animal cells do not. Plant cells also have a large vacuole, while animal cells have small or no vacuoles.',
          explanation: 'Any two valid differences.',
          hint: 'Think about the structures plants need that animals do not.',
          learningObjective: 'Compare plant and animal cells.',
          learningOutcome: 'States two structural differences.',
          competency: 'Scientific Reasoning',
          cognitiveLevel: 'Understanding',
          estimatedTime: '2 minutes',
        }),
        q({
          number: 10,
          text: 'Describe two ways in which the alveoli are adapted for efficient gas exchange.',
          type: 'Short Answer',
          marks: 2,
          difficulty: 'hard',
          chapter: 'Human Physiology',
          topic: 'Respiration',
          correctAnswer:
            'Their walls are one cell thick, so gases diffuse quickly; and there are millions of alveoli, giving a large surface area.',
          explanation: 'Any two adaptations, each with a reason.',
          hint: 'Think about surface area and wall thickness.',
          learningObjective: 'Explain gas exchange in humans.',
          learningOutcome: 'Links structure to function in alveoli.',
          competency: 'Scientific Reasoning',
          cognitiveLevel: 'Analysis',
          estimatedTime: '3 minutes',
        }),
      ],
    },
    {
      id: 'section-c',
      label: 'Section C',
      name: 'Long Answer',
      questions: [
        q({
          number: 11,
          text: 'Explain how green plants make their food. Include the raw materials, the energy source and the products.',
          type: 'Long Answer',
          marks: 3,
          difficulty: 'easy',
          chapter: 'Plant Biology',
          topic: 'Photosynthesis',
          correctAnswer:
            'Green plants make glucose by photosynthesis. The raw materials are carbon dioxide and water; chlorophyll traps energy from sunlight; the products are glucose and oxygen.',
          explanation: 'One mark each for raw materials, energy source and products.',
          hint: 'Start from the word equation.',
          learningObjective: 'Describe photosynthesis.',
          learningOutcome: 'Explains photosynthesis fully.',
          competency: 'Scientific Reasoning',
          cognitiveLevel: 'Understanding',
          estimatedTime: '5 minutes',
        }),
        q({
          number: 12,
          text: 'Phototropism helps a plant survive. Explain how, using an example.',
          type: 'Long Answer',
          marks: 4,
          difficulty: 'medium',
          chapter: 'Plant Biology',
          topic: 'Phototropism',
          correctAnswer:
            'Bending towards light lets the leaves receive more light for photosynthesis, e.g. a shoot bending towards a window. Roots bend away from light and towards gravity to reach water and minerals.',
          explanation: 'Award marks for the mechanism, the survival value and a valid example.',
          hint: 'More light means more food.',
          learningObjective: 'Understand plant response to external stimuli.',
          learningOutcome: 'Connects phototropism to survival.',
          competency: 'Scientific Reasoning',
          cognitiveLevel: 'Application',
          estimatedTime: '6 minutes',
        }),
        q({
          number: 13,
          text: 'Compare asexual and sexual reproduction in animals. Give one example of each.',
          type: 'Long Answer',
          marks: 4,
          difficulty: 'medium',
          chapter: 'Reproduction',
          topic: 'Asexual Reproduction',
          correctAnswer:
            'Asexual reproduction involves one parent and no gametes; offspring are identical, e.g. budding in Hydra. Sexual reproduction involves two parents whose gametes fuse; offspring show variation, e.g. humans.',
          explanation: 'Up to two marks per type.',
          hint: 'Number of parents, and whether offspring vary.',
          learningObjective: 'Classify types of reproduction.',
          learningOutcome: 'Compares the two types with examples.',
          competency: 'Scientific Reasoning',
          cognitiveLevel: 'Analysis',
          estimatedTime: '6 minutes',
        }),
        q({
          number: 14,
          text: 'A student claims that plants respire only at night because photosynthesis happens during the day. Evaluate this claim.',
          type: 'Long Answer',
          marks: 4,
          difficulty: 'hard',
          chapter: 'Plant Biology',
          topic: 'Respiration in Plants',
          correctAnswer:
            'The claim is wrong. Plants respire all the time, day and night. During the day photosynthesis releases more oxygen than respiration uses, so the net effect looks like oxygen release; at night only respiration continues.',
          explanation: 'Award marks for rejecting the claim and explaining both processes.',
          hint: 'Respiration never stops.',
          learningObjective: 'Distinguish photosynthesis from respiration.',
          learningOutcome: 'Evaluates a claim with evidence.',
          competency: 'Scientific Reasoning',
          cognitiveLevel: 'Evaluation',
          estimatedTime: '8 minutes',
        }),
      ],
    },
  ],
};
