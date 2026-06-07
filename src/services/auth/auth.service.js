const { loginUser, registerUser, getUserById } = require("../../repository/auth/auth.repository");

async function loginUserService(req, res, next) {
  try {
    const result = await loginUser(req.body);

    if (result.status === "success") {
      return res.status(200).json({
        message: result.message,
        data: result.data,
      });
    }

    return res.status(401).json({ message: result.data.message });
  } catch (error) {
    return next(error);
  }
}

async function registerUserService(req, res, next) {
  try {
    const result = await registerUser(req.body);

    if (result.status === "success") {
      return res.status(201).json({
        message: result.message,
        data: result.data,
      });
    }

    return res.status(409).json({ message: result.data.message });
  } catch (error) {
    return next(error);
  }
}

async function meUserService(req, res, next) {
  try {
    const user = await getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "User fetched successfully",
      data: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email || user.username,
        role: user.role,
        isActive: user.isActive !== undefined ? user.isActive : user.is_active,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  loginUserService,
  meUserService,
  registerUserService,
};
