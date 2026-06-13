import { jsPDF } from "jspdf";
import { StudyKit } from "./types";

/**
 * Generates and downloads a beautifully styled, formatted, and paginated PDF 
 * containing the summarized study notes, bullet points, equations, and definitions.
 */
export function exportStudyKitToPDF(kit: StudyKit) {
  if (!kit) return;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageHeight = 297;
  const pageWidth = 210;
  const marginX = 20;
  const contentWidth = pageWidth - (marginX * 2); // 170mm printable area
  const bottomLimit = 275; // Safe bottom limit

  let currentY = 25;
  let pageNum = 1;

  // Colors (RGB)
  const colors = {
    brandDark: [15, 23, 42],      // Slate 900
    brandBlue: [37, 99, 235],     // Blue 600
    accentAmber: [217, 119, 6],   // Amber 600
    accentEmerald: [5, 150, 105], // Green 600
    textPrimary: [30, 41, 59],    // Slate 800
    textMuted: [100, 116, 139],   // Slate 500
    bgLight: [248, 250, 252],     // Slate 50
    borderLight: [226, 232, 240], // Slate 200
  };

  // Helper: Get rgb string or set draw/fill colors
  const setFillColor = (color: number[]) => {
    doc.setFillColor(color[0], color[1], color[2]);
  };
  const setTextColor = (color: number[]) => {
    doc.setTextColor(color[0], color[1], color[2]);
  };
  const setDrawColor = (color: number[]) => {
    doc.setDrawColor(color[0], color[1], color[2]);
  };

  // Standard Header and Footer rendering
  const drawPageDecorations = (currentNumber: number, title: string) => {
    // Top fine-line header
    setDrawColor(colors.borderLight);
    doc.setLineWidth(0.3);
    doc.line(marginX, 15, pageWidth - marginX, 15);

    // Header metadata
    setTextColor(colors.brandBlue);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("PREPMIND AI STUDY SUITE", marginX, 12);

    setTextColor(colors.textMuted);
    doc.setFont("helvetica", "normal");
    const rightLabel = `Subject Summary — Page ${currentNumber}`;
    const textWidth = doc.getTextWidth(rightLabel);
    doc.text(rightLabel, pageWidth - marginX - textWidth, 12);

    // Bottom fine-line footer
    doc.line(marginX, pageHeight - 15, pageWidth - marginX, pageHeight - 15);
    
    // Bottom branding and watermark
    setTextColor(colors.textMuted);
    doc.setFontSize(7.5);
    doc.text("Generated with PrepMind AI — Your Active Recall Companion", marginX, pageHeight - 10);
    
    const timeString = `Downloaded: ${new Date().toLocaleDateString()}`;
    const timeWidth = doc.getTextWidth(timeString);
    doc.text(timeString, pageWidth - marginX - timeWidth, pageHeight - 10);
  };

  // Safe vertical spacing helper with auto-page-break logic
  const ensureVerticalSpace = (spaceNeeded: number) => {
    if (currentY + spaceNeeded > bottomLimit) {
      // Draw decorations for current finished page
      drawPageDecorations(pageNum, kit.document.title);
      
      // Navigate to blank canvas
      doc.addPage();
      pageNum++;
      currentY = 25; // Reset near top boundary
    }
  };

  // Beautiful section divider
  const drawSectionHeader = (title: string, colorRGB: number[]) => {
    ensureVerticalSpace(18);
    
    // Divider line
    setDrawColor(colorRGB);
    doc.setLineWidth(0.6);
    doc.line(marginX, currentY, marginX + 25, currentY);
    
    currentY += 6;
    
    // Title text
    setTextColor(colorRGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title.toUpperCase(), marginX, currentY);
    
    currentY += 6;
  };

  // Add wrapped paragraph blocks securely
  const drawWrappedText = (text: string, fontSize: number, style: "normal" | "bold" | "italic" = "normal", colorRGB = colors.textPrimary, lineSpacing = 5, indent = 0) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(fontSize);
    setTextColor(colorRGB);

    const actualWidth = contentWidth - indent;
    const lines = doc.splitTextToSize(text, actualWidth);
    
    for (const line of lines) {
      ensureVerticalSpace(lineSpacing);
      doc.text(line, marginX + indent, currentY);
      currentY += lineSpacing;
    }
  };

  // --- START PDF BUILD ENGINE ---

  // PAGE 1 HEADER / HERO BLOCK
  // Rounded decorative brand card
  setFillColor(colors.brandDark);
  doc.roundedRect(marginX, currentY, contentWidth, 38, 4, 4, "F");

  // Hero Card text content
  setTextColor([255, 255, 255]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PREPMIND AI ACTIVE RECALL STUDY PACK", marginX + 8, currentY + 11);

  // Document Title inside Hero
  doc.setFontSize(16);
  const titleText = kit.document.title;
  // Truncate if title is exceptionally long
  const truncatedTitle = titleText.length > 35 ? titleText.substring(0, 32) + "..." : titleText;
  doc.text(truncatedTitle, marginX + 8, currentY + 20);

  // Date info label inside Hero
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setTextColor([200, 210, 230]);
  doc.text(`Origin Created: ${kit.document.upload_date || "Continuous"}  |  Curriculum: Core Mastery Summary`, marginX + 8, currentY + 28);

  currentY += 46;

  // SECTION 1: ELI5 ANALOGY (Subject Overview)
  if (kit.summary.eli5_text) {
    drawSectionHeader("Cognitive Conceptual Framework (ELI5)", colors.accentAmber);
    
    // Analogy background box
    setFillColor(colors.bgLight);
    setDrawColor(colors.borderLight);
    doc.setLineWidth(0.3);
    
    const lines = doc.splitTextToSize(`"${kit.summary.eli5_text}"`, contentWidth - 16);
    const boxHeight = (lines.length * 5) + 12;
    
    ensureVerticalSpace(boxHeight + 4);
    doc.roundedRect(marginX, currentY, contentWidth, boxHeight, 3, 3, "FD");
    
    let innerY = currentY + 8;
    for (const line of lines) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      setTextColor(colors.textPrimary);
      doc.text(line, marginX + 8, innerY);
      innerY += 5;
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setTextColor(colors.accentAmber);
    doc.text("COGNITIVE METAPHOR MODEL FOR SIMPLIFICATION", marginX + 8, innerY + 1);
    
    currentY += boxHeight + 8;
  }

  // SECTION 2: BULLET SUMMARY POINTS
  if (kit.summary.quick_read_json && kit.summary.quick_read_json.length > 0) {
    drawSectionHeader("Interactive Digest (Key Bullet Points)", colors.brandBlue);
    
    kit.summary.quick_read_json.forEach((bullet, index) => {
      // Format number indicator
      ensureVerticalSpace(8);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setTextColor(colors.brandBlue);
      doc.text(`${index + 1}.`, marginX, currentY);
      
      // Render the bullet text with 8mm left margin indent for alignment
      drawWrappedText(bullet, 9, "normal", colors.textPrimary, 4.5, 8);
      currentY += 2; // Extra spacer after bullets
    });
    
    currentY += 4;
  }

  // SECTION 3: DETAILED DEEP-DIVE LECTURE NOTES
  if (kit.summary.deep_dive_json.notes && kit.summary.deep_dive_json.notes.length > 0) {
    drawSectionHeader("Structured Master Notes", colors.brandDark);
    
    kit.summary.deep_dive_json.notes.forEach((note) => {
      ensureVerticalSpace(8);
      
      // Bullet symbol
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setTextColor(colors.brandDark);
      doc.text("•", marginX + 1, currentY);
      
      // Memoized content wrapping
      drawWrappedText(note, 9, "normal", colors.textPrimary, 4.8, 6);
      currentY += 1.5;
    });
    
    currentY += 4;
  }

  // SECTION 4: FORMULAS / CORE LAWS (IF PRESENT)
  if (kit.summary.deep_dive_json.formulas && kit.summary.deep_dive_json.formulas.length > 0) {
    drawSectionHeader("Key Equation Formulas & Laws", colors.accentAmber);
    
    kit.summary.deep_dive_json.formulas.forEach((formula) => {
      ensureVerticalSpace(14);
      
      // Draw equation formula callout block
      setFillColor(colors.bgLight);
      setDrawColor(colors.borderLight);
      doc.setLineWidth(0.3);
      doc.roundedRect(marginX, currentY, contentWidth, 10, 2, 2, "FD");
      
      doc.setFont("courier", "bold");
      doc.setFontSize(9);
      setTextColor(colors.accentAmber);
      doc.text(formula, marginX + 5, currentY + 6.3);
      
      currentY += 13;
    });
    
    currentY += 4;
  }

  // SECTION 5: EXTRACTED INDEXED DEFINITIONS
  if (kit.summary.deep_dive_json.definitions && kit.summary.deep_dive_json.definitions.length > 0) {
    drawSectionHeader("Subject Matter Definitions", colors.accentEmerald);
    
    kit.summary.deep_dive_json.definitions.forEach((def) => {
      ensureVerticalSpace(16);
      
      // Draw elegant term badge background
      setFillColor(colors.bgLight);
      setDrawColor(colors.accentEmerald);
      doc.setLineWidth(0.3);
      
      const termLabel = def.term.trim();
      const termWidth = Math.min(100, doc.getTextWidth(termLabel) + 6);
      
      doc.roundedRect(marginX, currentY, termWidth, 6, 1.5, 1.5, "FD");
      
      // Term text
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setTextColor(colors.textPrimary);
      doc.text(termLabel, marginX + 3, currentY + 4.2);
      
      currentY += 8;
      
      // Definition description body text
      drawWrappedText(def.definition, 8.5, "normal", colors.textPrimary, 4.2, 3);
      currentY += 3.5; // Space between vocabulary card items
    });
  }

  // Final draw for the last active page
  drawPageDecorations(pageNum, kit.document.title);

  // Trigger file download
  const cleanFilename = kit.document.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  
  doc.save(`${cleanFilename || "dataset"}_study_kit.pdf`);
}
