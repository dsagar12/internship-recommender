import pdfParse from "pdf-parse";

// Simple keywords expected in a good resume
const importantKeywords = [
  "experience", "education", "skills", "projects", "certifications", "leadership"
];

export const analyzeResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Resume file is required" });
    }

    const dataBuffer = req.file.buffer;
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text.toLowerCase();

    let score = 0;
    let recommendations = [];

    importantKeywords.forEach((keyword) => {
      if (text.includes(keyword)) {
        score += 15;
      } else {
        recommendations.push(`Consider adding a section or mention of "${keyword}".`);
      }
    });

    // Basic formatting suggestions
    if (!text.includes("linkedin")) {
      recommendations.push("Add your LinkedIn profile.");
    }
    if (!text.includes("github")) {
      recommendations.push("Add your GitHub or portfolio link.");
    }

    // Clamp score to 100
    score = Math.min(score, 100);

    res.json({ atsScore: score, recommendations });
  } catch (err) {
    console.error("ATS check error:", err);
    res.status(500).json({ error: "Failed to process resume." });
  }
};
