import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import natural from "natural";
import Internship from "../models/internshipModel.js";

const router = express.Router();
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

const { WordTokenizer, PorterStemmer } = natural;
const tokenizer = new WordTokenizer();

// Common technical terms for skills extraction
const COMMON_TECH_TERMS = [
  // Programming Languages
  'javascript', 'python', 'java', 'c\\+\\+', 'c#', 'php', 'ruby', 'go', 'swift',
  'kotlin', 'typescript', 'rust', 'scala', 'perl', 'r', 'dart',
  // Web Technologies
  'html', 'css', 'sass', 'less', 'react', 'angular', 'vue', 'next\\.js', 'nuxt\\.js',
  'node\\.js', 'express\\.js', 'django', 'flask', 'spring', 'laravel', 'rails',
  'asp\\.net', 'jquery', 'redux', 'graphql', 'rest api', 'webpack', 'babel',
  // Databases
  'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'oracle', 'sqlite', 'firebase',
  'dynamodb', 'cassandra', 'neo4j',
  // DevOps & Cloud
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ansible', 'jenkins',
  'ci/cd', 'github actions', 'gitlab ci', 'nginx', 'apache',
  // Data Science
  'machine learning', 'ai', 'data science', 'big data', 'hadoop', 'spark',
  'tensorflow', 'pytorch', 'keras', 'pandas', 'numpy', 'scikit-learn',
  // Mobile
  'android', 'ios', 'react native', 'flutter', 'xamarin',
  // Other
  'git', 'linux', 'bash', 'shell scripting', 'agile', 'scrum'
];

// Enhanced resume parser
async function parseResume(text) {
  const result = {
    name: "",
    email: "",
    phone: "",
    education: [],
    experience: [],
    skills: [],
    projects: []
  };

  // Extract name
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  for (const line of lines) {
    if (/^(resume|curriculum vitae|cv)$/i.test(line)) continue;
    const words = line.split(/\s+/);
    const isNameLine = words.length <= 4 && words.every(w => /^[A-Z][a-z]+$/.test(w));
    if (isNameLine) {
      result.name = line;
      break;
    }
  }
  if (!result.name && lines.length > 0) result.name = lines[0];

  // Extract contact info
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  if (emailMatch) result.email = emailMatch[0];

  const phoneMatch = text.match(/(\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/);
  if (phoneMatch) result.phone = phoneMatch[0];

  // Extract education
  const educationSection = text.match(/(EDUCATION|ACADEMIC BACKGROUND|QUALIFICATIONS)[:\n]*(.*?)(?:\n\s*\n|\n[A-Z]{3,}|$)/is);
  if (educationSection) {
    result.education = educationSection[2]
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !/^\d{4}\s*[-–]\s*\d{4}$/.test(line)); // Filter out date ranges
  }

  // Extract work experience
  const experienceSection = text.match(/(WORK EXPERIENCE|EXPERIENCE|EMPLOYMENT HISTORY|PROFESSIONAL EXPERIENCE)[:\n]*(.*?)(?:\n\s*\n|\n[A-Z]{3,}|$)/is);
  if (experienceSection) {
    const experiences = experienceSection[2].split(/(?:\n\s*){2,}/); // Split by multiple newlines
    result.experience = experiences.map(exp => {
      const companyMatch = exp.match(/^(.*?)\n/);
      const positionMatch = exp.match(/\n(.*?)\n/);
      const bulletPoints = exp.match(/^[•\-*]\s*(.*)$/gm) || exp.match(/-\s*(.*?)(?=\n-|\n\s*\n|$)/g) || [];
      
      return {
        company: companyMatch ? companyMatch[1].trim() : "",
        position: positionMatch ? positionMatch[1].trim() : "",
        details: bulletPoints.map(bp => bp.replace(/^[•\-*]\s*/, '').trim())
      };
    }).filter(exp => exp.company);
  }

  // Enhanced skills extraction
  result.skills = extractSkillsFromText(text);

  // Extract projects
  const projectsSection = text.match(/(PROJECTS|PERSONAL PROJECTS|PORTFOLIO)[:\n]*(.*?)(?:\n\s*\n|\n[A-Z]{3,}|$)/is);
  if (projectsSection) {
    const projectText = projectsSection[2];
    
    // Handle different project formats
    const projectEntries = projectText.split(/(?:\*\*|\b)(.*?)(?:\*\*|\b)/g)
      .map(entry => entry.trim())
      .filter(entry => entry.length > 0);
    
    for (let i = 0; i < projectEntries.length; i += 2) {
      const projectName = projectEntries[i];
      const projectDesc = i + 1 < projectEntries.length ? projectEntries[i + 1] : "";
      
      // Extract technologies from description
      const techStack = extractTechnologiesFromText(projectDesc);
      
      result.projects.push({
        name: projectName,
        description: projectDesc,
        technologies: techStack
      });
    }
  }

  return result;
}

