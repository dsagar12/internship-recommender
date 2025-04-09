import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true, 
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"] 
    },
    password: { 
      type: String, 
      required: true, 
      minlength: [6, "Password must be at least 6 characters long"] 
    },
  },
  { timestamps: true } // ✅ Automatically adds `createdAt` & `updatedAt`
);

export default mongoose.model("User", UserSchema); // ✅ Using ES Modules
