import React, { useState, useEffect, useRef } from "react";
import { 
  BookOpen, 
  Brain, 
  CheckCircle, 
  Award, 
  MessageSquare, 
  Plus, 
  Sparkles, 
  Upload, 
  ChevronRight, 
  ChevronLeft, 
  ChevronDown,
  RotateCw, 
  HelpCircle, 
  Check, 
  X, 
  BookOpenCheck,
  TrendingUp,
  FileText,
  UserCheck,
  Clock,
  ArrowRight,
  Sparkle,
  AlertTriangle,
  FileDown
} from "lucide-react";
import { StudyKit, Flashcard, QuizQuestion, ChatMessage } from "./types";
import { PRE_BUILT_KITS } from "./data";
import { exportStudyKitToPDF } from "./pdfExport";
import DashboardStats from "./components/DashboardStats";
import { GoogleBannerAd, GoogleInterstitialAd } from "./components/GoogleAdPlaceholders";

// Firebase integrations
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  getDocs, 
  updateDoc, 
  query, 
  where 
} from "firebase/firestore";
import { auth, db, loginWithGoogle, logoutUser, handleFirestoreError, OperationType } from "./firebase";

// Dynamically load PDF.js from CDN to parse uploaded documents safely
const loadPdfJs = async (): Promise<any> => {
  if ((window as any).pdfjsLib) {
    return (window as any).pdfjsLib;
  }
  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById("pdfjs-cdn-script");
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if ((window as any).pdfjsLib) {
          clearInterval(checkInterval);
          resolve((window as any).pdfjsLib);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error("Timeout loading PDF reader library."));
      }, 10000);
      return;
    }

    const script = document.createElement("script");
    script.id = "pdfjs-cdn-script";
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
    script.onload = () => {
      const pdfjs = (window as any).pdfjsLib;
      // Setup worker cleanly
      pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
      resolve(pdfjs);
    };
    script.onerror = () => {
      reject(new Error("Failed to load PDF extraction library. Please check your network connection."));
    };
    document.body.appendChild(script);
  });
};

// Extract text contents from a PDF file
const extractTextFromPdf = async (file: File, onProgress?: (msg: string) => void): Promise<string> => {
  onProgress?.("Loading PDF parser...");
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  
  onProgress?.("Reading document pages...");
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  
  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(`Extracting text from page ${i} of ${pdf.numPages}...`);
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => (item as any).str).join(" ");
    fullText += pageText + "\n";
  }
  
  const trimmed = fullText.trim();
  if (!trimmed) {
    throw new Error("No readable text content found inside the PDF. It may contain scanned image pages.");
  }
  return trimmed;
};

// Extract text contents from plain text (.txt) file
const extractTextFromTxt = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string || "");
    };
    reader.onerror = () => reject(new Error("Failed to read text file."));
    reader.readAsText(file);
  });
};

// Dynamically load Mammoth.js from CDN to parse Word documents safely (.docx, .doc)
const loadMammoth = async (): Promise<any> => {
  if ((window as any).mammoth) {
    return (window as any).mammoth;
  }
  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById("mammoth-cdn-script");
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if ((window as any).mammoth) {
          clearInterval(checkInterval);
          resolve((window as any).mammoth);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error("Timeout loading Word document reader."));
      }, 10000);
      return;
    }
    const script = document.createElement("script");
    script.id = "mammoth-cdn-script";
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
    script.onload = () => resolve((window as any).mammoth);
    script.onerror = () => reject(new Error("Failed to load Word document reader from CDN."));
    document.body.appendChild(script);
  });
};

// Dynamically load SheetJS (XLSX) from CDN to parse spreadsheet formats cleanly
const loadXlsx = async (): Promise<any> => {
  if ((window as any).XLSX) {
    return (window as any).XLSX;
  }
  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById("xlsx-cdn-script");
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if ((window as any).XLSX) {
          clearInterval(checkInterval);
          resolve((window as any).XLSX);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error("Timeout loading Spreadsheet reader."));
      }, 10000);
      return;
    }
    const script = document.createElement("script");
    script.id = "xlsx-cdn-script";
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => resolve((window as any).XLSX);
    script.onerror = () => reject(new Error("Failed to load Spreadsheet reader from CDN."));
    document.body.appendChild(script);
  });
};

// Dynamically load JSZip from CDN to unpack files like PPTX/PowerPoint
const loadJsZip = async (): Promise<any> => {
  if ((window as any).JSZip) {
    return (window as any).JSZip;
  }
  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById("jszip-cdn-script");
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if ((window as any).JSZip) {
          clearInterval(checkInterval);
          resolve((window as any).JSZip);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error("Timeout loading Presentation pack reader."));
      }, 10000);
      return;
    }
    const script = document.createElement("script");
    script.id = "jszip-cdn-script";
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    script.onload = () => resolve((window as any).JSZip);
    script.onerror = () => reject(new Error("Failed to load Presentation file pack reader."));
    document.body.appendChild(script);
  });
};

// Dynamically load Tesseract.js from CDN to support client-side OCR on images
const loadTesseract = async (): Promise<any> => {
  if ((window as any).Tesseract) {
    return (window as any).Tesseract;
  }
  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById("tesseract-cdn-script");
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if ((window as any).Tesseract) {
          clearInterval(checkInterval);
          resolve((window as any).Tesseract);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error("Timeout loading OCR Image extraction utility."));
      }, 10000);
      return;
    }
    const script = document.createElement("script");
    script.id = "tesseract-cdn-script";
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.0.2/tesseract.min.js";
    script.onload = () => resolve((window as any).Tesseract);
    script.onerror = () => reject(new Error("Failed to load Image OCR utility from CDN."));
    document.body.appendChild(script);
  });
};

// Extract text contents from docx/doc (Word Documents)
const extractTextFromDocx = async (file: File, onProgress?: (msg: string) => void): Promise<string> => {
  onProgress?.("Loading Word document reader...");
  const mammoth = await loadMammoth();
  const arrayBuffer = await file.arrayBuffer();
  onProgress?.("Parsing document paragraphs...");
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value || "";
  const clean = text.trim();
  if (!clean) {
    throw new Error("No readable text found inside this Word document.");
  }
  return clean;
};

// Extract text contents from spreadsheet formats (Excel, CSV, TSV, ODS)
const extractTextFromSpreadsheet = async (file: File, onProgress?: (msg: string) => void): Promise<string> => {
  onProgress?.("Loading Spreadsheet parsed system...");
  const XLSX = await loadXlsx();
  const arrayBuffer = await file.arrayBuffer();
  onProgress?.("Analyzing worksheets...");
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
  let fullText = "";
  
  workbook.SheetNames.forEach((sheetName: string) => {
    const worksheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    if (csv && csv.trim()) {
      fullText += `--- sheet: ${sheetName} ---\n${csv}\n\n`;
    }
  });

  const clean = fullText.trim();
  if (!clean) {
    throw new Error("No non-empty spreadsheets/tables found in this workbook.");
  }
  return clean;
};

// Extract text contents from modern Presentation formats (PowerPoint pptx)
const extractTextFromPowerPoint = async (file: File, onProgress?: (msg: string) => void): Promise<string> => {
  onProgress?.("Loading Slides zip processor...");
  const JSZip = await loadJsZip();
  const arrayBuffer = await file.arrayBuffer();
  onProgress?.("Reading presentations structures...");
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  const slideFiles = Object.keys(zip.files).filter(name => name.startsWith("ppt/slides/slide") && name.endsWith(".xml"));
  if (slideFiles.length === 0) {
    throw new Error("This PowerPoint doesn't contain standard digital XML text slides.");
  }

  onProgress?.(`Found ${slideFiles.length} slides. Compiling slide layout...`);
  // Sort slide files numerically
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.replace(/[^0-9]/g, "")) || 0;
    const numB = parseInt(b.replace(/[^0-9]/g, "")) || 0;
    return numA - numB;
  });

  let pptText = "";
  for (let i = 0; i < slideFiles.length; i++) {
    onProgress?.(`Reading slide text: slide ${i + 1} of ${slideFiles.length}...`);
    const slideContent = await zip.files[slideFiles[i]].async("string");
    const matches = slideContent.match(/<a:t>([^<]*)<\/a:t>/g);
    if (matches) {
      // Strip <a:t> markup tags cleanly
      const slideText = matches.map(m => m.replace(/<\/?[^>]+(>|$)/g, "")).join(" ");
      pptText += `Slide ${i + 1}:\n${slideText}\n\n`;
    }
  }

  const clean = pptText.trim();
  if (!clean) {
    throw new Error("Unable to extract standard speech slide texts from presentation.");
  }
  return clean;
};

