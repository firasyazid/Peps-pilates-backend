const express = require("express");
const router = express.Router();
const { ScheduledSession } = require("../models/scheduledSession");
const { Booking } = require("../models/booking");
const { User } = require("../models/user");
const SibApiV3Sdk = require('@sendinblue/client');
const { getEmailTemplate } = require("../utils/emailTemplate");
const { hasValidAbonnement } = require("../utils/abonnementEligibility");
require("dotenv/config");

// Configure Brevo (Sendinblue) API for waitlist email notifications
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
const brevoApiKey = apiInstance.authentications['apiKey'];
brevoApiKey.apiKey = process.env.BREVO_API_KEY;

// Helper: Send waitlist promotion email to user
async function sendWaitlistPromotionEmail(user, scheduledSession) {
  try {
    // Format date for display
    const sessionDate = new Date(scheduledSession.date);
    const formattedDate = sessionDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "🎉 Bonne nouvelle ! Une place s'est libérée pour votre séance";
    
    const bodyContent = `
      <h2 style="color: #2c3e50;">Bonjour <strong>${user.fullname}</strong>,</h2>
      <p style="font-size: 16px;">Bonne nouvelle ! Une place s'est libérée pour la séance à laquelle vous étiez en liste d'attente.</p>
      <div style="background-color: #f8f9fa; border-left: 4px solid #CF6A68; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 4px 0;"><strong>📅 Séance :</strong> ${scheduledSession.name}</p>
        <p style="margin: 4px 0;"><strong>📆 Date :</strong> ${formattedDate}</p>
        <p style="margin: 4px 0;"><strong>🕐 Horaire :</strong> ${scheduledSession.startTime} - ${scheduledSession.endTime}</p>
      </div>
      <p style="font-size: 16px;">Votre réservation a été automatiquement confirmée. Veuillez arriver 10 minutes avant le début du cours.</p>
      <div style="background-color: #FFF5F5; border-left: 4px solid #CF6A68; padding: 12px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px;"><strong>⚠️ Rappel :</strong> Toute annulation doit être faite au moins 4 heures avant le début de la séance.</p>
      </div>
      <p style="font-size: 16px;">À bientôt au studio !</p>
    `;

    sendSmtpEmail.htmlContent = getEmailTemplate("🎉 Bonne nouvelle !", bodyContent);
    sendSmtpEmail.sender = {
      name: process.env.SENDER_NAME || "Peps pilate studio",
      email: process.env.SENDER_EMAIL || "noreply@pilatesbackend.com"
    };
    sendSmtpEmail.to = [{ email: user.email, name: user.fullname }];

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`Waitlist promotion email sent to ${user.email} for session ${scheduledSession.name}`);
  } catch (error) {
    console.error(`Error sending waitlist promotion email to ${user.email}:`, error);
    // Don't throw — email failure should not block the promotion
  }
}

