import ProfileDetails from "../../schemas/User/ProfileDetails";
import BankDetails from "../../schemas/User/BankDetails";
import DocumentDetails from "../../schemas/User/Document";
import WorkExperience from "../../schemas/User/WorkExperience";
import { generateError } from "../../config/Error/functions";
import { deleteFile, uploadFile } from "../uploadDoc.repository";
import FamilyDetails from "../../schemas/User/FamilyDetails";
import Documents from "../../schemas/User/Document";
import { updateUserRoleService } from "../../services/auth/auth.service";
import mongoose from "mongoose";
import User from "../../schemas/User/User";
import { createCatchError } from "../../config/helper/function";
import { statusCode } from "../../config/helper/statusCode";
import Qualification from "../../schemas/User/Qualifications";
import SalaryStructure from "../../schemas/salaryStructure/SalaryStructure.schema";
import companyDetails from "../../schemas/company/companyDetails";

const createUser = async (data: any) => {
  try {
    const user = await User.findOne({ username: data.username });
    if (user) {
      throw generateError(`${user.username} user is already exists`, 300);
    }

    const userCode = await User.findOne({ code: data.code });
    if (userCode) {
      throw generateError(
        `${userCode.username} is already exists with ${data.code}`,
        300
      );
    }

    const createdUser = new User({
      username: data.username,
      company: data.company,
      name: data.name,
      code: data.code,
      password: data.password,
      bio: data.bio,
      is_active: true,
      title: data.title,
    });

    const savedUser = await createdUser.save();

    if (!savedUser) {
      throw generateError(`cannot create the user`, 400);
    }

    const {pic, ...rest} = data
    const profile = new ProfileDetails({
      user: savedUser._id,
      personalInfo : { ...rest }
    });

    const savedProfile = await profile.save();
    savedUser.profile_details = savedProfile._id;
    await savedUser.save();


    const { password, ...restUser } = savedUser.toObject();

    if (data.pic?.filename && data.pic && data.pic !== "" && Object.entries(data?.pic || {}).length) {
      let url = await uploadFile(data.pic);
      savedUser.pic = {
        name: data.pic.filename,
        url: url,
        type: data.pic.type,
      };
      await savedUser.save();
    }

    return {
      status: "success",
      data: {
        ...restUser,
        profile_details: savedProfile.toObject()
      },
    };
  } catch (err: any) {
    return {
      status: "error",
      data: err,
    };
  }
};

export const getSalaryStructure = async (data: any) => {
  try {
    const salaryStructures = await SalaryStructure.aggregate([
      { $match: { user: data.user } },

      { $sort: { createdAt : -1 } },

      {
        $group: {
          _id: "$user",
          currentSalaryStructure: { $first: "$$ROOT" },
          historicalSalaryStructures: { $push: "$$ROOT" },
        },
      },
      {
        $project: {
          _id: 0,
          currentSalaryStructure: 1,
          historicalSalaryStructures: 1,
        },
      },
    ]);

    if (salaryStructures.length === 0) {
      return {
        status: "success",
        data: null,
        message: "no such salary details exists",
        statusCode: 200,
      };
    }

    return {
      status: "success",
      data: salaryStructures[0],
      message: "no such salary details exists",
      statusCode: 200,
    };
  } catch (err: any) {
    return {
      status: "error",
      data: err?.message,
      message: err?.message,
      statusCode: 500,
    };
  }
};

export const updateSalaryStructure = async (data: any) => {
  try {
    const id = data.id;

    let updatedSalaryStructure;

    const existingSalaryStructure = await SalaryStructure.findOne({
      user: data.user,
      _id: id,
    });

    if (existingSalaryStructure) {
      updatedSalaryStructure = await SalaryStructure.findOneAndUpdate(
        { user: data.user, _id: id },
        { $set: {...data, updatedAt : new Date()} },
        { new: true }
      );

      return {
        data: updatedSalaryStructure,
        message: "Salary Structure has been successfully updated",
        statusCode: 200,
        status: "success",
      };
    } else {
      updatedSalaryStructure = await SalaryStructure.create({
        user: data.user,
        ...data,
        createdAt : new Date()
      });

      return {
        data: updatedSalaryStructure,
        message: "Salary Structure has been successfully created",
        statusCode: 201,
        status: "success",
      };
    }
  } catch (err: any) {
    return {
      status: "error",
      data: err?.message,
      message: err?.message,
      statusCode: 500,
    };
  }
};

