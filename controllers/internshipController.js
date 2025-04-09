import Internship from "../models/Internship.js";

// Get all internships
export const getInternships = async (req, res) => {
  try {
    const internships = await Internship.find();
    res.status(200).json(internships);
  } catch (error) {
    console.error("Error fetching internships:", error);
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

// Add an internship
export const addInternship = async (req, res) => {
  try {
    const { title, company, location, stipend, duration, skills, description, applyLink } = req.body;

    // Check if all required fields are provided
    if (!title || !company || !location || !duration || !description || !applyLink) {
      return res.status(400).json({ msg: "All required fields must be filled" });
    }

    // Create a new internship entry
    const newInternship = new Internship({ title, company, location, stipend, duration, skills, description, applyLink });

    // Save to database
    await newInternship.save();
    res.status(201).json({ msg: "Internship added successfully", internship: newInternship });
  } catch (error) {
    console.error("Error adding internship:", error);
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};
