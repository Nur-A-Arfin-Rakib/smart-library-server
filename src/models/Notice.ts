import { Schema, model, Document, Types } from "mongoose";

export interface INotice extends Document {
  _id: Types.ObjectId;
  title: string;
  message: string;
  postedBy: Types.ObjectId;
  createdAt: Date;
}

const noticeSchema = new Schema<INotice>(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    postedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default model<INotice>("Notice", noticeSchema);
