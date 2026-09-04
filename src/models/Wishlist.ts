import { Schema, model, Document, Types } from "mongoose";

export interface IWishlist extends Document {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  book: Types.ObjectId;
}

const wishlistSchema = new Schema<IWishlist>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
  },
  { timestamps: true }
);

wishlistSchema.index({ student: 1, book: 1 }, { unique: true });

export default model<IWishlist>("Wishlist", wishlistSchema);
