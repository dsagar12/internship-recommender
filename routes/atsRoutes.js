import express from "express";
import multer from "multer";
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { PDFDocument, rgb } from "pdf-lib";

const router = express.Router();

// 🔧 Use memory storage for Multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 📚 Set of extra common words to ignore
const stopWords = new Set([
  "and", "or", "the", "to", "a", "of", "in", "on", "for", "with", "is", "are", "you", "your",
  "this", "that", "we", "as", "an", "be", "will", "should", "have", "has", "it", "at", "our",
  "us", "by", "from", "their", "they", "but", "if", "about", "into", "more", "can", "also"
]);

// ✅ Extract keywords from job description
const extractKeywordsFromJD = (description) => {
  if (!description) return [];

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
    .slice(0, 15); // Top 15 keywords
};

// 🎯 Calculate ATS Score
const calculateATSScore = (resumeText, keywords) => {
  const resume = resumeText.toLowerCase();
  const matched = keywords.filter(keyword =>
    resume.includes(keyword.toLowerCase())
  );
  const score = Math.round((matched.length / keywords.length) * 100);
  return { score, matched };
};

// 🖍️ Highlight missing keywords in PDF
const highlightKeywordsInPDF = async (pdfBuffer, keywords) => {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const { width, height } = firstPage.getSize();

  keywords.slice(0, 5).forEach((kw, idx) => {
    firstPage.drawText(kw, {
      x: 50,
      y: height - 50 - idx * 20,
      size: 12,
      color: rgb(1, 0, 0),
    });
  });

  const updatedPdfBytes = await pdfDoc.save();
  return updatedPdfBytes;
};

// 📥 POST /api/ats/upload
router.post("/upload", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const jobDescription = req.body.jobDescription || "";
    const pdfData = await pdfParse(req.file.buffer);
    const resumeText = pdfData.text.replace(/\s+/g, " ").trim();

    if (!resumeText || resumeText.length < 30) {
      return res.status(400).json({ error: "Resume content is too short or empty." });
    }

    const jdKeywords = extractKeywordsFromJD(jobDescription);
    const { score, matched } = calculateATSScore(resumeText, jdKeywords);

    const suggestions = jdKeywords
      .filter(k => !matched.includes(k))
      .map(k => `Consider including "${k}" in your resume.`);

    res.json({
      score,
      matchedKeywords: matched,
      missingKeywords: jdKeywords.filter(k => !matched.includes(k)),
      usedKeywords: jdKeywords,
      suggestions,
    });
  } catch (err) {
    console.error("❌ ATS Resume Analysis Error:", err.message);
    res.status(500).json({ error: "Something went wrong while parsing the resume." });
  }
});

// 🖨️ POST /api/ats/annotate
router.post("/annotate", upload.single("resume"), async (req, res) => {
  try {
    const jobDescription = req.body.jobDescription || "";
    const pdfBuffer = req.file.buffer;
    const pdfData = await pdfParse(pdfBuffer);
    const resumeText = pdfData.text.replace(/\s+/g, " ").trim();

    const jdKeywords = extractKeywordsFromJD(jobDescription);
    const missingKeywords = jdKeywords.filter(
      keyword => !resumeText.toLowerCase().includes(keyword.toLowerCase())
    );

    const annotatedPdf = await highlightKeywordsInPDF(pdfBuffer, missingKeywords);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=annotated_resume.pdf",
    });

    res.send(annotatedPdf);
  } catch (err) {
    console.error("❌ Annotate Error:", err.message);
    res.status(500).json({ error: "Failed to annotate PDF." });
  }
});

export default router;