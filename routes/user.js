const { User } = require("../models/user");
const { getEmailTemplate } = require("../utils/emailTemplate");
const { Abonnement } = require("../models/abonnements");
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const SibApiV3Sdk = require('@sendinblue/client');
const mongoose = require("mongoose");
const crypto = require("crypto");
const { Booking } = require("../models/booking");
const upload = require("../middleware/upload");
const rateLimit = require("express-rate-limit");
require("dotenv/config");

// rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Limit each IP to 5 requests per `windowMs`
  message: "Trop de tentatives de connexion depuis cette adresse IP, veuillez réessayer après 5 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure Brevo (Sendinblue) API
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
const apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_API_KEY;







router.get('/last-user', async (req, res) => {
  try {
    const userList = await User.find().select("-passwordHash").sort({ _id: -1 });

    if (!userList) {
      return res.status(500).json({ success: false, message: "No users found" });
    }
    res.status(200).send(userList);
  } catch (error) {
    console.error("Error fetching the last user:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
router.get('/total', async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

const VALID_ROLES = ["user", "admin", "assistant"];

// Accounts created before the `role` field existed have isAdmin=true but no
// stored role, which would otherwise default to "user" and contradict isAdmin.
// Fall back to isAdmin whenever role hasn't been explicitly set to something
// other than the schema default.
function resolveEffectiveRole(user) {
  if (user.role && user.role !== "user") return user.role;
  return user.isAdmin ? "admin" : "user";
}

router.post("/inscription", authLimiter, async (req, res) => {
  try {
    const { fullname, email, password, phone, isAdmin, role, languagePreference = "fr" } = req.body;
    if (!fullname || !email || !password) {
      return res.status(400).send("Fullname, email, and password are required.");
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send("User with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // `role` is the source of truth going forward; `isAdmin` is kept in sync for
    // backward compatibility with older clients (mobile app, dead JWT middleware).
    // Both "admin" and "assistant" get isAdmin=true since they share the same
    // dashboard access level — the frontend hides the dashboard overview for assistants.
    const resolvedRole = VALID_ROLES.includes(role) ? role : (isAdmin ? "admin" : "user");
    const resolvedIsAdmin = resolvedRole === "admin" || resolvedRole === "assistant";

    const user = new User({
      fullname,
      email,
      passwordHash,
      phone,
      isAdmin: resolvedIsAdmin,
      role: resolvedRole,
      languagePreference,
    });

    const savedUser = await user.save();
    if (!savedUser) {
      return res.status(400).send("The user could not be created.");
    }

    res.status(201).send({
      id: savedUser.id,
      fullname: savedUser.fullname,
      email: savedUser.email,
      phone: savedUser.phone,
      isAdmin: savedUser.isAdmin,
      role: savedUser.role,
      languagePreference: savedUser.languagePreference,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send("Error creating user");
  }
});

router.get(`/`, async (req, res) => {
  const userList = await User.find().select("-passwordHash").sort({ _id: -1 });

  if (!userList) {
    res.status(500).json({ success: false });
  }
  res.status(200).send(userList);
});

router.get("/:id", async (req, res) => {
  const user = await User.findById(req.params.id).select("-passwordHash");

  if (!user) {
    res
      .status(500)
      .json({ message: "The user with the given ID was not found." });
  }
  res.status(200).send(user);
});

router.put("/:id", async (req, res) => {
  try {
    const userExist = await User.findById(req.params.id);
    if (!userExist) return res.status(404).send("User not found!");

    let newPassword;
    if (req.body.password) {
      newPassword = bcrypt.hashSync(req.body.password, 10);
    } else {
      newPassword = userExist.passwordHash;
    }

    // Same role/isAdmin sync as /inscription — role is authoritative when provided.
    const resolvedRole = VALID_ROLES.includes(req.body.role)
      ? req.body.role
      : (req.body.isAdmin !== undefined ? (req.body.isAdmin ? "admin" : "user") : userExist.role);
    const resolvedIsAdmin = resolvedRole === "admin" || resolvedRole === "assistant";

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        fullname: req.body.fullname,
        email: req.body.email,
        passwordHash: newPassword,
        phone: req.body.phone,
        isAdmin: resolvedIsAdmin,
        role: resolvedRole,
        sessionCount: req.body.sessionCount !== undefined ? req.body.sessionCount : userExist.sessionCount,
      },
      { new: true }
    );

    if (!user) return res.status(400).send("The user cannot be updated!");



    res.send(user);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/login", authLimiter, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    const secret = process.env.secret;

    if (!user) {
      return res.status(404).send("Utilisateur non trouvé");
    }

    const isPasswordValid = await bcrypt.compare(req.body.password, user.passwordHash);
    if (isPasswordValid) {
      const effectiveRole = resolveEffectiveRole(user);
      const token = jwt.sign(
        {
          userId: user.id,
          isAdmin: user.isAdmin,
          role: effectiveRole,
        },
        secret,
        { expiresIn: "3d" }
      );

      return res.status(200).send({
        user: user.email,
        userId: user.id,
        token: token,
        isAdmin: user.isAdmin,
        role: effectiveRole,
        fullname: user.fullname,
        phone: user.phone,
        languagePreference: user.languagePreference,
      });
    } else {
      return res.status(401).send("Mot de passe incorrect");
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send("Erreur interne du serveur");
  }
});

router.get(`/get/count`, async (req, res) => {
  const userCount = await User.countDocuments();
  if (!userCount) {
    res.status(500).json({ success: false });
  }
  res.send({
    userCount: userCount,
  });
});

router.delete("/:id", (req, res) => {
  User.findByIdAndRemove(req.params.id)
    .then((user) => {
      if (user) {
        return res
          .status(200)
          .json({ success: true, message: "the user is deleted!" });
      } else {
        return res
          .status(404)
          .json({ success: false, message: "user not found!" });
      }
    })
    .catch((err) => {
      return res.status(500).json({ success: false, error: err });
    });
});

router.put("/update/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { email, name, lastname, password, validation } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send("User not found");
    }

    if (email) {
      user.email = email;
    }

    if (name) {
      user.name = name;
    }

    if (lastname) {
      user.lastname = lastname;
    }

    if (password) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      user.passwordHash = hashedPassword;
    }

    if (validation !== undefined) {
      user.validation = validation;
    }

    await user.save();
    res.status(200).send(user);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error updating user");
  }
});

///// purchase abonnement
router.post("/acheter-abonnement/:userId", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.params.userId;
    const abonnementId = req.body.abonnementId;

    // Vérifier les IDs
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(abonnementId)) {
      await session.abortTransaction();
      return res.status(400).send("ID utilisateur ou abonnement invalide");
    }

    // Vérifier si l'utilisateur existe
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).send("Utilisateur non trouvé");
    }

    // Vérifier si l'abonnement existe
    const abonnement = await Abonnement.findById(abonnementId).session(session);
    if (!abonnement) {
      await session.abortTransaction();
      return res.status(404).send("Abonnement non trouvé");
    }

    const currentDate = new Date();
    let baseDate = (user.expirationDate && user.expirationDate > currentDate)
      ? new Date(user.expirationDate)
      : currentDate;

    const expirationDate = new Date(baseDate);
    expirationDate.setDate(expirationDate.getDate() + abonnement.duration);

    // Ajouter l'abonnement au user (statut non payé)
    user.abonnement.push({
      abonnement: abonnement._id,
      sessionCount: abonnement.sessionCount,
      expirationDate: expirationDate,
      purchasedAt: new Date(),
      statut: "non payé",
    });
    await user.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(200).send({
      message: "Abonnement réservé avec succès (en attente de paiement)",
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        abonnement: user.abonnement,
      },
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Erreur lors de l'achat de l'abonnement :", error);
    res.status(500).send("Erreur interne du serveur");
  }
});

