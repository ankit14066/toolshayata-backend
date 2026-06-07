const {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} = require("../../repository/user/user.repository");

async function listUsersService(_req, res, next) {
  try {
    const users = await listUsers();
    return res.json({ message: "Users fetched successfully", data: users });
  } catch (error) {
    return next(error);
  }
}

async function createUserService(req, res, next) {
  try {
    const result = await createUser(req.body);
    if (result.status === "error") {
      return res.status(409).json({ message: result.data.message });
    }

    return res.status(201).json({ message: "User created successfully", data: result.data });
  } catch (error) {
    return next(error);
  }
}

async function updateUserService(req, res, next) {
  try {
    const user = await updateUser(req.params.id, req.body);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ message: "User updated successfully", data: user });
  } catch (error) {
    return next(error);
  }
}

async function deleteUserService(req, res, next) {
  try {
    const user = await deleteUser(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ message: "User deleted successfully" });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createUserService,
  deleteUserService,
  listUsersService,
  updateUserService,
};
