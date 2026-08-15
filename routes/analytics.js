const express = require("express");
const router = express.Router();
const { ScheduledSession } = require("../models/scheduledSession");
const { Booking } = require("../models/booking");
const { User } = require("../models/user");
const { Abonnement } = require("../models/abonnements");
const moment = require("moment-timezone");
const TZ = "Africa/Tunis";

/**
 * GET /api/v1/analytics/dashboard
 * Single endpoint — all KPIs for the main dashboard.
 */
router.get("/dashboard", async (req, res) => {
  try {
    const now = moment.tz(TZ).toDate();

    // ── Time boundaries (Strictly Tunis UTC+1 via moment-timezone) ──────────
    const tunisNow = moment.tz(TZ);
    const startOfToday = tunisNow.clone().startOf("day").toDate();
    const endOfToday = tunisNow.clone().endOf("day").toDate();
    // week = Sunday→Saturday (Tunis convention), isoWeek = Monday→Sunday
    const startOfWeek = tunisNow.clone().startOf("week").toDate(); // Sunday 00:00 Tunis
    const endOfWeek = tunisNow.clone().endOf("week").toDate();   // Saturday 23:59:59 Tunis

    // Explicit Tunis month boundaries
    const startOfMonth = tunisNow.clone().startOf("month").toDate();
    const endOfMonth = tunisNow.clone().endOf("month").toDate();
    const startOfLastMonth = tunisNow.clone().subtract(1, "month").startOf("month").toDate();
    const endOfLastMonth = tunisNow.clone().subtract(1, "month").endOf("month").toDate();
    const sevenDaysAgo = tunisNow.clone().subtract(6, "days").startOf("day").toDate();

    // ── 1. USERS ──────────────────────────────────────────────────────────────
    const totalUsers = await User.countDocuments();

    const newUsersThisMonth = await User.countDocuments({
      _id: { $gte: objectIdFromDate(startOfMonth), $lte: objectIdFromDate(endOfMonth) },
    });
    const newUsersLastMonth = await User.countDocuments({
      _id: { $gte: objectIdFromDate(startOfLastMonth), $lte: objectIdFromDate(endOfLastMonth) },
    });
    // Active members = users with at least 1 session credit left
    const activeMembers = await User.countDocuments({ sessionCount: { $gt: 0 } });

    // ── 2. SESSIONS TODAY ─────────────────────────────────────────────────────
    const todaySessions = await ScheduledSession.find({
      date: { $gte: startOfToday, $lte: endOfToday },
    })
      .populate("coach", "name")
      .populate("cours", "name")
      .sort({ startTime: 1 });

    const todaySessionCount = todaySessions.length;
    const fullSessionsToday = todaySessions.filter(
      (s) => s.maxCapacity > 0 && s.currentCapacity >= s.maxCapacity
    ).length;

    // ── 3. SESSIONS THIS WEEK + FILL RATE ─────────────────────────────────────
    const weekSessions = await ScheduledSession.find({
      date: { $gte: startOfWeek, $lte: endOfWeek },
    }).populate("coach", "name");

    const weekSessionCount = weekSessions.length;

    const sessionsWithCap = weekSessions.filter((s) => s.maxCapacity > 0);
    const totalCurrentCap = sessionsWithCap.reduce((sum, s) => sum + s.currentCapacity, 0);
    const totalMaxCap = sessionsWithCap.reduce((sum, s) => sum + s.maxCapacity, 0);
    
    const avgFillRate = totalMaxCap > 0
      ? Math.round((totalCurrentCap / totalMaxCap) * 100)
      : 0;

    // Top coach this week (most sessions assigned)
    const coachCount = {};
    weekSessions.forEach((s) => {
      if (s.coach?.name) coachCount[s.coach.name] = (coachCount[s.coach.name] || 0) + 1;
    });
    const topCoachEntry = Object.entries(coachCount).sort((a, b) => b[1] - a[1])[0] || null;

    // ── 4. BOOKINGS — status breakdown (current month, for donut chart) ─────────────
    const allBookings = await Booking.find({}, "status createdAt");

    const statusBreakdown = { payé: 0, "non payé": 0, annulé: 0, "en attente": 0 };
    allBookings.forEach((b) => {
      // Filter for current month only
      if (b.createdAt >= startOfMonth && b.createdAt <= endOfMonth) {
        if (statusBreakdown[b.status] !== undefined) statusBreakdown[b.status]++;
      }
    });

    // Bookings created this month (any status)
    const bookingsThisMonth = allBookings.filter(
      (b) => b.createdAt >= startOfMonth && b.createdAt <= endOfMonth
    ).length;

    const bookingsLastMonth = allBookings.filter(
      (b) => b.createdAt >= startOfLastMonth && b.createdAt <= endOfLastMonth
    ).length;

    // Paid bookings this month
    const paidThisMonth = allBookings.filter(
      (b) => b.status === "payé" && b.createdAt >= startOfMonth && b.createdAt <= endOfMonth
    ).length;

    const paidRate = bookingsThisMonth > 0
      ? Math.round((paidThisMonth / bookingsThisMonth) * 100)
      : 0;

    // ── 5. WAITLIST — strictly future sessions only ────────────────────────────
    // Get all sessions from today onwards, then filter to those that truly haven't started.
    // startTime is stored as "HH:MM" local Tunisian time (UTC+1).
    const todayPlusSessions = await ScheduledSession.find(
      { date: { $gte: startOfToday } },
      "_id date startTime"
    );

    const futureSessionIds = todayPlusSessions
      .filter((s) => {
        const [h = 0, m = 0] = (s.startTime || "00:00").split(":").map(Number);
        // Reconstruct session datetime in UTC: date (UTC midnight) + (h-1)h for UTC+1
        const sessionDT = new Date(s.date);
        sessionDT.setUTCHours(h - 1, m, 0, 0);
        return sessionDT > now;
      })
      .map((s) => s._id);

    let waitlistCount = 0;
    let waitlistSessionsCount = 0;

    if (futureSessionIds.length > 0) {
      waitlistCount = await Booking.countDocuments({
        scheduledSession: { $in: futureSessionIds },
        status: "en attente",
      });
      const waitlistSessionIds = await Booking.distinct("scheduledSession", {
        scheduledSession: { $in: futureSessionIds },
        status: "en attente",
      });
      waitlistSessionsCount = waitlistSessionIds.length;
    }

    // ── 6. WEEKLY BOOKINGS (bar chart) ─────────────────────────────────────────
    const currentWeekStart = tunisNow.clone().startOf("week");  // Sunday
    const currentWeekEnd = tunisNow.clone().endOf("week");      // Saturday
    const pastWeekStart = tunisNow.clone().subtract(1, "weeks").startOf("week");
    const pastWeekEnd = tunisNow.clone().subtract(1, "weeks").endOf("week");

    // Fetch sessions for the past and current week
    const targetSessions = await ScheduledSession.find({
      date: { $gte: pastWeekStart.toDate(), $lte: currentWeekEnd.toDate() }
    }, "_id date");

    const sessionDates = {};
    targetSessions.forEach(s => {
      sessionDates[s._id.toString()] = moment.tz(s.date, TZ).format("YYYY-MM-DD");
    });

    const targetSessionIds = targetSessions.map(s => s._id);

    // Fetch valid bookings for these sessions
    const targetBookings = await Booking.find(
      { 
        scheduledSession: { $in: targetSessionIds },
        status: { $ne: "annulé" } // Exclude cancelled
      },
      "status scheduledSession"
    );

    const bookingsByDate = {};
    targetBookings.forEach(b => {
      const d = sessionDates[b.scheduledSession.toString()];
      if (!d) return;
      if (!bookingsByDate[d]) bookingsByDate[d] = { total: 0, paid: 0 };
      bookingsByDate[d].total++;
      if (b.status === "payé") bookingsByDate[d].paid++;
    });

    const buildWeekData = (startMom) => {
      const arr = [];
      for (let i = 0; i < 7; i++) {
        const d = startMom.clone().add(i, "days").format("YYYY-MM-DD");
        const dayData = bookingsByDate[d] || { total: 0, paid: 0 };
        arr.push({
          date: d,
          label: moment.tz(d, TZ).locale("fr").format("ddd D"),
          total: dayData.total,
          paid: dayData.paid,
        });
      }
      return arr;
    };

    const currentWeek = buildWeekData(currentWeekStart);
    const pastWeek = buildWeekData(pastWeekStart);

    // ── 7. NEXT UPCOMING SESSION ───────────────────────────────────────────────
    const candidateSessions = await ScheduledSession.find(
      { date: { $gte: startOfToday } },
    )
      .populate("coach", "name")
      .populate("cours", "name")
      .sort({ date: 1, startTime: 1 });

    let nextSession = null;
    for (const session of candidateSessions) {
      const [h = 0, m = 0] = (session.startTime || "00:00").split(":").map(Number);
      const sessionDT = new Date(session.date);
      sessionDT.setUTCHours(h - 1, m, 0, 0); // UTC+1
      
      if (sessionDT > now) {
        nextSession = session;
        break;
      }
    }

    // ── Construct final object ───────────────────────────────────────────────
    res.json({
      users: {
        total: totalUsers,
        newThisMonth: newUsersThisMonth,
        newLastMonth: newUsersLastMonth,
        growth: newUsersLastMonth > 0 
          ? Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100) 
          : 0,
        activeMembers,
      },

      sessions: {
        today: todaySessionCount,
        fullToday: fullSessionsToday,
        thisWeek: weekSessionCount,
        avgFillRate,
        topCoach: topCoachEntry ? {
          name: topCoachEntry[0],
          sessionCount: topCoachEntry[1]
        } : null,
      },

      bookings: {
        thisMonth: bookingsThisMonth,
        lastMonth: bookingsLastMonth,
        growth: bookingsLastMonth > 0
          ? Math.round(((bookingsThisMonth - bookingsLastMonth) / bookingsLastMonth) * 100)
          : 0,
        paidRate,
        statusBreakdown,
        waitlistCount,
        waitlistSessionsCount,
        currentWeek,
        pastWeek,
      },

      nextSession: nextSession ? {
        id: nextSession._id,
        name: nextSession.name,
        cours: nextSession.cours?.name,
        coach: nextSession.coach?.name,
        date: nextSession.date,
        startTime: nextSession.startTime,
        endTime: nextSession.endTime,
        maxCapacity: nextSession.maxCapacity,
        currentCapacity: nextSession.currentCapacity,
      } : null,

    });
  } catch (error) {
    console.error("Dashboard Analytics Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

function objectIdFromDate(date) {
  return Math.floor(date.getTime() / 1000).toString(16) + "0000000000000000";
}

module.exports = router;
