import express from "express";
import dotenv from "dotenv";
import Internship from "../models/internshipModel.js";
import authMiddleware from "../middleware/authMiddleware.js";

dotenv.config();
const router = express.Router();

/**
 * ✅ GET - Fetch Internships with Pagination & Optional Filters
 */
router.get("/", async (req, res) => {
  try {
    let { page = 1, limit = 20, location, company } = req.query;

    // Convert to integers
    page = parseInt(page);
    limit = parseInt(limit);

    // 🔒 Optional: Set a max limit to avoid abuse
    const maxLimit = 100;
    if (limit > maxLimit) limit = maxLimit;

    const query = {};
    if (location) query.location = new RegExp(location, "i");
    if (company) query.company = new RegExp(company, "i");

    const internships = await Internship.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Internship.countDocuments(query);

    res.status(200).json({
      total,
      page,
      totalPages: Math.ceil(total / limit),
      internships,
    });
  } catch (error) {
    console.error("❌ Error fetching internships:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * ✅ POST - Add New Internship (Protected)
 */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { title, company, location, stipend, duration, skills, description, applyLink } = req.body;

    if (!title || !company || !location || !description || !applyLink) {
      return res.status(400).json({ error: "All required fields must be provided" });
    }

    const newInternship = new Internship({
      title,
      company,
      location,
      stipend,
      duration,
      skills,
      description,
      applyLink,
    });

    await newInternship.save();
    res.status(201).json({ message: "✅ Internship added successfully", internship: newInternship });
  } catch (error) {
    console.error("❌ Error adding internship:", error.message);
    res.status(500).json({ error: "Failed to add internship" });
  }
});

/**
 * ✅ DELETE - Delete Internship (Protected)
 */
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const internship = await Internship.findById(req.params.id);
    if (!internship) {
      return res.status(404).json({ error: "Internship not found" });
    }

    await internship.deleteOne();
    res.json({ message: "✅ Internship Deleted Successfully" });
  } catch (error) {
    console.error("❌ Error deleting internship:", error.message);
    res.status(500).json({ error: "Error deleting internship" });
  }
});

/**
 * ✅ PUT - Update Internship (Protected)
 */
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { title, company, location, stipend, duration, skills, description, applyLink } = req.body;

    const updatedInternship = await Internship.findByIdAndUpdate(
      req.params.id,
      { title, company, location, stipend, duration, skills, description, applyLink },
      { new: true }
    );

    if (!updatedInternship) {
      return res.status(404).json({ error: "Internship not found" });
    }

    res.json({ message: "✅ Internship Updated Successfully", internship: updatedInternship });
  } catch (error) {
    console.error("❌ Error updating internship:", error.message);
    res.status(500).json({ error: "Error updating internship" });
  }
});

export default router;