// payer abonnement
router.put("/valider-paiement/:userId/:abonnementId", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.params.userId;
    const abonnementId = req.params.abonnementId;

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(abonnementId)) {
      await session.abortTransaction();
      return res.status(400).send("ID utilisateur ou abonnement invalide");
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).send("Utilisateur non trouvé");
    }

    const abonnementItem = user.abonnement.find(
      (a) => a.abonnement.toString() === abonnementId && a.statut === "non payé"
    );

    if (!abonnementItem) {
      await session.abortTransaction();
      return res.status(404).send("Abonnement non trouvé ou déjà payé");
    }

    // Passer le statut à payé
    abonnementItem.statut = "payé";

    user.sessionCount += abonnementItem.sessionCount;

    await user.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(200).send({
      message: "Paiement validé et sessions ajoutées",
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        abonnement: user.abonnement,
        sessionCount: user.sessionCount,
      },
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Erreur lors de la validation du paiement :", error);
    res.status(500).send("Erreur interne du serveur");
  }
});



router.get("/users-by-abonnement/:abonnementId", async (req, res) => {
  try {
    const abonnementId = req.params.abonnementId;
    const abonnementObjectId = new mongoose.Types.ObjectId(abonnementId);

    const users = await User.aggregate([
      {
        $match: { "abonnement.abonnement": abonnementObjectId }
      },
      {
        $project: {
          fullname: 1,
          phone: 1,
          email: 1,
          sessionCount: 1,
          expirationDate: 1,
          abonnement: {
            $filter: {
              input: "$abonnement",
              as: "item",
              cond: { $eq: ["$$item.abonnement", abonnementObjectId] }
            }
          }
        }
      }
    ]);

    if (!users || users.length === 0) {
      return res.status(404).send("Aucun utilisateur trouvé pour cet abonnement");
    }

    res.status(200).json(users);
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs :", error);
    res.status(500).send("Erreur interne du serveur");
  }
});