// Helper: Send booking confirmation or waitlist status email to user
async function sendBookingStatusEmail(user, scheduledSession, status, waitlistPosition = null) {
  try {
    const sessionDate = new Date(scheduledSession.date);
    const formattedDate = sessionDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    let subject = "";
    let bodyContent = "";

    const sessionName = scheduledSession.cours?.name || scheduledSession.name || 'Pilates';

    if (status === "en attente") {
      subject = "⏳ Vous êtes sur la liste d'attente";
      bodyContent = `
        <h2 style="color: #2c3e50;">Bonjour <strong>${user.fullname}</strong>,</h2>
        <p style="font-size: 16px;">Votre demande de réservation a été enregistrée. La séance étant actuellement complète, vous avez été ajouté(e) à la liste d'attente (position ${waitlistPosition}).</p>
        <div style="background-color: #f8f9fa; border-left: 4px solid #ebaa65; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>📅 Séance :</strong> ${sessionName}</p>
          <p style="margin: 4px 0;"><strong>📆 Date :</strong> ${formattedDate}</p>
          <p style="margin: 4px 0;"><strong>🕐 Horaire :</strong> ${scheduledSession.startTime} - ${scheduledSession.endTime}</p>
        </div>
        <p style="font-size: 16px;">Nous vous enverrons un email dès qu'une place se libère.</p>
        <p style="font-size: 16px;">À bientôt !</p>
      `;
    } else if (status === "payé" || status === "non payé") {
      subject = "✅ Confirmation de votre réservation";
      
      let statusMessage = status === "payé" 
        ? "Votre réservation a été confirmée (payée)." 
        : "Votre réservation a été enregistrée (non payée).";

      bodyContent = `
        <h2 style="color: #2c3e50;">Bonjour <strong>${user.fullname}</strong>,</h2>
        <p style="font-size: 16px;">${statusMessage} Voici les détails de votre séance :</p>
        <div style="background-color: #f8f9fa; border-left: 4px solid #CF6A68; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>📅 Séance :</strong> ${sessionName}</p>
          <p style="margin: 4px 0;"><strong>📆 Date :</strong> ${formattedDate}</p>
          <p style="margin: 4px 0;"><strong>🕐 Horaire :</strong> ${scheduledSession.startTime} - ${scheduledSession.endTime}</p>
        </div>
        <p style="font-size: 16px;">Veuillez arriver 10 minutes avant le début du cours.</p>
        <div style="background-color: #FFF5F5; border-left: 4px solid #CF6A68; padding: 12px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px;"><strong>⚠️ Rappel :</strong> Toute annulation doit être faite au moins 4 heures avant le début de la séance.</p>
        </div>
        <p style="font-size: 16px;">À bientôt au studio !</p>
      `;
    } else {
      return; // Ne pas envoyer d'email pour les autres statuts
    }

    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = getEmailTemplate(subject, bodyContent);
    sendSmtpEmail.sender = {
      name: process.env.SENDER_NAME || "Peps pilate studio",
      email: process.env.SENDER_EMAIL || "noreply@pilatesbackend.com"
    };
    sendSmtpEmail.to = [{ email: user.email, name: user.fullname }];

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`Booking status email (${status}) sent to ${user.email} for session ${sessionName}`);
  } catch (error) {
    console.error(`Error sending booking status email to ${user.email}:`, error);
  }
}

// Helper: Promote the first waitlisted user when a spot opens up
async function promoteFromWaitlist(scheduledSessionId) {
  try {
    // Find the oldest "en attente" booking for this session (FIFO)
    const waitlistedBooking = await Booking.findOne({
      scheduledSession: scheduledSessionId,
      status: "en attente"
    }).sort({ createdAt: 1 });

    if (!waitlistedBooking) {
      console.log(`No waitlisted bookings for session ${scheduledSessionId}`);
      return null;
    }

    const user = await User.findById(waitlistedBooking.user);
    if (!user) {
      console.error(`Waitlisted user ${waitlistedBooking.user} not found — skipping promotion`);
      // Mark this booking as cancelled since user doesn't exist, then try next
      waitlistedBooking.status = "annulé";
      await waitlistedBooking.save();
      return promoteFromWaitlist(scheduledSessionId); // Recursively try next
    }

    const session = await ScheduledSession.findById(scheduledSessionId);
    if (!session) {
      console.error(`Session ${scheduledSessionId} not found for waitlist promotion`);
      return null;
    }

    // Promote the booking
    if (user.sessionCount > 0) {
      waitlistedBooking.status = "payé";
      user.sessionCount -= 1;
      await user.save();
    } else {
      waitlistedBooking.status = "non payé";
    }

    await waitlistedBooking.save();

    // Only increment capacity if the promoted booking is "payé"
    // ("non payé" bookings do not count toward capacity, consistent with the booking creation logic)
    if (waitlistedBooking.status === "payé") {
      session.currentCapacity += 1;
      await session.save();
    }

    console.log(`Promoted waitlisted booking ${waitlistedBooking._id} for user ${user.fullname} → ${waitlistedBooking.status}`);

    // Send email notification (async, non-blocking)
    sendWaitlistPromotionEmail(user, session).catch(err => {
      console.error("Error sending waitlist email:", err);
    });

    return {
      promotedBooking: waitlistedBooking,
      promotedUser: user,
      newStatus: waitlistedBooking.status
    };
  } catch (error) {
    console.error(`Error promoting from waitlist for session ${scheduledSessionId}:`, error);
    return null;
  }
}

