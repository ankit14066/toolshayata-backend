const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function seedDefaultAdmin() {
  const adminEmail = String(process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const adminPassword = String(process.env.ADMIN_PASSWORD || "").trim();
  const adminName = String(process.env.ADMIN_NAME || "Techsahayta Admin").trim();

  if (!adminEmail || !adminPassword) {
    return;
  }

  const existingAdmin = await User.findOne({ email: adminEmail });
  if (existingAdmin) {
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await User.create({
    name: adminName,
    email: adminEmail,
    passwordHash,
    role: "admin",
    isActive: true,
  });
}

module.exports = { seedDefaultAdmin };

