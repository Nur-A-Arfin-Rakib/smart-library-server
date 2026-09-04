import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { stripe, isStripeConfigured } from "../utils/stripe";
import BorrowRecord from "../models/BorrowRecord";
import { AuthRequest } from "../middleware/authMiddleware";

// @route POST /api/payments/checkout-session/:recordId
// Creates a Stripe Checkout session for a student to pay off a specific
// borrow record's fine. Redirects to Stripe's hosted payment page.
export const createCheckoutSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isStripeConfigured() || !stripe) {
      res.status(503).json({
        message: "Online payment isn't configured on this server yet (missing STRIPE_SECRET_KEY)",
      });
      return;
    }

    const { recordId } = req.params;
    if (!isValidObjectId(recordId)) {
      res.status(400).json({ message: "That doesn't look like a valid borrow record ID" });
      return;
    }

    const record = await BorrowRecord.findOne({ _id: recordId, student: req.user!.id }).populate(
      "book",
      "title"
    );
    if (!record) {
      res.status(404).json({ message: "Borrow record not found" });
      return;
    }
    if (record.finePaid || record.fine <= 0) {
      res.status(400).json({ message: "There's no outstanding fine on this record" });
      return;
    }

    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const bookTitle = (record.book as any)?.title || "borrowed book";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "bdt",
            product_data: { name: `Late fine — ${bookTitle}` },
            unit_amount: record.fine * 100, // smallest currency unit
          },
          quantity: 1,
        },
      ],
      metadata: { recordId: record._id.toString() },
      success_url: `${clientUrl}/student/books?payment=success`,
      cancel_url: `${clientUrl}/student/books?payment=cancelled`,
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    res.status(500).json({ message: "Failed to start payment", error: (error as Error).message });
  }
};

// @route POST /api/payments/webhook
// Stripe calls this after a successful (or failed) checkout. Must receive
// the RAW request body — mounted with express.raw() in server.ts, before
// the global JSON body parser, so the signature can be verified.
export const stripeWebhook = async (req: Request, res: Response): Promise<void> => {
  if (!isStripeConfigured() || !stripe) {
    res.status(503).send("Stripe not configured");
    return;
  }

  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (!webhookSecret || !signature) {
      throw new Error("Webhook secret or signature missing");
    }
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    res.status(400).send(`Webhook signature verification failed: ${(err as Error).message}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { metadata?: { recordId?: string } };
    const recordId = session.metadata?.recordId;

    if (recordId) {
      await BorrowRecord.findByIdAndUpdate(recordId, { finePaid: true });
    }
  }

  res.status(200).json({ received: true });
};