// Helper function to recalculate capacity from actual "payé" bookings
// This ensures capacity always matches the source of truth in the database
async function recalculateSessionCapacity(scheduledSessionId) {
  try {
    const scheduledSession = await ScheduledSession.findById(scheduledSessionId);
    if (!scheduledSession) {
      console.error(`Session ${scheduledSessionId} not found for capacity recalculation`);
      return null;
    }

    // Count only "payé" bookings for this session (only paid bookings count toward capacity)
    const paidBookingsCount = await Booking.countDocuments({
      scheduledSession: scheduledSessionId,
      status: "payé"
    });

    // Update capacity to match actual paid bookings
    const oldCapacity = scheduledSession.currentCapacity;
    scheduledSession.currentCapacity = paidBookingsCount;
    await scheduledSession.save();

    // Log if there was a discrepancy (for debugging)
    if (oldCapacity !== paidBookingsCount) {
      console.log(`Capacity corrected for session ${scheduledSessionId}: ${oldCapacity} → ${paidBookingsCount}`);
    }

    return {
      sessionId: scheduledSessionId,
      oldCapacity,
      newCapacity: paidBookingsCount,
      paidBookingsCount
    };
  } catch (error) {
    console.error(`Error recalculating capacity for session ${scheduledSessionId}:`, error);
    return null;
  }
}

