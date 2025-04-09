import axios from "axios";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Internship } from "./models/internshipModel.js"; // Import Internship model

dotenv.config(); // Load environment variables

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

const fetchInternships = async () => {
  try {
    console.log("🔄 Fetching internships...");
    const internships = [];
    const totalPages = 5; // Fetch 5 pages (Adjust as needed)

    for (let page = 1; page <= totalPages; page++) {
      const options = {
        method: "GET",
        url: "https://jsearch.p.rapidapi.com/search",
        params: { query: "internship", page: page.toString(), num_pages: "1" },
        headers: {
          "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
          "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        },
      };

      const response = await axios.request(options);
      const fetchedInternships = response.data.data;

      if (!fetchedInternships || fetchedInternships.length === 0) {
        console.log(`⚠️ No more data on page ${page}. Stopping fetch.`);
        break;
      }

      internships.push(...fetchedInternships);
    }

    console.log(`✅ Fetched ${internships.length} Internships`);

    // ✅ Store in MongoDB (Avoid Duplicates)
    for (const job of internships) {
      await Internship.findOneAndUpdate(
        { title: job.job_title, company: job.employer_name },
        {
          title: job.job_title,
          company: job.employer_name,
          location: job.job_location || "Remote",
          stipend: job.job_salary || "Not Provided",
          duration: "Varies",
          skills: [], // Add skills if available
          description: job.job_description,
          applyLink: job.job_apply_link,
        },
        { upsert: true, new: true } // Update existing or insert new
      );
    }

    // ✅ Log Total Count
    const count = await Internship.countDocuments();
    console.log(`📊 Total Internships in DB: ${count}`);
  } catch (error) {
    console.error("❌ Error fetching internships:", error.message);
  }
};

// ✅ Run every 6 hours (Auto-update)
setInterval(fetchInternships, 6 * 60 * 60 * 1000);

// ✅ Initial Fetch
fetchInternships();
