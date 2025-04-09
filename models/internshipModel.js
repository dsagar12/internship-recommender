import mongoose from "mongoose";

const internshipSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    company: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    stipend: {
      type: String,
      default: "Unpaid",
      trim: true,
    },
    duration: {
      type: String,
      required: true,
      trim: true,
    },
    skills: {
      type: [String],
      default: [],
      validate: {
        validator: function(v) {
          return v.length <= 10; // Maximum 10 skills
        },
        message: "Cannot have more than 10 skills"
      }
    },
    description: {
      type: String,
      required: true,
    },
    applyLink: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return /^https?:\/\/[\w\d./?=#&%_-]+$/.test(v); // More robust URL regex
        },
        message: "❌ Invalid URL format for applyLink",
      },
    },
  },
  {
    timestamps: true, // createdAt & updatedAt auto-added
  }
);

const Internship = mongoose.model("Internship", internshipSchema);

export default Internship;