// POST /api/bookings - Create a booking for a scheduled session
router.post("/", async (req, res) => {
  try {
    const { scheduledSessionId, userId } = req.body;

    // Vérifier si l'utilisateur existe
    const user = await User.findById(userId).populate("abonnement.abonnement");
    if (!user) {
      return res.status(404).json({ success: false, message: "Utilisateur non trouvé." });
    }

    // Vérifier si la session planifiée existe avec sa catégorie de cours
    const scheduledSession = await ScheduledSession.findById(scheduledSessionId)
      .populate({ path: "cours", populate: { path: "category" } });
    if (!scheduledSession) {
      return res.status(404).json({ success: false, message: "Session planifiée non trouvée." });
    }

    // Vérifier si la session est complète
    if (scheduledSession.currentCapacity >= scheduledSession.maxCapacity) {
      return res.status(400).json({ success: false, message: "Cette session est complète." });
    }

    // Vérifier l'abonnement valide (catégorie + expiration + sessions restantes)
    const abonnementCovers = hasValidAbonnement(user, scheduledSession);

    let bookingStatus = "non payé";

    if (abonnementCovers && user.sessionCount > 0) {
      user.sessionCount -= 1;
      await user.save();
      bookingStatus = "payé";
    }

    // Créer une nouvelle réservation
    const booking = new Booking({
      scheduledSession: scheduledSessionId,
      user: userId,
      status: bookingStatus,
    });

    const savedBooking = await booking.save();

    scheduledSession.currentCapacity += 1;
    await scheduledSession.save();

    sendBookingStatusEmail(user, scheduledSession, bookingStatus).catch(err => {
      console.error("Error sending booking email:", err);
    });

    res.status(201).json({
      success: true,
      message: bookingStatus === "payé" ? "Réservation confirmée." : "Réservation non payée.",
      data: savedBooking,
    });
  } catch (error) {
    console.error("Erreur lors de la création de la réservation :", error);
    res.status(500).json({ success: false, message: "Erreur interne du serveur." });
  }
});
// POST /api/bookings - Create a booking for a scheduled session this is itt!!!
router.post("/reserver-sessions", async (req, res) => {
  try {
    const { userId, scheduledSessionId } = req.body;

    if (!userId || !scheduledSessionId) {
      return res.status(400).json({ success: false, message: "IDs manquants" });
    }

    const user = await User.findById(userId).populate("abonnement.abonnement");
    if (!user) return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });

    const session = await ScheduledSession.findById(scheduledSessionId)
      .populate({ path: "cours", populate: { path: "category" } });
    if (!session) return res.status(404).json({ success: false, message: "Session non trouvée" });

    //  Vérifier si la session est dans le passé
    const [hours, minutes] = session.startTime.split(":").map(Number);
    const sessionDateTime = new Date(session.date);
    sessionDateTime.setHours(hours, minutes, 0, 0);

    if (sessionDateTime < new Date()) {
      return res.status(400).json({ success: false, message: "Impossible de réserver une session déjà passée." });
    }

    //  Vérifier si l'utilisateur a déjà réservé cette session
    const existingBooking = await Booking.findOne({
      user: userId,
      scheduledSession: scheduledSessionId,
      status: { $ne: "annulé" },
    });

    if (existingBooking) {
      return res.status(400).json({ success: false, message: "Vous avez déjà réservé cette session." });
    }

    //  Vérifier l'abonnement valide (catégorie + expiration)
    const willPay = hasValidAbonnement(user, session) && user.sessionCount > 0;

    if (willPay) {
      // Atomically claim a paid slot: the $expr condition and the $inc happen as a single
      // document operation in MongoDB, so two concurrent requests can't both read
      // "capacity available" and both write — only one findOneAndUpdate can win the last slot.
      const claimedSession = await ScheduledSession.findOneAndUpdate(
        {
          _id: scheduledSessionId,
          $expr: { $lt: ["$currentCapacity", "$maxCapacity"] },
        },
        { $inc: { currentCapacity: 1 } },
        { new: true }
      );

      if (claimedSession) {
        user.sessionCount -= 1;
        await user.save();

        const booking = new Booking({
          scheduledSession: scheduledSessionId,
          user: userId,
          status: "payé",
        });
        const savedBooking = await booking.save();

        sendBookingStatusEmail(user, claimedSession, "payé").catch(err => {
          console.error("Error sending booking status email:", err);
        });

        return res.status(201).json({
          success: true,
          message: "Réservation créée avec statut : payé",
          data: savedBooking,
        });
      }
      // Someone else took the last slot between our read and now — fall through to waitlist.
    }

    // Re-check capacity from the database (not the stale in-memory `session`) before deciding
    // between waitlist and an unpaid booking, since it may have changed since we first read it.
    const freshSession = await ScheduledSession.findById(scheduledSessionId);
    if (freshSession.currentCapacity >= freshSession.maxCapacity) {
      const waitlistCount = await Booking.countDocuments({
        scheduledSession: scheduledSessionId,
        status: "en attente"
      });
      const waitlistPosition = waitlistCount + 1;

      const waitlistBooking = new Booking({
        scheduledSession: scheduledSessionId,
        user: userId,
        status: "en attente",
      });

      const savedWaitlistBooking = await waitlistBooking.save();

      sendBookingStatusEmail(user, session, "en attente", waitlistPosition).catch(err => {
        console.error("Error sending waitlist status email:", err);
      });

      return res.status(201).json({
        success: true,
        waitlisted: true,
        waitlistPosition,
        message: `Vous êtes en liste d'attente (position ${waitlistPosition}). Vous serez notifié(e) par email si une place se libère.`,
        data: savedWaitlistBooking,
      });
    }

    const booking = new Booking({
      scheduledSession: scheduledSessionId,
      user: userId,
      status: "non payé",
    });

    const savedBooking = await booking.save();

    sendBookingStatusEmail(user, session, "non payé").catch(err => {
      console.error("Error sending booking status email:", err);
    });

    return res.status(201).json({
      success: true,
      message: "Réservation créée avec statut : non payé",
      data: savedBooking,
    });
  } catch (error) {
    console.error("Erreur lors de la réservation :", error);
    return res.status(500).json({ success: false, message: "Erreur interne du serveur" });
  }
});

//get all bookings
router.get("/", async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate({
        path: "scheduledSession",
        populate: [
          { path: "cours", select: "name description duration price intensityLevel" },
          { path: "coach", select: "name bio expertise" }
        ]
      })
      .populate("user", "fullname");

    res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).send("Internal Server Error");
  }
});