const updateUserProfileDetails = async (data: any) => {
  try {
    const { pic, ...rest } = data;
    const users: any = await User.findByIdAndUpdate(data.userId, {
      $set: { ...rest },
    });

    delete rest.pic
    const pUsers = await ProfileDetails.findOneAndUpdate(
      { user: data.userId },
      { $set: { personalInfo: data?.profileDetails } }
    );
    if (!pUsers && !users) {
      return {
        status: "error",
        data: "User does not exists",
      };
    }

    if (pic?.isDeleted === 1 && users.pic?.name) {
      await deleteFile(users.pic.name);
      users.pic = {
        name: undefined,
        url: undefined,
        type: undefined,
      };
      await users.save();
    }

    if (pic && pic?.isAdd === 1 && pic?.filename && pic?.buffer) {
      const { filename, type } = pic;
      const url = await uploadFile(pic);
      users.pic = {
        name: filename,
        url,
        type,
      };
      await users.save();
    }

    return {
      status: "success",
      data: "User has been updated successfully",
    };
  } catch (err : any) {
    console.log(err?.message)
    return {
      status: "error",
      data: err,
    };
  }
};

const getUsers = async (data: {
  page: number;
  limit: number;
  search?: string;
  company?: string[];
}) => {
  try {
    // Validate and set default values for pagination parameters
    const page = Math.max(1, Number(data.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(data.limit) || 10)); // Enforce reasonable limit range
    const skip = (page - 1) * limit;
    // Base match conditions
    let matchConditions: any = {
      is_active: true,
      deletedAt: { $exists: false },
    };

    // Add company filter if provided
    if (data.company?.length) {
      matchConditions.company = { $in: data.company };
    }

    // Add search conditions if provided
    if (data.search?.trim()) {
      const searchRegex = new RegExp(data.search.trim(), "i");
      matchConditions.$or = [
        { username: { $regex: searchRegex } },
        { code: { $regex: searchRegex } },
      ];
    }

    // Main aggregation pipeline
    const pipeline: any = [
      { $match: matchConditions },
      {
        $lookup: {
          from: "profiledetails",
          localField: "profile_details",
          foreignField: "_id",
          as: "profileDetails",
        },
      },
      { $unwind: "$profileDetails" },
      { $sort: { createdAt: -1 } },
    ];

    // Execute parallel aggregations for data and metadata
    const [usersResult, totalResult]: any = await Promise.all([
      // Data pipeline
      User.aggregate([
        ...pipeline,
        { $skip: skip },
        { $limit: limit },
      ]),
      // Counts pipeline
      User.aggregate([
        { $match: matchConditions },
        {
          $facet: {
            total: [{ $count: "count" }],
          },
        },
      ]),
    ]);

    // Extract total count
    const totalCount = totalResult[0]?.total[0]?.count || 0;

    console.log(totalCount)
    const totalPages = Math.ceil(totalCount / limit);


    return {
      status: "success",
      data: usersResult,
      totalPages
      }
  } catch (err : any) {
    console.error("Error in getUsers:", err);
    return {
      status: "error",
      message: err.message,
      data: null,
    };
  }
};



const getCompanyDetailsByUserId = async (data: any) => {
  try {
    const result = await companyDetails.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(data.userId),
        },
      },
      {
        $unwind: "$details",
      },
      {
        $lookup: {
          from: "users",
          localField: "details.managers",
          foreignField: "_id",
          as: "details.managersDetails",
        },
      },
      {
        $lookup: {
          from: "departments",
          localField: "details.designation",
          foreignField: "_id",
          as: "details.designationDetails",
        },
      },
      {
        $lookup: {
          from: "departmentcategories",
          localField: "details.department",
          foreignField: "_id",
          as: "details.departmentDetails",
        },
      },
      {
        $project: {
          _id: 0,
          user: 1,
          company: 1,
          companyOrg: 1,
          "details.doj": 1,
          "details.confirmationDate": 1,
          "details.noticePeriod": 1,
          "details.eCode": 1,
          "details.eType": 1,
          "details.eCategory": 1,
          "details.description": 1,
          "details.createdAt": 1,
          // Only include specific fields from managersDetails
          "details.managersDetails": {
            name: 1,
            title: 1,
            role: 1,
            username: 1,
            code: 1,
          },
          "details.departmentDetails": 1,
          "details.designationDetails": 1,
        },
      },
    ]);

    return {
      status: "success",
      data: result,
      statusCode: 200,
    };
  } catch (error: any) {
    return {
      status: "error",
      data: error?.message,
      statusCode: 500,
    };
  }
};




