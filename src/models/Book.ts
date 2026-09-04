import { Schema, model, Document, Types } from "mongoose";

export interface IBook extends Document {
  _id: Types.ObjectId;
  title: string;
  author: string;
  isbn: string;
  category?: string;
  shelfLocation?: string;
  totalCopies: number;
  availableCopies: number;
}

const bookSchema = new Schema<IBook>(
  {
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    isbn: { type: String, required: true, unique: true },
    category: { type: String },
    shelfLocation: { type: String },
    totalCopies: { type: Number, required: true, default: 1 },
    availableCopies: { type: Number, required: true, default: 1 },
  },
  { timestamps: true }
);

bookSchema.index({ title: "text", author: "text", category: "text" });

export default model<IBook>("Book", bookSchema);
