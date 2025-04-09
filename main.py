from fastapi import FastAPI, UploadFile, File
import spacy
import pdfplumber
import subprocess
import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from io import BytesIO

app = FastAPI()

# Load NLP Model
nlp = spacy.load("en_core_web_sm")

# Extract Text from PDF
def extract_text_from_pdf(file):
    with pdfplumber.open(file) as pdf:
        text = "\n".join([page.extract_text() for page in pdf.pages if page.extract_text()])
    return text

# Extract Skills from Resume
def extract_skills(text):
    doc = nlp(text)
    skills = [ent.text.lower() for ent in doc.ents if ent.label_ in ["ORG", "PRODUCT", "WORK_OF_ART"]]
    return list(set(skills))

# Chrome Scraper
def scrape_internships():
    try:
        result = subprocess.run(
            ["node", "backend/scraper/internshipScraper.js"],
            capture_output=True, text=True, check=True
        )
        internships = json.loads(result.stdout)
        return internships
    except subprocess.CalledProcessError as e:
        print("Scraping failed:", e.stderr)
        return []

# Match Internships
def match_internships(resume_text, internships):
    descriptions = [i["description"] for i in internships]
    
    if not descriptions:
        return []

    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform([resume_text] + descriptions)
    similarity_scores = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()

    ranked_internships = sorted(zip(internships, similarity_scores), key=lambda x: x[1], reverse=True)

    return [{"title": i[0]["title"], "company": i[0]["company"], "score": round(i[1], 2)} for i in ranked_internships[:5]]

# Upload Resume Endpoint
@app.post("/upload_resume/")
async def upload_resume(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        return {"error": "Only PDF files are supported"}

    contents = await file.read()
    resume_text = extract_text_from_pdf(BytesIO(contents))
    extracted_skills = extract_skills(resume_text)

    internships = scrape_internships()
    matched_internships = match_internships(resume_text, internships)

    return {
        "skills": extracted_skills,
        "matched_internships": matched_internships
    }
