import generateToken from "../../config/helper/generateToken";
import { generateError } from "../../config/Error/functions";
import User from "../../schemas/User/User";

const findUserByUserName = async (data: any) => {
  try {
    const user = await User.findOne({
      username: { $regex: new RegExp(data.username, "i") },
    });
    if (user) {
      return user;
    }
    return null;
  } catch (err: any) {
    return null;
  }
};

const findUserById = async (id: any) => {
  try {
    const user = await User.findById(id).select('-password');
    if (user) {
      return user;
    }
    return null;
  } catch (err: any) {
    return null;
  }
};

const loginUser = async (data: any): Promise<any> => {
  try {
    const query: any = {};
    if (data.loginType === "code") {
      query.code = data.code
    } else {
      query.username = { $regex: `^${data.username}$`, $options: 'i' };
    }

    const existUser = await User.findOne(query);
    if (!existUser) {
      throw generateError(`${data.username} user does not exist`, 401);
    }

    if (existUser.password !== data.password) {
      throw generateError(`Invalid username and password`, 400);
    }

    const responseUser = {
      authorization_token: generateToken({ userId: existUser._id }),
    };

    return {
      status: "success",
      data: responseUser,
      message: `${existUser?.name} has been logged in successfully`,
    };
  } catch (err) {
    return { status: "error", data: err };
  }
};

const changePassword = async (data: any) => {
  try {
    const user = await User.findById(data.user);
    if (user) {
      if (!(user.password === data.oldPassword)) {
        throw generateError(
          `Current Password does not match to the Old Password`,
          400
        );
      }
      user.password = data.newPassword;
      await user.save();
      return { status: "success", data: null };
    } else {
      return { status: "error", data: "User Does not exists" };
    }
  } catch (err) {
    return { status: "error", data: err };
  }
};

export const updateUserRole = async (id: string, role: string) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { role: role },
      { new: true }
    );
    if (updatedUser) {
      return {
        status: "success",
        data: updatedUser,
      };
    }
    return {
      status: "error",
      data: "User does not exists",
    };
  } catch (err) {
    return { status: "error", data: err };
  }
};

const getRoleUsers = async (data : any) => {
  try {
    const users = await User.aggregate([
      {
        $lookup: {
          from: 'companydetails',
          localField: 'companyDetail',
          foreignField: '_id',
          as: 'companyDetails',
        },
      },
      {
        $match: {
          'companyDetails.company': data.company,
          role: { $in: ['manager', 'admin','superadmin'] },
          deletedAt: { $exists: false },
        },
      },
      {
        $project: {
          password: 0,
          companyDetails: 0,
        },
      },
    ]);

    return {
      status: "success",
      statusCode: 200,
      data: { data: users || [] },
    };
  } catch (err: any) {
    return {
      status: "error",
      statusCode: 500,
      message: err?.message || 'An error occurred',
    };
  }
};

export { loginUser, changePassword, findUserById, findUserByUserName, getRoleUsers };
