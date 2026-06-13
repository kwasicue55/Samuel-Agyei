import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize GoogleGenAI SDK safely
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY") {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    console.log("GoogleGenAI initialized successfully with backend API key.");
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
  }
} else {
  console.log("No custom GEMINI_API_KEY found, fallback generator and Socratic chatbot will be used.");
}

/**
 * Resilient retry utility with exponential backoff and random jitter for transient GenAI demands.
 */
async function executeWithRetry<T>(fn: () => Promise<T>, retries = 5, delayMs = 1200): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      const errMsg = error?.message?.toLowerCase() || "";
      const isRetryable = error?.status === 503 || error?.status === 429 || 
                          errMsg.includes("503") || 
                          errMsg.includes("429") ||
                          errMsg.includes("high demand") || 
                          errMsg.includes("rate limit") || 
                          errMsg.includes("unavailable") ||
                          errMsg.includes("overloaded");
      
      if (isRetryable && attempt < retries) {
        const backoffDelay = delayMs * Math.pow(1.8, attempt) + Math.random() * 500;
        console.log(`[Backup System] Retrying model connection (code: ${error?.status || "503"}). Handled attempt ${attempt}/${retries}. Resubmitting query in ${Math.round(backoffDelay)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Unable to complete model generation due to continuous upstream demand spikes");
}

// Helper to clean up user input title or assign default
function cleanTitle(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= 5) {
    return text.trim();
  }
  return words.slice(0, 4).join(" ") + "...";
}

// Robust fallback study kit generator
function generateFallbackStudyKit(title: string, text: string) {
  const resolvedTitle = title.trim() || cleanTitle(text) || "Uploaded Document";
  const textLength = text.length;

  // Let's analyze keywords to try to customize the fallback kit slightly
  const lowerText = text.toLowerCase();
  
  let topic = "General Study Material";
  let quickRead = [
    "Understanding the core vocabulary and main themes is key to mastering this content.",
    "Active recall via flashcards is highly effective for memorizing these definitions.",
    "Quizzes reinforce conceptual retrieval, helping you identify areas requiring review.",
    "Applying the ELI5 analogy can solidify abstract ideas by associating them with simple concepts."
  ];
  let notes = [
    "This document covers central subjects that require deep cognitive focus.",
    "Always trace definitions back to real-world applications to verify your level of comprehension.",
    "Break downstream chapters into bite-sized segments to avoid overloading working memory."
  ];
  let formulas = ["Focus Retention Rate = (Time Spent / Total Sessions) * 100%"];
  let definitions = [
    { term: "Active Recall", definition: "A study method where you actively stimulate your memory for a piece of information during the learning process." },
    { term: "Spaced Repetition", definition: "A learning technique where reviews are spaced out over increasing intervals of time to exploit the psychological spacing effect." },
    { term: "Socratic Method", definition: "A form of cooperative argumentative dialogue that stimulates critical thinking and draws out ideas and underlying presuppositions." }
  ];
  let eli5 = "Imagine learning is like building with Lego. Instead of just looking at the pile of blocks (reading dense notes), you pick up the blocks and build a real house (active recall). Even if you make mistakes, building them yourself makes you remember where every block goes!";

  let flashcards = [
    { question: "What is the primary goal of the Socratic Method?", answer: "To stimulate critical thinking and illuminate ideas through cooperative, targeted questioning." },
    { question: "Why is passive highlighting often less effective than active testing?", answer: "Highlighting doesn't require cognitive effort or retrieval, creating an illusion of competence without deep storage." },
    { question: "How does spacing study sessions benefit long-term retention?", answer: "It allows minor forgetting to occur, making the next retrieval session more effortful and strongly reinforcing synaptic pathways." }
  ];

  let quizQuestions = [
    {
      question: "Which of the following is considered the most effective way to test your memory of dense concepts?",
      options: [
        "Re-reading the document three times consecutively",
        "Highlighting key phrases in different colors",
        "Active recall and self-quizzing without references",
        "Listening to ambient noise while skimming the summary"
      ],
      correctOptionIndex: 2,
      explanation: "Active recall forces your brain to retrieve knowledge from memory, which builds stronger neural connections than passive review."
    },
    {
      question: "What does ELI5 represent in modern educational frameworks?",
      options: [
        "Extra Line Item 5",
        "Explain Like I'm 5 (simplifying complex concepts using safe, easy analogies)",
        "Extended Learning Integration Model",
        "Error Log Investigation protocol"
      ],
      correctOptionIndex: 1,
      explanation: "ELI5 stands for 'Explain Like I'm 5', a powerful comprehension check where you describe a complex idea in terms so simple a child could understand."
    },
    {
      question: "Which learning curve explains why we forget information over time if not reviewed?",
      options: [
        "The Hermann Ebbinghaus Forgetting Curve",
        "The Pareto Progression",
        "The Pavlovian Extinction Rate",
        "The Socratic Decay Constant"
      ],
      correctOptionIndex: 0,
      explanation: "The Forgetting Curve, hypothesized by Ebbinghaus, outlines how information is lost over time when there is no attempt to retain it."
    }
  ];

  // Tailor if specific domains are detected
  if (lowerText.includes("photosynthesis") || lowerText.includes("biology") || lowerText.includes("cell") || lowerText.includes("chlorophyll")) {
    topic = "Photosynthesis & Cell Biology";
    quickRead = [
      "Photosynthesis is how green plants convert light energy into chemical energy.",
      "It happens mostly inside chloroplasts, using the green pigment called chlorophyll.",
      "The process consumes water, carbon dioxide, and sunlight to produce glucose and oxygen.",
      "It contains light-dependent reactions and the Calvin cycle (light-independent reactions)."
    ];
    notes = [
      "Chloroplasts are specialized double-membrane organelles responsible for capturing solar energy.",
      "Water is oxidized during the light-dependent reactions, releasing oxygen as a byproduct.",
      "ATP and NADPH produced in the initial phase are consumed during the Calvin cycle to synthesize sugars."
    ];
    formulas = [
      "6CO₂ + 6H₂O + light energy ➔ C₆H₁₂O₆ + 6O₂"
    ];
    definitions = [
      { term: "Chloroplast", definition: "A plastid in green plant cells where photosynthesis takes place." },
      { term: "Chlorophyll", definition: "The green pigment in plants that absorbs light energy used to carry out photosynthesis." },
      { term: "Calvin Cycle", definition: "A set of chemical reactions that takes place in chloroplasts during the light-independent phase of photosynthesis." }
    ];
    eli5 = "Think of a plant like a solar-powered bakery! Sunlight is the electricity, Water and Carbon Dioxide are flour and sugar. The leaf-baker cooks them up, making yummy Glucose cookies to eat, and releases clean Oxygen fresh air into the room as a happy byproduct!";
    flashcards = [
      { question: "What is the primary green pigment involved in photosynthesis?", answer: "Chlorophyll, found inside the thylakoid membranes of chloroplasts." },
      { question: "What are the key inputs required for photosynthesis?", answer: "Carbon dioxide (CO₂), Water (H₂O), and Light energy." },
      { question: "What are the two main phases of photosynthesis?", answer: "The Light-Dependent Reactions and the Light-Independent (Calvin) Cycle." }
    ];
    quizQuestions = [
      {
        question: "Where exactly inside a plant cell do the light reactions of photosynthesis occur?",
        options: [
          "In the stroma",
          "Within the thylakoid membrane",
          "In the mitochondrial matrix",
          "Along the cell outer wall"
        ],
        correctOptionIndex: 1,
        explanation: "The light-dependent reactions take place in the thylakoid membranes where chlorophyll molecules are organized into photosystems."
      },
      {
        question: "Which of the following molecules represents the primary chemical energy storage produced by photosynthesis?",
        options: [
          "Carbon dioxide",
          "Water",
          "Glucose",
          "Chlorophyll"
        ],
        correctOptionIndex: 2,
        explanation: "Glucose is the simple sugar/carbohydrate created during the Calvin Cycle, serving as the main fuel source for the plant's metabolic processes."
      }
    ];
  } else if (lowerText.includes("quadratic") || lowerText.includes("math") || lowerText.includes("equation") || lowerText.includes("algebra") || lowerText.includes("calculus")) {
    topic = "Algebraic Mathematics & Equations";
    quickRead = [
      "Quadratic equations represent second-degree polynomial formulas of style ax² + bx + c = 0.",
      "The graph of a quadratic function is a symmetrical curve called a parabola.",
      "The solutions or 'roots' can be found using factoring, completing the square, or the quadratic formula.",
      "The value b² - 4ac is called the discriminant, determining the number and type of roots."
    ];
    notes = [
      "A quadratic function has a maximum or minimum value located at its vertex: x = -b / (2a).",
      "If the discriminant is positive, there are two distinct real roots.",
      "If the discriminant is zero, there is exactly one rational real root.",
      "If the discriminant is negative, the roots are complex/imaginary numbers."
    ];
    formulas = [
      "Quadratic Formula: x = [-b ± √(b² - 4ac)] / (2a)",
      "Discriminant: D = b² - 4ac",
      "Vertex Coordinate formula: x = -b / (2a)"
    ];
    definitions = [
      { term: "Parabola", definition: "A symmetrical curve formed by the intersection of a cone with a plane parallel to its side (the shape of quadratic functions)." },
      { term: "Discriminant", definition: "The part of the quadratic formula under the square root, used to diagnose root properties." },
      { term: "Vertex", definition: "The highest or lowest point of a parabola, where the path changes direction." }
    ];
    eli5 = "Imagine throwing a basketball into a hoop! The ball goes up in a beautiful perfect arch and then falls back down. That upside-down bowl shape is a parabola! The mathematical formula that describes this beautiful flight path is a quadratic equation.";
    flashcards = [
      { question: "What coefficient power makes an equation quadratic?", answer: "A power of 2, indicating the variable is squared (e.g., x²)." },
      { question: "What does a negative discriminant tell you about the roots?", answer: "That the roots are complex or imaginary (there are no real horizontal x-axis intercepts)." },
      { question: "What is the formula to calculate the x-value of the vertex of a parabola?", answer: "x = -b / (2a)" }
    ];
    quizQuestions = [
      {
        question: "If a quadratic equation has a discriminant (b² - 4ac) equal to 0, what does this indicate about its roots?",
        options: [
          "It has two distinct real roots",
          "It has no real roots (two complex roots)",
          "It has exactly one real rational root",
          "It has infinitely many overlapping answers"
        ],
        correctOptionIndex: 2,
        explanation: "A discriminant of zero means the vertex lies exactly on the x-axis, resulting in a single repeated real root."
      },
      {
        question: "Which of the following terms describes the geometric shape of a quadratic equation's plot?",
        options: [
          "Hyperbola",
          "Parabola",
          "Ellipse",
          "Linear slope"
        ],
        correctOptionIndex: 1,
        explanation: "All quadratic equations produce parabolas on a Cartesian graph, which are U-shaped symmetrical arcs."
      }
    ];
  } else if (lowerText.length > 30) {
    // Dynamically build study content based on user's actual text lines to make it feel real!
    const lines = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
    const words = text.match(/\b[a-zA-Z]{5,15}\b/g) || [];
    
    // Find unique keywords (nouns/important words basically)
    const uniqueWords = Array.from(new Set(words))
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .filter(w => !["About", "These", "Their", "There", "Which", "Would", "Should", "Could", "Under", "After", "Before", "While"].includes(w))
      .slice(0, 5);

    topic = resolvedTitle;
    quickRead = [
      lines[0] ? `${lines[0]}.` : "Key takeaway points have been summarized directly from the document.",
      lines[1] ? `${lines[1]}.` : "Important contextual themes were extracted for review.",
      lines[2] ? `${lines[2]}.` : "Active testing is recommended on these materials.",
      lines[3] ? `${lines[3]}.` : "Formulas and custom definitions have been categorized below."
    ].slice(0, Math.max(3, lines.length));

    notes = [
      lines[4] ? `${lines[4]}.` : "Study note synthesized from raw textual reading materials.",
      lines[5] ? `${lines[5]}.` : "Conceptual relationships have been identified in the uploaded contents.",
      "Review definitions to master terminology, then reinforce using active self-reflection."
    ];

    definitions = uniqueWords.map((w, index) => {
      const sentenceWithWord = lines.find(line => line.toLowerCase().includes(w.toLowerCase())) || "";
      const baseDef = sentenceWithWord ? `As discussed in text: "${sentenceWithWord}."` : `An important term associated with properties of ${resolvedTitle}.`;
      return {
        term: w,
        definition: baseDef
      };
    });

    if (definitions.length === 0) {
      definitions = [
        { term: "Subject Term", definition: "An essential subject matter concept extracted from the provided text." }
      ];
    }

    eli5 = `Let's break ${resolvedTitle} down into simple blocks! Just like a recipe for cookies: instead of reading a huge scientific cookbook of chemical interactions, we can think of it as mixing eggs (concept 1) and sugar (concept 2) together in an oven to bake something delicious! Doing it hands-on makes everything clear!`;

    flashcards = uniqueWords.slice(0, 3).map((w, i) => {
      return {
        question: `Explain the importance of ${w} in the context of: ${resolvedTitle}?`,
        answer: `As outlined in your study source: it serves as a central building block or key relationship to understand the core message.`
      };
    });

    if (flashcards.length === 0) {
      flashcards = [
        { question: `What is the core theme of ${resolvedTitle}?`, answer: "The materials focus on teaching the relationships and definitions of this custom subject." }
      ];
    }

    quizQuestions = [
      {
        question: `Based on your materials for ${resolvedTitle}, which of the following is most accurate?`,
        options: [
          `It revolves around concepts connected to ${uniqueWords[0] || "Active Master"}.`,
          "It represents a purely historical event from centuries ago.",
          "It is irrelevant to the core modern education curriculum.",
          "It claims that passive viewing is superior to diagnostic quiz mode."
        ],
        correctOptionIndex: 0,
        explanation: `Your document repeatedly references ${uniqueWords[0] || "core subjects"} as representing key terms of the curriculum.`
      },
      {
        question: `To master the topics outlined in ${resolvedTitle}, what does the Socratic tutor advocate?`,
        options: [
          "Scanning highlighted paragraphs repeatedly without self-reflection",
          "Cooperative deep inquiry and explaining concepts in simple ELI5 analogies",
          "Memorizing text blocks verbatim with no comprehension checks",
          "Skipping summaries and only reviewing right before exam timers start"
        ],
        correctOptionIndex: 1,
        explanation: "Simple explanations (ELI5) and interactive quizzing are scientifically proven to maximize deep retention."
      }
    ];
  }

  // Guarantee exactly 5 structured summaries, 5 flashcards, and 5 quiz questions in fallback
  let finalQuickRead = [...quickRead];
  while (finalQuickRead.length < 5) {
    finalQuickRead.push(`Critical Study Insight #${finalQuickRead.length + 1}: Continuous active testing and retrieval reviews build deeper retention margins.`);
  }
  finalQuickRead = finalQuickRead.slice(0, 5);

  let finalFlashcards = [...flashcards];
  const fallbackFcs = [
    { question: "What is the key driver of long-term learning retention?", answer: "Active recall combined with spaced repetition cycles." },
    { question: "How does simplifying terms using ELI5 benefit the speaker?", answer: "It reveals personal blindspots and forces synthesis of complex terminology." },
    { question: "What does the PrepMind Socratic method prioritize?", answer: "Guiding the learner toward self-discovery rather than feeding flat answers." },
    { question: "How frequently should flashcards with 'learning' status be reviewed?", answer: "Ideally daily, until retrofitted with fluent retention patterns." },
    { question: "What is the primary advantage of testing over passive reading?", answer: "Testing constructs active neurological paths, preventing the illusion of familiarity." }
  ];
  while (finalFlashcards.length < 5) {
    finalFlashcards.push(fallbackFcs[finalFlashcards.length % fallbackFcs.length]);
  }
  finalFlashcards = finalFlashcards.slice(0, 5);

  let finalQuizzes = [...quizQuestions];
  const fallbackQuizzes = [
    {
      question: "Under the PrepMind learning hierarchy, which phase serves as the diagnostic foundation?",
      options: ["Verbatim rote memorization", "Drafting notes without reviews", "Socratic inquiry and diagnostic multiple-choice self-quizzes", "Skimming highlighted chapter headers"],
      correctOptionIndex: 2,
      explanation: "Active recall and diagnostic self-quitting build stronger memory retention through retrieval cues."
    },
    {
      question: "Which retention technique spaces study intervals dynamically over days?",
      options: ["Massed cramming", "Spaced repetition", "Subtle passive skimming", "Continuous reading marathons"],
      correctOptionIndex: 1,
      explanation: "Spaced repetition spaces study times out, combating the forgetting curve scientifically."
    },
    {
      question: "When teaching a peer using Explain Like I'm Five (ELI5) analogies, what do you maximize?",
      options: ["Conceptual simplification and associative thinking", "Jargon density", "The length of equations", "Verbatim definition matching"],
      correctOptionIndex: 0,
      explanation: "ELI5 forces you to simplify ideas down to their core metaphors, consolidating conceptual mastery."
    }
  ];
  while (finalQuizzes.length < 5) {
    finalQuizzes.push(fallbackQuizzes[finalQuizzes.length % fallbackQuizzes.length]);
  }
  finalQuizzes = finalQuizzes.slice(0, 5);

  return {
    document: {
      id: "doc_" + Math.random().toString(36).substr(2, 9),
      user_id: "user_test",
      title: resolvedTitle,
      raw_text_content: text,
      upload_date: new Date().toISOString().split('T')[0]
    },
    summary: {
      id: "sum_" + Math.random().toString(36).substr(2, 9),
      document_id: "doc_temp",
      quick_read_json: finalQuickRead,
      deep_dive_json: {
        notes,
        formulas,
        definitions
      },
      eli5_text: eli5
    },
    flashcards: finalFlashcards.map((f, i) => ({
      id: "fc_" + i + "_" + Math.random().toString(36).substr(2, 9),
      document_id: "doc_temp",
      question_text: f.question,
      answer_text: f.answer,
      review_status: "learning"
    })),
    quizzes: finalQuizzes.map((q, i) => ({
      id: "qq_" + i + "_" + Math.random().toString(36).substr(2, 9),
      document_id: "doc_temp",
      question_text: q.question,
      options_array: q.options,
      correct_option_index: q.correctOptionIndex,
      explanation: q.explanation
    }))
  };
}