const getUserById = async (data: any) => {
  try {
    const pipeline: any = [
      {
        $match: {
          _id: data.UserId,
          deletedAt: { $exists: false },
        },
      },
      {
        $lookup: {
          from: "profiledetails",
          localField: "_id",
          foreignField: "user",
          as: "profileDetails",
        },
      },
      {
        $lookup: {
          from: "bankdetails",
          localField: "_id",
          foreignField: "user",
          as: "bankDetails",
        },
      },
      {
        $lookup: {
          from: "documents",
          localField: "_id",
          foreignField: "user",
          as: "documents",
        },
      },
      {
        $lookup: {
          from: "familydetails",
          localField: "_id",
          foreignField: "user",
          as: "familyDetails",
        },
      },
      {
        $lookup: {
          from: "qualifications",
          localField: "_id",
          foreignField: "user",
          as: "qualifications",
        },
      },
      {
        $lookup: {
          from: "workexperiences",
          localField: "_id",
          foreignField: "user",
          as: "workExperience",
        },
      },
      {
        $lookup: {
          from: "companydetails",
          localField: "_id",
          foreignField: "user",
          as: "companyDetail",
        },
      },
    ];

    const UserData = await User.aggregate(pipeline);
    if (UserData.length === 1) {
      return {
        status: "success",
        data: UserData[0],
      };
    } else {
      return {
        status: "error",
        data: "User does not exists",
      };
    }
  } catch (err) {
    return {
      status: "error",
      data: err,
    };
  }
};

const getCountDesignationStatus = async (data: any) => {
  try {
    const designationCount = await User.aggregate([
      {
        $match: {
          company: data.company,
          companyOrg: data.companyOrg,
          deletedAt: { $exists: false },
        },
      },
      { $unwind: "$designation" },
      {
        $group: {
          _id: "$designation",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          designation: "$_id",
          count: 1,
        },
      },
    ]);

    return {
      status: "success",
      data: designationCount,
    };
  } catch (err) {
    return {
      status: "error",
      data: err,
    };
  }
};

