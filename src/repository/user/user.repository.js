const bcrypt = require("bcryptjs");
const User = require("../../schemas/User/User");

async function listUsers() {
  return User.find().select("_id name email role isActive createdAt").sort({ createdAt: -1 });
}

async function createUser({ name, email, password, role = "editor", isActive = true }) {
  const normalizedEmail = String(email).toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return { status: "error", data: { message: "User already exists with this email." } };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email: normalizedEmail, passwordHash, role, isActive });

  return {
    status: "success",
    data: {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    },
  };
}

async function updateUser(id, payload) {
  const user = await User.findById(id);
  if (!user) return null;

  if (payload.name) user.name = payload.name;
  if (payload.email) user.email = String(payload.email).toLowerCase();
  if (payload.role) user.role = payload.role;
  if (typeof payload.isActive === "boolean") user.isActive = payload.isActive;
  if (payload.password) {
    user.passwordHash = await bcrypt.hash(payload.password, 12);
  }

  await user.save();
  return {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

async function deleteUser(id) {
  return User.findByIdAndDelete(id);
}

async function countUsers() {
  return {
    totalUsers: await User.countDocuments(),
    activeUsers: await User.countDocuments({ isActive: true }),
  };
}

module.exports = {
  countUsers,
  createUser,
  deleteUser,
  listUsers,
  updateUser,
};
