import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse/lib/pdf-parse.js"; // ✅ Cloud-safe import
import { PDFDocument, rgb } from "pdf-lib";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }); // ✅ Memory storage (safe for Render)

// ❌ Common words to skip in keyword extraction
const stopWords = new Set([
  "and", "or", "the", "to", "a", "of", "in", "on", "for", "with", "is", "are", "you", "your",
  "this", "that", "we", "as", "an", "be", "will", "should", "have", "has", "it", "at", "our",
  "us", "by", "from", "their", "they", "but", "if", "about", "into", "more", "can", "also"
]);

// 🔍 Extract JD keywords
const extractKeywordsFromJD = (description = "") => {
  const wordFrequency = {};
  const words = description
    .toLowerCase()
    .replace(/[^\w\s\.\+#]/g, "")
    .split(/\s+/);

  words.forEach(word => {
    if (!stopWords.has(word) && word.length > 2) {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    }
  });

  return Object.keys(wordFrequency)
    .sort((a, b) => wordFrequency[b] - wordFrequency[a])
    .slice(0, 15);
};

// 📊 ATS score calculation
const calculateATSScore = (resumeText, keywords) => {
  const resume = resumeText.toLowerCase();
  const matched = keywords.filter(keyword => resume.includes(keyword.toLowerCase()));
  const score = Math.round((matched.length / keywords.length) * 100);
  return { score, matched };
};

// 🖍️ Add missing keywords in resume PDF
const highlightKeywordsInPDF = async (pdfBuffer, keywords) => {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const page = pdfDoc.getPages()[0];
  const { height } = page.getSize();

  keywords.slice(0, 5).forEach((kw, i) => {
    page.drawText(`🔍 ${kw}`, {
      x: 50,
      y: height - 60 - i * 20,
      size: 12,
      color: rgb(1, 0, 0),
    });
  });

  return await pdfDoc.save();
};

// 📥 Upload Resume & Analyze ATS Score
router.post("/upload", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No resume uploaded." });

    const jobDescription = req.body.jobDescription || "";
    const pdfData = await pdfParse(req.file.buffer);
    const resumeText = pdfData.text.replace(/\s+/g, " ").trim();

    if (!resumeText || resumeText.length < 30) {
      return res.status(400).json({ error: "Resume is too short or empty." });
    }

    const jdKeywords = extractKeywordsFromJD(jobDescription);
    const { score, matched } = calculateATSScore(resumeText, jdKeywords);
    const missing = jdKeywords.filter(k => !matched.includes(k));
    const suggestions = missing.map(k => `Consider adding "${k}" to your resume.`);

    res.json({
      score,
      matchedKeywords: matched,
      missingKeywords: missing,
      usedKeywords: jdKeywords,
      suggestions,
    });
  } catch (err) {
    console.error("❌ ATS Error:", err.message);
    res.status(500).json({ error: "Error analyzing resume." });
  }
});

// ✍️ Annotate Resume with Missing Keywords
router.post("/annotate", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No resume uploaded." });

    const jobDescription = req.body.jobDescription || "";
    const pdfData = await pdfParse(req.file.buffer);
    const resumeText = pdfData.text.replace(/\s+/g, " ").trim();

    const jdKeywords = extractKeywordsFromJD(jobDescription);
    const missingKeywords = jdKeywords.filter(k => !resumeText.toLowerCase().includes(k.toLowerCase()));

    const updatedPdf = await highlightKeywordsInPDF(req.file.buffer, missingKeywords);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=annotated_resume.pdf",
    });

    res.send(updatedPdf);
  } catch (err) {
    console.error("❌ PDF Annotate Error:", err.message);
    res.status(500).json({ error: "Failed to annotate resume." });
  }
});

export default router;