router.get("/abonnement-user-count/:abonnementId", async (req, res) => {
  try {
    const abonnementId = req.params.abonnementId;

    // Count the number of users with the specified abonnement
    const userCount = await User.countDocuments({
      "abonnement.abonnement": abonnementId
    });

    res.status(200).send({ abonnementId, userCount });
  } catch (error) {
    console.error("Erreur lors de la récupération du nombre d'utilisateurs :", error);
    res.status(500).send("Erreur interne du serveur");
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // Vérifiez si l'utilisateur existe
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "Utilisateur introuvable" });
    }

    // Génération d'un token aléatoire à 5 chiffres
    const token = Math.floor(10000 + Math.random() * 90000);

    // Enregistrez le token et la date d'expiration
    user.tokenPassword = token;
    user.tokenPasswordExpiration = Date.now() + 60 * 60 * 1000; // Expiration dans 1 heure
    await user.save();

    // Configuration de l'email avec Brevo (Sendinblue)
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "Réinitialisation de mot de passe";
    
    const bodyContent = `
      <h2 style="color: #2c3e50;">Bonjour ${user.fullname},</h2>
      <p style="font-size: 16px;">Voici votre code de réinitialisation de mot de passe :</p>
      <div style="background-color: #f8f9fa; border: 1px solid #CF6A68; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <h1 style="color: #CF6A68; margin: 0; font-size: 32px; letter-spacing: 5px;">${token}</h1>
      </div>
      <p style="font-size: 14px; color: #666;">Ce code expirera dans 1 heure.</p>
    `;

    sendSmtpEmail.htmlContent = getEmailTemplate("Réinitialisation de mot de passe", bodyContent);
    sendSmtpEmail.sender = {
      name: process.env.SENDER_NAME || "Peps pilate studio",
      email: process.env.SENDER_EMAIL || "noreply@pilatesbackend.com"
    };
    sendSmtpEmail.to = [{ email: user.email, name: user.fullname }];

    // Envoi de l'email via Brevo
    try {
      await apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log("Email envoyé avec succès via Brevo");
      return res.status(200).json({
        success: true,
        message: "Code de réinitialisation envoyé par email avec succès"
      });
    } catch (emailError) {
      console.error("Erreur Brevo:", emailError);
      return res.status(500).json({
        success: false,
        message: "Échec de l'envoi de l'email",
        error: emailError.message
      });
    }
  } catch (error) {
    console.error("Erreur forgot password:", error);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    // Validate inputs
    if (!email || !token || !newPassword) {
      return res.status(400).send("Tous les champs sont obligatoires.");
    }

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send("Utilisateur introuvable.");
    }

    // Check if the token matches and is not expired
    if (
      user.tokenPassword !== parseInt(token, 10) || // Compare token as a number
      user.tokenPasswordExpiration < Date.now()
    ) {
      return res.status(400).send("Token invalide ou expiré.");
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password and clear the token
    user.passwordHash = hashedPassword;
    user.tokenPassword = null; // Clear the token
    user.tokenPasswordExpiration = null; // Clear the expiration
    await user.save();

    return res.status(200).send("Mot de passe réinitialisé avec succès.");
  } catch (error) {
    console.error("Erreur lors de la réinitialisation du mot de passe:", error);
    res.status(500).send("Erreur serveur.");
  }
});

