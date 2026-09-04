import { Schema, model, Document, Types } from "mongoose";

export type BorrowStatus = "borrowed" | "returned" | "overdue" | "purchased";

export interface IBorrowRecord extends Document {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  book: Types.ObjectId;
  issueDate: Date;
  dueDate: Date;
  returnDate?: Date;
  status: BorrowStatus;
  fine: number;
  finePaid: boolean;
  renewed: boolean;
  dueReminderSent: boolean;
}

const borrowRecordSchema = new Schema<IBorrowRecord>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    issueDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, required: true },
    returnDate: { type: Date },
    status: {
      type: String,
      enum: ["borrowed", "returned", "overdue", "purchased"],
      default: "borrowed",
    },
    fine: { type: Number, default: 0 },
    finePaid: { type: Boolean, default: true }, // true until a fine is actually incurred
    renewed: { type: Boolean, default: false },
    dueReminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default model<IBorrowRecord>("BorrowRecord", borrowRecordSchema);