// REST API endpoint: Generate Study Kit
app.post("/api/generate", async (req: Request, res: Response): Promise<void> => {
  const { title, text } = req.body;

  if (!text || text.trim().length === 0) {
    res.status(400).json({ error: "Text content is required." });
    return;
  }

  const cleanTitleStr = title?.trim() || cleanTitle(text);

  // If Gemini AI client is initialized, generate real structured content!
  if (ai) {
    try {
      console.log(`Sending process request to Gemini for title: "${cleanTitleStr}"`);
      const prompt = `You are a professional educational assistant. Convert this dense student study document into interactive materials.
Document Title: "${cleanTitleStr}"
Raw Document Text:
"""
${text}
"""

You MUST reply with JSON in the exact structure defined by the schema, parsing content accurately. Keep explanations clear, engaging, and suitable for active recall studying.
- quickRead: EXACTLY 5 structured summaries/bullet points outlining core facts of the text.
- deepDive: structured list of key notes, optional list of formulas (only if math/scientific rules exist), and key terms with clear definitions.
- eli5: simple humorous analogy that explains the complex theme using basic friendly concepts (Explain Like I'm 5 style).
- flashcards: EXACTLY 5 term-or-question cards.
- quizQuestions: EXACTLY 5 multiple choice questions with 4 logical-sounding options each, correctOptionIndex (0 to 3), and rich explanation.`;

      const response = await executeWithRetry(() => ai!.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              quickRead: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              deepDive: {
                type: Type.OBJECT,
                properties: {
                  notes: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  formulas: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  definitions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        term: { type: Type.STRING },
                        definition: { type: Type.STRING }
                      },
                      required: ["term", "definition"]
                    }
                  }
                },
                required: ["notes", "definitions"]
              },
              eli5: { type: Type.STRING },
              flashcards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    answer: { type: Type.STRING }
                  },
                  required: ["question", "answer"]
                }
              },
              quizQuestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    correctOptionIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING }
                  },
                  required: ["question", "options", "correctOptionIndex", "explanation"]
                }
              }
            },
            required: ["quickRead", "deepDive", "eli5", "flashcards", "quizQuestions"]
          }
        }
      }));

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No text returned from Gemini API");
      }

      const parsed = JSON.parse(responseText.trim());

      // Guarantee exactly 5 structured summaries, 5 flashcards, and 5 quiz questions via safe post-processing
      let finalQuickRead = parsed.quickRead || [];
      while (finalQuickRead.length < 5) {
        finalQuickRead.push(`Core point #${finalQuickRead.length + 1}: Mastering vocabulary terms through active recall helps build complete subject expertise.`);
      }
      finalQuickRead = finalQuickRead.slice(0, 5);

      let finalFlashcards = parsed.flashcards || [];
      while (finalFlashcards.length < 5) {
        finalFlashcards.push({
          question: `Explain the importance of active recall for deep memorization?`,
          answer: `Active recall builds real neuron connections by stretching working memory, making retrieval easier over time.`
        });
      }
      finalFlashcards = finalFlashcards.slice(0, 5);

      let finalQuizzes = parsed.quizQuestions || [];
      while (finalQuizzes.length < 5) {
        finalQuizzes.push({
          question: `Under standard cognitive theories, which study strategy promotes maximum conceptual retention?`,
          options: ["Verbatim repetitive reading", "Active self-recall quizzes", "Extensive color-coded highlighting", "Reviewing materials only once"],
          correctOptionIndex: 1,
          explanation: "Active self-quizzing exercises retrieval networks, cementing learning way better than passive scanning."
        });
      }
      finalQuizzes = finalQuizzes.slice(0, 5);

      // Pack into custom StudyKit payload
      const docId = "doc_" + Math.random().toString(36).substr(2, 9);
      const studyKit = {
        document: {
          id: docId,
          user_id: "user_test",
          title: cleanTitleStr,
          raw_text_content: text,
          upload_date: new Date().toISOString().split('T')[0]
        },
        summary: {
          id: "sum_" + Math.random().toString(36).substr(2, 9),
          document_id: docId,
          quick_read_json: finalQuickRead,
          deep_dive_json: {
            notes: parsed.deepDive?.notes || [],
            formulas: parsed.deepDive?.formulas || [],
            definitions: parsed.deepDive?.definitions || []
          },
          eli5_text: parsed.eli5 || ""
        },
        flashcards: finalFlashcards.map((f: any, i: number) => ({
          id: `fc_${i}_` + Math.random().toString(36).substr(2, 9),
          document_id: docId,
          question_text: f.question,
          answer_text: f.answer,
          review_status: "learning"
        })),
        quizzes: finalQuizzes.map((q: any, i: number) => ({
          id: `qq_${i}_` + Math.random().toString(36).substr(2, 9),
          document_id: docId,
          question_text: q.question,
          options_array: q.options,
          correct_option_index: q.correctOptionIndex,
          explanation: q.explanation
        }))
      };

      res.json({ studyKit, source: "gemini" });
      return;
    } catch (err) {
      console.error("Gemini call failed. Gracefully falling back to mock kit...", err);
      // Fall through to fallback
    }
  }

  // Graceful fallback helper when Gemini is offline or not configured
  const fallback = generateFallbackStudyKit(cleanTitleStr, text);
  res.json({ studyKit: fallback, source: "fallback" });
});

