import { Schema, model, Document, Types } from "mongoose";

export interface IReview extends Document {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  book: Types.ObjectId;
  rating: number; // 1-5
  comment?: string;
}

const reviewSchema = new Schema<IReview>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
  },
  { timestamps: true }
);

reviewSchema.index({ student: 1, book: 1 }, { unique: true }); // one review per student per book

export default model<IReview>("Review", reviewSchema);