// Extract text contents from images via Tesseract OCR
const extractTextFromImage = async (file: File, onProgress?: (msg: string) => void): Promise<string> => {
  onProgress?.("Loading Image OCR AI engine...");
  const Tesseract = await loadTesseract();
  onProgress?.("Analyzing image text structure...");
  const result = await Tesseract.recognize(file, "eng", {
    logger: (m: any) => {
      if (m.status === "recognizing") {
        onProgress?.(`OCR AI scanning in progress: ${Math.round(m.progress * 100)}%`);
      }
    }
  });

  const text = result.data?.text || "";
  const clean = text.trim();
  if (!clean) {
    throw new Error("OCR scan completed but found no decipherable text characters in this image.");
  }
  return clean;
};

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'viewer' | 'study_hub' | 'chat'>('dashboard');
  
  // Authentication & Sync State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      await loginWithGoogle();
    } catch (error: any) {
      console.warn("Popup sign-in failed or was closed:", error);
      const errMsg = error?.message || String(error);
      if (errMsg.includes("popup-closed-by-user") || errMsg.includes("cancelled-by-user")) {
        setAuthError("Google Sign-In was cancelled or the login window was closed. Feel free to try again when you want to authorize cloud sync.");
      } else {
        setAuthError("Google Sign-In failed: " + errMsg);
      }
    }
  };

  // Data State
  const [kits, setKits] = useState<StudyKit[]>(PRE_BUILT_KITS);
  const [selectedKitId, setSelectedKitId] = useState<string>("doc_photosynthesis");

  // Global Quiz Scores state to calculate overall stats dynamically
  const [quizSessions, setQuizSessions] = useState<{ [kitId: string]: { total: number; correct: number } }>({});

  // 1. Connection Validation and Verification on Initially Boots (Mount Check)
  useEffect(() => {
    async function testConnectionOnAppMount() {
      try {
        const { getDocFromServer } = await import("firebase/firestore");
        await getDocFromServer(doc(db, "test", "connection"));
        console.log("Firestore verification check: successfully reached server stream.");
      } catch (error) {
        if (error instanceof Error && error.message.includes("offline")) {
          console.warn("Firestore initially boot resolved: local cache initialized.");
        }
      }
    }
    testConnectionOnAppMount();
  }, []);

  // 2. Authentication Monitor
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      setIsAuthLoading(false);
      
      if (u) {
        try {
          // Register public user profile document securely
          const userRef = doc(db, "users", u.uid);
          await setDoc(userRef, {
            id: u.uid,
            email: u.email || "",
            name: u.displayName || "Student",
            subscription_status: "free"
          }, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${u.uid}`);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // 3. Sync Kits from Cloud Firestore or fallback local state
  useEffect(() => {
    if (!firebaseUser) {
      // Local state fallback for unauthenticated sessions
      const savedKits = localStorage.getItem("prepmind_kits");
      if (savedKits) {
        try { 
          const parsed = JSON.parse(savedKits); 
          setKits(parsed);
          setSelectedKitId(parsed[0]?.document.id || "doc_photosynthesis");
        } catch (e) { 
          setKits(PRE_BUILT_KITS); 
          setSelectedKitId("doc_photosynthesis");
        }
      } else {
        setKits(PRE_BUILT_KITS);
        setSelectedKitId("doc_photosynthesis");
      }
      return;
    }

    // Authenticated query for current user's uploaded materials
    const kitsQuery = query(collection(db, "kits"), where("ownerId", "==", firebaseUser.uid));
    const unsubscribe = onSnapshot(kitsQuery, async (snapshot) => {
      try {
        const fetchedKits: StudyKit[] = [];
        for (const kitDoc of snapshot.docs) {
          const kitData = kitDoc.data();
          
          // Fetch flashcards and quizzes subcollections
          const flashcardsSnap = await getDocs(collection(db, "kits", kitDoc.id, "flashcards"));
          const flashcards = flashcardsSnap.docs.map(d => d.data() as Flashcard);
          
          const quizzesSnap = await getDocs(collection(db, "kits", kitDoc.id, "quizzes"));
          const quizzes = quizzesSnap.docs.map(d => d.data() as QuizQuestion);
          
          fetchedKits.push({
            document: {
              id: kitDoc.id,
              user_id: firebaseUser.uid,
              title: kitData.title || "Untitled Document",
              raw_text_content: kitData.raw_text_content || "",
              upload_date: kitData.upload_date || ""
            },
            summary: {
              id: "sum_" + kitDoc.id,
              document_id: kitDoc.id,
              quick_read_json: kitData.quick_read_json || [],
              deep_dive_json: kitData.deep_dive_json || { notes: [], definitions: [] },
              eli5_text: kitData.eli5_text || ""
            },
            flashcards,
            quizzes
          });
        }
        
        // Use PRE_BUILT_KITS if student has zero cloud uploads for standard visualization
        if (fetchedKits.length === 0) {
          setKits(PRE_BUILT_KITS);
          setSelectedKitId(PRE_BUILT_KITS[0].document.id);
        } else {
          setKits(fetchedKits);
          // Auto-select first of the custom documents if active kit isn't in new set
          if (!fetchedKits.some(k => k.document.id === selectedKitId)) {
            setSelectedKitId(fetchedKits[0].document.id);
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, "kits");
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "kits");
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  // 4. Sync Quiz Sessions from Cloud Firestore or fallback local storage
  useEffect(() => {
    if (!firebaseUser) {
      const savedSessions = localStorage.getItem("prepmind_quiz_sessions");
      if (savedSessions) {
        try { setQuizSessions(JSON.parse(savedSessions)); } catch (e) { setQuizSessions({}); }
      } else {
        setQuizSessions({});
      }
      return;
    }

    const sessionsRef = collection(db, "users", firebaseUser.uid, "quizSessions");
    const unsubscribe = onSnapshot(sessionsRef, (snapshot) => {
      const sessionsMap: { [key: string]: { total: number; correct: number } } = {};
      snapshot.forEach(doc => {
        sessionsMap[doc.id] = doc.data() as { total: number; correct: number };
      });
      setQuizSessions(sessionsMap);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${firebaseUser.uid}/quizSessions`);
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  // Save to localStorage whenever state changes for guest offline support
  useEffect(() => {
    if (!firebaseUser) {
      localStorage.setItem("prepmind_kits", JSON.stringify(kits));
    }
  }, [kits, firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) {
      localStorage.setItem("prepmind_quiz_sessions", JSON.stringify(quizSessions));
    }
  }, [quizSessions, firebaseUser]);

  // Tracking dynamic active kit details
  const currentKit = kits.find(kit => kit.document.id === selectedKitId) || kits[0];

  // Statistics calculation
  const totalFlashcardsMastered = kits.reduce((acc, kit) => {
    return acc + kit.flashcards.filter(f => f.review_status === "mastered").length;
  }, 0);

  const calculateAverageQuizScore = () => {
    const sessions = Object.values(quizSessions) as { total: number; correct: number }[];
    if (sessions.length === 0) return 0;
    const totalCorrect = sessions.reduce((sum, s) => sum + s.correct, 0);
    const totalQuestions = sessions.reduce((sum, s) => sum + s.total, 0);
    return totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  };

  const quickStats = {
    totalFlashcardsMastered,
    averageQuizScore: calculateAverageQuizScore()
  };

  // Upload/Input states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiSource, setApiSource] = useState<"gemini" | "fallback" | null>(null);
  const [uploadError, setUploadError] = useState("");

  // File upload/drag-and-drop states
  const [isDragging, setIsDragging] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [fileProgressMsg, setFileProgressMsg] = useState("");
  const [loadedFileName, setLoadedFileName] = useState("");

  const handleFileExtraction = async (file: File) => {
    if (!file) return;
    
    const extension = file.name.split('.').pop()?.toLowerCase() || "";
    setIsReadingFile(true);
    setUploadError("");
    setFileProgressMsg("Analyzing file structure...");
    
    try {
      let extractedText = "";
      
      // Route extraction based on user's file format
      if (extension === "pdf") {
        extractedText = await extractTextFromPdf(file, (msg) => setFileProgressMsg(msg));
      } else if (extension === "docx" || extension === "doc") {
        extractedText = await extractTextFromDocx(file, (msg) => setFileProgressMsg(msg));
      } else if (["xlsx", "xls", "ods"].includes(extension)) {
        extractedText = await extractTextFromSpreadsheet(file, (msg) => setFileProgressMsg(msg));
      } else if (extension === "pptx" || extension === "ppt") {
        extractedText = await extractTextFromPowerPoint(file, (msg) => setFileProgressMsg(msg));
      } else if (["png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff"].includes(extension)) {
        extractedText = await extractTextFromImage(file, (msg) => setFileProgressMsg(msg));
      } else {
        // Fallback for code scripts (.py, .ts, .js, .json), Markdown (.md), tables (.csv), and general files
        setFileProgressMsg("Reading plain text contents...");
        extractedText = await extractTextFromTxt(file);
      }
      
      const cleanName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      // Capitalize first letters and replace hyphens/underscores with spaces cleanly
      const formattedTitle = cleanName
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      
      setPastedText(extractedText);
      setDocumentTitle(formattedTitle);
      setLoadedFileName(file.name);
      setFileProgressMsg("");
    } catch (err: any) {
      console.error("File extraction error:", err);
      setUploadError(err.message || "An error occurred while reading the file. Feel free to copy-paste core text manually instead.");
    } finally {
      setIsReadingFile(false);
    }
  };

  // Split-screen Viewer Active Inner Tab
  const [viewerTab, setViewerTab] = useState<'quick' | 'deep' | 'eli5'>('quick');

  // Study Hub Active Mode
  const [studyMode, setStudyMode] = useState<'flashcard' | 'quiz'>('flashcard');

  // Active Recall: Flashcard status
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Active Recall: Quiz states
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isQuizSubmitted, setIsQuizSubmitted] = useState(false);
  const [sessionCorrectCount, setSessionCorrectCount] = useState(0);
  const [isQuizFinished, setIsQuizFinished] = useState(false);

  // AI Tutor Chatbot States
  const [chatInputs, setChatInputs] = useState("");
  const [chatMode, setChatMode] = useState<'solver' | 'socratic'>('solver');
  const [messages, setMessages] = useState<{ [kitId: string]: ChatMessage[] }>({});
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // Dashboard Core Question Solver States
  const [dashboardQuestion, setDashboardQuestion] = useState("");
  const [dashboardCategory, setDashboardCategory] = useState("Chemistry");
  const [dashboardSolution, setDashboardSolution] = useState("");
  const [isDashboardSolving, setIsDashboardSolving] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  // Google Ads Placement States
  const [isInterstitialOpen, setIsInterstitialOpen] = useState(false);
  const [pendingAdCompletion, setPendingAdCompletion] = useState<(() => void) | null>(null);

  // Load cloud message threads if logged in with Google
  useEffect(() => {
    if (!firebaseUser || !selectedKitId || selectedKitId.startsWith("doc_photo") || selectedKitId.startsWith("doc_quad")) {
      return;
    }

    const messagesQuery = query(collection(db, "kits", selectedKitId, "messages"));
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const fetchedMsgs: ChatMessage[] = [];
      snapshot.forEach(doc => {
        fetchedMsgs.push(doc.data() as ChatMessage);
      });
      // Sort chronologically using creation sequence
      fetchedMsgs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      setMessages(prev => ({ ...prev, [selectedKitId]: fetchedMsgs }));
    }, (err) => {
      console.warn("Message subscription passive bypass:", err);
    });

    return () => unsubscribe();
  }, [firebaseUser, selectedKitId]);

  // Decode ISO timestamp for nice UI display
  const formatMessageTime = (timestampStr: string) => {
    if (!timestampStr) return "";
    try {
      if (timestampStr.includes("T")) {
        return new Date(timestampStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return timestampStr;
    } catch (e) {
      return timestampStr;
    }
  };

  // Get active messages list
  const currentMessages = messages[selectedKitId] || [
    {
      id: "welcome-msg",
      role: "model",
      text: chatMode === "solver"
        ? `Hello, Scholar! I am Master Solve AI, your multi-disciplinary academic problem solver. 🎓
        
Ask me any rigorous educational question—be it:
- 🧪 Chemistry: stoichiometry, pH calculations, balancing equations, thermodynamic reactions.
- 📐 E-Maths / Higher Maths: algebra, trigonometry, limits, derivatives, integration.
- ⚡ Physics: kinematics, mechanics, electric circuits, force vectors.
- 🧬 Biology: cell respiration, genetics, photosynthesis, biochemistry cascades.
- 📈 Economics: elasticities, cost curves, market utilities, trade forecasting.
- 💼 Costing and Accounting: variance calculations, balance sheets, break-even CVP analysis.

Submit your problem below, and I will show you a flawless, comprehensive step-by-step mathematical or logical solution!`
        : `Hello! I am Socrates, your personal study assistant. What questions or concepts from "${currentKit?.document.title || "this course"}" should we examine together today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ];

  // Socratic mini-hint question shown in general UI
  const getSocraticHint = () => {
    if (!currentKit) return "What concept shall we test today?";
    const terms = currentKit.summary.deep_dive_json.definitions;
    if (terms && terms.length > 0) {
      return `How would you describe "${terms[0].term}" in your own personalized way?`;
    }
    return "What is the primary relationship inside this document?";
  };

  // Scroll to bottom of chat
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, isChatLoading]);

  // Handle uploading/pasting study materials
  const handleGenerateMaterials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedText.trim()) {
      setUploadError("Please provide some educational text or document notes to analyze.");
      return;
    }

    setIsGenerating(true);
    setUploadError("");
    setApiSource(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: documentTitle || undefined,
          text: pastedText
        })
      });

      if (!response.ok) {
        throw new Error("Generation request failed. Utilizing offline fallback engine.");
      }

      const data = await response.json();
      if (data.studyKit) {
        const newKit: StudyKit = data.studyKit;

        if (firebaseUser) {
          try {
            // Save StudyKit to Firestore securely
            const kitRef = doc(db, "kits", newKit.document.id);
            await setDoc(kitRef, {
              id: newKit.document.id,
              ownerId: firebaseUser.uid,
              title: newKit.document.title,
              raw_text_content: newKit.document.raw_text_content,
              upload_date: newKit.document.upload_date,
              quick_read_json: newKit.summary.quick_read_json,
              deep_dive_json: newKit.summary.deep_dive_json,
              eli5_text: newKit.summary.eli5_text
            });

            // Save child Flashcards
            for (const fc of newKit.flashcards) {
              const fcRef = doc(db, "kits", newKit.document.id, "flashcards", fc.id);
              await setDoc(fcRef, {
                id: fc.id,
                document_id: newKit.document.id,
                question_text: fc.question_text,
                answer_text: fc.answer_text,
                review_status: fc.review_status,
                ownerId: firebaseUser.uid
              });
            }

            // Save child Quiz questions
            for (const qq of newKit.quizzes) {
              const qqRef = doc(db, "kits", newKit.document.id, "quizzes", qq.id);
              await setDoc(qqRef, {
                id: qq.id,
                document_id: newKit.document.id,
                question_text: qq.question_text,
                options_array: qq.options_array,
                correct_option_index: qq.correct_option_index,
                explanation: qq.explanation,
                ownerId: firebaseUser.uid
              });
            }
          } catch (serverErr) {
            handleFirestoreError(serverErr, OperationType.CREATE, `kits/${newKit.document.id}`);
          }
        } else {
          // Fallback cache
          setKits(prev => [newKit, ...prev]);
        }

        const completeAction = () => {
          setSelectedKitId(newKit.document.id);
          setApiSource(data.source);
          setIsUploadModalOpen(false);
          setPastedText("");
          setDocumentTitle("");
          setLoadedFileName("");
          
          // Switch to the newly built study workspace
          setActiveTab('viewer');
          setViewerTab('quick');
          setCardIndex(0);
          setIsFlipped(false);
          setQuizIndex(0);
          setSelectedOption(null);
          setIsQuizSubmitted(false);
          setSessionCorrectCount(0);
          setIsQuizFinished(false);
        };

        // Standard Interstitial Ad trigger after successful generation
        setPendingAdCompletion(() => completeAction);
        setIsInterstitialOpen(true);
      } else {
        throw new Error("No structured document payload returned.");
      }
    } catch (err: any) {
      console.error(err);
      setUploadError("Could not connect with study generator. Please check your networks and try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Flashcard review status updates
  const markCardStatus = async (cardId: string, status: 'learning' | 'mastered') => {
    // 1. Local state update
    setKits(prev => prev.map(kit => {
      if (kit.document.id === selectedKitId) {
        const updatedFlashcards = kit.flashcards.map(fc => {
          if (fc.id === cardId) {
            return { ...fc, review_status: status };
          }
          return fc;
        });
        return { ...kit, flashcards: updatedFlashcards };
      }
      return kit;
    }));

    // 2. Cloud Firestore write if authenticated
    if (firebaseUser) {
      try {
        const cardRef = doc(db, "kits", selectedKitId, "flashcards", cardId);
        await updateDoc(cardRef, { review_status: status });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `kits/${selectedKitId}/flashcards/${cardId}`);
      }
    }

    // Transition to next card gracefully after short delay
    setTimeout(() => {
      if (currentKit && cardIndex < currentKit.flashcards.length - 1) {
        setCardIndex(c => c + 1);
        setIsFlipped(false);
      }
    }, 200);
  };

  // Handle Quiz answer selections
  const submitQuizAnswer = () => {
    if (selectedOption === null || !currentKit) return;
    
    // Check correctness
    const currentQuestion = currentKit.quizzes[quizIndex];
    const isCorrect = selectedOption === currentQuestion.correct_option_index;
    if (isCorrect) {
      setSessionCorrectCount(c => c + 1);
    }

    setIsQuizSubmitted(true);
  };

  const nextQuizQuestion = async () => {
    if (!currentKit) return;
    
    if (quizIndex < currentKit.quizzes.length - 1) {
      setQuizIndex(q => q + 1);
      setSelectedOption(null);
      setIsQuizSubmitted(false);
    } else {
      // Quiz completed! Save overall progress and scores
      const totalCorrect = sessionCorrectCount + (selectedOption === currentKit.quizzes[quizIndex].correct_option_index ? 1 : 0);
      const totalQuestions = currentKit.quizzes.length;
      
      setQuizSessions(prev => ({
        ...prev,
        [selectedKitId]: { total: totalQuestions, correct: totalCorrect }
      }));

      // Cloud Firestore write block
      if (firebaseUser) {
        try {
          const sessionRef = doc(db, "users", firebaseUser.uid, "quizSessions", selectedKitId);
          await setDoc(sessionRef, { total: totalQuestions, correct: totalCorrect });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}/quizSessions/${selectedKitId}`);
        }
      }

      const finishAction = () => {
        setIsQuizFinished(true);
      };

      setPendingAdCompletion(() => finishAction);
      setIsInterstitialOpen(true);
    }
  };

  const restartQuiz = () => {
    setQuizIndex(0);
    setSelectedOption(null);
    setIsQuizSubmitted(false);
    setSessionCorrectCount(0);
    setIsQuizFinished(false);
  };

  // Handle Socratic chatbot answers
  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInputs.trim()) return;

    const userMsgText = chatInputs;
    setChatInputs("");

    const newMsg: ChatMessage = {
      id: "msg_" + Math.random().toString(36).substr(2, 9),
      role: 'user',
      text: userMsgText,
      timestamp: new Date().toISOString()
    };

    // Save user message to Cloud Firestore if signed in
    if (firebaseUser && !selectedKitId.startsWith("doc_photo") && !selectedKitId.startsWith("doc_quad")) {
      try {
        const msgRef = doc(db, "kits", selectedKitId, "messages", newMsg.id);
        await setDoc(msgRef, newMsg);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `kits/${selectedKitId}/messages/${newMsg.id}`);
      }
    } else {
      // Offline local append
      setMessages(prev => {
        const activeList = prev[selectedKitId] || [
          {
            id: "welcome-msg",
            role: "model",
            text: chatMode === "solver"
              ? `Hello, Scholar! I am Master Solve AI, your multi-disciplinary academic problem solver. 🎓
              
Submit any chemistry, physics, math, biology, economics, or costing question, and I'll lay out a beautiful, complete, step-by-step solution!`
              : `Hello! I am Socrates, your personal study assistant. What questions or concepts from "${currentKit?.document.title || "this course"}" should we examine together today?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ];
        return {
          ...prev,
          [selectedKitId]: [...activeList, newMsg]
        };
      });
    }

    setIsChatLoading(true);

    try {
      const historyToSend = currentMessages.concat(newMsg).map(m => ({
        role: m.role,
        text: m.text
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsgText,
          contextDoc: currentKit ? currentKit.document : null,
          chatHistory: historyToSend,
          chatMode: chatMode
        })
      });

      if (!res.ok) {
        throw new Error("Chat api failed");
      }

      const data = await res.json();
      
      const modelMsg: ChatMessage = {
        id: "msg_model_" + Math.random().toString(36).substr(2, 9),
        role: 'model',
        text: data.responseText,
        timestamp: new Date().toISOString()
      };

      // Save model reply to Cloud Firestore if signed in
      if (firebaseUser && !selectedKitId.startsWith("doc_photo") && !selectedKitId.startsWith("doc_quad")) {
        try {
          const msgRef = doc(db, "kits", selectedKitId, "messages", modelMsg.id);
          await setDoc(msgRef, modelMsg);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `kits/${selectedKitId}/messages/${modelMsg.id}`);
        }
      } else {
        setMessages(prev => {
          const activeList = prev[selectedKitId] || [];
          return {
            ...prev,
            [selectedKitId]: [...activeList, modelMsg]
          };
        });
      }

    } catch (err) {
      console.error(err);
      // Fallback socratic diagnostic feedback
      const sampleText = `What component of that idea seems most unclear to you? Let's take a closer look at "${currentKit?.document.title}" and verify how it behaves under close analysis.`;
      const fallbackMsg: ChatMessage = {
        id: "msg_fallback_" + Math.random().toString(36).substr(2, 9),
        role: 'model',
        text: sampleText,
        timestamp: new Date().toISOString()
      };

      if (firebaseUser && !selectedKitId.startsWith("doc_photo") && !selectedKitId.startsWith("doc_quad")) {
        try {
          const msgRef = doc(db, "kits", selectedKitId, "messages", fallbackMsg.id);
          await setDoc(msgRef, fallbackMsg);
        } catch (serverErr) {
          console.warn(serverErr);
        }
      } else {
        setMessages(prev => {
          const activeList = prev[selectedKitId] || [];
          return {
            ...prev,
            [selectedKitId]: [...activeList, fallbackMsg]
          };
        });
      }
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleDashboardSolve = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!dashboardQuestion.trim()) return;

    setIsDashboardSolving(true);
    setDashboardError("");
    setDashboardSolution("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Solve this ${dashboardCategory} problem: ${dashboardQuestion}`,
          contextDoc: currentKit ? currentKit.document : null,
          chatHistory: [],
          chatMode: "solver"
        })
      });

      if (!response.ok) {
        throw new Error("Failed to reach the solver engine. Please try again.");
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setDashboardSolution(data.responseText);
    } catch (err: any) {
      console.error("Dashboard Solver Error:", err);
      setDashboardError(err.message || "An unexpected error occurred while computing the solution.");
    } finally {
      setIsDashboardSolving(false);
    }
  };

  const transferSolutionToChat = async () => {
    if (!dashboardSolution) return;
    
    const userMsgText = `Request: Solve this ${dashboardCategory} question: ${dashboardQuestion}`;
    const modelMsgText = dashboardSolution;

    const userMsg: ChatMessage = {
      id: "msg_dash_q_" + Math.random().toString(36).substr(2, 9),
      role: 'user',
      text: userMsgText,
      timestamp: new Date().toISOString()
    };

    const modelMsg: ChatMessage = {
      id: "msg_dash_a_" + Math.random().toString(36).substr(2, 9),
      role: 'model',
      text: modelMsgText,
      timestamp: new Date().toISOString()
    };

    // Save to Cloud Firestore if signed in
    if (firebaseUser && !selectedKitId.startsWith("doc_photo") && !selectedKitId.startsWith("doc_quad")) {
      try {
        const uMsgRef = doc(db, "kits", selectedKitId, "messages", userMsg.id);
        const mMsgRef = doc(db, "kits", selectedKitId, "messages", modelMsg.id);
        await setDoc(uMsgRef, userMsg);
        await setDoc(mMsgRef, modelMsg);
      } catch (err) {
        console.error("Error storing transferred chat to firestore:", err);
      }
    } else {
      setMessages(prev => {
        const activeList = prev[selectedKitId] || [];
        return {
          ...prev,
          [selectedKitId]: [...activeList, userMsg, modelMsg]
        };
      });
    }

    // Set Chat Tab Active, Socratic Chat Mode to "solver" so it fits nicely
    setChatMode('solver');
    setActiveTab('chat');
  };

  // Quick helper to handle pre-populated trigger clicks
  const loadPreBuiltSample = (id: string) => {
    setSelectedKitId(id);
    setCardIndex(0);
    setIsFlipped(false);
    setQuizIndex(0);
    setSelectedOption(null);
    setIsQuizSubmitted(false);
    setSessionCorrectCount(0);
    setIsQuizFinished(false);
    setActiveTab('viewer');
  };

  return (
    <div className="w-full min-h-screen bg-[#1A1D29] text-slate-100 flex overflow-x-hidden relative" id="prepmind-app-root">
      
      {/* Sidebar Navigation */}
      <nav className="w-16 md:w-20 bg-slate-900/60 border-r border-slate-800/80 flex flex-col items-center py-6 gap-8 shrink-0 select-none z-10" id="sidebar-nav">
        {/* Logo Icon */}
        <div 
          className="w-11 h-11 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/10 cursor-pointer hover:scale-105 transition-all"
          onClick={() => setActiveTab('dashboard')}
          title="PrepMind AI Hub"
          id="logo-button"
        >
          <Brain className="w-6 h-6 text-white" />
        </div>

        {/* Tab Items */}
        <div className="flex flex-col gap-4 w-full px-2" id="nav-items-container">
          <button 
            id="nav-tab-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`p-3 rounded-xl transition-all flex justify-center items-center group relative ${
              activeTab === 'dashboard' 
                ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' 
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
            title="Dashboard"
          >
            <BookOpen className="w-5 h-5" />
            <span className="absolute left-full ml-3 px-2 py-1 bg-slate-900 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
              Dashboard
            </span>
          </button>

          <button 
            id="nav-tab-viewer"
            onClick={() => {
              setActiveTab('viewer');
              setCardIndex(0);
              setIsFlipped(false);
            }}
            className={`p-3 rounded-xl transition-all flex justify-center items-center group relative ${
              activeTab === 'viewer' 
                ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' 
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
            title="Study Summaries"
          >
            <FileText className="w-5 h-5" />
            <span className="absolute left-full ml-3 px-2 py-1 bg-slate-900 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
              Study Summaries
            </span>
          </button>

          <button 
            id="nav-tab-study"
            onClick={() => {
              setActiveTab('study_hub');
              setCardIndex(0);
              setIsFlipped(false);
            }}
            className={`p-3 rounded-xl transition-all flex justify-center items-center group relative ${
              activeTab === 'study_hub' 
                ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' 
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
            title="Recall & Quiz Hub"
          >
            <BookOpenCheck className="w-5 h-5" />
            <span className="absolute left-full ml-3 px-2 py-1 bg-slate-900 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
              Active Recall Hub (Flashcards/Quizzes)
            </span>
          </button>

          <button 
            id="nav-tab-chat"
            onClick={() => setActiveTab('chat')}
            className={`p-3 rounded-xl transition-all flex justify-center items-center group relative ${
              activeTab === 'chat' 
                ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' 
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
            title="Socratic Tutor Chat"
          >
            <MessageSquare className="w-5 h-5" />
            <span className="absolute left-full ml-3 px-2 py-1 bg-slate-900 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
              Socratic AI Tutor
            </span>
          </button>
        </div>

        {/* Info label and diagnostic details */}
        <div className="mt-auto flex flex-col items-center gap-3 w-full px-2" id="sidebar-footer">
          {isAuthLoading ? (
            <div className="w-5 h-5 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
          ) : firebaseUser ? (
            <div className="flex flex-col items-center gap-2 w-full">
              <div 
                className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs select-none uppercase tracking-wide border border-indigo-400/30 font-mono"
                title={`Signed in as ${firebaseUser.email}`}
              >
                {firebaseUser.displayName?.charAt(0) || firebaseUser.email?.charAt(0) || "S"}
              </div>
              <button 
                onClick={logoutUser}
                className="text-[10px] text-slate-500 hover:text-red-400 transition-colors font-semibold font-sans tracking-wide"
                title="Logout from Cloud Sync"
              >
                Log Out
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleLogin}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white transition-all flex items-center justify-center group relative shadow-md cursor-pointer active:scale-95"
              title="Sign in with Google to enable cloud backup"
            >
              <UserCheck className="w-4.5 h-4.5 text-slate-400 group-hover:text-blue-400 transition-colors" />
              <span className="absolute left-full ml-3 px-2 py-1 bg-slate-900 text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none font-sans">
                Sign in with Google
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* Main Container Workspace */}
      <main className="flex-1 min-w-0 flex flex-col p-6 overflow-y-auto" id="main-workspace-scroll">
        
        {/* Transparent Header */}
        <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 pb-6 border-b border-white/5 gap-4" id="header-section">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium tracking-wide">
                Active Recall Engine v3.5
              </span>
              {apiSource && (
                <span className="text-[10px] text-amber-400 italic">
                  ({apiSource === "gemini" ? "AI Generated Study Kit" : "Local Synthesis"})
                </span>
              )}
              {firebaseUser ? (
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 font-medium tracking-wide flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                  Cloud Synced ({firebaseUser.email})
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-medium tracking-wide flex items-center gap-1" onClick={handleGoogleLogin} style={{ cursor: 'pointer' }}>
                  Guest State (Click to Cloud Sync)
                </span>
              )}
            </div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight flex items-center gap-2">
              PrepMind AI 
              <Sparkle className="w-5 h-5 text-amber-400" />
            </h1>
            <p className="text-slate-400 text-xs">Transform dense lecture materials, textbooks, or summaries into cognitive study suites instantly</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-stretch lg:self-auto justify-between lg:justify-start">
            {/* Streak indicator */}
            <div className="flex gap-2 items-center bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl shadow-inner select-none animate-fadeIn" id="streak-indicator">
              <div className="w-2.5 h-2.5 bg-[#10B981] rounded-full animate-pulse"></div>
              <span className="text-xs font-semibold text-[#10B981]">14 Day Study Streak</span>
            </div>

            {/* Connection sync log actions list */}
            {!firebaseUser && (
              <button 
                onClick={handleGoogleLogin}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3.5 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all outline-none"
              >
                Sign in with Google
              </button>
            )}

            {/* Upload Trigger Button */}
            <button 
              id="btn-upload-new"
              onClick={() => setIsUploadModalOpen(true)}
              className="bg-[#3B82F6] hover:bg-blue-600 text-white px-4 py-2 text-xs md:text-sm font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all whitespace-nowrap active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Upload Material
            </button>
          </div>
        </header>

        {authError && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between text-amber-400 text-xs animate-fadeIn shadow-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-amber-500 animate-pulse" />
              <span>{authError}</span>
            </div>
            <button 
              onClick={() => setAuthError(null)}
              className="text-slate-400 hover:text-white font-bold ml-2 px-2.5 py-1 hover:bg-white/5 rounded-lg transition-all text-[11px]"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* PAGE CONTENT SWITCHER */}
        <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col" id="applet-view-render">
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="animate-fadeIn space-y-8" id="dashboard-tab-content">
              {/* Dynamic stats header component */}
              <DashboardStats stats={quickStats} totalDocuments={kits.length} />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left/Middle Column (Materials lists) */}
                <div className="lg:col-span-2 space-y-6" id="dashboard-col-left">
                  {/* Dedicated AI Academic Problem Solver space */}
                  <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900/65 border border-indigo-500/20 rounded-2xl p-6 shadow-xl space-y-4" id="dashboard-academic-solver">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/15">
                        <Sparkles className="w-5.2 h-5.2" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                          Interactive AI Problem Solver <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded font-mono font-medium uppercase border border-blue-500/20">Direct Engine</span>
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">Get flawless, step-by-step calculations and conceptual reasoning for any strict educational question.</p>
                      </div>
                    </div>

                    <form onSubmit={handleDashboardSolve} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">1. Enter Your Academic Question</label>
                        <textarea
                          rows={3}
                          value={dashboardQuestion}
                          onChange={(e) => setDashboardQuestion(e.target.value)}
                          placeholder="Type or paste Chemistry, Physics, Maths (E-maths/Higher maths), Biology, Economics or Costing accounting questions here..."
                          className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl p-3.5 text-xs sm:text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <div className="space-y-1.5 flex-1 max-w-sm">
                          <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">2. Select Subject Domain</label>
                          <div className="relative">
                            <select
                              value={dashboardCategory}
                              onChange={(e) => setDashboardCategory(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500 appearance-none cursor-pointer"
                            >
                              <option value="Chemistry">🧪 Chemistry (equilibrium, formulas, pH, stoichiometry)</option>
                              <option value="Physics">⚡ Physics (kinematics, electricity, optics, forces, waves)</option>
                              <option value="Maths">📐 Maths / E-Maths (calculus, equations, geometry, statistics)</option>
                              <option value="Biology">🧬 Biology (cell structures, replication cycles, physiology)</option>
                              <option value="Economics">📈 Economics (elasticity, utilities, macro policies, GDP)</option>
                              <option value="Costing">💼 Costing and Accounting (variance analysis, CVP ledger, margins)</option>
                              <option value="General academic helper">✏️ General Academic Query</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                              <ChevronDown className="w-4 h-4" />
                            </div>
                          </div>
                        </div>

                        <button
                          type="submit"
                          id="btn-compute-solution"
                          disabled={isDashboardSolving || !dashboardQuestion.trim()}
                          className="sm:self-end h-9.5 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {isDashboardSolving ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              <span>Solving Problem...</span>
                            </>
                          ) : (
                            <>
                              <ArrowRight className="w-3.5 h-3.5" />
                              <span>Compute Solution</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>

                    {/* Display Error if any */}
                    {dashboardError && (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-xs p-3.5 rounded-xl">
                        {dashboardError}
                      </div>
                    )}

                    {/* Displays Solution in Beautiful Interactive Box */}
                    {dashboardSolution && (
                      <div className="bg-slate-950/80 border border-indigo-500/20 rounded-xl p-4 sm:p-5 space-y-4" id="dashboard-solution-box">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Solution Formulated successfully</span>
                          </div>
                          <div className="flex items-center gap-1.5 animate-fadeIn">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(dashboardSolution);
                                alert("Solution copied to clipboard!");
                              }}
                              className="px-2.5 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-slate-300 rounded font-medium transition"
                            >
                              Copy Solution
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDashboardSolution("");
                                setDashboardQuestion("");
                              }}
                              className="px-2.5 py-1 text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded font-medium transition"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        {/* Beautifully wrapped mathematical structured layout */}
                        <div className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap select-text max-h-[450px] overflow-y-auto pr-1">
                          {dashboardSolution}
                        </div>

                        <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide block">Need follow-up explanations?</span>
                            <span className="text-[10px] text-slate-400">Export this problem and solution to the active chat workspace to discuss with Master Solve AI.</span>
                          </div>
                          <button
                            type="button"
                            onClick={transferSolutionToChat}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Discuss with Tutor</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 shadow-xl" id="materials-manager">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">Active Subjects & Documents</h2>
                        <p className="text-xs text-slate-400 mt-1">Select any subject below to open the custom generated study environment.</p>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        {kits.length} items loaded
                      </span>
                    </div>

                    <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
                      {kits.map((kit) => {
                        const isSelected = kit.document.id === selectedKitId;
                        const cardCount = kit.flashcards.length;
                        const quizCount = kit.quizzes.length;
                        const masteredCount = kit.flashcards.filter(f => f.review_status === "mastered").length;

                        return (
                          <div 
                            key={kit.document.id}
                            id={`subject-item-${kit.document.id}`}
                            onClick={() => {
                              setSelectedKitId(kit.document.id);
                              // Automatically show summaries when clicked
                              setActiveTab('viewer');
                            }}
                            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                              isSelected 
                                ? 'bg-blue-500/10 border-blue-500/40 shadow-lg shadow-blue-500/5' 
                                : 'bg-slate-800/30 border-white/5 hover:border-white/10 hover:bg-slate-800/50'
                            }`}
                          >
                            <div className="space-y-1">
                              <span className="text-[10px] px-2 py-0.5 rounded-md font-mono font-bold bg-white/5 text-slate-300">
                                {kit.document.upload_date}
                              </span>
                              <h3 className="font-bold text-slate-100 flex items-center gap-2 mt-1">
                                {kit.document.title}
                                {isSelected && <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>}
                              </h3>
                              <p className="text-xs text-slate-400 line-clamp-1 max-w-xl">
                                {kit.document.raw_text_content}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right hidden sm:block">
                                <div className="text-xs font-semibold text-slate-300">
                                  {masteredCount}/{cardCount} Mastered Cards
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {quizCount} Quiz Questions
                                </div>
                              </div>
                              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-300 hover:bg-blue-500/20 hover:text-blue-400 transition-colors">
                                <ChevronRight className="w-4 h-4" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-white/5 mt-5 pt-4 flex justify-between items-center bg-slate-800/10 -mx-6 -mb-6 p-6 rounded-b-2xl">
                      <span className="text-xs text-slate-400">Did not see your course? Paste any note instantly:</span>
                      <button 
                        id="btn-trigger-upload text-xs"
                        onClick={() => setIsUploadModalOpen(true)}
                        className="text-xs text-blue-400 font-semibold hover:text-blue-300 flex items-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create Study Material
                      </button>
                    </div>
                  </div>

                  {/* Socratic Hint Banner */}
                  <div className="bg-gradient-to-r from-blue-900/10 to-indigo-900/25 border border-blue-500/10 rounded-2xl p-5 shadow-lg flex items-center gap-4">
                    <div className="w-11 h-11 bg-blue-500/15 rounded-xl flex items-center justify-center text-blue-400 shrink-0">
                      <Sparkles className="w-5.5 h-5.5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Socratic Suggestion: Active Retrieval</div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed italic">
                        "{getSocraticHint()}"
                      </p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('chat')}
                      className="ml-auto text-xs bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 font-semibold px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all"
                    >
                      Ask Socrates
                    </button>
                  </div>
                </div>

                {/* Right Column (Instructions & Quick Study Prompt) */}
                <div className="space-y-6" id="dashboard-col-right">
                  {/* Quick-select study shortcuts */}
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 shadow-xl" id="study-hub-dashboard">
                    <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4">Quick Study Launchpads</h2>
                    
                    <div className="space-y-3">
                      <div 
                        onClick={() => {
                          setStudyMode('flashcard');
                          setActiveTab('study_hub');
                        }}
                        className="p-3.5 bg-slate-800/20 border border-white/5 rounded-xl hover:bg-slate-800/40 hover:border-slate-700 transition-all cursor-pointer flex items-center gap-3"
                      >
                        <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                          <RotateCw className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-white">Active Recall Flashcards</h3>
                          <p className="text-[10px] text-slate-400 mt-0.5">Quick swipeable Q&A testing</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500 ml-auto" />
                      </div>

                      <div 
                        onClick={() => {
                          setStudyMode('quiz');
                          setActiveTab('study_hub');
                          restartQuiz();
                        }}
                        className="p-3.5 bg-slate-800/20 border border-white/5 rounded-xl hover:bg-slate-800/40 hover:border-slate-700 transition-all cursor-pointer flex items-center gap-3"
                      >
                        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-white">Exam Practice Quizzes</h3>
                          <p className="text-[10px] text-slate-400 mt-0.5">Test mastery on options</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500 ml-auto" />
                      </div>

                      <div 
                        onClick={() => setActiveTab('chat')}
                        className="p-3.5 bg-slate-800/20 border border-white/5 rounded-xl hover:bg-slate-800/40 hover:border-slate-700 transition-all cursor-pointer flex items-center gap-3"
                      >
                        <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-white">Interactive Socratic Tutor</h3>
                          <p className="text-[10px] text-slate-400 mt-0.5">Deep conversation checking details</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500 ml-auto" />
                      </div>
                    </div>
                  </div>

                  {/* Active Course Status */}
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 shadow-xl relative overflow-hidden" id="dashboard-status-card">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold tracking-wider uppercase text-blue-400">Target Session Goal</span>
                      <TrendingUp className="w-4.5 h-4.5 text-blue-400" />
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span>Study Goal Progress</span>
                          <span>{totalFlashcardsMastered} / 12 Mastered</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-[#10B981] h-full rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(100, (totalFlashcardsMastered / 12) * 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-400 leading-relaxed pt-2 border-t border-white/5">
                        <span className="text-emerald-400 font-bold font-mono">Tip:</span> Research proves self-testing (like quizzes and active flashcards) increases long-term exam retention by up to <span className="text-white font-bold">150%</span> over passive highlight reading.
                      </div>
                    </div>
                  </div>

                </div>
              </div>
              
              {/* Google Adsense Horizontal Banner Ad Placeholder */}
              <GoogleBannerAd />
            </div>
          )}

          {/* TAB 2: DOCUMENT VIEWER & SUMMARY SUITE (SPLIT-SCREEN) */}
          {activeTab === 'viewer' && (
            <div className="animate-fadeIn flex-1 flex flex-col gap-6" id="viewer-tab-content">
              {/* Top subject selector indicator */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-800/40 border border-slate-700/50 p-4 rounded-2xl">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Currently studying</span>
                  <p className="text-base font-bold text-white mt-0.5">{currentKit?.document.title}</p>
                </div>
                
                {/* Subjects dropdown inside study zone */}
                <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
                  <span className="text-xs text-slate-400 hidden md:inline">Change subject:</span>
                  <select 
                    id="subject-dropdown"
                    value={selectedKitId}
                    onChange={(e) => {
                      setSelectedKitId(e.target.value);
                      setCardIndex(0);
                      setIsFlipped(false);
                      setQuizIndex(0);
                      setSelectedOption(null);
                      setIsQuizSubmitted(false);
                      setSessionCorrectCount(0);
                      setIsQuizFinished(false);
                    }}
                    className="bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500 w-full sm:w-auto"
                  >
                    {kits.map(k => (
                      <option key={k.document.id} value={k.document.id}>
                        {k.document.title}
                      </option>
                    ))}
                  </select>

                  {/* Export PDF Button */}
                  <button
                    onClick={() => exportStudyKitToPDF(currentKit)}
                    title="Export study kit summaries and definitions to a printable PDF"
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500/50 rounded-xl transition-all shadow-md focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0 cursor-pointer active:scale-95"
                    id="export-pdf-btn"
                  >
                    <FileDown className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>

              {/* Split Screen Grid Layout */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
                
                {/* Left Split Side: Uploaded Document View (5 columns) */}
                <div 
                  className="lg:col-span-5 bg-white text-slate-900 rounded-3xl p-6 md:p-8 flex flex-col border border-slate-200 shadow-xl overflow-hidden"
                  id="source-document-panel"
                >
                  <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span className="bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                        Source Text
                      </span>
                      <span className="text-slate-700 font-bold text-xs truncate max-w-[180px]" id="doc-title-badge">
                        {currentKit?.document.title || "Subject.txt"}
                      </span>
                    </div>
                    <div className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">{currentKit?.document.upload_date}</span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-4 text-slate-700 leading-relaxed pr-1" id="document-text-content">
                    <h2 className="text-2xl font-display font-bold text-slate-900 leading-tight">
                      {currentKit?.document.title}
                    </h2>
                    
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {currentKit?.document.raw_text_content || "No textbook or notes content provided."}
                    </p>

                    {/* Socratic callout box at base of source pdf notes */}
                    <div className="mt-8 p-4 rounded-2xl bg-neutral-50 border border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                        Retentive Socratic Target
                      </div>
                      <div className="text-xs text-slate-600 italic">
                        "If you read this passage, verify what parts are key logic drivers. Can you rephrase them clearly?"
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Split Side: Tabs & Interactive Summary Suite (7 columns) */}
                <div 
                  className="lg:col-span-7 flex flex-col gap-5"
                  id="study-panel-suite"
                >
                  {/* Summary Tabs Header */}
                  <div className="bg-slate-900/40 border border-slate-800 p-1.5 rounded-2xl flex gap-2" id="summary-tabs">
                    <button 
                      id="tab-quick-read"
                      onClick={() => setViewerTab('quick')}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                        viewerTab === 'quick' 
                          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Quick Read (Bullet points)
                    </button>
                    <button 
                      id="tab-deep-dive"
                      onClick={() => setViewerTab('deep')}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                        viewerTab === 'deep' 
                          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Deep Dive (Notes & formulas)
                    </button>
                    <button 
                      id="tab-eli5"
                      onClick={() => setViewerTab('eli5')}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                        viewerTab === 'eli5' 
                          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      ELI5 Analogy
                    </button>
                  </div>

                  {/* Summary Dynamic Workspace content container */}
                  <div className="flex-1 bg-slate-800/40 border border-slate-700/50 rounded-3xl p-6 md:p-8 flex flex-col justify-between overflow-y-auto min-h-[400px]">
                    
                    {/* VIEW: QUICK READ */}
                    {viewerTab === 'quick' && (
                      <div className="space-y-5 animate-fadeIn" id="quick-read-content">
                        <div>
                          <div className="text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-1">Interactive Digest</div>
                          <h3 className="text-lg font-bold text-white">Summary Bullet Points</h3>
                        </div>

                        <ul className="space-y-4">
                          {currentKit?.summary.quick_read_json.map((point, index) => (
                            <li key={index} className="flex gap-3 text-sm text-slate-300 leading-relaxed">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/25 flex items-center justify-center font-mono text-[10px] text-blue-400 font-bold">
                                {index + 1}
                              </span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* VIEW: DEEP DIVE NOTES & FORMULAS */}
                    {viewerTab === 'deep' && (
                      <div className="space-y-6 animate-fadeIn" id="deep-dive-content">
                        {/* Section 1: Detailed Structured Notes */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Structured Master Notes</h4>
                          <ul className="space-y-2">
                            {currentKit?.summary.deep_dive_json.notes.map((note, index) => (
                              <li key={index} className="text-sm text-slate-300 leading-relaxed flex items-start gap-2">
                                <span className="text-blue-500 select-none mt-1">•</span>
                                <span>{note}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Section 2: Mathematical formulas (Only if available in kit) */}
                        {currentKit?.summary.deep_dive_json.formulas && currentKit.summary.deep_dive_json.formulas.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Key Equation Formulas & Laws</h4>
                            <div className="grid grid-cols-1 gap-2">
                              {currentKit.summary.deep_dive_json.formulas.map((formula, index) => (
                                <div key={index} className="p-3 bg-slate-900/60 border border-amber-500/10 rounded-xl font-mono text-xs text-amber-300">
                                  {formula}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Section 3: Essential study definitions */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Extracted Subject Definitions</h4>
                          <div className="grid grid-cols-1 gap-3">
                            {currentKit?.summary.deep_dive_json.definitions.map((def, index) => (
                              <div key={index} className="p-3.5 bg-slate-900/40 border border-slate-700 rounded-xl space-y-1">
                                <span className="text-xs font-bold text-white block underline decoration-emerald-500/40">
                                  {def.term}
                                </span>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                  {def.definition}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* VIEW: ELI5 CONCEPT ANALOGY */}
                    {viewerTab === 'eli5' && (
                      <div className="space-y-5 animate-fadeIn flex flex-col justify-center h-full text-center py-6" id="eli5-view-content">
                        <div className="mx-auto w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mb-2">
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-amber-400 text-[10px] font-bold uppercase tracking-widest mb-1">Explain Like I'm 5 (Analogy Mode)</div>
                          <h3 className="text-lg font-bold text-white">Complex Science Simplified</h3>
                        </div>

                        <p className="text-sm text-slate-300 leading-relaxed max-w-xl mx-auto italic bg-slate-900/30 p-5 border border-white/5 rounded-2xl">
                          "{currentKit?.summary.eli5_text || "Preparing custom simple analogy..."}"
                        </p>

                        <div className="text-[10px] text-slate-500 font-mono">
                          Designed with cognitive science to replace memorization blockages with immediate physical models.
                        </div>
                      </div>
                    )}

                    {/* Bottom Prompt Study launcher */}
                    <div className="border-t border-white/5 mt-8 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-white font-semibold">Ready to challenge your memory?</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Test with flashcards or practize the quiz now.</p>
                      </div>

                      <div className="flex gap-2 w-full sm:w-auto">
                        <button 
                          onClick={() => {
                            setStudyMode('flashcard');
                            setActiveTab('study_hub');
                          }}
                          className="flex-1 sm:flex-initial bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 text-xs rounded-xl border border-slate-700 transition"
                        >
                          Cards Mode
                        </button>
                        <button 
                          onClick={() => {
                            setStudyMode('quiz');
                            setActiveTab('study_hub');
                            restartQuiz();
                          }}
                          className="flex-1 sm:flex-initial bg-[#3B82F6] text-white px-4 py-1.5 text-xs font-semibold rounded-xl"
                        >
                          Take Practice Quiz
                        </button>
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: STUDY HUB (FLASHCARDS & MULTIPLE-CHOICE QUIZZES) */}
          {activeTab === 'study_hub' && (
            <div className="animate-fadeIn flex-1 flex flex-col gap-6" id="study-hub-tab-content">
              
              {/* Study Mode Toggle Switch (Flashcard vs Quiz) */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-800/40 border border-slate-700/50 p-4 rounded-2xl">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Subject Selection</span>
                  <p className="text-base font-bold text-white truncate max-w-sm mt-0.5" id="study-mode-heading">
                    {currentKit?.document.title} — Active Recall Hub
                  </p>
                </div>

                <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl w-full sm:w-auto" id="hub-mode-selector">
                  <button 
                    id="btn-flashcard-mode"
                    onClick={() => {
                      setStudyMode('flashcard');
                      setCardIndex(0);
                      setIsFlipped(false);
                    }}
                    className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      studyMode === 'flashcard' 
                        ? 'bg-blue-500 text-white' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Flashcards
                  </button>
                  <button 
                    id="btn-quiz-mode"
                    onClick={() => {
                      setStudyMode('quiz');
                      restartQuiz();
                    }}
                    className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      studyMode === 'quiz' 
                        ? 'bg-blue-500 text-white' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Practice Quiz
                  </button>
                </div>
              </div>

              {/* STUDY MODE CONTAINER 1: FLASHCARDS */}
              {studyMode === 'flashcard' && (
                <div className="flex flex-col items-center justify-center max-w-2xl mx-auto w-full py-6 space-y-6" id="flashcard-workspace">
                  
                  {/* Current index indicator with Mastered vs Learning summary stats */}
                  <div className="flex justify-between items-center w-full text-xs text-slate-400 px-1">
                    <span className="font-mono">
                      Card {cardIndex + 1} of {currentKit?.flashcards.length || 0}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                      {currentKit?.flashcards.filter(f => f.review_status === "mastered").length || 0} Mastered
                    </span>
                  </div>

                  {/* FLIP CARD AREA COG */}
                  {currentKit && currentKit.flashcards.length > 0 ? (
                    <div className="w-full" id="active-flashcard-game">
                      
                      {/* Swipeable card container */}
                      <div 
                        id={`flashcard-item-${currentKit.flashcards[cardIndex].id}`}
                        onClick={() => setIsFlipped(!isFlipped)}
                        className="w-full h-80 perspective-1000 cursor-pointer group"
                      >
                        <div 
                          className={`w-full h-full relative duration-500 transform-style-3d transition-transform ${
                            isFlipped ? 'rotate-y-180' : ''
                          }`}
                        >
                          {/* FRONT SIDE (Question / Term) */}
                          <div className="absolute inset-0 bg-white text-slate-900 rounded-3xl p-6 md:p-8 flex flex-col justify-between border border-slate-200 shadow-2xl backface-hidden">
                            <div className="flex justify-between items-center text-slate-400">
                              <span className="text-[10px] font-bold tracking-widest uppercase text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md">
                                FRONT (TERM or QUESTION)
                              </span>
                              <div className="p-1 px-2 rounded-full border border-slate-200 text-[10px] font-bold text-slate-500">
                                {currentKit.flashcards[cardIndex].review_status.toUpperCase()}
                              </div>
                            </div>

                            <div className="flex-1 flex items-center justify-center text-center py-6">
                              <h3 className="text-xl md:text-2xl font-display font-bold text-slate-900 px-4">
                                {currentKit.flashcards[cardIndex].question_text}
                              </h3>
                            </div>

                            <div className="text-center text-slate-400 text-xs flex items-center justify-center gap-1.5">
                              <RotateCw className="w-3.5 h-3.5 animate-pulse" />
                              <span>Click card to reveal definition answer</span>
                            </div>
                          </div>

                          {/* BACK SIDE (Answer / Definition) */}
                          <div className="absolute inset-0 bg-slate-900 border border-slate-700 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-2xl backface-hidden rotate-y-180 text-white">
                            <div className="flex justify-between items-center text-slate-500">
                              <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-md">
                                BACK (ANSWER or DEFINITION)
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">Verified Answer</span>
                            </div>

                            <div className="flex-1 flex items-center justify-center text-center py-6">
                              <p className="text-base md:text-lg text-slate-200 px-4 font-medium leading-relaxed">
                                {currentKit.flashcards[cardIndex].answer_text}
                              </p>
                            </div>

                            <div className="text-center text-slate-500 text-xs">
                              Click card to return to front side
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Got It or Review Again Buttons */}
                      <div className="grid grid-cols-2 gap-4 mt-6" id="flashcard-action-bar">
                        <button 
                          id="btn-review-again"
                          onClick={() => markCardStatus(currentKit.flashcards[cardIndex].id, 'learning')}
                          className="py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-bold border border-red-500/20 text-sm flex items-center justify-center gap-2 transition-all"
                        >
                          <X className="w-4.5 h-4.5" />
                          Review Again
                        </button>

                        <button 
                          id="btn-got-it"
                          onClick={() => markCardStatus(currentKit.flashcards[cardIndex].id, 'mastered')}
                          className="py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/15 transition-all"
                        >
                          <Check className="w-4.5 h-4.5" />
                          Got it! (Mastered)
                        </button>
                      </div>

                      {/* Manual swipe pagination */}
                      <div className="flex justify-between items-center mt-6 text-xs text-slate-400">
                        <button 
                          id="btn-prev-card"
                          disabled={cardIndex === 0}
                          onClick={() => {
                            setCardIndex(c => c - 1);
                            setIsFlipped(false);
                          }}
                          className="flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 font-semibold"
                        >
                          <ChevronLeft className="w-4 h-4" /> Prev Card
                        </button>

                        <button 
                          id="btn-next-card"
                          disabled={cardIndex >= currentKit.flashcards.length - 1}
                          onClick={() => {
                            setCardIndex(c => c + 1);
                            setIsFlipped(false);
                          }}
                          className="flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 font-semibold"
                        >
                          Next Card <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      No study cards loaded. Please upload course material to begin.
                    </div>
                  )}

                </div>
              )}

              {/* STUDY MODE CONTAINER 2: QUIZZES */}
              {studyMode === 'quiz' && (
                <div className="max-w-3xl mx-auto w-full py-4 space-y-6 animate-fadeIn" id="quiz-workspace">
                  
                  {currentKit && currentKit.quizzes.length > 0 ? (
                    !isQuizFinished ? (
                      <div className="bg-slate-800/30 border border-white/5 rounded-2xl p-6 md:p-8 space-y-6" id="active-quiz-game">
                        
                        {/* Progress Bar & accuracy */}
                        <div>
                          <div className="flex justify-between text-xs text-slate-400 mb-2">
                            <span>Question {quizIndex + 1} of {currentKit.quizzes.length}</span>
                            <span>Current correct count: {sessionCorrectCount}</span>
                          </div>
                          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-blue-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${((quizIndex + 1) / currentKit.quizzes.length) * 100}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Question Text */}
                        <div className="space-y-2">
                          <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Multiple-Choice</span>
                          <h3 className="text-base md:text-lg font-bold text-white leading-relaxed" id="quiz-question-text">
                            {currentKit.quizzes[quizIndex].question_text}
                          </h3>
                        </div>

                        {/* Options List */}
                        <div className="grid grid-cols-1 gap-3" id="quiz-options-container">
                          {currentKit.quizzes[quizIndex].options_array.map((option, idx) => {
                            const isSelected = selectedOption === idx;
                            const isCorrectAnswer = idx === currentKit.quizzes[quizIndex].correct_option_index;
                            
                            let optionStyle = "bg-slate-800/30 border-white/5 hover:bg-slate-800/60";
                            
                            if (isQuizSubmitted) {
                              if (isCorrectAnswer) {
                                // Correct gets emerald state
                                optionStyle = "bg-emerald-500/10 border-emerald-500 text-emerald-300 font-medium";
                              } else if (isSelected) {
                                // Selected incorrect option gets error red
                                optionStyle = "bg-red-500/10 border-red-500 text-red-300";
                              } else {
                                optionStyle = "bg-slate-800/10 border-white/5 opacity-50";
                              }
                            } else if (isSelected) {
                              optionStyle = "bg-blue-500/10 border-blue-500 text-white font-medium shadow-md shadow-blue-500/5";
                            }

                            return (
                              <button
                                key={idx}
                                disabled={isQuizSubmitted}
                                onClick={() => setSelectedOption(idx)}
                                className={`p-4 rounded-xl text-left text-xs md:text-sm border transition-all flex items-start gap-3 w-full cursor-pointer disabled:cursor-default ${optionStyle}`}
                              >
                                <span className={`w-5.5 h-5.5 rounded-full flex items-center justify-center font-mono font-bold text-[10px] shrink-0 mt-0.5 ${
                                  isSelected ? 'bg-blue-500 text-white' : 'bg-white/5 text-slate-300'
                                }`}>
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                <span className="flex-1">{option}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Interactive Explanation Box (Visible only after submission) */}
                        {isQuizSubmitted && (
                          <div className="p-4 bg-slate-900/60 border border-white/5 rounded-xl space-y-2 animate-fadeIn" id="quiz-explanation-box">
                            <div className="flex items-center gap-2 text-xs font-semibold">
                              {selectedOption === currentKit.quizzes[quizIndex].correct_option_index ? (
                                <span className="text-emerald-400 flex items-center gap-1">
                                  <Check className="w-4 h-4" /> Correct Answer!
                                </span>
                              ) : (
                                <span className="text-red-400 flex items-center gap-1">
                                  <X className="w-4 h-4" /> Incorrect Choice
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {currentKit.quizzes[quizIndex].explanation}
                            </p>
                          </div>
                        )}

                        {/* Submit vs Next Buttons */}
                        <div className="flex gap-3 justify-end pt-2">
                          {!isQuizSubmitted ? (
                            <button
                              id="btn-submit-quiz"
                              disabled={selectedOption === null}
                              onClick={submitQuizAnswer}
                              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 text-xs font-bold rounded-xl transition"
                            >
                              Check Answer
                            </button>
                          ) : (
                            <button
                              id="btn-next-quiz"
                              onClick={nextQuizQuestion}
                              className="bg-[#10B981] hover:bg-[#0ea571] text-white px-6 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-2"
                            >
                              {quizIndex < currentKit.quizzes.length - 1 ? 'Next Question' : 'Finish Quiz'}
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                      </div>
                    ) : (
                      // Quiz final score screen
                      <div className="bg-slate-800/30 border border-white/10 rounded-2xl p-8 text-center space-y-6" id="quiz-results-screen">
                        <div className="mx-auto w-16 h-16 bg-blue-500/10 text-blue-400 rounded-3xl flex items-center justify-center">
                          <Award className="w-10 h-10" />
                        </div>

                        <div>
                          <h3 className="text-xl font-bold text-white">Subject Mastery Quiz Complete!</h3>
                          <p className="text-xs text-slate-400 mt-1">Excellent retrieve attempt. Here are your accuracy results:</p>
                        </div>

                        <div className="bg-slate-900/60 border border-white/5 p-6 rounded-2xl max-w-sm mx-auto space-y-3">
                          <div className="text-5xl font-mono font-bold text-white text-center tracking-tight">
                            {Math.round((sessionCorrectCount / currentKit.quizzes.length) * 100)}%
                          </div>
                          
                          <div className="text-xs text-slate-300 text-center font-semibold">
                            Correct choices: {sessionCorrectCount} of {currentKit.quizzes.length} questions
                          </div>
                        </div>

                        <p className="text-xs text-slate-400 max-w-md mx-auto italic">
                          This score has been incorporated into your total diagnostic analytics shown on the Dashboard stats cards. Keep practicing to reach 100%!
                        </p>

                        <div className="flex justify-center gap-3">
                          <button 
                            id="btn-return-dashboard"
                            onClick={() => setActiveTab('dashboard')}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-5 py-2.5 rounded-xl text-xs border border-slate-700"
                          >
                            Return Home
                          </button>
                          <button 
                            id="btn-restart-quiz"
                            onClick={restartQuiz}
                            className="bg-[#3B82F6] hover:bg-blue-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-lg shadow-blue-500/15"
                          >
                            Practice Again
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      No mock or custom quizzes available for this target document yet.
                    </div>
                  )}

                </div>
              )}

            </div>
          )}

          {/* TAB 4: SOCRATIC CHAT & PROBLEM SOLVER */}
          {activeTab === 'chat' && (
            <div className="animate-fadeIn flex-1 flex flex-col max-w-4xl mx-auto w-full bg-slate-800/20 border border-slate-700/50 rounded-3xl overflow-hidden min-h-[500px]" id="chat-tab-workspace">
              
              {/* Chat Subject Header */}
              <div className="bg-slate-900/80 p-5 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center relative">
                    <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
                    <MessageSquare className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5 leading-none">
                      {chatMode === 'solver' ? 'Master Solve AI (Direct Problem Solver) 🎓' : 'Socratic AI Tutor (Socrates) 💬'}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1 leading-none">
                      {chatMode === 'solver' 
                        ? 'Direct step-by-step math, science, economics and costing solver' 
                        : 'Interactive guided learning, hints and conceptual study advice'
                      }
                    </p>
                  </div>
                </div>

                <div className="text-right hidden sm:block">
                  <span className="px-2 py-0.5 rounded-md bg-white/5 text-slate-400 text-[10px] uppercase font-mono font-bold tracking-wider">
                    {chatMode === 'solver' ? 'solver-active' : 'socrates-active'}
                  </span>
                </div>
              </div>

              {/* Mode Toggle Selection Subbar */}
              <div className="bg-slate-950/40 px-5 py-3.5 border-b border-white/5 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
                <div className="flex flex-col text-center md:text-left">
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Choose Tutor Methodology</span>
                  <span className="text-[9px] text-slate-400">Toggle method depending on what type of academic question you are focusing on right now</span>
                </div>
                <div className="bg-slate-900/90 border border-white/5 rounded-xl p-1 flex gap-1 w-full md:w-auto">
                  <button
                    type="button"
                    id="toggle-solver-btn"
                    onClick={() => setChatMode('solver')}
                    className={`flex-1 md:flex-initial px-3.5 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                      chatMode === 'solver'
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>🧪 Step-by-Step Solver</span>
                  </button>
                  <button
                    type="button"
                    id="toggle-socratic-btn"
                    onClick={() => setChatMode('socratic')}
                    className={`flex-1 md:flex-initial px-3.5 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                      chatMode === 'socratic'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>💬 Socratic Guidance</span>
                  </button>
                </div>
              </div>

              {/* Message Streams Panel */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4 min-h-[300px]" id="chat-messages-container">
                {currentMessages.map((msg) => {
                  const isModel = msg.role === 'model';
                  return (
                    <div 
                      key={msg.id}
                      className={`flex gap-3.5 max-w-[85%] ${isModel ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
                    >
                      {/* Avatar */}
                      <div className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center shrink-0 text-slate-200 text-xs font-bold font-mono uppercase shadow-md ${
                        isModel 
                          ? chatMode === 'solver' ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'
                          : 'bg-slate-700'
                      }`}>
                        {isModel ? (chatMode === 'solver' ? 'M' : 'S') : 'U'}
                      </div>

                      {/* Text Dialog Box */}
                      <div className={`p-4 rounded-2xl relative space-y-1.5 ${
                        isModel 
                          ? chatMode === 'solver'
                            ? 'bg-slate-800/80 text-slate-200 rounded-tl-none border-l-4 border-blue-500'
                            : 'bg-slate-800/80 text-slate-200 rounded-tl-none border-l-4 border-indigo-400' 
                          : 'bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-500/5'
                      }`}>
                        <p className="text-xs md:text-sm whitespace-pre-wrap leading-relaxed">
                          {msg.text}
                        </p>
                        <span className="text-[9px] block text-right opacity-60 font-mono">
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Simulated Socratic Processing Loader */}
                {isChatLoading && (
                  <div className="flex gap-3.5 max-w-[80%] mr-auto">
                    <div className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                      chatMode === 'solver' ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'
                    }`}>
                      {chatMode === 'solver' ? 'M' : 'S'}
                    </div>
                    <div className={`bg-slate-800/80 p-4 rounded-2xl rounded-tl-none text-slate-300 space-y-2 min-w-[150px] border-l-4 ${
                      chatMode === 'solver' ? 'border-blue-500' : 'border-indigo-400'
                    }`}>
                      <div className="text-[10px] text-blue-300 font-bold uppercase animate-pulse">
                        {chatMode === 'solver' ? 'Computing step-by-step solution...' : 'Socrates is formulating inquiry...'}
                      </div>
                      <div className="flex gap-1 items-center h-3">
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatMessagesEndRef} />
              </div>

              {/* Chat Input Field form footer */}
              <form 
                onSubmit={handleSendChatMessage}
                className="bg-slate-900/40 p-4 border-t border-white/5 flex gap-2 items-center"
                id="chatbot-form"
              >
                <input 
                  id="chat-input-text"
                  type="text"
                  value={chatInputs}
                  onChange={(e) => setChatInputs(e.target.value)}
                  placeholder={chatMode === 'solver' 
                    ? "Ask Chemistry, Physics, Maths, Biology, Economics or Costing questions..." 
                    : "Ask a guiding question for conceptual Socratic study..."
                  }
                  className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-3 text-xs md:text-sm text-slate-200 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <button 
                  id="btn-chat-send"
                  type="submit"
                  disabled={!chatInputs.trim() || isChatLoading}
                  className={`${
                    chatMode === 'solver' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-indigo-600 hover:bg-indigo-500'
                  } disabled:opacity-50 disabled:cursor-not-allowed px-5 py-3 rounded-xl font-bold text-xs text-white transition whitespace-nowrap`}
                >
                  {chatMode === 'solver' ? 'Solve Question' : 'Ask Tutor'}
                </button>
              </form>

            </div>
          )}

        </div>
      </main>

      {/* --- FLOATING MODAL: UPLOAD NEW MATERIAL --- */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn" id="upload-dialog-box">
          <div className="bg-[#1A1D29] border border-white/10 w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Generate Neural Study Kit</h3>
                  <p className="text-[10px] text-slate-400">Convert text summaries or lecture notes into study guides</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setUploadError("");
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form inputs */}
            <form onSubmit={handleGenerateMaterials} className="p-6 flex-1 overflow-y-auto space-y-4">
              
              {/* File Upload Drag-and-Drop Area */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-300 block">
                  Load Study Files (Drag & Drop or click selection)
                </span>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const files = e.dataTransfer.files;
                    if (files && files[0]) {
                      handleFileExtraction(files[0]);
                    }
                  }}
                  onClick={() => {
                    document.getElementById("study-file-input")?.click();
                  }}
                  className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                    isDragging 
                      ? "border-blue-500 bg-blue-500/10" 
                      : loadedFileName 
                        ? "border-emerald-500/50 bg-emerald-500/5 hover:border-emerald-500 hover:bg-emerald-500/10" 
                        : "border-white/10 hover:border-blue-500/50 hover:bg-white/5"
                  }`}
                  id="file-dropzone"
                >
                  <input
                    type="file"
                    id="study-file-input"
                    accept=".pdf,.txt,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.png,.jpg,.jpeg,.webp,.gif,.bmp,.csv,.tsv,.md,.js,.ts,.html,.css,.json,text/*"
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files[0]) {
                        handleFileExtraction(files[0]);
                      }
                    }}
                  />
                  
                  {isReadingFile ? (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                      <p className="text-xs text-blue-400 font-medium font-mono">{fileProgressMsg}</p>
                    </div>
                  ) : loadedFileName ? (
                    <div className="flex flex-col items-center gap-1.5 py-1">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                        <FileText className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-400 font-sans">File Loaded Successfully!</p>
                        <p className="text-[10px] text-slate-300 font-medium truncate max-w-[280px] mt-0.5">{loadedFileName}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLoadedFileName("");
                          setPastedText("");
                          setDocumentTitle("");
                          const fileInput = document.getElementById("study-file-input") as HTMLInputElement;
                          if (fileInput) fileInput.value = "";
                        }}
                        className="text-[10px] text-slate-400 hover:text-red-400 font-bold transition underline mt-1"
                        id="clear-file-btn"
                      >
                        Clear loaded contents
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500/5 text-blue-400 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-200 font-bold">Drag and drop your study material here</p>
                        <p className="text-[10px] text-slate-400 mt-1">Supports PDF, Word, Excel, PowerPoint, Text, Code, CSV, Markdown, or Images (OCR)</p>
                      </div>
                      <span className="inline-block bg-blue-500/10 hover:bg-blue-500/20 transition text-blue-400 text-[10px] font-bold px-3 py-1.5 rounded-lg mt-1 border border-blue-500/25">
                        Browse Files
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block" htmlFor="input-title">
                  Course / Subject Title (Optional)
                </label>
                <input 
                  id="input-title"
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  placeholder="E.g., Quantum Mechanics Chapter 1"
                  className="w-full bg-[#1e2230] border border-white/10 rounded-xl px-4 py-3 text-xs md:text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-300 block" htmlFor="input-text">
                    Dense Course Notes / Textbook Paragraphs (Required)
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {pastedText.length} characters
                  </span>
                </div>
                <textarea 
                  id="input-text"
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste textbook definitions, dense presentation slides, chemical reactions, or summaries here..."
                  className="w-full bg-[#1e2230] border border-white/10 rounded-xl px-4 py-3 text-xs md:text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none font-sans"
                />
              </div>

              {/* Error label if upload fails */}
              {uploadError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-start gap-2 animate-fadeIn">
                  <X className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Sample study suggestions helper */}
              <div className="bg-slate-800/20 p-4 rounded-xl border border-white/5 space-y-2">
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block">Short Sample Prompting Ideas:</span>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Type or search standard topics like "Photosynthesis biological steps" or "Algebraic Quadratic formula standard derivation" to test the automated generation mechanisms instantly!
                </p>
              </div>

              {/* Submit triggers */}
              <div className="flex gap-3 justify-end pt-3">
                <button 
                  type="button"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setUploadError("");
                  }}
                  className="bg-transparent hover:bg-white/5 text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>

                <button 
                  id="btn-process-upload"
                  type="submit"
                  disabled={isGenerating || !pastedText.trim()}
                  className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-blue-500/15"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Generating Study Kit...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate Study Kit
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Google Interstitial Full-Screen Ad Overlay with 5-second countdown */}
      {isInterstitialOpen && (
        <GoogleInterstitialAd 
          onComplete={() => {
            setIsInterstitialOpen(false);
            if (pendingAdCompletion) {
              pendingAdCompletion();
              setPendingAdCompletion(null);
            }
          }} 
        />
      )}

    </div>
  );
}
