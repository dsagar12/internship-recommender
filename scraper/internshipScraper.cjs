const { chromium } = require('playwright');
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb+srv://sdhawalapure:Sunita12345@cluster0.00quhdo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error", err));

const internshipSchema = new mongoose.Schema({
  title: String,
  company: String,
  location: String,
  duration: String,
  stipend: String,
  postedTime: String,
  fullLink: String,
  skills: [String],
  description: String,
  category: String // Added field to categorize internships
});

const Internship = mongoose.model("Internship", internshipSchema);

// List of technology categories to search for
const TECH_CATEGORIES = [
 
  "Full Stack Development",
  "Frontend Development",
  "Backend Development",
  "App Development",
  "Android Development",
  "iOS Development",
  "Flutter",
  "React Native",
  "React.js",
  "Vue.js",
  "Angular",
  "Node.js",
  "Express.js",
  "Java Development",
];

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  const allInternships = [];

  try {
    // Scrape each technology category
    for (const category of TECH_CATEGORIES) {
      console.log(`🔎 Searching for ${category} internships...`);
      
      const url = `https://internshala.com/internships/keywords-${encodeURIComponent(category)}`;
      console.log(`🌐 Visiting: ${url}`);
      
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // Scroll to load all internships
        for (let i = 0; i < 1; i++) {
          await page.mouse.wheel(0, 5000);
          await page.waitForTimeout(1500);
        }

        await page.waitForSelector('.individual_internship', { timeout: 15000 });

        // Get all internship links first
        const internshipLinks = await page.$$eval('.individual_internship .job-title-href', links => 
          links.map(link => 'https://internshala.com' + link.getAttribute('href'))
        );

        // Process each internship individually
        for (const link of internshipLinks) {
          console.log(`🔍 Processing: ${link}`);
          const detailPage = await context.newPage();
          
          try {
            await detailPage.goto(link, { waitUntil: 'networkidle', timeout: 30000 });
            
            // Extract basic info
            const internship = await detailPage.evaluate(() => {
              const title = document.querySelector('.individual_internship_header .heading_4_5.profile')?.textContent?.trim() || 'N/A';
              const company = document.querySelector('.individual_internship_header .company_name a')?.textContent?.trim() || 'N/A';
              const location = document.querySelector('#location_names span')?.textContent?.trim() || 'N/A';
              const duration = document.querySelector('.other_detail_item_row .other_detail_item:nth-child(2) .item_body')?.textContent?.trim() || 'N/A';
              const stipend = document.querySelector('.other_detail_item.stipend_container .item_body span')?.textContent?.trim() || 'N/A';
              const postedTime = document.querySelector('.other_detail_item.apply_by .item_body')?.textContent?.trim() || 'N/A';
              const description = document.querySelector('#about_internship .text-container')?.textContent?.trim() || 'N/A';

              // Extract skills
              const skillElements = document.querySelectorAll('.round_tabs_container .round_tabs');
              const skills = Array.from(skillElements).map(el => el.textContent.trim());

              return {
                title,
                company,
                location,
                duration,
                stipend,
                postedTime,
                fullLink: window.location.href,
                skills,
                description
              };
            });

            // Add category information
            internship.category = category;
            allInternships.push(internship);
            console.log(`✅ Scraped: ${internship.title} (${internship.skills.length} skills)`);
          } catch (err) {
            console.error(`❌ Error processing ${link}:`, err.message);
          } finally {
            await detailPage.close();
          }
        }
      } catch (error) {
        console.error(`❌ Error processing ${category} category:`, error.message);
      }
    }

    // Save to MongoDB
    if (allInternships.length > 0) {
      // Clear existing data before inserting new
      await Internship.deleteMany({});
      await Internship.insertMany(allInternships);
      console.log(`🚀 ${allInternships.length} internships saved to MongoDB!`);
    } else {
      console.log("⚠️ No internships found to save");
    }

  } catch (error) {
    console.error("❌ Main scraping error:", error);
  } finally {
    await browser.close();
    await mongoose.disconnect();
    process.exit();
  }
})();