// Helper to strip symbols that the user dislikes (* @ & etc.), replacing them with clear words/spaces.
function sanitizeSolutionSymbols(text: string): string {
  if (!text) return "";
  let clean = text;
  
  // Replace references to ampersand symbol with the word "and"
  clean = clean.replace(/&/g, " and ");
  
  // Replace at symbol with "at"
  clean = clean.replace(/@/g, " at ");
  
  // Remove asterisks completely (commonly used in Markdown bold **word** or list points)
  clean = clean.replace(/\*/g, "");

  // Remove other symbols like underscores or backticks that act as markup tags
  clean = clean.replace(/_/g, "");
  clean = clean.replace(/`/g, "");
  
  // Tidy up multiple consecutive spaces resulting from replacements
  clean = clean.replace(/[ ]{2,}/g, " ");
  
  return clean;
}

// REST API endpoint: Socratic Tutor chatbot queries
app.post("/api/chat", async (req: Request, res: Response): Promise<void> => {
  const { message, contextDoc, chatHistory, chatMode } = req.body;

  if (!message) {
    res.status(400).json({ error: "Message is required." });
    return;
  }

  const mode = chatMode || "solver";

  const docContext = contextDoc 
    ? `Document Title: ${contextDoc.title}\nContent summary background: ${contextDoc.raw_text_content.substring(0, 1500)}...`
    : "No document loaded yet. Help them study general concepts.";

  if (ai) {
    try {
      // Build chronological conversational thread
      let systemPrompt = "";
      
      if (mode === "solver") {
        systemPrompt = `You are "Master Solve AI", an elite, world-class academic professor and expert problem solver. You hold advanced doctorates across multiple academic disciplines and specialize in delivering flawless, detailed step-by-step solutions for:
- Chemistry: chemical equations, balancing reactions, molarity, stoichiometry, pH, thermodynamic gas laws, equilibrium, organic synthesis.
- Physics: mechanics, kinematics, electrodynamics, optics, thermodynamics, circuits, quantum physics.
- E-Maths (Elementary and Higher Mathematics): algebra, calculus, matrices, geometry, trigonometry, probability, statistics, differential equations.
- Biology: cell structures, genetics, biochemistry replication, physiology, photosynthesis, respiration cycles.
- Economics: microeconomics (supply and demand, elasticity, utility, market structures, monopolies), macroeconomics (GDP, inflation, monetary/fiscal policy, IS-LM, trade).
- Costing and Financial Accounting: cost sheets, variance analysis (material, labor, overheads), break-even analysis (CVP, margin of safety), marginal costing, balance sheets, T-accounts/ledgers.

CRITICAL FORMATTING INSTRUCTIONS:
1. NEVER use the symbols "*" (asterisk), "@" (at symbol), or "&" (ampersand) anywhere in your text, headings, or mathematical calculations.
2. DO NOT use asterisks like "**" or "*" for bolding, italics, or list bullets. When formatting headings, write them in plain standard letters or CAPITAL letters followed by a colon (e.g. "PROBLEM SCOPING AND VARIABLES:" or "1. Formula Applied:"). Use normal hyphens "-" or plain numbers for list items.
3. For multiplication in any formulas or calculation guides, do not use the asterisk symbol "*". Write out the word "times", "multiplied by", or use the letter "x" (e.g., write "2 x 3" or "2 times 3").
4. ALWAYS replace "&" with "and" and replace "@" with "at".
5. Never output markup bold, italics, or code blocks containing asterisks. Keep the response completely standard, beautiful, readable, and clean plain text representation.

GUIDELINES:
1. When a user submits any question, your main goal is to deliver a definitive, accurate, and completely correct step-by-step mathematical, theoretical, or logical solution.
2. Structure your answers with clear sections:
   - [Problem Scoping and Variables]: Identify given variables, constants, and target objectives.
   - [Formula / Principles Applied]: Explicitly state relevant laws or formulas using clear notation.
   - [Step-by-Step Derivation / Calculations]: Walk through calculations showing working margins clearly so that the solution is incredibly easy to follow.
   - [Final Conclusion / Answer]: State the final computed value or outcome clearly.
   - [Conceptual Takeaway]: Give a one-sentence high-level educational tip corresponding to the concept.
3. If the user presents multiple-choice questions, solve them explicitly, select the correct option, and explain why other options are wrong.
4. Keep explanations visually neat, professional, and accessible. You have no length constraints for Solver Mode; prioritize thoroughness and clarity.`;
      } else {
        systemPrompt = `You are "Socrates", a supportive, brilliant, and friendly Socratic AI Tutor.
Your goal is to guide students to answers on their own. Instead of giving direct flat answers, use guiding questions, simple hints, analogies, and friendly Socratic inquiry that stimulates active recall.
Hold deep empathy, match their style, keep answers safe, encouraging, and under 150 words.

CRITICAL FORMATTING INSTRUCTIONS:
1. NEVER use the symbols "*" (asterisk), "@" (at symbol), or "&" (ampersand) anywhere in your reply.
2. DO NOT use asterisks "**" or "*" for bolding, italics, or list bullets. Write in simple plain paragraphs.
3. Write "and" instead of "&", and "at" instead of "@".

Base your insights on the student's current uploaded material:
---
${docContext}
---`;
      }

      // Build chat object or stream
      const formattedHistory = (chatHistory || []).map((msg: any) => {
        return {
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: sanitizeSolutionSymbols(msg.text) }]
        };
      });

      // Include latest user message in request
      const chat = ai.chats.create({
        model: "gemini-3.5-flash",
        config: {
          systemInstruction: systemPrompt,
          temperature: mode === "solver" ? 0.3 : 0.8 // Low temperature for high academic precision during solving
        },
        history: formattedHistory
      });

      const result = await executeWithRetry(() => chat.sendMessage({ message: message }));
      const responseText = sanitizeSolutionSymbols(result.text || "I am listening carefully. What are you thinking about that exact concept?");
      res.json({ responseText, source: "gemini" });
      return;
    } catch (err) {
      console.error("Gemini chat failed, fallback to local chatbot...", err);
    }
  }

  // Socratic fallback dialogue rules
  const lowerMsg = message.toLowerCase();
  let responseText = "That is a very curious query! Let's think about it. What part of the definition seems the most challenging or interesting to you?";

  if (lowerMsg.includes("why") || lowerMsg.includes("how")) {
    responseText = "A great 'how/why' question! If you had to break that concept down under its smallest visual pieces, what physical analogy would you use to describe it to a peer?";
  } else if (lowerMsg.includes("photosynthesis") || lowerMsg.includes("chlorophyll") || lowerMsg.includes("plant")) {
    responseText = "Plants are like green power plants! When the sun rises, how do you think the chlorophyll molecules capture that sunlight without losing the energy?";
  } else if (lowerMsg.includes("formula") || lowerMsg.includes("quadratic") || lowerMsg.includes("equation") || lowerMsg.includes("math")) {
    responseText = "Equations represent perfect balances, like a seesaw! If we adjust one variable on the left, what must occur on the right to keep the balance?";
  } else if (lowerMsg.includes("hello") || lowerMsg.includes("hi ") || lowerMsg.includes("hey")) {
    responseText = "Hello there, scholar! I am Socrates, your study guide. What interesting concept from your documents are we exploring together today?";
  } else if (lowerMsg.includes("exam") || lowerMsg.includes("quiz") || lowerMsg.includes("test")) {
    responseText = "Ah, exams are opportunities to prove your cognitive grit! Instead of just cramming, what would happen if you explained this topic out loud right now? Give it a try!";
  } else {
    responseText = `An excellent target! Tell me: in your own simple words, how would you define "${message}" if you had to teach it to someone younger?`;
  }

  res.json({ responseText: sanitizeSolutionSymbols(responseText), source: "fallback" });
});

// Configure Vite middleware for development or static serving for production
async function startViteApp() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Configuring Vite Development Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving production files from /dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PrepMind AI Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startViteApp().catch((err) => {
  console.error("Failed to start server:", err);
});
