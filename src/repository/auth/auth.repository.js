const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../../schemas/User/User");

function buildAuthResponse(user) {
  const token = jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email || user.username,
      name: user.name,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return {
    authorization_token: token,
    user: {
      _id: user._id.toString(),
      name: user.name,
      email: user.email || user.username,
      role: user.role,
      isActive: user.isActive !== undefined ? user.isActive : user.is_active,
      createdAt: user.createdAt,
    },
  };
}

async function findUserByUsername(username) {
  const escapedUsername = String(username).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return User.findOne({
    $or: [
      { email: { $regex: new RegExp(`^${escapedUsername}$`, "i") } },
      { username: { $regex: new RegExp(`^${escapedUsername}$`, "i") } },
    ],
  });
}

async function loginUser({ username, password }) {
  const user = await findUserByUsername(username);

  if (!user) {
    return { status: "error", data: { message: `${username} user does not exist` } };
  }

  const isActive = user.isActive !== undefined ? user.isActive : user.is_active;
  if (!isActive) {
    return { status: "error", data: { message: "User account is not active." } };
  }

  let isValid = false;
  if (user.passwordHash) {
    isValid = await bcrypt.compare(password, user.passwordHash);
  } else if (user.password) {
    isValid = password === user.password;
  }

  if (!isValid) {
    return { status: "error", data: { message: "Invalid username and password" } };
  }

  return {
    status: "success",
    data: buildAuthResponse(user),
    message: "Login successful",
  };
}

async function registerUser({ name, email, password }) {
  const normalizedEmail = String(email).toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return { status: "error", data: { message: "User already exists with this email." } };
  }

  const totalUsers = await User.countDocuments();
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name,
    email: normalizedEmail,
    passwordHash,
    role: totalUsers === 0 ? "admin" : "editor",
    isActive: true,
  });

  return {
    status: "success",
    data: buildAuthResponse(user),
    message: "Registration successful",
  };
}

async function getUserById(id) {
  return User.findById(id).select("_id name email username role isActive is_active createdAt");
}

module.exports = {
  buildAuthResponse,
  findUserByUsername,
  getUserById,
  loginUser,
  registerUser,
};