router.put("/:id/email", async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Le champ email est obligatoire.",
      });
    }

    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: "Cet email est déjà utilisé.",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { email },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Email mis à jour avec succès.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'email:", error);
    res.status(500).json({
      success: false,
      message: "Erreur interne du serveur.",
      error,
    });
  }
});

// PUT route to update the phone number of a user
router.put("/update-phone/:userId", async (req, res) => {
  const { userId } = req.params;
  const { phone } = req.body;

  try {
    // Validate input
    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Update the user's phone field
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { phone },
      { new: true } // Return the updated document
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Phone number updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred while updating the phone number" });
  }
});

router.put("/update-password/:userId", async (req, res) => {
  const { userId } = req.params;
  const { currentPassword, newPassword } = req.body;

  try {
    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Both current and new passwords are required.",
      });
    }

    // Fetch user from the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify the current password
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res
        .status(401)
        .json({ message: "Current password is incorrect." });
    }

    // Hash the new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update the user's password
    user.passwordHash = newPasswordHash;
    const updatedUser = await user.save();

    res.status(200).json({
      message: "Password updated successfully.",
      user: { id: updatedUser.id, email: updatedUser.email },
    });
  } catch (error) {
    console.error("Error updating password:", error);
    res
      .status(500)
      .json({ message: "An error occurred while updating the password." });
  }
});

router.get("/user-booking/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const bookings = await Booking.find({ user: userId })
      .populate("scheduledSession")
      .populate("user", "-passwordHash")
      .sort({ createdAt: -1 });

    if (!bookings || bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bookings found for this user.",
      });
    }

    res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching bookings.",
    });
  }
});

router.put(
  "/:userId/update-image",
  upload.single("image"),
  async (req, res) => {
    try {
      const userId = req.params.userId;
      const file = req.file;

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { image: file.path },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(404).send("User not found");
      }

      res.send(updatedUser);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error updating user's image");
    }
  }
);

// Route to get all abonnements for a specific user
router.get("/Allabonnements/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "ID utilisateur invalide" });
    }

    // Fetch user and populate abonnements
    const user = await User.findById(userId)
      .populate({
        path: "abonnement.abonnement", // Populate abonnement details
        select: "name duration sessionCount price", // Select only necessary fields
      })
      .select("fullname email abonnement"); // Select relevant user fields

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    // Return the user's abonnements with structured data
    res.status(200).json({
      userId: user.id,
      fullname: user.fullname,
      email: user.email,
      abonnements: user.abonnement.map((item) => ({
        _id: item._id,
        abonnement: item.abonnement,
        sessionCount: item.sessionCount,
        expirationDate: item.expirationDate,
        purchasedAt: item.purchasedAt,
        statut: item.statut,
      })),
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des abonnements :", error);
    res.status(500).json({ error: "Erreur interne du serveur" });
  }
});


module.exports = router;
