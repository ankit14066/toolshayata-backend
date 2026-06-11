const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId).select("_id name email role isActive");

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "User is inactive or missing" });
    }

    req.user = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    };

    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: "You do not have access to this resource." });
    }
    
    const userRole = String(req.user.role).toLowerCase().trim();
    const extendedRoles = [...allowedRoles, "superadmin", "manager"].map(r => String(r).toLowerCase().trim());
    
    if (!extendedRoles.includes(userRole)) {
      return res.status(403).json({ message: `You do not have access to this resource. Role: ${userRole}` });
    }

    return next();
  };
}

module.exports = { requireAuth, requireRole };