const getTotalUsers = async (data: any) => {
  try {
    const result = await companyDetails.aggregate([
      {
        $match: {
          ...data,
          company: { $in: data.company },
          is_active: true,
          deletedAt: { $exists: false },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      status: "success",
      data: result.length > 0 ? result[0].count : 0,
      message: "Retrieved Users Counts Successfully",
      statusCode: statusCode.success,
    };
  } catch (err) {
    return createCatchError(err);
  }
};

// UPDATE BANK DETAILS OF THE User

const updateBankDetails = async (data: any) => {
  try {
    const { cancelledCheque, ...rest } = data;
    const updatedData: any = await BankDetails.findOneAndUpdate(
      { user: data.id },
      rest,
      {
        new: true,
      }
    );

    if (!updatedData) {
      return {
        status: "error",
        data: "bank Details does not exist",
      };
    }

    if (
      data?.cancelledCheque?.isDeleted === 1 &&
      updatedData.cancelledCheque?.name
    ) {
      await deleteFile(updatedData.cancelledCheque.name);
      updatedData.cancelledCheque = {
        name: undefined,
        url: undefined,
        type: undefined,
      };
      await updatedData.save();
    }

    if (
      data.cancelledCheque &&
      data.cancelledCheque?.isAdd === 1 &&
      data.cancelledCheque?.filename &&
      data.cancelledCheque?.buffer
    ) {
      const { filename, type } = data.cancelledCheque;
      const url = await uploadFile(data.cancelledCheque);
      updatedData.cancelledCheque = {
        name: filename,
        url,
        type,
      };
      await updatedData.save();
    }

    return {
      status: "success",
      data: updatedData,
    };
  } catch (err: any) {
    throw new Error(err);
  }
};

const updatePermissions = async (data: any) => {
  try {
    const updatedData: any = await User.findByIdAndUpdate(
      data.id,
      { permissions: data.permissions },
      {
        new: true,
      }
    );

    if (!updatedData) {
      return {
        status: "error",
        data: "User does not exist",
      };
    }

    return {
      status: "success",
      data: updatedData,
    };
  } catch (err: any) {
    throw new Error(err);
  }
};

const updateFamilyDetails = async (data: any) => {
  try {
    const updatedData: any = await FamilyDetails.findOneAndUpdate(
      { user: data.id },
      data,
      {
        new: true,
      }
    );

    if (!updatedData) {
      return {
        status: "error",
        data: "Family Details does not exist",
      };
    }

    return {
      status: "success",
      data: updatedData,
    };
  } catch (err: any) {
    throw new Error(err);
  }
};

const updateWorkExperienceDetails = async (data: any) => {
  try {
    let rest = data.experienceDetails;
    let workExperience: any = await WorkExperience.findOne({ user: data.id });
    if (workExperience) {
      for (var i = 0; i < rest.length; i++) {
        try {
          if (
            rest[i].certificate &&
            rest[i].certificate?.buffer &&
            rest[i].certificate.isAdd === 1
          ) {
            const { filename, type, isFileDeleted } = rest[i].certificate;
            const url = await uploadFile(rest[i].certificate);
            rest[i].certificate = {
              name: filename,
              url,
              type,
              isFileDeleted: isFileDeleted,
            };
          }

          if (
            rest[i].certificate.isFileDeleted === 1 &&
            workExperience.experienceDetails[i]?.certificate
          ) {
            await deleteFile(
              workExperience.experienceDetails[i].certificate?.name
            );
          }
        } catch (error) {}
      }
      const updatedData: any = await WorkExperience.findOneAndUpdate(
        { user: data.id },
        { experienceDetails: rest },
        {
          new: true,
        }
      );
      return {
        status: "success",
        data: updatedData,
      };
    } else {
      return {
        status: "error",
        data: "WorkExperience Details does not exists",
      };
    }
  } catch (err: any) {
    throw new Error(err);
  }
};

async function uploadDocument(originalDoc: any, data: any, fieldName: string) {
  try {
    if (
      data[fieldName] &&
      data[fieldName]?.isAdd === 1 &&
      data[fieldName]?.filename &&
      data[fieldName]?.buffer
    ) {
      const { filename, type } = data[fieldName];
      const url = await uploadFile(data[fieldName]);
      return { name: filename, url, type, validTill: "", effectiveFrom: "" };
    }
    if (
      data[fieldName] &&
      data[fieldName]?.isDeleted === 1 &&
      originalDoc[fieldName]
    ) {
      const deleted = await deleteFile(originalDoc[fieldName]?.name);
      return null;
    }
    return originalDoc[fieldName];
  } catch (error: any) {
    return null;
  }
}

async function updateDocumentDetails(data: any) {
  try {
    const docum = await Documents.findOne({ user: data.id });
    if (docum) {
      const { documents } = data;

      for (const file of data.deleteAttachments) {
        await deleteFile(file);
      }

      let attach_files: any = [];

      for (const file of documents) {
        try {
          if (file.file && file.isAdd) {
            let filename = `${data.id}_document_${file.file.filename}`;
            const documentInfo = await uploadFile({ ...file.file, filename });
            delete file.isAdd;
            attach_files.push({
              ...file,
              file: {
                url: documentInfo,
                name: filename,
                type: file.file.type,
              },
            });
          } else {
            if (file.file) {
              delete file.isAdd;
              attach_files.push({
                ...file,
              });
            } else {
              delete file.isAdd;
              attach_files.push({
                ...file,
                file: {
                  url: undefined,
                  name: undefined,
                  type: undefined,
                },
              });
            }
          }
        } catch (err: any) {
          console.error("Error uploading file:", err);
        }
      }

      docum.documents = attach_files;
      await docum.save();
      return {
        statusCode: statusCode.success,
        status: "success",
        data: docum,
      };
    } else {
      return {
        statusCode: statusCode.info,
        status: "error",
        data: "Documents do not exist",
      };
    }
  } catch (err) {
    return {
      statusCode: statusCode.serverError,
      status: "error",
      data: err,
    };
  }
}

async function updateQualificationDetails(data: any) {
  try {
    const docum = await Qualification.findOne({ user: data.id });
    if (docum) {
      const { qualifications } = data;

      for (const file of data.deleteAttachments) {
        await deleteFile(file);
      }

      let attach_files: any = [];

      for (const file of qualifications) {
        try {
          if (file.file && file.isAdd) {
            let filename = `${data.id}_qualification_${file.file.filename}`;
            const documentInfo = await uploadFile({ ...file.file, filename });
            delete file.isAdd;
            attach_files.push({
              ...file,
              file: {
                url: documentInfo,
                name: filename,
                type: file.file.type,
              },
            });
          } else {
            if (file.file) {
              delete file.isAdd;
              attach_files.push({
                ...file,
              });
            } else {
              delete file.isAdd;
              attach_files.push({
                ...file,
                file: {
                  url: undefined,
                  name: undefined,
                  type: undefined,
                },
              });
            }
          }
        } catch (err: any) {
          console.error("Error uploading file:", err);
        }
      }

      docum.qualifications = attach_files;
      await docum.save();
      return {
        statusCode: statusCode.success,
        status: "success",
        data: docum,
      };
    } else {
      return {
        statusCode: statusCode.info,
        status: "error",
        data: "Documents do not exist",
      };
    }
  } catch (err) {
    return {
      statusCode: statusCode.serverError,
      status: "error",
      data: err,
    };
  }
}

async function updateCompanyDetails(data: any) {
  try {
    const docum = await companyDetails.findOne({ user: data.id });
    if (docum) {
      docum.details.push(data.details);
      await docum.save();
      await updateUserRoleService(data.id, data.details.eType);
      return {
        status: "success",
        data: docum,
      };
    } else {
      return {
        status: "error",
        data: "Company Details do not exist",
      };
    }
  } catch (err) {
    return {
      status: "error",
      data: err,
    };
  }
}

export const getManagerUsers = async (data: any) => {
  try {
    let matchConditions: any = {
      is_active: true,
      deletedAt: { $exists: false },
      company: data.company,
    };

    const pipeline: any = [
      {
        $match: matchConditions,
      },
      {
        $addFields: {
          details: { $arrayElemAt: ["$details", -1] },
        },
      },
      {
        $match: {
          "details.managers": { $in: data.managers },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userData",
        },
      },
      {
        $unwind: "$userData",
      },
      {
        $lookup: {
          from: "departments",
          localField: "details.designation",
          foreignField: "_id",
          as: "designation",
        },
      },
    ];

    if (data.search) {
      const searchRegex = new RegExp(data.search.trim(), "i");
      pipeline.push({
        $match: {
          $or: [
            { "userData.username": { $regex: searchRegex } },
            { "userData.code": { $regex: searchRegex } },
          ],
        },
      });
    }

    const documentPipeline: any = [
      ...pipeline,
      { $sort: { createdAt: -1 } },
      { $skip: (data.page - 1) * data.limit },
      { $limit: Number(data.limit) },
    ];

    const [resultData, countDocuments]: any = await Promise.all([
      companyDetails.aggregate(documentPipeline),
      companyDetails.aggregate([
        ...pipeline,
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalCounts = countDocuments.length > 0 ? countDocuments[0].count : 0;

    return {
      status: "success",
      data: resultData,
      totalPages: Math.ceil(totalCounts / data.limit),
    };
  } catch (err) {
    return {
      status: "error",
      data: err,
    };
  }
};

const getManagerUsersCounts = async (data: any) => {
  try {
    let matchConditions: any = {
      is_active: true,
      deletedAt: { $exists: false },
      company: { $in: data.company },
    };

    const pipeline: any = [
      {
        $match: matchConditions,
      },
      {
        $addFields: {
          details: { $arrayElemAt: ["$details", -1] },
        },
      },
      {
        $unwind: "$details.managers",
      },
      {
        $group: {
          _id: "$details.managers",
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "managerDetails",
        },
      },
      {
        $unwind: "$managerDetails",
      },
      {
        $addFields: {
          title: {
            $concat: [
              "$managerDetails.name",
              " ",
              "(",
              "$managerDetails.code",
              ")",
            ],
          },
        },
      },
      {
        $project: {
          managerDetails: 0,
        },
      },
    ];

    const resultData = await companyDetails.aggregate(pipeline).exec();

    return {
      status: "success",
      data: resultData,
    };
  } catch (err) {
    return {
      status: "error",
      data: err,
    };
  }
};

export const getUserInfoWithManagers = async (data: any) => {
  try {
    const matchCriteria: any = {};

    if (data.username) {
      matchCriteria.username = { $regex: data.username, $options: "i" };
    }

    if (data.code) {
      matchCriteria.code = data.code;
    }

    const pipeline: any = [
      {
        $match: matchCriteria,
      },
      {
        $lookup: {
          from: "profiledetails",
          localField: "_id",
          foreignField: "user",
          as: "profileDetails",
        },
      },
      {
        $unwind: "$profileDetails",
      },
      {
        $lookup: {
          from: "companydetails",
          localField: "companyDetail",
          foreignField: "_id",
          as: "company",
        },
      },
      {
        $unwind: "$company",
      },
      {
        $addFields: {
          company_details: { $arrayElemAt: ["$company.details", -1] },
        },
      },
      {
        $lookup: {
          from: "departments",
          localField: "company_details.designation",
          foreignField: "_id",
          as: "designation",
        },
      },
      {
        $lookup: {
          from: "departmentcategories",
          localField: "company_details.department",
          foreignField: "_id",
          as: "departmentCategory",
        },
      },
      {
        $project: {
          password: 0,
          company: 0,
        },
      },
    ];

    if (data.bloodGroup) {
      pipeline.splice(3, 0, {
        $match: { "profileDetails.bloodGroup": data.bloodGroup },
      });
    }

    if (data.designation) {
      pipeline.push({
        $match: {
          "company_details.designation": new mongoose.Types.ObjectId(
            data.designation
          ),
        },
      });
    }

    if (data.department) {
      pipeline.push({
        $match: {
          "company_details.department": new mongoose.Types.ObjectId(
            data.department
          ),
        },
      });
    }

    const datas = await User.aggregate(pipeline).exec();
    return {
      status: "success",
      data: datas,
    };
  } catch (err: any) {
    return {
      status: "error",
      data: err?.message || "An error occurred",
    };
  }
};

export const getUserInfoWithManagersAction = async (data: any) => {
  try {
    const page = data.page;
    const limit = data.limit;
    const skip = (page - 1) * limit;

    const pipeline: any = [
      {
        $match: {
          _id: data.userId,
        },
      },
      {
        $lookup: {
          from: "profiledetails",
          localField: "_id",
          foreignField: "user",
          as: "profiledetails",
        },
      },
      {
        $lookup: {
          from: "companydetails",
          localField: "companyDetail",
          foreignField: "_id",
          as: "companydetail",
        },
      },
      {
        $unwind: "$companydetail",
      },
      {
        $addFields: {
          companydetail: { $arrayElemAt: ["$companydetail.details", -1] },
        },
      },
      {
        $unwind: "$companydetail.managers",
      },
      {
        $lookup: {
          from: "departments",
          localField: "companydetail.designation",
          foreignField: "_id",
          as: "designation",
        },
      },
      {
        $lookup: {
          from: "departmentcategories",
          localField: "companydetail.department",
          foreignField: "_id",
          as: "department",
        },
      },
      {
        $lookup: {
          from: "users",
          let: { managerId: "$companydetail.managers" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$managerId"],
                },
              },
            },
            {
              $project: {
                name: 1,
                username: 1,
                code: 1,
                title: 1,
                pic: 1,
              },
            },
          ],
          as: "managerDetails",
        },
      },
      {
        $project: {
          name: 1,
          username: 1,
          code: 1,
          title: 1,
          pic: 1,
          "designation.title": 1,
          "department.title": 1,
          profiledetails: 1,
          managerDetails: 1,
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    const userPipeline: any = [
      {
        $lookup: {
          from: "companydetails",
          localField: "companyDetail",
          foreignField: "_id",
          as: "companydetail",
        },
      },
      {
        $unwind: "$companydetail",
      },
      {
        $addFields: {
          companydetail: { $arrayElemAt: ["$companydetail.details", -1] },
        },
      },
      {
        $match: {
          "companydetail.managers": { $elemMatch: { $eq: data.userId } },
        },
      },
      {
        $lookup: {
          from: "departmentcategories",
          localField: "companydetail.department",
          foreignField: "_id",
          as: "companydetail.department",
        },
      },
      {
        $lookup: {
          from: "departments",
          localField: "companydetail.designation",
          foreignField: "_id",
          as: "companydetail.designation",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      {
        $unwind: "$userDetails",
      },
      {
        $project: {
          "userDetails.name": 1,
          "userDetails.pic": 1,
          "userDetails.username": 1,
          "userDetails.code": 1,
          "userDetails.title": 1,
          "companydetail.designation": 1,
          "companydetail.department": 1,
          "companydetail.doj": 1,
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    const [userDetails, users] = await Promise.all([
      User.aggregate(pipeline),
      User.aggregate(userPipeline),
    ]);

    if (users.length && userDetails.length) {
      return {
        status: "success",
        data: { userDetails, users, page, limit },
      };
    } else {
      return {
        status: "error",
        data: "User does not exists",
      };
    }
  } catch (err: any) {
    return {
      status: "error",
      data: err?.message || "An error occurred",
    };
  }
};

// get the managers of the particular users
const getManagersOfUser = async (data: any) => {
  try {
    const pipeline = [
      {
        $match: { _id: data.user },
      },
      {
        $lookup: {
          from: "companydetails",
          localField: "companyDetail",
          foreignField: "_id",
          as: "companydetail",
        },
      },
      {
        $unwind: "$companydetail",
      },
      {
        $project: {
          managers: {
            $arrayElemAt: ["$companydetail.details.managers", -1],
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "managers",
          foreignField: "_id",
          as: "managerDetails",
        },
      },
      {
        $project: {
          managers: {
            $map: {
              input: "$managerDetails",
              as: "manager",
              in: {
                _id: "$$manager._id",
                username: "$$manager.username",
              },
            },
          },
        },
      },
    ];

    const managers = await User.aggregate(pipeline);
    return {
      status: "success",
      data: managers,
    };
  } catch (err: any) {
    return {
      status: "error",
      message: err?.message || "An unknown error occurred",
    };
  }
};

export const getRoleCountOfCompany = async (data: any) => {
  try {
    const { company } = data;

    const pipeline: any = [];

    pipeline.push({
      $match: {
        deletedAt: { $exists: false },
      },
    });

    pipeline.push({
      $lookup: {
        from: "companydetails",
        localField: "companyDetail",
        foreignField: "_id",
        as: "companydetail",
      },
    });

    pipeline.push({
      $unwind: "$companydetail",
    });

    pipeline.push({
      $match: {
        "companydetail.company": company,
      },
    });

    pipeline.push({
      $project: {
        lastDetail: {
          $arrayElemAt: ["$companydetail.details", -1],
        },
      },
    });

    pipeline.push({
      $group: {
        _id: "$lastDetail.eType",
        count: { $sum: 1 },
      },
    });

    const result = await User.aggregate(pipeline);
    return {
      status: "success",
      data: result,
      message: "Retrieved Role Counts Successfully",
      statusCode: 200,
    };
  } catch (err: any) {
    return createCatchError(err);
  }
};

const getCompanyDetailsById = async (data: any) => {
  try {
    const pipeline: any = [
      {
        $match: {
          _id: data.id,
          deletedAt: { $exists: false },
        },
      },
      {
        $lookup: {
          from: "companydetails",
          localField: "_id",
          foreignField: "user",
          as: "companydetails",
        },
      },
      {
        $unwind: {
          path: "$companydetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: "$companydetails.details",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "departments",
          localField: "companydetails.details.designation",
          foreignField: "_id",
          as: "designationDetails",
        },
      },
      {
        $lookup: {
          from: "departmentcategories",
          localField: "companydetails.details.department",
          foreignField: "_id",
          as: "departmentDetails",
        },
      },
      {
        $lookup: {
          from: "users",
          let: { managerIds: "$companydetails.details.managers" },
          pipeline: [
            { $match: { $expr: { $in: ["$_id", "$$managerIds"] } } },
            { $project: { username: 1, code: 1, _id: 1 } },
          ],
          as: "managerDetails",
        },
      },
      {
        $lookup: {
          from: "companypolicies",
          localField: "companydetails.company",
          foreignField: "company",
          as: "companyPolicy",
        },
      },
      {
        $unwind: {
          path: "$companyPolicy",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          "companydetails.details.designationDetails": {
            $arrayElemAt: ["$designationDetails", 0],
          },
          "companydetails.details.departmentDetails": {
            $arrayElemAt: ["$departmentDetails", 0],
          },
          "companydetails.details.managerDetails": "$managerDetails",
          "companydetails.details.workLocationDetails": {
            $map: {
              input: "$companydetails.details.workingLocation",
              as: "locId",
              in: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$companyPolicy.workLocations",
                      as: "workLoc",
                      cond: { $eq: ["$$workLoc._id", "$$locId"] },
                    },
                  },
                  0,
                ],
              },
            },
          },
          "companydetails.details.workTimingDetails": {
            $map: {
              input: "$companydetails.details.workTiming",
              as: "timeId",
              in: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$companyPolicy.workTiming",
                      as: "workTime",
                      cond: { $eq: ["$$workTime._id", "$$timeId"] },
                    },
                  },
                  0,
                ],
              },
            },
          },
        },
      },
      {
        $group: {
          _id: {
            userId: "$_id",
            detailId: "$companydetails.details._id",
          },
          profileDetails: { $first: "$profiledetails" },
          companydetails: { $first: "$companydetails" },
          bankDetails: { $first: "$bankDetails" },
          details: {
            $push: {
              _id: "$companydetails.details._id",
              doj: "$companydetails.details.doj",
              confirmationDate: "$companydetails.details.confirmationDate",
              managers: "$companydetails.details.managerDetails",
              department: "$companydetails.details.departmentDetails",
              designation: "$companydetails.details.designationDetails",
              workingLocation: "$companydetails.details.workLocationDetails",
              eType: "$companydetails.details.eType",
              description: "$companydetails.details.description",
              workTiming: "$companydetails.details.workTimingDetails",
              createdAt: "$companydetails.details.createdAt",
            },
          },
        },
      },
      {
        $group: {
          _id: "$_id.userId",
          companydetails: { $first: "$companydetails" },
          details: { $first: "$details" },
        },
      },
      {
        $unwind: "$details",
      },
      {
        $replaceRoot: {
          newRoot: {
            _id: "$_id",
            profileDetails: "$profileDetails",
            companydetails: "$companydetails",
            bankDetails: "$bankDetails",
            details: "$details",
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          details: { $push: "$details" },
        },
      },
    ];

    const result = await User.aggregate(pipeline);
    if (result.length) {
      return {
        data: result[0],
        message: "Retrived User Details",
        statusCode: 200,
        status: "success",
      };
    } else {
      return {
        data: "User does not exists",
        message: "User does not exists",
        statusCode: 300,
        status: "error",
      };
    }
  } catch (err: any) {
    return createCatchError(err);
  }
};

export {
  createUser,
  updateUserProfileDetails,
  getCompanyDetailsById,
  getUsers,
  getUserById,
  getCompanyDetailsByUserId,
  getCountDesignationStatus,
  getTotalUsers,
  updateBankDetails,
  updateFamilyDetails,
  updateQualificationDetails,
  updateWorkExperienceDetails,
  updateDocumentDetails,
  updateCompanyDetails,
  updatePermissions,
  getManagerUsersCounts,
  getManagersOfUser,
};