// Universal skills extraction function
function extractSkillsFromText(text) {
  const skills = new Set();

  // 1. Try to find dedicated skills section
  const skillsSectionMatch = text.match(
    /(?:SKILLS|TECHNICAL SKILLS|TECHNOLOGIES|COMPETENCIES|EXPERTISE)[\s*:]*\n([\s\S]*?)(?:\n\s*\n|\n[A-Z]{3,}|$)/i
  );

  if (skillsSectionMatch) {
    const skillsText = skillsSectionMatch[1];
    
    // Handle table format
    if (skillsText.includes('|')) {
      const tableRows = skillsText.split('\n').filter(line => line.includes('|'));
      tableRows.forEach(row => {
        const columns = row.split('|').map(col => col.trim()).filter(col => col);
        if (columns.length > 1) {
          // Take first column after initial pipe
          const mainSkill = columns[1].split(':')[0].trim();
          if (mainSkill) skills.add(mainSkill);
        }
      });
    } else {
      // Handle other formats
      skillsText.split('\n').forEach(line => {
        const cleanedLine = line
          .replace(/\([^)]*\)/g, '')
          .replace(/\[[^\]]*\]/g, '')
          .replace(/\{[^}]*\}/g, '')
          .replace(/\s*[-–]\s*.*$/, '')
          .replace(/\d+%\s*/, '')
          .replace(/\d+\+?\s*years?/i, '');

        cleanedLine.split(/[,;•\-–·\/]|\s+\/\s+/).forEach(skill => {
          const trimmedSkill = skill.trim();
          if (trimmedSkill && !/^(and|or|etc)$/i.test(trimmedSkill)) {
            skills.add(trimmedSkill);
          }
        });
      });
    }
  }

  // 2. Scan entire text for technical terms
  const techRegex = new RegExp(`\\b(${COMMON_TECH_TERMS.join('|')})\\b`, 'gi');
  let match;
  while ((match = techRegex.exec(text.toLowerCase()))) {
    skills.add(match[0]);
  }

  // 3. Extract from experience bullet points
  const bulletPoints = text.match(/^[•\-*]\s*(.*)$/gm) || [];
  bulletPoints.forEach(point => {
    const techMatch = point.match(new RegExp(`\\b(${COMMON_TECH_TERMS.join('|')})\\b`, 'gi'));
    if (techMatch) techMatch.forEach(tech => skills.add(tech.toLowerCase()));
  });

  return Array.from(skills).filter(skill => skill.length > 0);
}

// Extract technologies from project/experience descriptions
function extractTechnologiesFromText(text) {
  const techs = new Set();
  
  // Look for explicit tech mentions (e.g., "Technologies: Java, React")
  const explicitTechMatch = text.match(/(?:Technologies|Tools|Stack)[:\s]*([^.\n]*)/i);
  if (explicitTechMatch) {
    explicitTechMatch[1].split(/[,;]/).forEach(tech => {
      const trimmedTech = tech.trim();
      if (trimmedTech) techs.add(trimmedTech);
    });
  }
  
  // Scan for common tech terms
  const techRegex = new RegExp(`\\b(${COMMON_TECH_TERMS.join('|')})\\b`, 'gi');
  let match;
  while ((match = techRegex.exec(text.toLowerCase()))) {
    techs.add(match[0]);
  }
  
  return Array.from(techs);
}

// Calculate similarity between resume and internship
function calculateMatchScore(resume, internship) {
  const resumeText = [
    resume.skills.join(' '),
    ...resume.experience.map(exp => exp.details.join(' ')),
    ...resume.projects.map(proj => proj.description)
  ].join(' ').toLowerCase();

  const internshipText = [
    internship.title,
    ...(internship.skills || []),
    internship.description || '',
    internship.requirements || ''
  ].join(' ').toLowerCase();

  const processText = (text) => {
    return tokenizer.tokenize(text)
      .map(token => PorterStemmer.stem(token))
      .filter(token => token.length > 2);
  };

  const words1 = processText(resumeText);
  const words2 = processText(internshipText);
  
  if (words1.length === 0 || words2.length === 0) return 0;

  const intersection = words1.filter(word => words2.includes(word));
  const union = new Set([...words1, ...words2]);
  
  return intersection.length / union.size;
}

router.post("/recommend", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file && !req.body.skills) {
      return res.status(400).json({
        success: false,
        message: "Please provide either a resume or list of skills"
      });
    }

    let parsedInfo = {
      name: "",
      email: "",
      phone: "",
      education: [],
      experience: [],
      skills: [],
      projects: []
    };

    // Process resume if uploaded
    if (req.file) {
      try {
        const pdfData = await pdfParse(req.file.buffer);
        parsedInfo = await parseResume(pdfData.text);
      } catch (pdfErr) {
        console.error("PDF processing error:", pdfErr);
        return res.status(400).json({ 
          success: false,
          message: "Invalid PDF file",
          details: pdfErr.message 
        });
      }
    }

    // Process skills from form
    let formSkills = [];
    if (req.body.skills) {
      formSkills = Array.isArray(req.body.skills) 
        ? req.body.skills 
        : req.body.skills.split(/\s*,\s*/).filter(s => s.trim());
    }

    // Combine all skills
    const allSkills = [...new Set([...parsedInfo.skills, ...formSkills])];
    if (allSkills.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "No skills detected in resume or input"
      });
    }

    // Get all internships from database
    const allInternships = await Internship.find({}).lean();

    // Calculate recommendations
    const recommendations = allInternships
      .map(internship => ({
        ...internship,
        score: calculateMatchScore({ ...parsedInfo, skills: allSkills }, internship)
      }))
      .filter(item => item.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // Calculate missing skills
    const topInternshipSkills = recommendations
      .flatMap(rec => rec.skills || [])
      .filter(skill => !allSkills.includes(skill));
    
    const missingSkills = [...new Set(topInternshipSkills)].slice(0, 5);

    // Normalize scores to 0-100
    const maxScore = recommendations[0]?.score || 1;
    const normalizedRecs = recommendations.map(item => ({
      ...item,
      score: Math.round((item.score / maxScore) * 100)
    }));

    res.json({ 
      success: true,
      recommendations: normalizedRecs,
      parsedInfo,
      matchScore: normalizedRecs[0]?.score || 0,
      missingSkills
    });

  } catch (err) {
    console.error("Recommendation error:", err);
    res.status(500).json({ 
      success: false,
      message: "Server Error",
      error: err.message
    });
  }
});

export default router;