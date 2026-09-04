import cron from "node-cron";
import {
  sweepNoShowBookings,
  sweepCompletedBookings,
  sweepBookingReminders,
} from "../controllers/bookingController";
import { sweepOverdueBooks, sweepDueReminders } from "../controllers/bookController";

export const startCronJobs = (): void => {
  // Every 5 minutes: auto-cancel bookings whose grace period has passed
  // and apply no-show penalties.
  cron.schedule("*/5 * * * *", async () => {
    try {
      await sweepNoShowBookings();
      await sweepCompletedBookings();
    } catch (err) {
      console.error("No-show sweep failed:", err);
    }
  });

  // Every minute: email students whose seat booking starts in ~10 minutes.
  cron.schedule("* * * * *", async () => {
    try {
      await sweepBookingReminders();
    } catch (err) {
      console.error("Booking reminder sweep failed:", err);
    }
  });

  // Once a day at midnight: recalculate fines for overdue books and
  // convert to "purchased" once the fine cap is reached.
  cron.schedule("0 0 * * *", async () => {
    try {
      await sweepOverdueBooks();
    } catch (err) {
      console.error("Overdue book sweep failed:", err);
    }
  });

  // Once a day at 9 AM: email students whose book is due in 3 days.
  cron.schedule("0 9 * * *", async () => {
    try {
      await sweepDueReminders();
    } catch (err) {
      console.error("Due-date reminder sweep failed:", err);
    }
  });

  console.log(
    "Cron jobs scheduled: no-show sweep (5 min), booking reminders (1 min), overdue sweep (daily), due-date reminders (daily 9am)"
  );
};
