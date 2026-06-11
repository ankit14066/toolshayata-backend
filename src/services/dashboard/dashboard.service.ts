import { Response } from "express";
import mongoose from "mongoose";
import BlogModel from "../../schemas/Blog/BlogSchema";
import contactSchema from "../../schemas/contact/contact.schema";
import Testimonial from "../../schemas/Testimonial";
import UserModel from "../../schemas/User/User";

export const getDashboardData = async (req: any, res: Response, next: any) => {
  try {
    const companyId = new mongoose.Types.ObjectId(req.body.company);
    console.log(req.body.company)

    const countActiveDocuments = async (model: any) => {
      const result = await model.aggregate([
        { $match: { } },
        { $count: "count" }
      ]);
      return result.length > 0 ? result[0].count : 0;
    };

    // Fetch counts for each collection in parallel
    const [blogCount, contactCount, testimonialCount, userCount] = await Promise.all([
      countActiveDocuments(BlogModel),
      countActiveDocuments(contactSchema),
      countActiveDocuments(Testimonial),
      countActiveDocuments(UserModel),
    ]);

    return res.status(200).send({
      message: "Dashboard data fetched successfully",
      status: true,
      data: {
        blogs: blogCount,
        contacts: contactCount,
        testimonials: testimonialCount,
        users: userCount,
      },
    });
  } catch (err: any) {
    next(err);
  }
};