// GET /api/bookings/:id - Get a specific booking by ID with populated details
router.get('/daily-bookings', async (req, res) => {
  try {
    const bookings = await Booking.aggregate([
      {
        $group: {
          _id: { date: "$date", classType: "$classType" },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.date": 1 }
      }
    ]);

    const formattedData = bookings.reduce((acc, booking) => {
      const date = booking._id.date ? booking._id.date.toISOString().split('T')[0] : 'Unknown Date';
      const classType = booking._id.classType;
      const count = booking.count;

      // Initialize the date entry if it doesn't exist
      if (!acc[date]) {
        acc[date] = {};
      }

      // Add class type and count
      acc[date][classType] = count;
      return acc;
    }, {});

    res.json(formattedData);
  } catch (err) {
    console.error('Error fetching daily bookings:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Define the route with a dynamic ID after specific routes like /daily-bookings
router.get('/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.json(booking);
  } catch (err) {
    console.error('Error fetching booking:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deletedBooking = await Booking.findByIdAndDelete(req.params.id);
    if (!deletedBooking) {
      return res.status(404).json({ success: false, message: "booking not found!" });
    }

    // Deleting a "payé" booking removes a slot that was counted toward capacity —
    // recalculate from the DB and free the spot up for the waitlist.
    if (deletedBooking.status === "payé") {
      await recalculateSessionCapacity(deletedBooking.scheduledSession);
      const promotion = await promoteFromWaitlist(deletedBooking.scheduledSession);
      if (promotion) {
        console.log(`Delete: Auto-promoted user ${promotion.promotedUser.fullname} from waitlist`);
      }
    }

    return res.status(200).json({ success: true, message: "the booking is deleted!" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["non payé", "annulé"].includes(status)) {
    return res.status(400).send("Invalid status. Must be 'non payé' or 'annulé'.");
  }
  try {
    const existingBooking = await Booking.findById(id);
    if (!existingBooking) {
      return res.status(404).send("Booking not found.");
    }
    const previousStatus = existingBooking.status;

    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    // A "payé" booking counted toward currentCapacity; moving it away from "payé"
    // must free that slot, otherwise the counter drifts out of sync with real bookings.
    if (previousStatus === "payé" && status !== "payé") {
      await recalculateSessionCapacity(updatedBooking.scheduledSession);
      const promotion = await promoteFromWaitlist(updatedBooking.scheduledSession);
      if (promotion) {
        console.log(`Status update: Auto-promoted user ${promotion.promotedUser.fullname} from waitlist`);
      }
    }

    res.status(200).json(updatedBooking);
  } catch (error) {
    console.error("Error updating booking status:", error);
    res.status(500).send("Internal Server Error");
  }
});


//   Update booking status
router.put("/reserver-sessions/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;

    // Validate status
    const allowedStatuses = ["non payé", "payé", "annulé", "en attente"];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Statut invalide. Statuts autorisés : ${allowedStatuses.join(", ")}`,
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Réservation non trouvée." });
    }

    const previousStatus = booking.status;  // Save current status for comparison

    // Update status
    booking.status = status;
    await booking.save();

    // Fast path: Use increment/decrement for performance
    const scheduledSession = await ScheduledSession.findById(booking.scheduledSession);
    if (scheduledSession) {
      // Only decrement if cancelling a "payé" booking (it was counted)
      if (previousStatus === "payé" && status === "annulé" && scheduledSession.currentCapacity > 0) {
        scheduledSession.currentCapacity -= 1;
        await scheduledSession.save();

        // Auto-promote from waitlist when a paid booking is cancelled by admin
        const promotion = await promoteFromWaitlist(booking.scheduledSession);
        if (promotion) {
          console.log(`Admin cancel: Auto-promoted user ${promotion.promotedUser.fullname} from waitlist`);
        }
      }

      // If cancelling a "en attente" booking, no capacity change needed
      // (waitlisted bookings don't count toward capacity)

      // Only increment if changing to "payé" and wasn't already "payé"
      if (previousStatus !== "payé" && status === "payé") {
        // If promoting from "en attente", the user wasn't counted yet
        if (scheduledSession.currentCapacity < scheduledSession.maxCapacity) {
          scheduledSession.currentCapacity += 1;
          await scheduledSession.save();
        } else {
          // Revert status if capacity is full
          booking.status = previousStatus;
          await booking.save();
          return res.status(400).json({
            success: false,
            message: "Impossible de payer: la session est complète.",
          });
        }
      }
    }

    // Safety net: Recalculate capacity from database to catch any discrepancies
    recalculateSessionCapacity(booking.scheduledSession).catch(err => {
      console.error("Error in background capacity recalculation:", err);
    });

    return res.status(200).json({
      success: true,
      message: `Statut de la réservation mis à jour : ${status}`,
      data: booking,
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut :", error);
    return res.status(500).json({ success: false, message: "Erreur interne du serveur." });
  }
});

// Cancel booking specifically (handles refund logic)
router.put("/cancel/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId).populate("scheduledSession");
    if (!booking) {
      return res.status(404).json({ success: false, message: "Réservation non trouvée." });
    }

    if (booking.status === "annulé") {
      return res.status(400).json({ success: false, message: "La réservation est déjà annulée." });
    }

    const { scheduledSession } = booking;
    if (!scheduledSession) {
      return res.status(404).json({ success: false, message: "Session associée non trouvée." });
    }

    const previousStatus = booking.status;

    // --- Waitlisted booking: can cancel anytime, no time restriction, no capacity/refund ---
    if (previousStatus === "en attente") {
      booking.status = "annulé";
      await booking.save();

      return res.status(200).json({
        success: true,
        message: "Vous avez quitté la liste d'attente.",
        data: booking,
      });
    }

    // --- Time Check Logic (Tunisian Time) for confirmed bookings ---
    // Tunisia is UTC+1 (CET).
    const sessionDateStr = scheduledSession.date.toISOString().split("T")[0]; // "YYYY-MM-DD"
    const sessionDateTimeStr = `${sessionDateStr}T${scheduledSession.startTime}:00`;
    const sessionDateObj = new Date(`${sessionDateTimeStr}+01:00`);

    const now = new Date();
    const diffInMs = sessionDateObj - now;
    const diffInHours = diffInMs / (1000 * 60 * 60);

    // Debug logs
    console.log(`Checking cancellation for Booking ${bookingId}`);
    console.log(`Session (Tunisia): ${sessionDateObj.toISOString()}`);
    console.log(`Now (Server/UTC): ${now.toISOString()}`);
    console.log(`Diff in Hours: ${diffInHours}`);

    if (diffInHours < 4) {
      return res.status(400).json({
        success: false,
        message: "L'annulation n'est possible que jusqu'à 4 heures avant le début de la séance."
      });
    }

    // --- Proceed with Cancellation ---
    booking.status = "annulé";
    await booking.save();

    // 1. Update Session Capacity
    if (previousStatus === "payé" && scheduledSession.currentCapacity > 0) {
      scheduledSession.currentCapacity -= 1;
      await scheduledSession.save();
    }

    // 2. Refund User (if they paid)
    if (previousStatus === "payé") {
      const user = await User.findById(booking.user);
      if (user) {
        user.sessionCount += 1;
        await user.save();
      }
    }

    // 3. Auto-promote first waitlisted user (if any)
    const promotion = await promoteFromWaitlist(booking.scheduledSession._id);
    if (promotion) {
      console.log(`Auto-promoted user ${promotion.promotedUser.fullname} from waitlist`);
    }

    // Background capacity check
    recalculateSessionCapacity(booking.scheduledSession._id).catch(err => {
      console.error("Error in background capacity recalculation:", err);
    });

    return res.status(200).json({
      success: true,
      message: "Réservation annulée avec succès. Votre séance a été remboursée.",
      data: booking,
    });
  } catch (error) {
    console.error("Erreur lors de l'annulation de la réservation :", error);
    return res.status(500).json({ success: false, message: "Erreur interne du serveur." });
  }
});



router.get("/:scheduledSessionId/users", async (req, res) => {
  try {
    const { scheduledSessionId } = req.params;

    const bookings = await Booking.find({ scheduledSession: scheduledSessionId }).populate("user", "fullname email phone");

    if (!bookings || bookings.length === 0) {
      return res.status(404).send("No users found for the given session.");
    }

    // Filter out bookings where user was deleted or is null, and map valid ones
    const usersWithBookingInfo = bookings
      .filter((booking) => booking.user != null) // Filter out bookings with null/deleted users
      .map((booking) => {
        return {
          _id: booking.user._id,
          fullname: booking.user.fullname,
          email: booking.user.email,
          phone: booking.user.phone,
          id: booking.user._id,
          bookingId: booking._id,  // Include the booking ID
          status: booking.status   // Include the booking status
        };
      });

    // Return empty array instead of 404 if all users are deleted
    res.status(200).json(usersWithBookingInfo);
  } catch (error) {
    console.error("Error fetching users for the scheduled session:", error);
    console.error("Error details:", error.message);
    res.status(500).json({ 
      success: false, 
      message: "Internal Server Error",
      error: error.message 
    });
  }
});

module.exports = router;
